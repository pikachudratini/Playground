"""Data model for the appointment / payment / QA tracking system.

See ../../02-architecture-and-data-model.md for the design rationale.
Fields marked "PHI" hold protected health information.
"""

from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

ZERO = Decimal("0.00")


class User(AbstractUser):
    """Staff account. One unique login per person (HIPAA access control)."""

    class Role(models.TextChoices):
        FRONT_DESK = "front_desk", "Front desk"
        EXAMINER = "examiner", "Examiner"
        DOCTOR = "doctor", "Doctor"
        ADMIN = "admin", "Administrator"

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.FRONT_DESK
    )

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class Payer(models.Model):
    """The insurer / exam contractor that reimburses the practice."""

    name = models.CharField(max_length=200, unique=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Patient(models.Model):
    full_name = models.CharField(max_length=200)  # PHI
    date_of_birth = models.DateField(null=True, blank=True)  # PHI
    contact_info = models.CharField(max_length=300, blank=True)  # PHI
    canonical_patient_number = models.CharField(
        max_length=50, unique=True, help_text="The office's official number."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} (#{self.canonical_patient_number})"


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        ARRIVED = "arrived", "Arrived"
        IN_EXAM = "in_exam", "In exam"
        COMPLETED = "completed", "Completed"
        CLAIM_SUBMITTED = "claim_submitted", "Claim submitted"
        NO_SHOW = "no_show", "No-show"
        CANCELLED = "cancelled", "Cancelled"

    class FollowUp(models.TextChoices):
        NONE = "none", "None"
        IN_PERSON = "in_person", "In-person"
        TELEHEALTH = "telehealth", "Telehealth"
        PHONE = "phone", "Phone call"

    patient = models.ForeignKey(
        Patient, on_delete=models.PROTECT, related_name="appointments"
    )
    payer = models.ForeignKey(
        Payer, on_delete=models.PROTECT, related_name="appointments"
    )
    scheduled_datetime = models.DateTimeField()
    exam_type = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    arrived_at = models.DateTimeField(null=True, blank=True)
    exam_started_at = models.DateTimeField(null=True, blank=True)
    exam_ended_at = models.DateTimeField(null=True, blank=True)
    checked_out_at = models.DateTimeField(null=True, blank=True)
    follow_up_type = models.CharField(
        max_length=20, choices=FollowUp.choices, default=FollowUp.NONE
    )
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_datetime"]

    def __str__(self):
        return f"{self.patient.full_name} — {self.scheduled_datetime:%Y-%m-%d %H:%M}"

    @property
    def wait_minutes(self):
        if self.arrived_at and self.exam_started_at:
            return round((self.exam_started_at - self.arrived_at).total_seconds() / 60)
        return None

    @property
    def exam_duration_minutes(self):
        if self.exam_started_at and self.exam_ended_at:
            return round(
                (self.exam_ended_at - self.exam_started_at).total_seconds() / 60
            )
        return None

    @property
    def has_completed_exam(self):
        if self.status not in (self.Status.COMPLETED, self.Status.CLAIM_SUBMITTED):
            return False
        exam = getattr(self, "exam_record", None)
        return bool(exam and exam.items.exists())


class CheckIn(models.Model):
    """Proof-of-arrival record: timestamp, photo, signature, consent."""

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="check_in"
    )
    arrival_timestamp = models.DateTimeField(default=timezone.now)
    arrival_photo = models.ImageField(
        upload_to="arrival_photos/", null=True, blank=True
    )  # PHI
    signature = models.ImageField(
        upload_to="signatures/", null=True, blank=True
    )  # PHI
    photo_consent = models.BooleanField(default=False)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True
    )

    def __str__(self):
        return f"Check-in: {self.appointment}"


class RecordsIntake(models.Model):
    class Source(models.TextChoices):
        EHR_EXPORT = "ehr_export", "EHR export"
        PAPER_SCAN = "paper_scan", "Paper scan"

    class ExtractionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="records_intake"
    )
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.PAPER_SCAN
    )
    document = models.FileField(
        upload_to="records/", null=True, blank=True
    )  # PHI
    ocr_text = models.TextField(blank=True)  # PHI
    extraction_status = models.CharField(
        max_length=20,
        choices=ExtractionStatus.choices,
        default=ExtractionStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Records: {self.appointment}"


class ExamRecord(models.Model):
    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="exam_record"
    )
    conditions_examined = models.TextField(blank=True)
    examiner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Exam: {self.appointment}"

    @property
    def dbq_count(self):
        return self.items.filter(item_type=ExamItem.ItemType.DBQ).count()

    @property
    def imo_count(self):
        return self.items.filter(item_type=ExamItem.ItemType.IMO).count()


class ExamItem(models.Model):
    """One DBQ or IMO performed during an exam."""

    class ItemType(models.TextChoices):
        DBQ = "dbq", "DBQ"
        IMO = "imo", "IMO"

    exam_record = models.ForeignKey(
        ExamRecord, on_delete=models.CASCADE, related_name="items"
    )
    item_type = models.CharField(max_length=10, choices=ItemType.choices)
    description = models.CharField(max_length=300, blank=True)
    expected_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=ZERO
    )

    def __str__(self):
        return f"{self.get_item_type_display()} — {self.description}"


class FeeSchedule(models.Model):
    """Per-payer reimbursement rates, including the no-show fee."""

    class ItemType(models.TextChoices):
        DBQ = "dbq", "DBQ"
        IMO = "imo", "IMO"
        EXAM = "exam", "Full exam"
        NO_SHOW = "no_show", "No-show"

    payer = models.ForeignKey(Payer, on_delete=models.CASCADE, related_name="fees")
    item_type = models.CharField(max_length=10, choices=ItemType.choices)
    fee = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = [("payer", "item_type")]
        ordering = ["payer", "item_type"]

    def __str__(self):
        return f"{self.payer} / {self.get_item_type_display()}: ${self.fee}"


class Claim(models.Model):
    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="claim"
    )
    submitted_date = models.DateField()
    submitted_patient_number = models.CharField(
        max_length=50,
        help_text="The patient number as keyed onto the submission.",
    )
    services_claimed = models.TextField(blank=True)
    expected_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=ZERO
    )

    def __str__(self):
        return f"Claim: {self.appointment} (${self.expected_amount})"

    @property
    def patient_number_mismatch(self):
        """True if the submitted number disagrees with the office record."""
        return (
            self.submitted_patient_number
            != self.appointment.patient.canonical_patient_number
        )


class QAQuestionnaire(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    appointment = models.ForeignKey(
        Appointment, on_delete=models.CASCADE, related_name="qa_questionnaires"
    )
    received_date = models.DateField()
    deadline = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN
    )
    time_spent_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["deadline"]

    def __str__(self):
        return f"QA: {self.appointment} (due {self.deadline})"

    @property
    def days_until_deadline(self):
        return (self.deadline - timezone.localdate()).days

    @property
    def is_overdue(self):
        return (
            self.status != self.Status.COMPLETED
            and self.deadline < timezone.localdate()
        )


class Remittance(models.Model):
    """A single EFT / payment statement from a payer."""

    payer = models.ForeignKey(
        Payer, on_delete=models.PROTECT, related_name="remittances"
    )
    received_date = models.DateField()
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=ZERO
    )
    source_file = models.FileField(
        upload_to="remittances/", null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_date"]

    def __str__(self):
        return f"Remittance {self.payer} {self.received_date} (${self.total_amount})"


class RemittanceLine(models.Model):
    class MatchStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        EXACT = "exact", "Exact match"
        FUZZY_SUGGESTED = "fuzzy_suggested", "Fuzzy suggestion (needs review)"
        CONFIRMED = "confirmed", "Confirmed by staff"
        UNMATCHED = "unmatched", "Unmatched"

    remittance = models.ForeignKey(
        Remittance, on_delete=models.CASCADE, related_name="lines"
    )
    patient_number_on_eft = models.CharField(max_length=50)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    service_description = models.CharField(max_length=300, blank=True)
    matched_appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="remittance_lines",
    )
    suggested_appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="suggested_remittance_lines",
    )
    match_status = models.CharField(
        max_length=20, choices=MatchStatus.choices, default=MatchStatus.PENDING
    )

    def __str__(self):
        return f"EFT line #{self.patient_number_on_eft}: ${self.amount_paid}"


class Reconciliation(models.Model):
    class Result(models.TextChoices):
        MATCHED = "matched", "Matched"
        UNDERPAID = "underpaid", "Underpaid"
        UNPAID = "unpaid", "Unpaid"
        NO_SHOW_DOWNCODED = "no_show_downcoded", "No-show downcoded"
        PATIENT_NUMBER_MISMATCH = "patient_number_mismatch", "Patient-number mismatch"
        UNMATCHED = "unmatched", "Unmatched"
        OVERPAID = "overpaid", "Overpaid"

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="reconciliation"
    )
    expected_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=ZERO
    )
    paid_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=ZERO
    )
    variance = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    result = models.CharField(max_length=30, choices=Result.choices)
    note = models.TextField(blank=True)
    checked_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-checked_at"]

    def __str__(self):
        return f"{self.appointment}: {self.get_result_display()}"

    @property
    def needs_dispute(self):
        return self.result not in (self.Result.MATCHED, self.Result.OVERPAID)


class Dispute(models.Model):
    class Status(models.TextChoices):
        DRAFTED = "drafted", "Drafted — awaiting doctor review"
        SENT = "sent", "Sent"
        RESOLVED = "resolved", "Resolved"
        ESCALATED = "escalated", "Escalated"

    reconciliation = models.OneToOneField(
        Reconciliation, on_delete=models.CASCADE, related_name="dispute"
    )
    draft_subject = models.CharField(max_length=300)
    draft_email_body = models.TextField()
    evidence_summary = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFTED
    )
    drafted_at = models.DateTimeField(auto_now_add=True)
    sent_date = models.DateField(null=True, blank=True)
    response_due_date = models.DateField(null=True, blank=True)
    amount_recovered = models.DecimalField(
        max_digits=10, decimal_places=2, default=ZERO
    )

    class Meta:
        ordering = ["-drafted_at"]

    def __str__(self):
        return f"Dispute: {self.reconciliation.appointment} ({self.get_status_display()})"


class AuditLog(models.Model):
    """Append-only record of every change to tracked data (HIPAA + evidence)."""

    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    action = models.CharField(max_length=20)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=50)
    summary = models.TextField(blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return (
            f"{self.timestamp:%Y-%m-%d %H:%M} {self.action} "
            f"{self.entity_type}#{self.entity_id}"
        )
