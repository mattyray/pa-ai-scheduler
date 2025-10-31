from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchedulePeriodViewSet

app_name = 'schedules'

router = DefaultRouter()
router.register(r'schedule-periods', SchedulePeriodViewSet, basename='schedule-period')

urlpatterns = [
    path('', include(router.urls)),
]