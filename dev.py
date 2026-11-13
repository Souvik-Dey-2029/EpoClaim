"""
EpoClaim — Unified Local Development Runner
Starts the FastAPI backend and Vite frontend together in a single command.
Usage:
    python dev.py
"""
import sys
import os
import subprocess
import signal
import time
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parent
    backend_dir = root_dir / "backend"
    frontend_dir = root_dir / "frontend"

    print("=" * 60)
    print("🚀 Starting EpoClaim Development Suite (Backend + Frontend)")
    print("=" * 60)
    print(f"📁 Project Root : {root_dir}")
    print(f"🐍 Backend Dir  : {backend_dir}")
    print(f"⚡ Frontend Dir : {frontend_dir}")
    print("-" * 60)

    # Backend environment setup
    backend_env = os.environ.copy()
    backend_env["PYTHONUNBUFFERED"] = "1"

    # Command to start backend using python -m uvicorn
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "127.0.0.1",
        "--port",
        "8000"
    ]

    # Command to start frontend using npm run dev
    frontend_cmd = ["npm", "run", "dev"]
    # On Windows, npm is a cmd script
    use_shell = sys.platform.startswith("win")

    processes = []
    try:
        print("▶️  Launching Backend at http://127.0.0.1:8000 ...")
        p_backend = subprocess.Popen(
            backend_cmd,
            cwd=str(backend_dir),
            env=backend_env
        )
        processes.append(("Backend", p_backend))

        print("▶️  Launching Frontend at http://localhost:5173 ...")
        p_frontend = subprocess.Popen(
            frontend_cmd,
            cwd=str(frontend_dir),
            shell=use_shell
        )
        processes.append(("Frontend", p_frontend))

        print("-" * 60)
        print("✨ Both services running! Press Ctrl+C to terminate both cleanly.")
        print("-" * 60)

        # Monitor loop
        while True:
            for name, proc in processes:
                ret = proc.poll()
                if ret is not None:
                    print(f"⚠️  {name} process exited unexpectedly with code {ret}")
                    return ret
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested by user (Ctrl+C). Stopping services...")
    finally:
        for name, proc in processes:
            if proc.poll() is None:
                print(f"🛑 Terminating {name} (PID: {proc.pid})...")
                try:
                    if sys.platform.startswith("win"):
                        # Force terminate task tree on Windows
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            capture_output=True
                        )
                    else:
                        proc.terminate()
                        proc.wait(timeout=3)
                except Exception as e:
                    print(f"Error terminating {name}: {e}")
                    proc.kill()
        print("✅ All services stopped.")

if __name__ == "__main__":
    main()
