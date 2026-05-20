from django.urls import path

from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("appointments/", views.appointment_list, name="appointments"),
    path("appointments/new/", views.appointment_create, name="appointment_create"),
    path("appointments/<int:pk>/", views.appointment_detail, name="appointment_detail"),
    path("appointments/<int:pk>/check-in/", views.check_in, name="check_in"),
    path("appointments/<int:pk>/log-exam/", views.log_exam, name="log_exam"),
    path("appointments/<int:pk>/submit-claim/", views.submit_claim, name="submit_claim"),
    path("appointments/<int:pk>/records/", views.records_upload, name="records_upload"),
    path("appointments/<int:pk>/qa/new/", views.qa_create, name="qa_create"),
    path("patients/new/", views.patient_create, name="patient_create"),
    path("remittances/new/", views.remittance_create, name="remittance_create"),
    path("disputes/", views.disputes_list, name="disputes"),
    path("disputes/<int:pk>/", views.dispute_detail, name="dispute_detail"),
    path("disputes/<int:pk>/mark/<str:action>/", views.dispute_mark, name="dispute_mark"),
    path("remittance-lines/<int:pk>/confirm/", views.confirm_line, name="confirm_line"),
    path("reconcile-all/", views.reconcile_all, name="reconcile_all"),
    path("reports/", views.reports, name="reports"),
]
