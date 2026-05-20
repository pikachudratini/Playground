from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from tracking import models

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
