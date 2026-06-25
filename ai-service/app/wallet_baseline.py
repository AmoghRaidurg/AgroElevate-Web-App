"""Wallet commerce revenue baseline for income forecasting."""
from __future__ import annotations

from app.supabase_client import get_supabase

# Commerce-related credits only — exclude Razorpay top-ups from income forecast baseline.
COMMERCE_CREDIT_TYPES = frozenset({
    "royalty_income",
    "sale_income",
    "transfer_in",
    "credit",
})


def load_wallet_commerce_revenue(user_id: str) -> float:
    sb = get_supabase()
    if not sb:
        return 0.0
    try:
        res = (
            sb.table("wallet_history")
            .select("amount, type")
            .eq("userId", user_id)
            .execute()
        )
        total = 0.0
        for row in res.data or []:
            t = str(row.get("type") or "")
            amt = float(row.get("amount") or 0)
            if t in COMMERCE_CREDIT_TYPES and amt > 0:
                total += amt
        return total
    except Exception as exc:
        print(f"Wallet baseline load warning: {exc}")
        return 0.0
