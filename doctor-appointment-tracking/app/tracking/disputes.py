"""Dispute email drafting — plain template mail-merge, no AI.

The doctor always reviews a draft before it is sent. See
../../03-reconciliation-and-automation.md section 3.6.
"""

from django.utils import timezone

from .models import Dispute, Reconciliation

RESULT_EXPLANATION = {
    Reconciliation.Result.UNPAID: "no payment has been received for this appointment",
    Reconciliation.Result.UNDERPAID: (
        "the payment received is less than the amount due for the services performed"
    ),
    Reconciliation.Result.NO_SHOW_DOWNCODED: (
        "the payment matches the no-show rate, but the patient attended and a full "
        "exam was completed"
    ),
    Reconciliation.Result.PATIENT_NUMBER_MISMATCH: (
        "the remittance references a patient number that does not exactly match our "
        "records and must be reconciled"
    ),
    Reconciliation.Result.UNMATCHED: (
        "a remittance payment line could not be matched to any appointment"
    ),
}


def build_evidence_summary(appointment):
    """Plain-text bullet list of the proof captured for an appointment."""
    lines = []
    check_in = getattr(appointment, "check_in", None)
    if check_in is not None:
        local = timezone.localtime(check_in.arrival_timestamp)
        lines.append(f"Arrival confirmed at {local:%Y-%m-%d %H:%M}.")
        if check_in.arrival_photo:
            lines.append("Arrival photo on file.")
        if check_in.signature:
            lines.append("Patient check-in signature on file.")
        if check_in.photo_consent:
            lines.append("Patient photo consent recorded.")
    if appointment.wait_minutes is not None:
        lines.append(f"Recorded wait time: {appointment.wait_minutes} minutes.")
    if appointment.exam_duration_minutes is not None:
        lines.append(
            f"Recorded exam duration: {appointment.exam_duration_minutes} minutes."
        )
    exam = getattr(appointment, "exam_record", None)
    if exam is not None:
        lines.append(
            f"Procedures performed: {exam.dbq_count} DBQ(s), {exam.imo_count} IMO(s)."
        )
        if exam.conditions_examined:
            conditions = exam.conditions_examined.strip().rstrip(".")
            lines.append(f"Conditions examined: {conditions}.")
    records = getattr(appointment, "records_intake", None)
    if records is not None and records.document:
        lines.append("Patient medical records on file.")
    if not lines:
        lines.append("No supporting evidence has been captured for this appointment.")
    return "\n".join(f"  - {line}" for line in lines)


def _claim_number(appointment):
    claim = getattr(appointment, "claim", None)
    if claim is not None:
        return claim.submitted_patient_number
    return appointment.patient.canonical_patient_number


def draft_dispute(reconciliation):
    """Create or refresh the Dispute draft for a reconciliation result.

    Existing dispute status (e.g. already Sent) is preserved — only the
    draft text and evidence are refreshed.
    """
    appointment = reconciliation.appointment
    claim_number = _claim_number(appointment)
    dos = f"{timezone.localtime(appointment.scheduled_datetime):%Y-%m-%d}"
    evidence = build_evidence_summary(appointment)
    explanation = RESULT_EXPLANATION.get(
        reconciliation.result, "this payment requires review"
    )

    subject = f"Payment discrepancy - claim #{claim_number}, date of service {dos}"
    body = f"""To {appointment.payer.name},

On {dos}, patient #{claim_number} attended a scheduled exam at our office.
Our records for this appointment show:

{evidence}

  Expected reimbursement: ${reconciliation.expected_amount}
  Amount paid:            ${reconciliation.paid_amount}
  Outstanding:            ${reconciliation.variance}

Reason for this dispute: {explanation}.

We request a review and correction of this payment. Full supporting
documentation - arrival photo, timestamps, and exam records - is available
on request.

[Practice name / billing contact]
"""

    dispute = Dispute.objects.filter(reconciliation=reconciliation).first()
    if dispute is None:
        dispute = Dispute(
            reconciliation=reconciliation, status=Dispute.Status.DRAFTED
        )
    dispute.draft_subject = subject
    dispute.draft_email_body = body
    dispute.evidence_summary = evidence
    dispute.save()
    return dispute
