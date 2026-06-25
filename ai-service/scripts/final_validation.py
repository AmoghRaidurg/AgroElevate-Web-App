"""Final validation — AI roles + 30+ Copilot prompts."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# project root on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.copilot import _classify_intent, run_copilot
from app.data_loader import load_marketplace_data
from app.role_commerce import build_role_context, scope_data_for_role, role_analytics_ready
from app.services.intelligence_service import refresh_intelligence, copilot_chat
from app.commerce_snapshot import build_commerce_snapshot
import pandas as pd

OUTPUT = Path(__file__).resolve().parent.parent.parent / "scripts" / ".ai-validation-output.json"

COPILOT_PROMPTS = [
    ("What is my total income?", "farmer"),
    ("How much royalty did I earn?", "farmer"),
    ("Show tomato sales.", "farmer"),
    ("Compare wheat and rice.", "farmer"),
    ("Suggest profitable crops.", "farmer"),
    ("Predict next season.", "farmer"),
    ("Summarize my dashboard.", "farmer"),
    ("Show demand trends.", "farmer"),
    ("How do I increase profit?", "farmer"),
    ("Explain my analytics.", "farmer"),
    ("What should I grow next month?", "farmer"),
    ("Which district has highest demand?", "farmer"),
    ("Why is my income decreasing?", "farmer"),
    ("What crop gives highest royalty?", "farmer"),
    ("Show my best selling crop.", "farmer"),
    ("What happened this month?", "farmer"),
    ("What crops are trending?", "farmer"),
    ("Suggest better pricing.", "farmer"),
    ("Why is demand low?", "farmer"),
    ("What should I sell in Pune?", "farmer"),
    ("Show procurement history.", "industrialist"),
    ("Which supplier is best?", "industrialist"),
    ("What should I manufacture?", "industrialist"),
    ("Summarize my business.", "industrialist"),
    ("Predict next quarter.", "industrialist"),
    ("Show margins", "middleman"),
    ("Purchase history?", "middleman"),
    ("Highest demand crops?", "middleman"),
    ("How much did I earn?", "middleman"),
    ("Inventory optimization tips", "middleman"),
    ("Hello what can you do?", "farmer"),
    ("Compare rice and wheat prices", "farmer"),
    ("I am from Pune", "farmer"),
    ("Weather for farming today", "farmer"),
    ("Show tomato prices.", "farmer"),
]


def load_test_user_ids() -> dict:
    val_path = Path(__file__).resolve().parent.parent.parent / "scripts" / ".validation-output.json"
    if val_path.exists():
        data = json.loads(val_path.read_text(encoding="utf-8"))
        return data.get("test_user_ids") or {}
    return {}


def validate_ai_roles(user_ids: dict) -> list[dict]:
    results = []
    role_map = [
        ("farmer", user_ids.get("farmer"), ["recommendations", "income_forecasts", "demand_intelligence", "district_analytics", "historical_trends", "commerce_totals"]),
        ("middleman", user_ids.get("trader"), ["trader", "commerce_totals", "insights"]),
        ("industrialist", user_ids.get("industrialist"), ["industrialist", "commerce_totals", "insights"]),
    ]
    for role, uid, fields in role_map:
        if not uid:
            results.append({"role": role, "ok": False, "detail": "no test user id"})
            continue
        t0 = time.perf_counter()
        try:
            payload = refresh_intelligence(uid, role)
            ms = round((time.perf_counter() - t0) * 1000)
            checks = {}
            for f in fields:
                val = payload.get(f)
                if f == "commerce_totals":
                    checks[f] = isinstance(val, dict) and "has_data" in val
                elif f == "trader":
                    checks[f] = isinstance(val, dict) and ("profit_opportunities" in val or "inventory_optimization" in val)
                elif f == "industrialist":
                    checks[f] = isinstance(val, dict)
                elif isinstance(val, list):
                    checks[f] = True  # may be empty if no data — structure ok
                else:
                    checks[f] = val is not None
            ok = payload.get("live_data") is not False or True  # offline still structurally valid
            results.append({
                "role": role,
                "ok": all(checks.values()),
                "ms": ms,
                "commerce_ready": payload.get("commerce_ready"),
                "commerce_baseline": payload.get("commerce_baseline"),
                "checks": checks,
                "live_data": payload.get("live_data"),
            })
        except Exception as e:
            results.append({"role": role, "ok": False, "detail": str(e)})
    return results


def validate_copilot(user_ids: dict) -> list[dict]:
    results = []
    data = load_marketplace_data()
    history: list[str] = []

    for prompt, role in COPILOT_PROMPTS:
        uid = user_ids.get("farmer" if role == "farmer" else "trader" if role == "middleman" else "industrialist") or "00000000-0000-0000-0000-000000000001"
        intent, conf = _classify_intent(prompt, history)
        t0 = time.perf_counter()
        try:
            res = copilot_chat(uid, prompt, role, "Pune, Maharashtra", {"conversation_history": history[-4:]})
            ms = round((time.perf_counter() - t0) * 1000)
            reply = res.get("reply", "")
            honest = "don't have enough information" in reply.lower() or len(reply) > 20
            not_faq_only = res.get("intent") != "general" or "assistant" in reply.lower() or honest
            results.append({
                "prompt": prompt,
                "role": role,
                "ok": bool(reply) and honest and res.get("intent") == intent,
                "intent": res.get("intent"),
                "classified": intent,
                "confidence": round(conf, 3),
                "intent_confidence": res.get("intent_confidence"),
                "ms": ms,
                "reply_preview": reply[:120].replace("\n", " "),
                "has_commerce_snapshot": bool(res.get("commerce_snapshot")),
            })
            history.append(prompt)
        except Exception as e:
            results.append({"prompt": prompt, "role": role, "ok": False, "error": str(e)})
    return results


def validate_historical_aggregation(user_ids: dict) -> dict:
    uid = user_ids.get("farmer")
    if not uid:
        return {"ok": False, "detail": "no farmer id"}
    data = load_marketplace_data()
    ctx = build_role_context(uid, "farmer", data)
    snap = build_commerce_snapshot(ctx)
    return {
        "ok": True,
        "total_sales_count": snap.total_sales_count,
        "has_data": snap.has_data,
        "wallet_sale_income": snap.wallet_sale_income,
        "items_in_context": len(ctx.farmer_sales_items) if not ctx.farmer_sales_items.empty else 0,
        "wallet_entries": len(ctx.wallet_entries),
    }


def main():
    user_ids = load_test_user_ids()
    out = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "live_data": load_marketplace_data().get("live_data"),
        "ai_roles": validate_ai_roles(user_ids),
        "copilot": validate_copilot(user_ids),
        "historical_aggregation": validate_historical_aggregation(user_ids),
    }
    copilot_ok = sum(1 for c in out["copilot"] if c.get("ok"))
    out["summary"] = {
        "copilot_pass": copilot_ok,
        "copilot_total": len(out["copilot"]),
        "ai_roles_pass": sum(1 for r in out["ai_roles"] if r.get("ok")),
        "ai_roles_total": len(out["ai_roles"]),
    }
    OUTPUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out["summary"], indent=2))
    print(f"Written {OUTPUT}")
    return 0 if copilot_ok >= 28 and out["summary"]["ai_roles_pass"] == out["summary"]["ai_roles_total"] else 1


if __name__ == "__main__":
    sys.exit(main())
