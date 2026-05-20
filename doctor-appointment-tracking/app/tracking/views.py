"""Views for the appointment tracking system."""

import base64
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_POST

from .forms import (
    AppointmentForm,
    ClaimForm,
    ExamRecordForm,
    PatientForm,
    QAForm,
    RecordsIntakeForm,
    RemittanceForm,
)
from .models import (
    Appointment,
    CheckIn,
    Claim,
    Dispute,
    ExamItem,
    ExamRecord,
    Patient,
    Payer,
    QAQuestionnaire,
    Reconciliation,
    RecordsIntake,
    Remittance,
    RemittanceLine,
)
from .ocr import extract_text, ocr_available
from .reconciliation import (
    confirm_line_match,
    early_warning_claims,
    expected_amount_for,
    fee_for,
    flag_overdue_claims,
    reconcile_remittance,
)


def _decode_data_url(data_url, prefix):
    """Turn a base64 data URL (webcam still / signature) into a file."""
    if not data_url or "," not in data_url:
        return None
    header, encoded = data_url.split(",", 1)
    ext = "jpg" if ("jpeg" in header or "jpg" in header) else "png"
    try:
        raw = base64.b64decode(encoded)
    except (ValueError, TypeError):
        return None
    if not raw:
        return None
    return ContentFile(raw, name=f"{prefix}_{uuid.uuid4().hex}.{ext}")


def _aware(dt):
    if dt and timezone.is_naive(dt):
        return timezone.make_aware(dt)
    return dt


@login_required
def dashboard(request):
    status_counts = {
        row["status"]: row["n"]
        for row in Appointment.objects.values("status").annotate(n=Count("id"))
    }
    status_summary = [
        {"label": label, "count": status_counts.get(value, 0)}
        for value, label in Appointment.Status.choices
    ]

    open_qas = list(
        QAQuestionnaire.objects.exclude(status=QAQuestionnaire.Status.COMPLETED)
        .select_related("appointment__patient")
    )
    overdue_qas = [q for q in open_qas if q.is_overdue]

    needs_attention = Reconciliation.objects.exclude(
        result__in=[Reconciliation.Result.MATCHED, Reconciliation.Result.OVERPAID]
    ).select_related("appointment__patient", "appointment__payer")
    outstanding = needs_attention.aggregate(s=Sum("variance"))["s"] or Decimal("0.00")
    recovered = Dispute.objects.filter(
        status=Dispute.Status.RESOLVED
    ).aggregate(s=Sum("amount_recovered"))["s"] or Decimal("0.00")

    context = {
        "status_summary": status_summary,
        "total_appointments": Appointment.objects.count(),
        "open_qa_count": len(open_qas),
        "overdue_qa_count": len(overdue_qas),
        "qa_worklist": open_qas[:10],
        "disputes_drafted": Dispute.objects.filter(
            status=Dispute.Status.DRAFTED
        ).count(),
        "disputes_sent": Dispute.objects.filter(status=Dispute.Status.SENT).count(),
        "needs_attention": needs_attention[:10],
        "needs_attention_count": needs_attention.count(),
        "outstanding": outstanding,
        "recovered": recovered,
        "early_warning_count": len(early_warning_claims()),
    }
    return render(request, "tracking/dashboard.html", context)


@login_required
def appointment_list(request):
    status = request.GET.get("status", "")
    appointments = Appointment.objects.select_related("patient", "payer")
    if status:
        appointments = appointments.filter(status=status)
    return render(
        request,
        "tracking/appointment_list.html",
        {
            "appointments": appointments[:200],
            "status": status,
            "statuses": Appointment.Status.choices,
        },
    )


@login_required
def appointment_detail(request, pk):
    appointment = get_object_or_404(
        Appointment.objects.select_related("patient", "payer"), pk=pk
    )
    reconciliation = getattr(appointment, "reconciliation", None)
    return render(
        request,
        "tracking/appointment_detail.html",
        {
            "appt": appointment,
            "check_in": getattr(appointment, "check_in", None),
            "records": getattr(appointment, "records_intake", None),
            "exam": getattr(appointment, "exam_record", None),
            "claim": getattr(appointment, "claim", None),
            "reconciliation": reconciliation,
            "dispute": getattr(reconciliation, "dispute", None),
            "qas": appointment.qa_questionnaires.all(),
            "Status": Appointment.Status,
        },
    )


@login_required
def check_in(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    if request.method == "POST":
        record, _ = CheckIn.objects.get_or_create(appointment=appointment)
        record.photo_consent = bool(request.POST.get("photo_consent"))
        record.checked_in_by = request.user
        record.arrival_timestamp = timezone.now()
        photo = request.FILES.get("arrival_photo_file") or _decode_data_url(
            request.POST.get("arrival_photo_data"), "arrival"
        )
        if photo:
            record.arrival_photo = photo
        signature = _decode_data_url(request.POST.get("signature_data"), "signature")
        if signature:
            record.signature = signature
        record.save()
        if appointment.status == Appointment.Status.SCHEDULED:
            appointment.status = Appointment.Status.ARRIVED
            appointment.arrived_at = record.arrival_timestamp
            appointment.save(update_fields=["status", "arrived_at"])
        messages.success(request, "Patient checked in.")
        return redirect("appointment_detail", pk=appointment.pk)
    return render(request, "tracking/check_in.html", {"appt": appointment})


@login_required
def log_exam(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    exam = getattr(appointment, "exam_record", None)
    if request.method == "POST":
        form = ExamRecordForm(
            request.POST, instance=exam or ExamRecord(appointment=appointment)
        )
        if form.is_valid():
            exam = form.save(commit=False)
            exam.appointment = appointment
            exam.examiner = request.user
            exam.save()
            exam.items.all().delete()
            types = request.POST.getlist("item_type")
            descriptions = request.POST.getlist("item_description")
            for item_type, description in zip(types, descriptions):
                if not item_type:
                    continue
                ExamItem.objects.create(
                    exam_record=exam,
                    item_type=item_type,
                    description=description.strip(),
                    expected_fee=fee_for(appointment.payer, item_type),
                )
            started = _aware(parse_datetime(request.POST.get("exam_started_at", "")))
            ended = _aware(parse_datetime(request.POST.get("exam_ended_at", "")))
            if started:
                appointment.exam_started_at = started
            if ended:
                appointment.exam_ended_at = ended
            appointment.status = Appointment.Status.COMPLETED
            if not appointment.checked_out_at:
                appointment.checked_out_at = timezone.now()
            appointment.save()
            messages.success(request, "Exam logged.")
            return redirect("appointment_detail", pk=appointment.pk)
    else:
        form = ExamRecordForm(instance=exam)
    now_value = timezone.localtime().strftime("%Y-%m-%dT%H:%M")
    return render(
        request,
        "tracking/log_exam.html",
        {
            "appt": appointment,
            "form": form,
            "exam": exam,
            "now_value": now_value,
            "item_types": ExamItem.ItemType.choices,
        },
    )


@login_required
def submit_claim(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    claim = getattr(appointment, "claim", None)
    if request.method == "POST":
        form = ClaimForm(
            request.POST, instance=claim or Claim(appointment=appointment)
        )
        if form.is_valid():
            claim = form.save(commit=False)
            claim.appointment = appointment
            claim.save()
            if appointment.status in (
                Appointment.Status.ARRIVED,
                Appointment.Status.IN_EXAM,
                Appointment.Status.COMPLETED,
            ):
                appointment.status = Appointment.Status.CLAIM_SUBMITTED
                appointment.save(update_fields=["status"])
            messages.success(request, "Claim recorded.")
            return redirect("appointment_detail", pk=appointment.pk)
    else:
        initial = None
        if claim is None:
            initial = {
                "submitted_date": timezone.localdate(),
                "submitted_patient_number": appointment.patient.canonical_patient_number,
                "expected_amount": expected_amount_for(appointment),
            }
        form = ClaimForm(instance=claim, initial=initial)
    return render(
        request, "tracking/submit_claim.html", {"appt": appointment, "form": form}
    )


@login_required
def disputes_list(request):
    disputes = Dispute.objects.select_related(
        "reconciliation__appointment__patient"
    ).all()
    fuzzy_lines = RemittanceLine.objects.filter(
        match_status=RemittanceLine.MatchStatus.FUZZY_SUGGESTED
    ).select_related("remittance__payer", "suggested_appointment__patient")
    unmatched_lines = RemittanceLine.objects.filter(
        match_status=RemittanceLine.MatchStatus.UNMATCHED
    ).select_related("remittance__payer")
    return render(
        request,
        "tracking/disputes_list.html",
        {
            "drafted": disputes.filter(status=Dispute.Status.DRAFTED),
            "sent": disputes.filter(status=Dispute.Status.SENT),
            "resolved": disputes.filter(status=Dispute.Status.RESOLVED),
            "escalated": disputes.filter(status=Dispute.Status.ESCALATED),
            "fuzzy_lines": fuzzy_lines,
            "unmatched_lines": unmatched_lines,
        },
    )


@login_required
def dispute_detail(request, pk):
    dispute = get_object_or_404(
        Dispute.objects.select_related("reconciliation__appointment__patient"), pk=pk
    )
    return render(
        request,
        "tracking/dispute_detail.html",
        {"dispute": dispute, "appt": dispute.reconciliation.appointment},
    )


@login_required
@require_POST
def dispute_mark(request, pk, action):
    dispute = get_object_or_404(Dispute, pk=pk)
    today = timezone.localdate()
    if action == "sent":
        dispute.status = Dispute.Status.SENT
        dispute.sent_date = today
        dispute.response_due_date = today + timedelta(days=30)
    elif action == "resolved":
        dispute.status = Dispute.Status.RESOLVED
        raw = request.POST.get("amount_recovered", "").strip()
        if raw:
            try:
                dispute.amount_recovered = Decimal(raw)
            except InvalidOperation:
                messages.error(request, "Invalid recovered amount.")
                return redirect("dispute_detail", pk=dispute.pk)
    elif action == "escalated":
        dispute.status = Dispute.Status.ESCALATED
    else:
        messages.error(request, "Unknown action.")
        return redirect("dispute_detail", pk=dispute.pk)
    dispute.save()
    messages.success(request, f"Dispute marked {dispute.get_status_display()}.")
    return redirect("dispute_detail", pk=dispute.pk)


@login_required
@require_POST
def confirm_line(request, pk):
    line = get_object_or_404(RemittanceLine, pk=pk)
    confirm_line_match(line)
    messages.success(request, "Match confirmed and re-reconciled.")
    return redirect("disputes")


@login_required
@require_POST
def reconcile_all(request):
    remittances = Remittance.objects.all()
    for remittance in remittances:
        reconcile_remittance(remittance)
    overdue = flag_overdue_claims()
    messages.success(
        request,
        f"Reconciled {remittances.count()} remittance(s); "
        f"flagged {len(overdue)} overdue claim(s).",
    )
    return redirect("dashboard")


@login_required
def patient_create(request):
    if request.method == "POST":
        form = PatientForm(request.POST)
        if form.is_valid():
            patient = form.save()
            messages.success(request, "Patient record created.")
            return redirect(f"{reverse('appointment_create')}?patient={patient.pk}")
    else:
        form = PatientForm()
    return render(request, "tracking/patient_form.html", {"form": form})


@login_required
def appointment_create(request):
    if request.method == "POST":
        form = AppointmentForm(request.POST)
        if form.is_valid():
            appointment = form.save()
            messages.success(request, "Appointment created.")
            return redirect("appointment_detail", pk=appointment.pk)
    else:
        initial = {}
        patient_id = request.GET.get("patient")
        if patient_id:
            initial["patient"] = patient_id
        form = AppointmentForm(initial=initial)
    return render(
        request,
        "tracking/appointment_form.html",
        {"form": form, "has_patients": Patient.objects.exists()},
    )


@login_required
def records_upload(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    intake = getattr(appointment, "records_intake", None)
    if request.method == "POST":
        form = RecordsIntakeForm(
            request.POST,
            request.FILES,
            instance=intake or RecordsIntake(appointment=appointment),
        )
        if form.is_valid():
            intake = form.save(commit=False)
            intake.appointment = appointment
            intake.save()
            text, status = extract_text(intake.document)
            intake.ocr_text = text
            intake.extraction_status = status
            intake.save(update_fields=["ocr_text", "extraction_status"])
            messages.success(
                request,
                f"Records uploaded. OCR: {intake.get_extraction_status_display()}.",
            )
            return redirect("appointment_detail", pk=appointment.pk)
    else:
        form = RecordsIntakeForm(instance=intake)
    return render(
        request,
        "tracking/records_upload.html",
        {
            "appt": appointment,
            "form": form,
            "intake": intake,
            "ocr_available": ocr_available(),
        },
    )


@login_required
def qa_create(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    if request.method == "POST":
        form = QAForm(request.POST)
        if form.is_valid():
            qa = form.save(commit=False)
            qa.appointment = appointment
            qa.save()
            messages.success(request, "QA questionnaire added.")
            return redirect("appointment_detail", pk=appointment.pk)
    else:
        form = QAForm(initial={"received_date": timezone.localdate()})
    return render(
        request, "tracking/qa_form.html", {"appt": appointment, "form": form}
    )


@login_required
def remittance_create(request):
    if request.method == "POST":
        form = RemittanceForm(request.POST, request.FILES)
        if form.is_valid():
            remittance = form.save(commit=False)
            numbers = request.POST.getlist("line_number")
            amounts = request.POST.getlist("line_amount")
            parsed = []
            total = Decimal("0.00")
            for number, amount in zip(numbers, amounts):
                number, amount = number.strip(), amount.strip()
                if not number or not amount:
                    continue
                try:
                    value = Decimal(amount)
                except InvalidOperation:
                    continue
                parsed.append((number, value))
                total += value
            remittance.total_amount = total
            remittance.save()
            for number, value in parsed:
                RemittanceLine.objects.create(
                    remittance=remittance,
                    patient_number_on_eft=number,
                    amount_paid=value,
                )
            reconcile_remittance(remittance)
            messages.success(
                request,
                f"Remittance saved with {len(parsed)} line(s) and reconciled.",
            )
            return redirect("disputes")
    else:
        form = RemittanceForm(initial={"received_date": timezone.localdate()})
    return render(request, "tracking/remittance_form.html", {"form": form})


@login_required
def reports(request):
    reconciliations = Reconciliation.objects.all()
    by_result = []
    for value, label in Reconciliation.Result.choices:
        subset = reconciliations.filter(result=value)
        by_result.append(
            {
                "label": label,
                "count": subset.count(),
                "variance": subset.aggregate(s=Sum("variance"))["s"]
                or Decimal("0.00"),
            }
        )
    total_expected = reconciliations.aggregate(s=Sum("expected_amount"))["s"] or Decimal(
        "0.00"
    )
    total_paid = reconciliations.aggregate(s=Sum("paid_amount"))["s"] or Decimal("0.00")
    outstanding = reconciliations.exclude(
        result__in=[Reconciliation.Result.MATCHED, Reconciliation.Result.OVERPAID]
    ).aggregate(s=Sum("variance"))["s"] or Decimal("0.00")
    recovered = Dispute.objects.filter(
        status=Dispute.Status.RESOLVED
    ).aggregate(s=Sum("amount_recovered"))["s"] or Decimal("0.00")

    qas = list(QAQuestionnaire.objects.all())
    qa_completed = sum(
        1 for q in qas if q.status == QAQuestionnaire.Status.COMPLETED
    )
    qa_overdue = sum(1 for q in qas if q.is_overdue)

    waits = [
        a.wait_minutes
        for a in Appointment.objects.all()
        if a.wait_minutes is not None
    ]
    durations = [
        a.exam_duration_minutes
        for a in Appointment.objects.all()
        if a.exam_duration_minutes is not None
    ]

    payer_rows = []
    for payer in Payer.objects.all():
        subset = reconciliations.filter(appointment__payer=payer)
        payer_rows.append(
            {
                "payer": payer.name,
                "expected": subset.aggregate(s=Sum("expected_amount"))["s"]
                or Decimal("0.00"),
                "paid": subset.aggregate(s=Sum("paid_amount"))["s"]
                or Decimal("0.00"),
            }
        )

    return render(
        request,
        "tracking/reports.html",
        {
            "by_result": by_result,
            "total_expected": total_expected,
            "total_paid": total_paid,
            "outstanding": outstanding,
            "recovered": recovered,
            "reconciled_count": reconciliations.count(),
            "qa_total": len(qas),
            "qa_completed": qa_completed,
            "qa_overdue": qa_overdue,
            "avg_wait": round(sum(waits) / len(waits)) if waits else None,
            "avg_duration": round(sum(durations) / len(durations))
            if durations
            else None,
            "payer_rows": payer_rows,
        },
    )
