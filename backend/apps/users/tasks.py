from celery import shared_task
from .utils import calculate_pa_patterns
import logging

logger = logging.getLogger(__name__)


@shared_task
def calculate_all_pa_patterns():
    """
    Calculate patterns for all PA users.
    Scheduled to run weekly (Monday 2 AM).
    """
    from apps.users.models import User
    
    pa_users = User.objects.filter(role='PA', is_active=True)
    
    success_count = 0
    error_count = 0
    
    for pa in pa_users:
        try:
            calculate_pa_patterns(pa.id)
            success_count += 1
            logger.info(f'Successfully calculated patterns for PA {pa.email}')
        except Exception as e:
            error_count += 1
            logger.error(f'Failed to calculate patterns for PA {pa.email}: {e}')
    
    logger.info(f'Pattern calculation complete: {success_count} success, {error_count} errors')
    return f'Calculated patterns for {success_count}/{pa_users.count()} PAs'