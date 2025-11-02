from django.apps import AppConfig


class CoverageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.coverage'
    
    def ready(self):
        import apps.coverage.signals  # noqa