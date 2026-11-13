"""
EpoClaim — Unified Production Build Runner
Executes the unified build steps cross-platform (Windows / Linux / macOS):
1. Installs backend dependencies from backend/requirements.txt
2. Installs frontend dependencies using frontend/package-lock.json
3. Builds React/Vite frontend into frontend/dist
"""
import sys
import os
import subprocess
from pathlib import Path

def run_command(cmd, cwd=None, env=None):
    print(f"▶️  Running: {' '.join(cmd) if isinstance(cmd, list) else cmd} (in {cwd or '.'})")
    use_shell = sys.platform.startswith("win") and isinstance(cmd, list) and cmd[0] in ("npm", "npx")
    res = subprocess.run(cmd, cwd=str(cwd) if cwd else None, env=env, shell=use_shell)
    if res.returncode != 0:
        print(f"❌ Command failed with exit code {res.returncode}")
        sys.exit(res.returncode)

def main():
    root_dir = Path(__file__).resolve().parent
    backend_dir = root_dir / "backend"
    frontend_dir = root_dir / "frontend"
    requirements_file = backend_dir / "requirements.txt"

    print("=" * 70)
    print("🚀 [EpoClaim Build] Starting Unified Build")
    print("=" * 70)

    # 1. Install backend requirements
    print("🐍 [1/3] Installing backend dependencies from backend/requirements.txt...")
    run_command([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)], cwd=root_dir)

    # 2. Install frontend dependencies
    print("📦 [2/3] Installing frontend dependencies from frontend/package-lock.json...")
    run_command(["npm", "ci"], cwd=frontend_dir)

    # 3. Build frontend
    print("🏗️  [3/3] Compiling React + Vite frontend...")
    build_env = os.environ.copy()
    build_env["VITE_API_BASE_URL"] = ""  # Same-origin in unified single-service mode
    run_command(["npm", "run", "build"], cwd=frontend_dir, env=build_env)

    dist_index = frontend_dir / "dist" / "index.html"
    if not dist_index.is_file():
        print(f"❌ Error: {dist_index} was not found after build!")
        sys.exit(1)

    print("=" * 70)
    print(f"✅ [EpoClaim Build] Complete! Frontend assets ready in: {frontend_dir / 'dist'}")
    print("=" * 70)

if __name__ == "__main__":
    main()
