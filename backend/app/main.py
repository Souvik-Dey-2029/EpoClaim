"""Main FastAPI application entry point."""
from __future__ import annotations

import logging
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.endpoints import router as api_v1_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("epoclaim")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Unified AI-Powered Stale-Answer Detection & Temporal Fact-Verification Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.cors_origins if o != "*"],
    allow_origin_regex=settings.cors_origin_regex if settings.cors_origin_regex else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_request_size_middleware(request: Request, call_next):
    """Enforce maximum body size to protect against DoS attacks."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.max_body_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": f"Payload exceeds maximum allowed size of {settings.max_body_bytes} bytes."},
                )
        except ValueError:
            pass

    response: Response = await call_next(request)
    return response


# Include API routers
app.include_router(api_v1_router)


@app.get("/health", tags=["Root"], status_code=status.HTTP_200_OK)
async def root_health_check():
    """Top-level health check endpoint for Render and infrastructure probes."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "platform": settings.app_name,
        "version": settings.app_version,
        "documentation": "/docs",
        "api_v1": "/api/v1",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.app_debug)
