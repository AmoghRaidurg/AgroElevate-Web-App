"""India-focused agricultural geography and crop suitability reference."""
from __future__ import annotations

import re
from dataclasses import dataclass

# Yield in quintals per acre (India national averages, reference data)
CROP_YIELD_QTL_PER_ACRE: dict[str, float] = {
    "Wheat": 18.0, "Rice": 22.0, "Maize": 16.0, "Onion": 120.0, "Potato": 95.0,
    "Tomato": 110.0, "Soybean": 12.0, "Cotton": 8.0, "Sugarcane": 350.0,
    "Mustard": 10.0, "Chickpea": 9.0, "Groundnut": 11.0,
}

STATE_DISTRICTS: dict[str, list[str]] = {
    "Maharashtra": ["Pune", "Mumbai", "Nagpur", "Nashik", "Aurangabad", "Kolhapur", "Solapur"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
    "Haryana": ["Gurgaon", "Karnal", "Hisar", "Rohtak", "Ambala"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Meerut", "Prayagraj"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Belagavi", "Mangaluru"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
    "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Bardhaman", "Malda"],
    "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore"],
    "Telangana": ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur"],
}

# State-level crop suitability 0–1 (agro-climatic zones, reference)
CROP_STATE_SUITABILITY: dict[str, dict[str, float]] = {
    "Wheat": {"Punjab": 0.96, "Haryana": 0.94, "Uttar Pradesh": 0.90, "Madhya Pradesh": 0.85, "Maharashtra": 0.72, "Rajasthan": 0.78, "Bihar": 0.82, "Gujarat": 0.70},
    "Rice": {"West Bengal": 0.95, "Punjab": 0.92, "Tamil Nadu": 0.90, "Andhra Pradesh": 0.88, "Bihar": 0.86, "Uttar Pradesh": 0.84, "Maharashtra": 0.75, "Kerala": 0.82},
    "Maize": {"Karnataka": 0.90, "Madhya Pradesh": 0.88, "Maharashtra": 0.85, "Bihar": 0.82, "Telangana": 0.80, "Uttar Pradesh": 0.78},
    "Onion": {"Maharashtra": 0.92, "Gujarat": 0.88, "Karnataka": 0.85, "Madhya Pradesh": 0.82, "Rajasthan": 0.80, "Uttar Pradesh": 0.78},
    "Potato": {"Uttar Pradesh": 0.92, "West Bengal": 0.90, "Bihar": 0.88, "Gujarat": 0.85, "Punjab": 0.82, "Maharashtra": 0.75},
    "Tomato": {"Karnataka": 0.90, "Maharashtra": 0.88, "Andhra Pradesh": 0.86, "Madhya Pradesh": 0.82, "Uttar Pradesh": 0.80, "Haryana": 0.78},
    "Soybean": {"Madhya Pradesh": 0.95, "Maharashtra": 0.90, "Rajasthan": 0.82, "Karnataka": 0.78, "Telangana": 0.75},
    "Cotton": {"Gujarat": 0.94, "Maharashtra": 0.92, "Telangana": 0.90, "Karnataka": 0.85, "Madhya Pradesh": 0.82, "Punjab": 0.70},
    "Sugarcane": {"Uttar Pradesh": 0.95, "Maharashtra": 0.92, "Karnataka": 0.90, "Tamil Nadu": 0.88, "Gujarat": 0.85, "Bihar": 0.82},
    "Mustard": {"Rajasthan": 0.92, "Haryana": 0.90, "Uttar Pradesh": 0.85, "Madhya Pradesh": 0.80, "Punjab": 0.78},
    "Chickpea": {"Madhya Pradesh": 0.92, "Maharashtra": 0.88, "Rajasthan": 0.85, "Karnataka": 0.80, "Uttar Pradesh": 0.78},
    "Groundnut": {"Gujarat": 0.94, "Andhra Pradesh": 0.90, "Tamil Nadu": 0.85, "Karnataka": 0.82, "Maharashtra": 0.78},
}

SEASON_CROP_BOOST: dict[str, dict[str, float]] = {
    "kharif": {"Rice": 1.15, "Maize": 1.12, "Cotton": 1.10, "Soybean": 1.08, "Groundnut": 1.05},
    "rabi": {"Wheat": 1.15, "Mustard": 1.12, "Chickpea": 1.10, "Potato": 1.08, "Onion": 1.05},
    "zaid": {"Tomato": 1.12, "Onion": 1.10, "Maize": 1.05, "Sugarcane": 1.03},
}

DISTRICT_TO_STATE = {d: s for s, dists in STATE_DISTRICTS.items() for d in dists}


@dataclass
class ParsedLocation:
    state: str
    district: str | None
    region: str
    raw: str


def parse_location(text: str) -> ParsedLocation:
    raw = (text or "India").strip()
    lower = raw.lower()

    for state in STATE_DISTRICTS:
        if state.lower() in lower:
            district = None
            for d in STATE_DISTRICTS[state]:
                if d.lower() in lower:
                    district = d
                    break
            return ParsedLocation(state=state, district=district, region=_state_to_region(state), raw=raw)

    for district, state in DISTRICT_TO_STATE.items():
        if district.lower() in lower:
            return ParsedLocation(state=state, district=district, region=_state_to_region(state), raw=raw)

    return ParsedLocation(state="Maharashtra", district="Pune", region="West India", raw=raw)


def _state_to_region(state: str) -> str:
    mapping = {
        "Punjab": "North India", "Haryana": "North India", "Uttar Pradesh": "North India", "Rajasthan": "North India",
        "Bihar": "East India", "West Bengal": "East India",
        "Maharashtra": "West India", "Gujarat": "West India",
        "Madhya Pradesh": "Central India",
        "Karnataka": "South India", "Tamil Nadu": "South India", "Kerala": "South India",
        "Andhra Pradesh": "South India", "Telangana": "South India",
    }
    return mapping.get(state, "Central India")


def state_suitability(crop: str, state: str) -> float:
    return CROP_STATE_SUITABILITY.get(crop, {}).get(state, 0.65)


def district_suitability(crop: str, state: str, district: str | None) -> float:
    base = state_suitability(crop, state)
    if district and district in STATE_DISTRICTS.get(state, []):
        return min(1.0, base + 0.05)
    return base


def expected_yield_quintals(crop: str, state: str, acres: float = 1.0) -> float:
    base = CROP_YIELD_QTL_PER_ACRE.get(crop, 12.0)
    mult = 0.85 + state_suitability(crop, state) * 0.2
    return round(base * mult * max(acres, 0.1), 1)


def parse_acres(text: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:acres?|acre)", text.lower())
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:hectares?|ha\b)", text.lower())
    if m:
        return float(m.group(1)) * 2.47
    return None
