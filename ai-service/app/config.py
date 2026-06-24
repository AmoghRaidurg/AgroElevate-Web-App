"""AgroElevate AI Service configuration."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
MODEL_VERSION = "v2"
DATA_DIR = ROOT / "data"
SYNTHETIC_CSV = DATA_DIR / "synthetic_ag_market.csv"

CROPS = [
    "Wheat", "Rice", "Maize", "Onion", "Potato", "Tomato",
    "Soybean", "Cotton", "Sugarcane", "Mustard", "Chickpea", "Groundnut",
]

SEASONS = {"kharif": [6, 7, 8, 9], "rabi": [10, 11, 12, 1, 2, 3], "zaid": [4, 5]}

MIN_MARKETPLACE_ROWS = 8
