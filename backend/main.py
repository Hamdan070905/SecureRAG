import multiprocessing

# MUST be at the top to prevent silent crashes in bundled/frozen Windows apps
if __name__ == "__main__":
    multiprocessing.freeze_support()

import uvicorn
from api import app

# Unconditionally run the server without reload or extra workers
uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)