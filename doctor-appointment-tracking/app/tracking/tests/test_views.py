import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image

from tracking import models


def _png_upload():
    buffer = BytesIO()
    Image.new("RGB", (60, 30), "white").save(buffer, format="PNG")
    return SimpleUploadedFile("record.png", buffer.getvalue(), content_type="image/png")

PASSWORD = "staff-pw-strong-2026"


class ViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="staff", password=PASSWORD
        )
        self.client.login(username="staff", password=PASSWORD)
        self.payer = models.Payer.objects.create(name="Test Payer")
        self.patient = models.Patient.objects.create(
            full_name="Test Patient", canonical_patient_number="300001"
        )
        self.appointment = models.Appointment.objects.create(
            patient=self.patient,
            payer=self.payer,
            scheduled_datetime=timezone.now() + timedelta(days=1),
        )

    def test_dashboard_loads(self):
        self.assertEqual(self.client.get(reverse("dashboard")).status_code, 200)

    def test_appointments_loads(self):
        self.assertEqual(self.client.get(reverse("appointments")).status_code, 200)

    def test_disputes_loads(self):
        self.assertEqual(self.client.get(reverse("disputes")).status_code, 200)

    def test_appointment_detail_loads(self):
        url = reverse("appointment_detail", args=[self.appointment.pk])
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_login_required(self):
        self.client.logout()
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_check_in_flow(self):
        url = reverse("check_in", args=[self.appointment.pk])
        self.assertEqual(self.client.get(url).status_code, 200)
        response = self.client.post(url, {"photo_consent": "1"})
        self.assertRedirects(
            response, reverse("appointment_detail", args=[self.appointment.pk])
        )
        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, models.Appointment.Status.ARRIVED
        )
        self.assertTrue(self.appointment.check_in.photo_consent)

    def test_log_exam_flow(self):
        url = reverse("log_exam", args=[self.appointment.pk])
        self.assertEqual(self.client.get(url).status_code, 200)
        now = timezone.localtime()
        response = self.client.post(
            url,
            {
                "conditions_examined": "Knee, back",
                "notes": "",
                "exam_started_at": now.strftime("%Y-%m-%dT%H:%M"),
                "exam_ended_at": (now + timedelta(minutes=40)).strftime(
                    "%Y-%m-%dT%H:%M"
                ),
                "item_type": ["dbq", "dbq"],
                "item_description": ["Knee DBQ", "Back DBQ"],
            },
        )
        self.assertRedirects(
            response, reverse("appointment_detail", args=[self.appointment.pk])
        )
        self.appointment.refresh_from_db()
        self.assertEqual(
            self.appointment.status, models.Appointment.Status.COMPLETED
        )
        self.assertEqual(self.appointment.exam_record.items.count(), 2)

    def test_reports_loads(self):
        self.assertEqual(self.client.get(reverse("reports")).status_code, 200)

    def test_patient_create(self):
        response = self.client.post(
            reverse("patient_create"),
            {"full_name": "New Patient", "canonical_patient_number": "400001"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            models.Patient.objects.filter(canonical_patient_number="400001").exists()
        )

    def test_appointment_create(self):
        response = self.client.post(
            reverse("appointment_create"),
            {
                "patient": self.patient.pk,
                "payer": self.payer.pk,
                "scheduled_datetime": timezone.localtime().strftime(
                    "%Y-%m-%dT%H:%M"
                ),
                "exam_type": "Disability exam",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.patient.appointments.count(), 2)

    def test_qa_create(self):
        today = timezone.localdate()
        response = self.client.post(
            reverse("qa_create", args=[self.appointment.pk]),
            {
                "received_date": today.isoformat(),
                "deadline": (today + timedelta(days=14)).isoformat(),
                "status": models.QAQuestionnaire.Status.OPEN,
                "time_spent_minutes": 0,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.appointment.qa_questionnaires.count(), 1)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_records_upload(self):
        url = reverse("records_upload", args=[self.appointment.pk])
        self.assertEqual(self.client.get(url).status_code, 200)
        response = self.client.post(
            url, {"source": "paper_scan", "document": _png_upload()}
        )
        self.assertRedirects(
            response, reverse("appointment_detail", args=[self.appointment.pk])
        )
        self.appointment.refresh_from_db()
        self.assertIsNotNone(self.appointment.records_intake.document.name)

    def test_remittance_create_and_reconcile(self):
        response = self.client.post(
            reverse("remittance_create"),
            {
                "payer": self.payer.pk,
                "received_date": timezone.localdate().isoformat(),
                "line_number": ["300001", ""],
                "line_amount": ["250.00", ""],
            },
        )
        self.assertRedirects(response, reverse("disputes"))
        remittance = models.Remittance.objects.latest("id")
        self.assertEqual(remittance.lines.count(), 1)
