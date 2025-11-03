from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchedulePeriodViewSet, MonthViewAPI, WeekViewAPI, DayViewAPI

router = DefaultRouter()
router.register(r'', SchedulePeriodViewSet, basename='schedule-period')

urlpatterns = [
    path('', include(router.urls)),
    path('calendar/month/<int:year>/<int:month>/', MonthViewAPI.as_view(), name='month-view'),
    path('calendar/week/<int:year>/<int:week>/', WeekViewAPI.as_view(), name='week-view'),
    path('calendar/day/<str:date>/', DayViewAPI.as_view(), name='day-view'),
]
