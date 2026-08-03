"""Lint-style guard: the credit RPCs must be revoked from PUBLIC in the SQL scripts.

Postgres grants EXECUTE to PUBLIC on new functions by default, so a revoke that
names only anon/authenticated leaves SECURITY DEFINER RPCs callable via the anon
key (mint/drain credits). These tests fail if that regression ever comes back.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

SIGNATURES = [
    "public.credit_balance(uuid)",
    "public.grant_credits(uuid, integer, text, text)",
    "public.spend_credits(uuid, integer, text, text)",
]

SQL_FILES = [
    REPO_ROOT / "supabase" / "APPLY_ME_PART3.sql",
    REPO_ROOT / "supabase" / "APPLY_ME_PART4.sql",
]


@pytest.mark.parametrize("sql_path", SQL_FILES, ids=lambda p: p.name)
@pytest.mark.parametrize("signature", SIGNATURES)
def test_credit_rpc_revoked_from_public(sql_path, signature):
    sql = sql_path.read_text(encoding="utf-8")
    pattern = (
        r"revoke\s+execute\s+on\s+function\s+"
        + re.escape(signature).replace("\\ ", r"\s+")
        + r"\s+from\s+public\b"
    )
    assert re.search(pattern, sql, re.IGNORECASE), (
        f"{sql_path.name} must revoke execute on {signature} from public "
        "(revoking only anon/authenticated leaves the default PUBLIC grant live)"
    )


def test_part4_hardens_default_privileges():
    sql = (REPO_ROOT / "supabase" / "APPLY_ME_PART4.sql").read_text(encoding="utf-8")
    assert re.search(
        r"alter\s+default\s+privileges\s+in\s+schema\s+public\s+"
        r"revoke\s+execute\s+on\s+functions\s+from\s+public",
        sql,
        re.IGNORECASE,
    ), "PART4 must strip the default PUBLIC execute grant for future functions"
