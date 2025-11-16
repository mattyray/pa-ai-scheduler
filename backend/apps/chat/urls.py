from django.urls import path
from .views import MessageListView

app_name = 'chat'

urlpatterns = [
    path('messages/', MessageListView.as_view(), name='message-list'),
]