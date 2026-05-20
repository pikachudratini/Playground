"""Append-only audit logging.

A thread-local holds the request's user so model-level signals can attribute
each change. System actions (management commands, the scheduler) log with a
null user, which is expected and correct.
"""

import threading

from django.apps import apps
from django.db.models.signals import post_delete, post_save

_local = threading.local()

# Models whose create/update/delete events are recorded.
AUDITED_MODELS = (
    "Patient",
    "Appointment",
    "CheckIn",
    "RecordsIntake",
    "ExamRecord",
    "ExamItem",
    "Claim",
    "QAQuestionnaire",
    "Remittance",
    "RemittanceLine",
    "Reconciliation",
    "Dispute",
    "FeeSchedule",
    "Payer",
    "User",
)


def get_current_user():
    return getattr(_local, "user", None)


class CurrentUserMiddleware:
    """Stashes the authenticated request user for the audit signal."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _local.user = getattr(request, "user", None)
        try:
            return self.get_response(request)
        finally:
            _local.user = None


def _record(action, instance):
    from .models import AuditLog

    user = get_current_user()
    if user is not None and not getattr(user, "is_authenticated", False):
        user = None
    AuditLog.objects.create(
        user=user,
        action=action,
        entity_type=instance.__class__.__name__,
        entity_id=str(instance.pk),
        summary=str(instance)[:300],
    )


def _on_save(sender, instance, created, **kwargs):
    _record("create" if created else "update", instance)


def _on_delete(sender, instance, **kwargs):
    _record("delete", instance)


def connect_signals():
    for name in AUDITED_MODELS:
        try:
            model = apps.get_model("tracking", name)
        except LookupError:
            continue
        post_save.connect(_on_save, sender=model, dispatch_uid=f"audit_save_{name}")
        post_delete.connect(
            _on_delete, sender=model, dispatch_uid=f"audit_delete_{name}"
        )
