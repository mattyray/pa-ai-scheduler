from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchedulePeriodViewSet,
    MonthViewAPI,
    WeekViewAPI,
    DayViewAPI
)

app_name = 'schedules'

router = DefaultRouter()
router.register(r'schedule-periods', SchedulePeriodViewSet, basename='schedule-period')

urlpatterns = [
    path('', include(router.urls)),
    
    # Calendar views
    path('calendar/month/<int:year>/<int:month>/', MonthViewAPI.as_view(), name='month-view'),
    path('calendar/week/<int:year>/<int:week>/', WeekViewAPI.as_view(), name='week-view'),
    path('calendar/day/<str:date>/', DayViewAPI.as_view(), name='day-view'),
]

