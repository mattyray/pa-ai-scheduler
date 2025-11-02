from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/schedule-periods/', include('apps.schedules.urls')),
    path('api/shifts/', include('apps.shifts.urls')),
]
