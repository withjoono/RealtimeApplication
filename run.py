import os
import sys

# Force UTF-8 encoding on Windows
os.environ["PYTHONUTF8"] = "1"
if sys.platform == "win32":
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import uvicorn
from app.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
