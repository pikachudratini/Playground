from django import forms

from .models import (
    Appointment,
    Claim,
    ExamRecord,
    Patient,
    QAQuestionnaire,
    RecordsIntake,
    Remittance,
)

_DATE = forms.DateInput(attrs={"type": "date"})


class ExamRecordForm(forms.ModelForm):
    class Meta:
        model = ExamRecord
        fields = ["conditions_examined", "notes"]
        widgets = {
            "conditions_examined": forms.Textarea(attrs={"rows": 3}),
            "notes": forms.Textarea(attrs={"rows": 3}),
        }


class ClaimForm(forms.ModelForm):
    class Meta:
        model = Claim
        fields = [
            "submitted_date",
            "submitted_patient_number",
            "services_claimed",
            "expected_amount",
        ]
        widgets = {
            "submitted_date": _DATE,
            "services_claimed": forms.Textarea(attrs={"rows": 2}),
        }


class PatientForm(forms.ModelForm):
    class Meta:
        model = Patient
        fields = [
            "full_name",
            "date_of_birth",
            "contact_info",
            "canonical_patient_number",
        ]
        widgets = {"date_of_birth": _DATE}


class AppointmentForm(forms.ModelForm):
    class Meta:
        model = Appointment
        fields = ["patient", "payer", "scheduled_datetime", "exam_type"]
        widgets = {
            "scheduled_datetime": forms.DateTimeInput(
                attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"
            )
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["scheduled_datetime"].input_formats = [
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
        ]


class QAForm(forms.ModelForm):
    class Meta:
        model = QAQuestionnaire
        fields = [
            "received_date",
            "deadline",
            "status",
            "completed_date",
            "time_spent_minutes",
        ]
        widgets = {
            "received_date": _DATE,
            "deadline": _DATE,
            "completed_date": _DATE,
        }


class RecordsIntakeForm(forms.ModelForm):
    class Meta:
        model = RecordsIntake
        fields = ["source", "document"]


class RemittanceForm(forms.ModelForm):
    class Meta:
        model = Remittance
        fields = ["payer", "received_date", "source_file"]
        widgets = {"received_date": _DATE}
