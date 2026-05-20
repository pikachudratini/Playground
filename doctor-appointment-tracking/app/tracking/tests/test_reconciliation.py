from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from tracking import models
from tracking.reconciliation import (
    confirm_line_match,
    flag_overdue_claims,
    reconcile_remittance,
)

Result = models.Reconciliation.Result
MatchStatus = models.RemittanceLine.MatchStatus


class ReconciliationEngineTests(TestCase):
    def setUp(self):
        self.payer = models.Payer.objects.create(name="Test Payer")
        models.FeeSchedule.objects.create(
            payer=self.payer,
            item_type=models.FeeSchedule.ItemType.DBQ,
            fee=Decimal("350.00"),
        )
        models.FeeSchedule.objects.create(
            payer=self.payer,
            item_type=models.FeeSchedule.ItemType.NO_SHOW,
            fee=Decimal("75.00"),
        )

    def _appointment(self, number, dbqs=2, days_ago=130, submitted=None):
        patient = models.Patient.objects.create(
            full_name=f"Patient {number}", canonical_patient_number=number
        )
        scheduled = timezone.now() - timedelta(days=days_ago)
        appointment = models.Appointment.objects.create(
            patient=patient,
            payer=self.payer,
            scheduled_datetime=scheduled,
            status=models.Appointment.Status.CLAIM_SUBMITTED,
            arrived_at=scheduled,
            exam_started_at=scheduled + timedelta(minutes=20),
            exam_ended_at=scheduled + timedelta(minutes=60),
        )
        exam = models.ExamRecord.objects.create(appointment=appointment)
        for i in range(dbqs):
            models.ExamItem.objects.create(
                exam_record=exam,
                item_type=models.ExamItem.ItemType.DBQ,
                description=f"DBQ {i}",
                expected_fee=Decimal("350.00"),
            )
        models.Claim.objects.create(
            appointment=appointment,
            submitted_date=scheduled.date(),
            submitted_patient_number=submitted or number,
            expected_amount=Decimal("350.00") * dbqs,
        )
        return appointment

    def _remittance(self, lines):
        remittance = models.Remittance.objects.create(
            payer=self.payer, received_date=timezone.localdate()
        )
        for number, amount in lines:
            models.RemittanceLine.objects.create(
                remittance=remittance,
                patient_number_on_eft=number,
                amount_paid=Decimal(amount),
            )
        return remittance

    def _result(self, appointment):
        return models.Reconciliation.objects.get(appointment=appointment).result

    def test_matched(self):
        appointment = self._appointment("200001", dbqs=2)
        reconcile_remittance(self._remittance([("200001", "700.00")]))
        self.assertEqual(self._result(appointment), Result.MATCHED)

    def test_underpaid_with_variance(self):
        appointment = self._appointment("200002", dbqs=2)
        reconcile_remittance(self._remittance([("200002", "350.00")]))
        reconciliation = models.Reconciliation.objects.get(appointment=appointment)
        self.assertEqual(reconciliation.result, Result.UNDERPAID)
        self.assertEqual(reconciliation.variance, Decimal("350.00"))

    def test_no_show_downcoded(self):
        appointment = self._appointment("200003", dbqs=3)
        reconcile_remittance(self._remittance([("200003", "75.00")]))
        self.assertEqual(self._result(appointment), Result.NO_SHOW_DOWNCODED)

    def test_overpaid(self):
        appointment = self._appointment("200010", dbqs=2)
        reconcile_remittance(self._remittance([("200010", "900.00")]))
        self.assertEqual(self._result(appointment), Result.OVERPAID)

    def test_patient_number_mismatch_is_flagged_not_applied(self):
        appointment = self._appointment("200004", dbqs=2, submitted="200004")
        reconcile_remittance(self._remittance([("200040", "700.00")]))
        self.assertEqual(self._result(appointment), Result.PATIENT_NUMBER_MISMATCH)
        line = models.RemittanceLine.objects.get(patient_number_on_eft="200040")
        self.assertEqual(line.match_status, MatchStatus.FUZZY_SUGGESTED)
        self.assertEqual(line.suggested_appointment_id, appointment.pk)
        self.assertIsNone(line.matched_appointment_id)

    def test_unmatched_line(self):
        self._appointment("200005", dbqs=2)
        reconcile_remittance(self._remittance([("888888", "700.00")]))
        line = models.RemittanceLine.objects.get(patient_number_on_eft="888888")
        self.assertEqual(line.match_status, MatchStatus.UNMATCHED)

    def test_confirm_fuzzy_match_reconciles_cleanly(self):
        appointment = self._appointment("200009", dbqs=2)
        reconcile_remittance(self._remittance([("200090", "700.00")]))
        line = models.RemittanceLine.objects.get(patient_number_on_eft="200090")
        self.assertEqual(line.match_status, MatchStatus.FUZZY_SUGGESTED)
        confirm_line_match(line)
        line.refresh_from_db()
        self.assertEqual(line.match_status, MatchStatus.CONFIRMED)
        self.assertEqual(self._result(appointment), Result.MATCHED)

    def test_overdue_claim_flagged_unpaid(self):
        appointment = self._appointment("200006", dbqs=2, days_ago=200)
        flagged = flag_overdue_claims()
        self.assertEqual(len(flagged), 1)
        self.assertEqual(self._result(appointment), Result.UNPAID)

    def test_paid_claim_not_reflagged_as_overdue(self):
        appointment = self._appointment("200007", dbqs=2, days_ago=200)
        reconcile_remittance(self._remittance([("200007", "700.00")]))
        flag_overdue_claims()
        self.assertEqual(self._result(appointment), Result.MATCHED)

    def test_dispute_drafted_for_underpaid(self):
        appointment = self._appointment("200008", dbqs=2)
        reconcile_remittance(self._remittance([("200008", "350.00")]))
        reconciliation = models.Reconciliation.objects.get(appointment=appointment)
        self.assertTrue(hasattr(reconciliation, "dispute"))
        self.assertIn("Payment discrepancy", reconciliation.dispute.draft_subject)

    def test_no_dispute_for_matched(self):
        appointment = self._appointment("200011", dbqs=2)
        reconcile_remittance(self._remittance([("200011", "700.00")]))
        reconciliation = models.Reconciliation.objects.get(appointment=appointment)
        self.assertFalse(hasattr(reconciliation, "dispute"))

    def test_audit_log_records_changes(self):
        self._appointment("200012", dbqs=1)
        self.assertTrue(
            models.AuditLog.objects.filter(entity_type="Appointment").exists()
        )
