"""Main FastAPI application entry point."""
from __future__ import annotations

import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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


# ------------------------------------------------------------------------------
# Frontend Static Asset & Single-Page Application (SPA) Serving
# ------------------------------------------------------------------------------
_root_dir = Path(__file__).resolve().parent.parent.parent
_frontend_dist = _root_dir / "frontend" / "dist"
_assets_dir = _frontend_dist / "assets"

if _assets_dir.is_dir():
    # Mount Vite static assets (JS, CSS, images) with proper MIME types and caching
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="frontend_assets")


@app.get("/{full_path:path}", tags=["Frontend"])
async def serve_frontend(full_path: str, request: Request):
    """
    Serve compiled React frontend assets and SPA routes.
    - Never intercepts API routes (/api/*), health check (/health), or docs (/docs, /redoc, /openapi.json).
    - Serves exact matching static assets located in frontend/dist (e.g. favicon.ico, cached_benchmark.json).
    - Falls back to index.html for client-side HTML5 history navigation.
    """
    # Strict API route boundary protection
    if (
        full_path.startswith("api/")
        or full_path == "api"
        or full_path.startswith("health")
        or full_path in ("docs", "redoc", "openapi.json")
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API route not found")

    # If the root or JSON info is explicitly requested via API headers when dist is not built:
    index_file = _frontend_dist / "index.html"

    # Serve direct file from frontend/dist if it exists
    if full_path:
        target_file = (_frontend_dist / full_path).resolve()
        # Security: protect against directory traversal
        if _frontend_dist in target_file.parents or target_file == index_file:
            if target_file.is_file():
                return FileResponse(str(target_file))

    # Fallback to index.html for client-side routes (e.g. /, /analyzer, /benchmark, /developers)
    if index_file.is_file():
        return FileResponse(str(index_file))

    # Fallback for environments where frontend hasn't been built yet (e.g. headless dev)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "platform": settings.app_name,
            "version": settings.app_version,
            "status": "Frontend not yet built. Run 'npm --prefix frontend run build' or access API at /docs.",
            "api_v1": "/api/v1",
            "documentation": "/docs",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.app_debug)
