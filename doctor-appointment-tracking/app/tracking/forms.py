from django import forms

from .models import Claim, ExamRecord


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
            "submitted_date": forms.DateInput(attrs={"type": "date"}),
            "services_claimed": forms.Textarea(attrs={"rows": 2}),
        }
