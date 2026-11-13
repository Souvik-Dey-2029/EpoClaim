# EpoClaim — Render Single Web Service Deployment Guide

This guide documents deploying the entire EpoClaim application (FastAPI backend + React Vite frontend) as **one integrated Render Web Service** from this single monorepo repository.

Repository: `https://github.com/Souvik-Dey-2029/EpoClaim`

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Render Cloud                │
                      │                                        │
  User Browser ──────►│  epoclaim (Single Web Service)         │
                      │  - Host: 0.0.0.0, Port: $PORT          │
                      │  - Python 3.11 Runtime                 │
                      │  - Serves React Frontend at /          │
                      │  - Serves Static Assets at /assets/*   │
                      │  - Handles SPA routes (fallback)       │
                      │  - Serves API routes at /api/v1/*      │
                      │  - Health Probe at /health             │
                      └────────────────────────────────────────┘
```

---

## 1. Unified Single-Service Deployment Setup

- **Service Type:** Web Service
- **Runtime:** Python
- **Root Directory:** *(leave blank / repository root)*
- **Build Command:** `./build.sh` (or `python build.py`)
- **Start Command:** `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`
- **Public URL:** A single URL serves both the UI and API (e.g. `https://epoclaim.onrender.com`).

---

## 2. How the Unified Build Works

The root-level [build.sh](file:///d:/Development/Projects/MY%20PERSONAAL%20WORKS/Global/EPOCLAIM/build.sh) (and cross-platform [build.py](file:///d:/Development/Projects/MY%20PERSONAAL%20WORKS/Global/EPOCLAIM/build.py)) runs during Render's build phase:

1. **Backend Dependencies:** Installs Python packages from `backend/requirements.txt`.
2. **Node Runtime Guarantee:** Automatically detects if `node` and `npm` are in the environment; if missing, it downloads a standalone Node.js v20 binary locally without requiring root permissions.
3. **Frontend Dependencies:** Runs `npm ci` inside `frontend/` using `frontend/package-lock.json`.
4. **Vite Compilation:** Runs `npm run build`, producing optimized static assets in `frontend/dist`.
5. **FastAPI Integration:** FastAPI mounts `frontend/dist/assets` under `/assets` and serves `index.html` with full SPA client-side fallback.

---

## 3. Step-by-Step Deployment Instructions

### Method A: Deploy via Blueprint (`render.yaml`) — Recommended

1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Connect `Souvik-Dey-2029/EpoClaim`.
5. Render detects the root `render.yaml` and displays the `epoclaim` Web Service.
6. Enter any optional secrets requested (e.g. `TAVILY_API_KEY`) or leave them blank.
7. Click **Apply Blueprint**.

---

### Method B: Deploy Manually as a Single Web Service

1. Click **New +** $\rightarrow$ **Web Service**.
2. Connect `Souvik-Dey-2029/EpoClaim`.
3. Configure settings:
   - **Name:** `epoclaim`
   - **Language / Runtime:** `Python 3`
   - **Branch:** `main`
   - **Root Directory:** *(leave empty)*
   - **Build Command:** `./build.sh`
   - **Start Command:** `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
4. Expand **Advanced**:
   - **Health Check Path:** `/health`
   - Add Environment Variables:
     - `PYTHONPATH`: `backend`
     - `ENVIRONMENT`: `production`
     - `TAVILY_API_KEY`: *(Optional)*
     - `BIFROST_BASE_URL`: *(Optional)*
     - `BIFROST_API_KEY`: *(Optional)*
5. Click **Create Web Service**.

---

## 4. Environment Variables Reference

| Variable | Scope | Secret? | Default | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Backend | No | `production` | Deployment mode (`production`, `development`). |
| `APP_DEBUG` | Backend | No | `false` | Enable/disable debug logs. |
| `HOST` | Backend | No | `0.0.0.0` | Bind host address. |
| `PORT` | Backend | No | Injected by Render | Container port binding ($PORT). |
| `PYTHONPATH` | Backend | No | `backend` | Python import path. |
| `CORS_ORIGINS` | Backend | No | `http://localhost:5173,http://localhost:3000` | Allowed origins for external callers. |
| `TAVILY_API_KEY` | Backend | **Yes** | `""` | Optional live web search key. |
| `BIFROST_BASE_URL`| Backend | **Yes** | `""` | Optional LLM gateway base URL. |
| `BIFROST_API_KEY` | Backend | **Yes** | `""` | Optional LLM gateway authorization token. |

---

## 5. Local Development Workflow

To run the local development server:
```bash
python dev.py
```
- Starts backend at `http://127.0.0.1:8000`.
- Starts frontend at `http://localhost:5173`.
- Vite reverse-proxies `/api` requests to port 8000.
- Clean shutdown on `Ctrl+C`.
