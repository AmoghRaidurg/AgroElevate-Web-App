"""Capture live AgroElevate screenshots for presentation."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://agro-fair-chain.vercel.app"
OUT = Path(__file__).resolve().parent.parent / "docs" / "presentation" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

PUBLIC = [
    ("landing", "/"),
    ("login", "/login"),
    ("marketplace", "/marketplace"),
]

AUTH_FLOW = [
    ("dashboard", "/dashboard"),
    ("wallet", "/wallet"),
    ("intelligence", "/intelligence"),
]

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        for name, path in PUBLIC:
            try:
                page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(2000)
                page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
                print(f"OK {name}")
            except Exception as e:
                print(f"FAIL {name}: {e}")

        # Attempt authenticated captures
        try:
            page.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
            page.fill("#email", "commerce.verify.farmer@example.com")
            page.fill("#password", "CommerceTest!123")
            page.click('button[type="submit"]')
            page.wait_for_url("**/dashboard**", timeout=15000)
            page.wait_for_timeout(2000)
            for name, path in AUTH_FLOW:
                try:
                    page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=60000)
                    page.wait_for_timeout(2500)
                    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
                    print(f"OK {name}")
                except Exception as e:
                    print(f"FAIL {name}: {e}")
        except Exception as e:
            print(f"FAIL auth: {e}")

        browser.close()

if __name__ == "__main__":
    main()
