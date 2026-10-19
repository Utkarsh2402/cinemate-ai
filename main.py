"""
CineMate AI — Production ASGI Root Entrypoint for PaaS (Railway, Render, Heroku)
Enables zero-config deployments for runners expecting `main:app`
"""
import os
import sys
from pathlib import Path

# Ensure backend directory is first in sys.path so 'app' package resolves correctly
_ROOT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _ROOT_DIR / "backend"

if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Expose the FastAPI application instance for `uvicorn main:app`
try:
    from app.main import app
except Exception as e:
    import traceback
    print("=" * 60, file=sys.stderr)
    print("FATAL ERROR LOADING CINEMATE APP IN main.py:", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    raise e

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"🎬 CineMate AI FastAPI backend launching on port {port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
