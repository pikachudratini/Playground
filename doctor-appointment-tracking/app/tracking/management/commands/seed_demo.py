"""Populate the database with demonstration data.

Creates one payer, a fee schedule, staff logins, and a spread of
appointments that exercise every reconciliation outcome. Safe to re-run:
existing tracking data is cleared first.

    python manage.py seed_demo
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from tracking import models
from tracking.reconciliation import fee_for, flag_overdue_claims, reconcile_remittance

DEMO_PASSWORD = "ChangeMe!2026"
DEMO_USERS = ["admin", "frontdesk", "examiner", "doctor"]


class Command(BaseCommand):
    help = "Load demonstration data (clears existing tracking data first)."

    def handle(self, *args, **options):
        User = get_user_model()

        # --- clear previous demo data -----------------------------------
        for model in (
            models.Dispute,
            models.Reconciliation,
            models.RemittanceLine,
            models.Remittance,
            models.QAQuestionnaire,
            models.Claim,
            models.ExamItem,
            models.ExamRecord,
            models.RecordsIntake,
            models.CheckIn,
            models.Appointment,
            models.FeeSchedule,
            models.Patient,
            models.Payer,
            models.AuditLog,
        ):
            model.objects.all().delete()
        User.objects.filter(username__in=DEMO_USERS).delete()

        # --- staff logins -----------------------------------------------
        admin = User.objects.create_superuser(
            username="admin", password=DEMO_PASSWORD, role=User.Role.ADMIN
        )
        User.objects.create_user(
            username="frontdesk",
            password=DEMO_PASSWORD,
            first_name="Front",
            last_name="Desk",
            role=User.Role.FRONT_DESK,
            is_staff=True,
        )
        examiner = User.objects.create_user(
            username="examiner",
            password=DEMO_PASSWORD,
            first_name="Eva",
            last_name="Examiner",
            role=User.Role.EXAMINER,
            is_staff=True,
        )
        User.objects.create_user(
            username="doctor",
            password=DEMO_PASSWORD,
            first_name="Dana",
            last_name="Doctor",
            role=User.Role.DOCTOR,
            is_staff=True,
        )

        # --- payer + fee schedule ---------------------------------------
        payer = models.Payer.objects.create(name="Veterans Exam Services")
        fees = {
            models.FeeSchedule.ItemType.DBQ: Decimal("350.00"),
            models.FeeSchedule.ItemType.IMO: Decimal("500.00"),
            models.FeeSchedule.ItemType.EXAM: Decimal("300.00"),
            models.FeeSchedule.ItemType.NO_SHOW: Decimal("75.00"),
        }
        for item_type, fee in fees.items():
            models.FeeSchedule.objects.create(
                payer=payer, item_type=item_type, fee=fee
            )

        now = timezone.now()
        today = timezone.localdate()

        def make_completed(name, number, days_ago, items, submitted_number=None):
            """Create a fully-worked, claim-submitted appointment."""
            patient = models.Patient.objects.create(
                full_name=name,
                canonical_patient_number=number,
                contact_info="555-0100",
            )
            scheduled = now - timedelta(days=days_ago)
            appt = models.Appointment.objects.create(
                patient=patient,
                payer=payer,
                scheduled_datetime=scheduled,
                exam_type="Disability exam",
                status=models.Appointment.Status.CLAIM_SUBMITTED,
                arrived_at=scheduled,
                exam_started_at=scheduled + timedelta(minutes=25),
                exam_ended_at=scheduled + timedelta(minutes=65),
                checked_out_at=scheduled + timedelta(minutes=70),
            )
            models.CheckIn.objects.create(
                appointment=appt,
                arrival_timestamp=scheduled,
                photo_consent=True,
                checked_in_by=admin,
            )
            exam = models.ExamRecord.objects.create(
                appointment=appt,
                examiner=examiner,
                conditions_examined="Documented per exam request.",
            )
            total = Decimal("0.00")
            for item_type, description in items:
                fee = fee_for(payer, item_type)
                total += fee
                models.ExamItem.objects.create(
                    exam_record=exam,
                    item_type=item_type,
                    description=description,
                    expected_fee=fee,
                )
            models.Claim.objects.create(
                appointment=appt,
                submitted_date=(scheduled + timedelta(days=2)).date(),
                submitted_patient_number=submitted_number or number,
                services_claimed=", ".join(d for _, d in items),
                expected_amount=total,
            )
            return appt

        DBQ = models.ExamItem.ItemType.DBQ
        IMO = models.ExamItem.ItemType.IMO

        # Scenario appointments (claim submitted, awaiting/with payment).
        a_matched = make_completed(
            "Robert Hayes", "100245", 130, [(DBQ, "Knee DBQ"), (DBQ, "Back DBQ")]
        )
        a_underpaid = make_completed(
            "Maria Lopez", "100246", 135, [(DBQ, "Shoulder DBQ"), (IMO, "Nexus IMO")]
        )
        a_downcoded = make_completed(
            "James Carter",
            "100247",
            128,
            [(DBQ, "PTSD DBQ"), (DBQ, "Hearing DBQ"), (DBQ, "Knee DBQ")],
        )
        a_mismatch = make_completed(
            "Susan Reed",
            "100248",
            132,
            [(DBQ, "Hip DBQ"), (DBQ, "Ankle DBQ")],
            submitted_number="100248",
        )
        make_completed(
            "David Kim", "100250", 150, [(DBQ, "Spine DBQ"), (DBQ, "Wrist DBQ")]
        )

        # Earlier-stage appointments to show the workflow.
        p_scheduled = models.Patient.objects.create(
            full_name="Patricia Gomez", canonical_patient_number="100251"
        )
        models.Appointment.objects.create(
            patient=p_scheduled,
            payer=payer,
            scheduled_datetime=now + timedelta(days=2),
            exam_type="Disability exam",
            status=models.Appointment.Status.SCHEDULED,
        )
        p_arrived = models.Patient.objects.create(
            full_name="Thomas Wright", canonical_patient_number="100252"
        )
        appt_arrived = models.Appointment.objects.create(
            patient=p_arrived,
            payer=payer,
            scheduled_datetime=now,
            exam_type="Disability exam",
            status=models.Appointment.Status.ARRIVED,
            arrived_at=now,
        )
        models.CheckIn.objects.create(
            appointment=appt_arrived,
            arrival_timestamp=now,
            photo_consent=True,
            checked_in_by=admin,
        )

        # --- QA questionnaires ------------------------------------------
        models.QAQuestionnaire.objects.create(
            appointment=a_matched,
            received_date=today - timedelta(days=3),
            deadline=today + timedelta(days=2),
            status=models.QAQuestionnaire.Status.OPEN,
        )
        models.QAQuestionnaire.objects.create(
            appointment=a_downcoded,
            received_date=today - timedelta(days=20),
            deadline=today - timedelta(days=5),
            status=models.QAQuestionnaire.Status.IN_PROGRESS,
        )
        models.QAQuestionnaire.objects.create(
            appointment=a_underpaid,
            received_date=today - timedelta(days=40),
            deadline=today - timedelta(days=20),
            completed_date=today - timedelta(days=25),
            status=models.QAQuestionnaire.Status.COMPLETED,
            time_spent_minutes=180,
        )

        # --- remittance / EFT -------------------------------------------
        remittance = models.Remittance.objects.create(
            payer=payer,
            received_date=today - timedelta(days=2),
            total_amount=Decimal("1875.00"),
        )
        eft_lines = [
            ("100245", "700.00"),   # Robert  -> exact, matched
            ("100246", "350.00"),   # Maria   -> exact, underpaid
            ("100247", "75.00"),    # James   -> exact, no-show downcoded
            ("100284", "350.00"),   # Susan   -> transposed number, mismatch
            ("999999", "400.00"),   # unknown -> unmatched
        ]
        for number, amount in eft_lines:
            models.RemittanceLine.objects.create(
                remittance=remittance,
                patient_number_on_eft=number,
                amount_paid=Decimal(amount),
            )

        # --- run the engine so the dashboard is populated ---------------
        reconcile_remittance(remittance)
        overdue = flag_overdue_claims()

        self.stdout.write(self.style.SUCCESS("Demo data loaded."))
        self.stdout.write(
            f"  Patients: {models.Patient.objects.count()}  "
            f"Appointments: {models.Appointment.objects.count()}  "
            f"Overdue flagged: {len(overdue)}"
        )
        self.stdout.write(
            f"  Logins ({', '.join(DEMO_USERS)}) password: {DEMO_PASSWORD}"
        )
        self.stdout.write(
            self.style.WARNING("  Demo credentials — change before any real use.")
        )
