"""
Merges mock MLB/NHL markets into existing opportunities.json.
Run from prop-screen-web directory or adjust paths.
"""
import json
from pathlib import Path
from datetime import datetime, timezone

OPPS_PATH = Path("/home/claude/vigil/mock_mlb_nhl.json")
mock_markets = json.loads(OPPS_PATH.read_text())

# Build a minimal valid payload — frontend expects { updated, source, markets }
# The NBA data will come from the real pipeline; this script just adds mock sports.
# When you run pipeline.py for real it will overwrite — mock is for dev only.

# Try to load existing opportunities.json if it exists
existing_path = Path("../prop-screen-web/public/opportunities.json")
if existing_path.exists():
    existing = json.loads(existing_path.read_text())
    existing_markets = existing.get("markets", [])
    # Remove any existing mock mlb/nhl (by sport field) to avoid dupes on re-run
    existing_markets = [m for m in existing_markets if m.get("sport") not in ("mlb", "nhl")]
    all_markets = existing_markets + mock_markets
    payload = {
        "updated": existing.get("updated", datetime.now(timezone.utc).isoformat()),
        "source": existing.get("source", "the-odds-api"),
        "markets": all_markets,
    }
    print(f"Merged: {len(existing_markets)} existing + {len(mock_markets)} mock = {len(all_markets)} total")
else:
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "source": "mock",
        "markets": mock_markets,
    }
    print(f"No existing file found, writing mock-only payload ({len(mock_markets)} markets)")

existing_path.parent.mkdir(parents=True, exist_ok=True)
existing_path.write_text(json.dumps(payload, indent=2))
print(f"Wrote → {existing_path}")
