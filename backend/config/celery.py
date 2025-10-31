import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Schedule
app.conf.beat_schedule = {
    'check-upcoming-coverage': {
        'task': 'apps.ai.tasks.check_upcoming_coverage',
        'schedule': crontab(hour=6, minute=0),  # Run daily at 6 AM
    },
    'calculate-pa-patterns': {
        'task': 'apps.users.tasks.calculate_all_pa_patterns',
        'schedule': crontab(day_of_week=1, hour=2, minute=0),  # Run weekly Monday 2 AM
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')