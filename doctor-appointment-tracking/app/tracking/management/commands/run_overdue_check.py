"""Scheduled job: flag overdue unpaid claims and report early warnings.

Run daily from cron. See ../../05-hosting-and-roadmap.md (Phase 5).

    python manage.py run_overdue_check
"""

from django.core.management.base import BaseCommand

from tracking.reconciliation import early_warning_claims, flag_overdue_claims


class Command(BaseCommand):
    help = "Flag claims past the overdue window as unpaid; report early warnings."

    def handle(self, *args, **options):
        flagged = flag_overdue_claims()
        self.stdout.write(
            self.style.SUCCESS(
                f"Flagged {len(flagged)} overdue unpaid claim(s); "
                f"dispute drafts created."
            )
        )
        for reconciliation in flagged:
            self.stdout.write(f"  - {reconciliation.appointment}")

        early = early_warning_claims()
        if early:
            self.stdout.write(
                self.style.WARNING(
                    f"{len(early)} claim(s) past the early-warning window:"
                )
            )
            for appointment in early:
                self.stdout.write(f"  - {appointment}")
