from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShiftRequestViewSet, ShiftSuggestionViewSet

router = DefaultRouter()
router.register(r'requests', ShiftRequestViewSet, basename='shift-request')
router.register(r'suggestions', ShiftSuggestionViewSet, basename='shift-suggestion')

urlpatterns = [
    path('', include(router.urls)),
]
