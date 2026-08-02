"""Load repo-root .env into os.environ (no external dependency).

Existing environment variables win — deployment platforms set real env vars;
the .env file is the local-dev convenience.
"""

import os
from pathlib import Path


def load_dotenv() -> None:
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_dotenv()
