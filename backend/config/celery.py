import os
import logging
from celery import Celery, signals
from celery.schedules import crontab

logger = logging.getLogger(__name__)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

app.conf.beat_schedule = {
    'check-upcoming-coverage': {
        'task': 'apps.ai.tasks.check_upcoming_coverage',
        'schedule': crontab(hour=6, minute=0),
    },
    'calculate-pa-patterns': {
        'task': 'apps.users.tasks.calculate_all_pa_patterns',
        'schedule': crontab(day_of_week=1, hour=2, minute=0),
    },
}

@signals.task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, args=None, kwargs=None, **kw):
    logger.error(
        f'Celery task failed - Task: {sender.name}, ID: {task_id}, '
        f'Exception: {exception}, Args: {args}, Kwargs: {kwargs}'
    )

@signals.worker_process_shutdown.connect
def worker_shutdown_handler(sender=None, pid=None, exitcode=None, **kwargs):
    logger.error(f'Celery worker process shutting down - PID: {pid}, Exit Code: {exitcode}')

@signals.worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    logger.info(f'Celery worker ready - Hostname: {sender.hostname}')

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')