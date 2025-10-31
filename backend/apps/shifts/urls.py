from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShiftRequestViewSet

app_name = 'shifts'

router = DefaultRouter()
router.register(r'shifts', ShiftRequestViewSet, basename='shift')

urlpatterns = [
    path('', include(router.urls)),
]