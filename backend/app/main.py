import sys
from pathlib import Path

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import time
import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.common.logging import setup_logging, request_id_ctx_var, logger
from app.common.exceptions import AppException
from app.database import engine, Base, AsyncSessionLocal
from app.redis_client import redis_service
from app.api.v1.api import api_router
from app.services.reservation_service import ReservationService

setup_logging()


async def background_hold_cleaner():
    """Background task to regularly purge expired seat holds and release inventory."""
    while True:
        try:
            await asyncio.sleep(30)
            async with AsyncSessionLocal() as db:
                await ReservationService.cleanup_all_expired_holds(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Error in background seat hold cleaner: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CineMate AI backend services...")
    # 1. Connect Redis
    await redis_service.connect()

    # 2. Ensure database tables exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema verified.")
    except Exception as e:
        logger.error("Database connection/init warning during startup: %s", e, exc_info=True)

    # 3. Check and seed demo inventory if empty
    try:
        from scripts.seed_data import seed_database
        async with AsyncSessionLocal() as db:
            await seed_database(db)
    except Exception as e:
        logger.warning("Auto-seed check: %s", e)

    # 4. Start background cleaner task
    cleaner_task = asyncio.create_task(background_hold_cleaner())

    yield

    # Shutdown
    cleaner_task.cancel()
    await redis_service.close()
    await engine.dispose()
    logger.info("CineMate AI backend shut down cleanly.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend-First Movie Ticket Reservation System with Dual-Layer Concurrency Control, Redis Caching, and AI Discovery",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Correlation ID, Request Timing & Security Headers Middleware
@app.middleware("http")
async def correlation_id_and_timing_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request_id_ctx_var.set(req_id)
    start_time = time.perf_counter()

    response = await call_next(request)

    process_time = (time.perf_counter() - start_time) * 1000.0
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Response-Time-Ms"] = f"{process_time:.2f}"
    
    # Standard Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.ENVIRONMENT != "development":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
    return response


# Global Exception Handlers
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed",
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
            }
        },
    )


# Health & Readiness Checks
@app.get("/health", tags=["Observability"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/readiness", tags=["Observability"])
async def readiness_check():
    db_ok = True
    redis_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(Base.metadata.tables["movies"].select().limit(1))
    except Exception:
        db_ok = False

    try:
        if redis_service.client:
            await redis_service.client.ping()
        else:
            redis_ok = False
    except Exception:
        redis_ok = False

    is_ready = db_ok and redis_ok
    status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "degraded",
            "database": "connected" if db_ok else "unreachable",
            "redis": "connected" if redis_ok else "unreachable",
        },
    )


# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)
