"""
OddsBlaze Trial Data Capture

Captures a systematic snapshot of OddsBlaze API responses before trial expires.
Saves raw JSON for every meaningful endpoint + book/league combination.

Use:
    1. Copy .env.example to .env and paste your key
    2. python capture_oddsblaze.py
    3. All data saved to ./oddsblaze_snapshot/ with timestamps

Rate limit: 30 req/min on trial. Script sleeps 2.5s between calls to stay safe.
"""

import requests
import json
import time
import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# ============================================================================
# CONFIG — loaded from .env file
# ============================================================================

load_dotenv()
API_KEY = os.environ.get("ODDSBLAZE_API_KEY")
if not API_KEY:
    raise RuntimeError(
        "ODDSBLAZE_API_KEY not set. Copy .env.example to .env and add your key."
    )

OUTPUT_DIR = Path("./oddsblaze_snapshot")
RATE_LIMIT_SLEEP = 2.5  # seconds between calls (30/min = 2s, pad to 2.5s)

# ============================================================================
# WHAT TO CAPTURE
# ============================================================================

# Books worth snapshotting — skip duplicates like betmgm-michigan, hard-rock-illinois
BOOKS_TO_CAPTURE = [
    "draftkings", "betmgm", "caesars", "fanatics", "betrivers",
    "bet365", "betonline", "bovada",
    "prizepicks", "prizepicks-demons", "prizepicks-goblins",
    "novig", "kalshi", "polymarket", "prophetx",
    "fliff", "hard-rock",
]

# Main leagues to capture
LEAGUES_TO_CAPTURE = ["nba", "nfl", "mlb", "nhl"]

# ============================================================================
# HELPERS
# ============================================================================

def timestamp():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def safe_filename(s):
    return s.replace("/", "_").replace(" ", "_")


def fetch_and_save(url, out_path, label):
    """Hit an endpoint, save response, respect rate limit."""
    print(f"  → {label}... ", end="", flush=True)
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()

        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(data, f, indent=2)

        # Quick summary for console
        if isinstance(data, list):
            print(f"✓ saved {len(data)} items")
        elif isinstance(data, dict) and "events" in data:
            print(f"✓ saved {len(data['events'])} events")
        else:
            print("✓ saved")

    except requests.HTTPError as e:
        print(f"✗ HTTP {e.response.status_code}")
    except Exception as e:
        print(f"✗ {type(e).__name__}: {e}")

    time.sleep(RATE_LIMIT_SLEEP)


# ============================================================================
# MAIN CAPTURE
# ============================================================================

def main():
    run_dir = OUTPUT_DIR / f"run_{timestamp()}"
    run_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n📂 Saving to {run_dir}\n")

    # --- 1. Reference endpoints (sportsbooks, leagues, etc.)
    print("=== Reference endpoints ===")
    reference_calls = [
        ("sportsbooks", f"https://sportsbooks.oddsblaze.com/?key={API_KEY}"),
        ("leagues", f"https://leagues.oddsblaze.com/?key={API_KEY}"),
    ]
    for label, url in reference_calls:
        fetch_and_save(url, run_dir / "reference" / f"{label}.json", label)

    # --- 2. Odds snapshots for each book × NBA (primary focus)
    print("\n=== NBA odds per book ===")
    for book in BOOKS_TO_CAPTURE:
        url = f"https://odds.oddsblaze.com/?sportsbook={book}&league=nba&key={API_KEY}"
        fetch_and_save(url, run_dir / "odds" / "nba" / f"{book}.json", f"nba/{book}")

    # --- 3. Odds snapshots for each major league on DraftKings (schema reference)
    print("\n=== DraftKings across leagues (schema reference) ===")
    for league in LEAGUES_TO_CAPTURE:
        url = f"https://odds.oddsblaze.com/?sportsbook=draftkings&league={league}&key={API_KEY}"
        fetch_and_save(url, run_dir / "odds" / "draftkings" / f"{league}.json", f"draftkings/{league}")

    # --- 4. Active markets (tells us exact market names)
    print("\n=== Active markets reference ===")
    market_calls = [
        ("draftkings_nba", f"https://active-markets.oddsblaze.com/?sportsbook=draftkings&league=nba&key={API_KEY}"),
        ("prizepicks_nba", f"https://active-markets.oddsblaze.com/?sportsbook=prizepicks&league=nba&key={API_KEY}"),
    ]
    for label, url in market_calls:
        fetch_and_save(url, run_dir / "markets" / f"{label}.json", label)

    # --- 5. Summary file
    summary = {
        "captured_at": datetime.now().isoformat(),
        "api_base": "oddsblaze.com",
        "trial": True,
        "books_captured": BOOKS_TO_CAPTURE,
        "leagues_captured": LEAGUES_TO_CAPTURE,
        "notes": "Raw JSON snapshots from OddsBlaze trial. Reference material.",
    }
    with open(run_dir / "_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n✅ Done. Everything saved to: {run_dir}")
    print(f"   Total files: ~{len(BOOKS_TO_CAPTURE) + len(LEAGUES_TO_CAPTURE) + 4}")


if __name__ == "__main__":
    main()