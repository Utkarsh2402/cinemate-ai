import os
from celery import Celery
from app.config import settings

celery_app = Celery(
    "cinemate_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "cleanup-expired-holds-every-minute": {
            "task": "app.worker.tasks.clean_expired_holds_task",
            "schedule": 60.0,
        },
        "process-outbox-every-30-seconds": {
            "task": "app.worker.tasks.process_outbox_events_task",
            "schedule": 30.0,
        },
    },
)
