from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from . import models
from .reconciliation import reconcile_remittance


@admin.register(models.User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (("Practice role", {"fields": ("role",)}),)
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Practice role", {"fields": ("role",)}),
    )


@admin.register(models.Payer)
class PayerAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(models.Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "canonical_patient_number", "date_of_birth")
    search_fields = ("full_name", "canonical_patient_number")


@admin.register(models.FeeSchedule)
class FeeScheduleAdmin(admin.ModelAdmin):
    list_display = ("payer", "item_type", "fee")
    list_filter = ("payer", "item_type")


@admin.register(models.Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "payer",
        "scheduled_datetime",
        "status",
        "wait_minutes",
        "exam_duration_minutes",
    )
    list_filter = ("status", "payer")
    search_fields = ("patient__full_name", "patient__canonical_patient_number")
    date_hierarchy = "scheduled_datetime"


@admin.register(models.CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    list_display = ("appointment", "arrival_timestamp", "photo_consent", "checked_in_by")


class ExamItemInline(admin.TabularInline):
    model = models.ExamItem
    extra = 1


@admin.register(models.ExamRecord)
class ExamRecordAdmin(admin.ModelAdmin):
    list_display = ("appointment", "examiner", "dbq_count", "imo_count")
    inlines = [ExamItemInline]


@admin.register(models.RecordsIntake)
class RecordsIntakeAdmin(admin.ModelAdmin):
    list_display = ("appointment", "source", "extraction_status", "created_at")


@admin.register(models.Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = (
        "appointment",
        "submitted_date",
        "submitted_patient_number",
        "expected_amount",
    )


@admin.register(models.QAQuestionnaire)
class QAQuestionnaireAdmin(admin.ModelAdmin):
    list_display = ("appointment", "received_date", "deadline", "status", "is_overdue")
    list_filter = ("status",)


class RemittanceLineInline(admin.TabularInline):
    model = models.RemittanceLine
    extra = 1
    readonly_fields = ("match_status", "matched_appointment", "suggested_appointment")


@admin.register(models.Remittance)
class RemittanceAdmin(admin.ModelAdmin):
    list_display = ("payer", "received_date", "total_amount")
    inlines = [RemittanceLineInline]
    actions = ["run_reconciliation"]

    @admin.action(description="Reconcile selected remittances")
    def run_reconciliation(self, request, queryset):
        for remittance in queryset:
            reconcile_remittance(remittance)
        self.message_user(request, f"Reconciled {queryset.count()} remittance(s).")


@admin.register(models.Reconciliation)
class ReconciliationAdmin(admin.ModelAdmin):
    list_display = (
        "appointment",
        "result",
        "expected_amount",
        "paid_amount",
        "variance",
        "checked_at",
    )
    list_filter = ("result",)


@admin.register(models.Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ("reconciliation", "status", "drafted_at", "amount_recovered")
    list_filter = ("status",)


@admin.register(models.AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "action", "entity_type", "entity_id")
    list_filter = ("action", "entity_type")
    readonly_fields = (
        "timestamp",
        "user",
        "action",
        "entity_type",
        "entity_id",
        "summary",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
