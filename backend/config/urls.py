from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('health/', health_check),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/schedule-periods/', include('apps.schedules.urls')),
    path('api/shifts/', include('apps.shifts.urls')),
    path('api/', include('apps.schedules.urls')),
]