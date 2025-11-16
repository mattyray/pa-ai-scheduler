import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

from apps.schedules.routing import websocket_urlpatterns as schedule_urlpatterns
from apps.chat.routing import websocket_urlpatterns as chat_urlpatterns

all_websocket_patterns = schedule_urlpatterns + chat_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            all_websocket_patterns
        )
    ),
})