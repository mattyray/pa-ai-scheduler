from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/schedule/(?P<period_id>\d+)/$', consumers.ScheduleConsumer.as_asgi()),
]