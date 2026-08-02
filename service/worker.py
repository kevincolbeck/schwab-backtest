"""Daily forward-test worker CLI.

Railway cron (weekdays ~7pm ET, retry 9pm):  python -m service.worker
Backfill / simulate a specific day:          python -m service.worker --as-of 2026-02-20

Idempotent: re-running any day appends nothing new. Missed days are covered
automatically — each run replays up to as_of, so gaps backfill in order.
"""

import argparse
import json
import logging
import sys

from service.forward import run_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one forward-test worker pass")
    parser.add_argument("--as-of", default=None, help="Evaluate as of this date (YYYY-MM-DD; default today UTC)")
    args = parser.parse_args()

    out = run_worker(as_of=args.as_of)
    print(json.dumps(out, indent=2, default=str))
    return 1 if out["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
