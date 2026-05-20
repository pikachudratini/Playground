"""The reconciliation engine — deterministic, no AI.

Compares what an appointment should have been paid against what a payer
actually paid, and classifies the result. See ../../03-reconciliation-and-automation.md.
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .matching import find_number_match
from .models import (
    Appointment,
    Claim,
    FeeSchedule,
    Reconciliation,
    RemittanceLine,
)

ZERO = Decimal("0.00")
NO_SHOW_TOLERANCE = Decimal("0.01")


def fee_for(payer, item_type):
    """Look up a single fee-schedule rate; ZERO if not configured."""
    row = FeeSchedule.objects.filter(payer=payer, item_type=item_type).first()
    return row.fee if row else ZERO


def no_show_fee_for(payer):
    """The payer's no-show rate, or None if not configured."""
    row = FeeSchedule.objects.filter(
        payer=payer, item_type=FeeSchedule.ItemType.NO_SHOW
    ).first()
    return row.fee if row else None


def expected_amount_for(appointment):
    """What the appointment should have been reimbursed.

    Prefers the sum of exam-item fees; falls back to the claim's stated
    expected amount.
    """
    exam = getattr(appointment, "exam_record", None)
    if exam is not None:
        total = sum((item.expected_fee for item in exam.items.all()), ZERO)
        if total > 0:
            return total
    claim = getattr(appointment, "claim", None)
    if claim is not None and claim.expected_amount > 0:
        return claim.expected_amount
    return ZERO


def reconcile_appointment(appointment, paid_amount, *, mismatch=False, note="", draft=True):
    """Classify one appointment's payment and store a Reconciliation.

    Returns the Reconciliation. When the result needs a dispute and
    ``draft`` is true, a Dispute draft is created/updated automatically.
    """
    expected = expected_amount_for(appointment)
    paid = Decimal(paid_amount or 0)

    if mismatch:
        result = Reconciliation.Result.PATIENT_NUMBER_MISMATCH
    elif paid <= ZERO:
        result = Reconciliation.Result.UNPAID
    else:
        no_show = no_show_fee_for(appointment.payer)
        is_downcoded = (
            no_show is not None
            and abs(paid - no_show) <= NO_SHOW_TOLERANCE
            and appointment.has_completed_exam
            and expected > no_show
        )
        if is_downcoded:
            result = Reconciliation.Result.NO_SHOW_DOWNCODED
        elif paid == expected:
            result = Reconciliation.Result.MATCHED
        elif paid > expected:
            result = Reconciliation.Result.OVERPAID
        else:
            result = Reconciliation.Result.UNDERPAID

    reconciliation, _ = Reconciliation.objects.update_or_create(
        appointment=appointment,
        defaults={
            "expected_amount": expected,
            "paid_amount": paid,
            "variance": expected - paid,
            "result": result,
            "note": note,
        },
    )

    if draft and reconciliation.needs_dispute:
        from .disputes import draft_dispute

        draft_dispute(reconciliation)

    return reconciliation


def reconcile_line(line):
    """Match a single remittance line to an appointment and reconcile it.

    Returns the Reconciliation, or None if the line cannot be matched.
    """
    remittance = line.remittance

    # Already confirmed by staff or matched on a previous run.
    if line.matched_appointment_id:
        if line.match_status != RemittanceLine.MatchStatus.EXACT:
            line.match_status = RemittanceLine.MatchStatus.CONFIRMED
            line.save(update_fields=["match_status"])
        return reconcile_appointment(line.matched_appointment, line.amount_paid)

    # Exact match on the patient number keyed onto the claim.
    claim = (
        Claim.objects.filter(
            appointment__payer=remittance.payer,
            submitted_patient_number=line.patient_number_on_eft,
        )
        .select_related("appointment")
        .first()
    )
    if claim:
        line.matched_appointment = claim.appointment
        line.match_status = RemittanceLine.MatchStatus.EXACT
        line.save(update_fields=["matched_appointment", "match_status"])
        return reconcile_appointment(claim.appointment, line.amount_paid)

    # Fuzzy match — flag for human confirmation, never auto-applied.
    candidate_claims = Claim.objects.filter(
        appointment__payer=remittance.payer
    ).select_related("appointment")
    candidates = {c.submitted_patient_number: c for c in candidate_claims}
    suggestion = find_number_match(line.patient_number_on_eft, candidates)
    if suggestion is not None:
        line.suggested_appointment = suggestion.appointment
        line.match_status = RemittanceLine.MatchStatus.FUZZY_SUGGESTED
        line.save(update_fields=["suggested_appointment", "match_status"])
        note = (
            f"EFT patient #{line.patient_number_on_eft} has no exact match. "
            f"Closest claim is #{suggestion.submitted_patient_number} "
            f"({suggestion.appointment}). A staff member must confirm before "
            f"this is treated as paid."
        )
        return reconcile_appointment(
            suggestion.appointment, line.amount_paid, mismatch=True, note=note
        )

    # No match at all.
    line.match_status = RemittanceLine.MatchStatus.UNMATCHED
    line.save(update_fields=["match_status"])
    return None


def reconcile_remittance(remittance):
    """Reconcile every line of a remittance. Returns the list of results."""
    return [reconcile_line(line) for line in remittance.lines.all()]


def confirm_line_match(line):
    """Apply a staff-confirmed fuzzy suggestion and re-reconcile cleanly."""
    if line.suggested_appointment_id and not line.matched_appointment_id:
        line.matched_appointment = line.suggested_appointment
        line.match_status = RemittanceLine.MatchStatus.CONFIRMED
        line.save(update_fields=["matched_appointment", "match_status"])
    return reconcile_appointment(line.matched_appointment, line.amount_paid)


def _overdue_query(days, now):
    cutoff = (now or timezone.now()).date() - timedelta(days=days)
    return (
        Appointment.objects.filter(
            status=Appointment.Status.CLAIM_SUBMITTED,
            claim__submitted_date__lte=cutoff,
        )
        .select_related("claim", "payer", "patient")
    )


def early_warning_claims(now=None):
    """Submitted claims past the early-warning window with no payment yet.

    Read-only — surfaces claims sooner without flagging them as unpaid.
    """
    out = []
    for appt in _overdue_query(settings.EARLY_WARNING_DAYS, now):
        rec = getattr(appt, "reconciliation", None)
        if rec and rec.paid_amount > ZERO:
            continue
        out.append(appt)
    return out


def flag_overdue_claims(now=None):
    """Flag submitted claims past the overdue window as Unpaid.

    Skips claims that are already matched or already have a recorded
    payment. Returns the list of Reconciliations created/updated.
    """
    flagged = []
    for appt in _overdue_query(settings.OVERDUE_CLAIM_DAYS, now):
        rec = getattr(appt, "reconciliation", None)
        if rec and rec.result == Reconciliation.Result.MATCHED:
            continue
        if rec and rec.paid_amount > ZERO:
            continue
        flagged.append(
            reconcile_appointment(
                appt,
                ZERO,
                note=(
                    f"Auto-flagged: claim submitted {appt.claim.submitted_date} "
                    f"is more than {settings.OVERDUE_CLAIM_DAYS} days old with no "
                    f"payment recorded."
                ),
            )
        )
    return flagged
