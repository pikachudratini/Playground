from django.urls import path

from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("appointments/", views.appointment_list, name="appointments"),
    path("appointments/<int:pk>/", views.appointment_detail, name="appointment_detail"),
    path("appointments/<int:pk>/check-in/", views.check_in, name="check_in"),
    path("appointments/<int:pk>/log-exam/", views.log_exam, name="log_exam"),
    path("appointments/<int:pk>/submit-claim/", views.submit_claim, name="submit_claim"),
    path("disputes/", views.disputes_list, name="disputes"),
    path("disputes/<int:pk>/", views.dispute_detail, name="dispute_detail"),
    path("disputes/<int:pk>/mark/<str:action>/", views.dispute_mark, name="dispute_mark"),
    path("remittance-lines/<int:pk>/confirm/", views.confirm_line, name="confirm_line"),
    path("reconcile-all/", views.reconcile_all, name="reconcile_all"),
]
