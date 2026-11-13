# EpoClaim — Render Blueprint Deployment Guide

This guide documents deploying the entire EpoClaim application (FastAPI backend + React Vite frontend) from this single monorepo repository using **Render Blueprints** (`render.yaml`).

Repository: `https://github.com/Souvik-Dey-2029/EpoClaim`

---

## Why the Initial Standalone Web Service Build Failed

When deploying a monorepo as a standard manual Render Web Service without configuring `Root Directory`:
1. Render executed `pip install -r requirements.txt` directly at the **repository root**.
2. Because EpoClaim is a monorepo where the Python application and `requirements.txt` live inside the `backend/` folder (and the React application lives inside `frontend/`), Render could not locate `requirements.txt` at the root and failed with:
   ```
   ERROR: Could not open requirements file: [Errno 2] No such file or directory: 'requirements.txt'
   ```
3. Attempting to deploy manually also requires creating two separate disconnected services and manually copying URLs back and forth.

**The Solution:** The root-level [render.yaml](file:///d:/Development/Projects/MY%20PERSONAAL%20WORKS/Global/EPOCLAIM/render.yaml) Blueprint explicitly assigns `rootDir: backend` for the Python Web Service and `rootDir: frontend` for the Static Site. Render switches to the appropriate subfolder before executing install, build, and run commands.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Render Cloud                │
                      │                                        │
  User Browser ──────►│  epoclaim-frontend (Static Site)       │
                      │  - Global CDN                          │
                      │  - Built with Vite                     │
                      │  - Rewrites /* -> /index.html (SPA)    │
                      │  - Bundled VITE_API_BASE_URL           │
                      └──────────────────┬─────────────────────┘
                                         │
                                         │ HTTPS API Calls (/api/v1/...)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │  epoclaim-backend (Web Service)        │
                      │  - Python 3.11 / FastAPI               │
                      │  - Dynamic $PORT binding               │
                      │  - Health Probe: GET /health           │
                      │  - Deterministic NLI & Temporal Decay  │
                      │  - Optional: Tavily Search / Bifrost   │
                      └────────────────────────────────────────┘
```

---

## 1. Blueprint Specification (`render.yaml`)

The repository root includes a declarative [render.yaml](file:///d:/Development/Projects/MY%20PERSONAAL%20WORKS/Global/EPOCLAIM/render.yaml) file adhering to Render's Blueprint specification.

### Provisioned Services & Groups:

1. **Environment Group (`epoclaim-shared-config`):**
   - `ENVIRONMENT`: `production`
   - `APP_DEBUG`: `"false"`

2. **Backend Web Service (`epoclaim-backend`):**
   - **Type:** `web` | **Runtime:** `python` | **Plan:** `free`
   - **Root Directory:** `backend` *(solves the requirements.txt path issue)*
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
   - **CORS Allowed Origins:** Restricts origin to `https://epoclaim-frontend.onrender.com` and `^https://epoclaim-frontend.*\.onrender\.com$` with `allow_credentials=True`.

3. **Frontend Static Site (`epoclaim-frontend`):**
   - **Type:** `web` | **Runtime:** `static`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
   - **SPA Routing Rule:** Rewrites `/*` $\rightarrow$ `/index.html`
   - **Dynamic API Wiring:** `VITE_API_BASE_URL` is wired directly using `fromService`:
     ```yaml
     envVars:
       - key: VITE_API_BASE_URL
         fromService:
           type: web
           name: epoclaim-backend
           envVarKey: RENDER_EXTERNAL_URL
     ```

---

## 2. One-Time Deployment Walkthrough

To deploy both services to Render together:

1. **Push Repository to GitHub:**
   Ensure the latest commits on branch `main` are pushed to `https://github.com/Souvik-Dey-2029/EpoClaim`:
   ```bash
   git push origin main
   ```

2. **Open Render Dashboard:**
   - Log into [dashboard.render.com](https://dashboard.render.com).
   - Click the **New +** button in the top navigation bar.
   - Select **Blueprint**.

3. **Connect Repository:**
   - Connect your GitHub account and choose `Souvik-Dey-2029/EpoClaim`.
   - Render automatically detects `render.yaml` at the root and presents the configuration summary.

4. **Review Both Services:**
   - Render displays two services:
     1. `epoclaim-backend` (Web Service, Python)
     2. `epoclaim-frontend` (Static Site, Node)

5. **Supply Requested Secret Credentials (`sync: false`):**
   During Blueprint setup, Render will prompt for the sensitive credentials that are intentionally untracked in Git:
   - `TAVILY_API_KEY`: *(Optional)* Your Tavily API key for live web search. If left blank, EpoClaim defaults to deterministic offline analysis.
   - `BIFROST_BASE_URL`: *(Optional)* URL for your LLM gateway (e.g. `http://localhost:8080/v1` or OpenAI proxy).
   - `BIFROST_API_KEY`: *(Optional)* Bearer token for your LLM gateway.
   - `EPOCLAIM_API_KEY`: *(Optional)* Global client API key to protect your API endpoints. Leave blank for public access.
   - `EPOCLAIM_ADMIN_API_KEY`: *(Optional)* Admin key for privileged maintenance operations.

6. **Apply Blueprint:**
   - Click **Apply Blueprint**.
   - Render provisions both the backend Web Service and the frontend Static Site in parallel.
   - Render automatically passes the generated backend URL (`https://epoclaim-backend.onrender.com`) into the frontend build environment as `VITE_API_BASE_URL`.

7. **Verify Connectivity:**
   - Visit `https://epoclaim-frontend.onrender.com`.
   - The landing page and Benchmark Suite load instantly.
   - Clicking **Answer Analyzer** pings `GET /health` / `GET /api/v1/health` and displays the cold-start startup modal until the backend is awake, then automatically transitions into the analyzer workspace.

---

## 3. Environment Variables Reference

A single unified [.env.example](file:///d:/Development/Projects/MY%20PERSONAAL%20WORKS/Global/EPOCLAIM/.env.example) is maintained at the root.

| Variable | Scope / Service | Secret? | Default Value | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Backend (Shared) | No | `production` | Execution environment mode (`development`, `staging`, `production`). |
| `APP_DEBUG` | Backend (Shared) | No | `false` | Enable/disable verbose debug logs. |
| `HOST` | Backend | No | `0.0.0.0` | Ingress bind address for container environment. |
| `PORT` | Backend | No | Injected by Render | Container port binding (handled dynamically by `$PORT`). |
| `CORS_ORIGINS` | Backend | No | `https://epoclaim-frontend.onrender.com,http://localhost:5173` | Allowed CORS origins for browser fetch requests. |
| `CORS_ORIGIN_REGEX` | Backend | No | `^https://epoclaim-frontend.*\.onrender\.com$` | Regex matching Render frontend subdomains and PR previews. |
| `DATABASE_URL` | Backend | No | `sqlite:///./epoclaim.db` | Local SQLite database URL. |
| `TAVILY_API_KEY` | Backend | **Yes** | `""` | Outbound live search API key. |
| `BIFROST_BASE_URL` | Backend | **Yes** | `""` | LLM Gateway base URL. |
| `BIFROST_API_KEY` | Backend | **Yes** | `""` | LLM Gateway authorization secret. |
| `BIFROST_MODEL` | Backend | No | `gpt-4o-mini` | LLM model target identifier. |
| `EPOCLAIM_API_KEY` | Backend | **Yes** | `""` | Optional developer API key header check. |
| `VITE_API_BASE_URL` | Frontend | No | Injected from Backend | Public client API base URL. |

> [!IMPORTANT]
> **Secret Separation:** Variables marked **Yes** under *Secret?* are strictly private to the backend. They are **never** prefixed with `VITE_` and are **never** bundled into the client-side JavaScript bundle.

---

## 4. Local Development vs. Production

### Local Development
In local development, both services can be launched with a single command from the repository root:
```bash
python dev.py
```
- Backend starts at `http://127.0.0.1:8000`.
- Frontend starts at `http://localhost:5173`.
- Vite reverse-proxies `/api` requests directly to `http://127.0.0.1:8000`.
- Configuration is loaded from the single root `.env` file.

### Production (Render)
- The frontend and backend run as separate Render services under distinct HTTPS subdomains.
- Cross-origin communication is handled via HTTP headers and verified CORS policies.
- Secrets are managed in Render's secure vault rather than on the filesystem.

---

## 5. Free-Tier Cold Starts & Startup Modal

Render's free-tier Web Services sleep after 15 minutes of inactivity. EpoClaim handles this seamlessly:

1. **Initial Visit:** The frontend is served instantly from Render's global CDN and does not block on the sleeping backend. The landing page and Benchmark Suite load with zero latency.
2. **Analyzer Activation:** When the user clicks **Answer Analyzer**, EpoClaim displays the glassmorphic emerald startup modal (`EngineStartupModal.tsx`).
3. **Health Ping:** The modal polls `GET /api/v1/health`. Once the backend spins up (typically 30–50 seconds), the modal auto-transitions directly into the Analyzer workspace.

---

## 6. Troubleshooting & Diagnostics

- **Backend Health Check:** Verify the backend is up by visiting:
  ```
  https://epoclaim-backend.onrender.com/health
  ```
  Expected response: `{"status": "healthy", "service": "EpoClaim", "version": "0.1.0", "environment": "production"}`
- **CORS Issues:** If API requests fail in the browser console with CORS errors, check `CORS_ORIGINS` in the backend service settings and ensure it includes your frontend domain.
- **Tavily / Search Status:** You can check search integration health at:
  ```
  https://epoclaim-backend.onrender.com/api/v1/tavily/status
  ```
