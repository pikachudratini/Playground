"""Scheduled job: report the QA questionnaire worklist by deadline.

Run daily from cron. In production this is where reminder emails to the
doctor would be sent (via the secure email channel).

    python manage.py run_qa_reminders
"""

from django.core.management.base import BaseCommand

from tracking.models import QAQuestionnaire


class Command(BaseCommand):
    help = "List open QA questionnaires sorted by deadline; highlight overdue ones."

    def handle(self, *args, **options):
        open_qas = (
            QAQuestionnaire.objects.exclude(
                status=QAQuestionnaire.Status.COMPLETED
            )
            .select_related("appointment__patient")
            .order_by("deadline")
        )
        if not open_qas:
            self.stdout.write(self.style.SUCCESS("No open QA questionnaires."))
            return

        self.stdout.write(f"Open QA questionnaires ({open_qas.count()}):")
        for qa in open_qas:
            patient = qa.appointment.patient.full_name
            if qa.is_overdue:
                self.stdout.write(
                    self.style.ERROR(
                        f"  OVERDUE  {qa.deadline}  {patient}"
                    )
                )
            elif qa.days_until_deadline <= 3:
                self.stdout.write(
                    self.style.WARNING(
                        f"  DUE SOON {qa.deadline}  {patient} "
                        f"({qa.days_until_deadline}d)"
                    )
                )
            else:
                self.stdout.write(
                    f"  open     {qa.deadline}  {patient} "
                    f"({qa.days_until_deadline}d)"
                )
