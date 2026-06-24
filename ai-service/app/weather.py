"""Optional weather context via Open-Meteo (no API key required)."""
from __future__ import annotations

import httpx
from app.india_geo import parse_location

# Approximate coordinates for major Indian agri districts (fallback)
DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    "pune": (18.5204, 73.8567),
    "mumbai": (19.0760, 72.8777),
    "nagpur": (21.1458, 79.0882),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "delhi": (28.6139, 77.2090),
    "chennai": (13.0827, 80.2707),
    "ahmedabad": (23.0225, 72.5714),
    "lucknow": (26.8467, 80.9462),
    "patna": (25.5941, 85.1376),
    "jaipur": (26.9124, 75.7873),
}

STATE_COORDS: dict[str, tuple[float, float]] = {
    "maharashtra": (19.7515, 75.7139),
    "karnataka": (15.3173, 75.7139),
    "punjab": (31.1471, 75.3412),
    "uttar pradesh": (26.8467, 80.9462),
    "gujarat": (22.2587, 71.1924),
    "rajasthan": (27.0238, 74.2179),
    "tamil nadu": (11.1271, 78.6569),
    "west bengal": (22.9868, 87.8550),
    "madhya pradesh": (22.9734, 78.6569),
    "bihar": (25.0961, 85.3131),
}


def _resolve_coords(location: str) -> tuple[float, float] | None:
    parsed = parse_location(location)
    if parsed.district:
        key = parsed.district.lower().split(",")[0].strip()
        if key in DISTRICT_COORDS:
            return DISTRICT_COORDS[key]
    state_key = parsed.state.lower()
    return STATE_COORDS.get(state_key)


def fetch_weather_summary(location: str) -> dict | None:
    """Return temperature, precipitation chance, and farming note — or None if unavailable."""
    coords = _resolve_coords(location)
    if not coords:
        return None
    lat, lon = coords
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,precipitation,weather_code"
        "&daily=precipitation_probability_max"
        "&forecast_days=1&timezone=Asia%2FKolkata"
    )
    try:
        with httpx.Client(timeout=4.0) as client:
            res = client.get(url)
            res.raise_for_status()
            data = res.json()
        current = data.get("current", {})
        daily = data.get("daily", {})
        temp = current.get("temperature_2m")
        precip = current.get("precipitation", 0)
        rain_prob = (daily.get("precipitation_probability_max") or [0])[0]
        note = "Favourable for field work." if rain_prob < 40 else "Rain likely — plan harvest/logistics accordingly."
        return {
            "temperature_c": round(float(temp), 1) if temp is not None else None,
            "precipitation_mm": round(float(precip), 1),
            "rain_probability_pct": int(rain_prob),
            "farming_note": note,
            "source": "open-meteo",
        }
    except Exception:
        return None
