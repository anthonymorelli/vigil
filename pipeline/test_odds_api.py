import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ODDS_API_KEY")
BASE_URL = "https://api.the-odds-api.com/v4"

# ─── Step 1: Get live WNBA events (free, no credit cost) ──────────────────────
events_res = requests.get(
    f"{BASE_URL}/sports/basketball_wnba/events",
    params={"apiKey": API_KEY}
)
events = events_res.json()

print(f"Credits before: {events_res.headers.get('x-requests-remaining')}")
print()

if not events:
    print("No live WNBA events right now")
    exit()

# Print all available events so we can pick the best one
print(f"Found {len(events)} WNBA events:")
for i, e in enumerate(events):
    print(f"  [{i}] {e['home_team']} vs {e['away_team']} — {e['commence_time']}")

print()

# Grab first event
event = events[0]
event_id = event["id"]
print(f"Testing with: {event['home_team']} vs {event['away_team']}")
print()

# ─── Step 2: Full pull ─────────────────────────────────────────────────────────
REGIONS = "us_dfs,us_ex,eu,us,us2"
MARKETS = ",".join([
    "player_points",
    "player_points_alternate",
    "player_rebounds",
    "player_rebounds_alternate",
    "player_assists",
    "player_assists_alternate",
    "player_threes",
    "player_threes_alternate",
    "player_blocks",
    "player_steals",
])

odds_res = requests.get(
    f"{BASE_URL}/sports/basketball_wnba/events/{event_id}/odds",
    params={
        "apiKey": API_KEY,
        "regions": REGIONS,
        "markets": MARKETS,
        "oddsFormat": "american",
        "includeMultipliers": "true",
    }
)

data = odds_res.json()

print(f"Credits used this call: {odds_res.headers.get('x-requests-last')}")
print(f"Credits remaining: {odds_res.headers.get('x-requests-remaining')}")
print()

# ─── Step 3: Dedup utility ────────────────────────────────────────────────────
def dedup_outcomes(outcomes):
    seen = set()
    unique = []
    for o in outcomes:
        key = (o["description"], o["point"], o.get("multiplier"))
        if key not in seen:
            seen.add(key)
            unique.append(o)
    return unique

# ─── Step 4: Kalshi filter ────────────────────────────────────────────────────
def kalshi_filter(outcomes, limit=500):
    pairs = {}
    for o in outcomes:
        k = (o["description"], o["point"])
        if k not in pairs:
            pairs[k] = {}
        pairs[k][o["name"]] = o["price"]
    usable_keys = set()
    for k, sides in pairs.items():
        if "Over" in sides and "Under" in sides:
            if abs(sides["Over"]) <= limit and abs(sides["Under"]) <= limit:
                usable_keys.add(k)
    return [o for o in outcomes if (o["description"], o["point"]) in usable_keys]

# ─── Step 5: Summarize results ────────────────────────────────────────────────
print("=" * 60)
print("BOOKS + MARKETS RETURNED")
print("=" * 60)

book_summary = {}

for book in data.get("bookmakers", []):
    book_key = book["key"]
    book_title = book["title"]
    book_summary[book_key] = {}

    for market in book.get("markets", []):
        market_key = market["key"]
        outcomes = market.get("outcomes", [])

        if book_key == "pick6":
            outcomes = dedup_outcomes(outcomes)

        if book_key == "kalshi":
            raw_count = len(outcomes)
            outcomes = kalshi_filter(outcomes)
            print(f"  {book_title} | {market_key} — {raw_count} raw → {len(outcomes)} after filter")
        else:
            print(f"  {book_title} | {market_key} — {len(outcomes)} outcomes")

        book_summary[book_key][market_key] = outcomes

print()

# ─── Step 6: Pinnacle coverage ────────────────────────────────────────────────
print("=" * 60)
print("PINNACLE COVERAGE CHECK")
print("=" * 60)
if "pinnacle" in book_summary:
    for market_key, outcomes in book_summary["pinnacle"].items():
        players = list(set(o["description"] for o in outcomes))
        print(f"  {market_key}: {len(outcomes)} outcomes across {len(players)} players")
        for p in players[:5]:
            player_lines = [o for o in outcomes if o["description"] == p]
            for line in player_lines:
                print(f"    {p} | {line['name']} {line['point']} @ {line['price']}")
else:
    print("  Pinnacle returned NO data for this event")

print()

# ─── Step 7: PrizePicks Demon/Goblin check ────────────────────────────────────
print("=" * 60)
print("PRIZEPICKS DEMON/GOBLIN CHECK")
print("=" * 60)
if "prizepicks" in book_summary:
    for market_key, outcomes in book_summary["prizepicks"].items():
        demons = [o for o in outcomes if o["price"] == 100]
        goblins = [o for o in outcomes if o["price"] == -137]
        standard = [o for o in outcomes if o["price"] not in (100, -137)]
        print(f"  {market_key}:")
        print(f"    Goblins (price=-137): {len(goblins)}")
        print(f"    Demons  (price=+100): {len(demons)}")
        print(f"    Other:               {len(standard)}")
        for o in demons[:3]:
            print(f"    DEMON  → {o['description']} {o['name']} {o['point']}")
        for o in goblins[:3]:
            print(f"    GOBLIN → {o['description']} {o['name']} {o['point']}")
else:
    print("  PrizePicks returned NO data for WNBA")

print()

# ─── Step 8: Kalshi usability ─────────────────────────────────────────────────
print("=" * 60)
print("KALSHI USABILITY SUMMARY")
print("=" * 60)
if "kalshi" in book_summary:
    total = sum(len(v) for v in book_summary["kalshi"].values())
    if total == 0:
        print("  No usable Kalshi outcomes after filter — DROP IT")
    else:
        print(f"  {total} usable outcomes after filter — KEEP WITH FILTER")
        for market_key, outcomes in book_summary["kalshi"].items():
            players = list(set(o["description"] for o in outcomes))
            print(f"  {market_key}: {len(players)} players with clean two-sided markets")
            for p in players:
                lines = [o for o in outcomes if o["description"] == p]
                for l in lines:
                    print(f"    {p} | {l['name']} {l['point']} @ {l['price']}")
else:
    print("  Kalshi returned NO data for WNBA")

print()

# ─── Step 9: DFS book presence ───────────────────────────────────────────────
print("=" * 60)
print("DFS BOOK PRESENCE CHECK")
print("=" * 60)
dfs_books = {
    "prizepicks": "PrizePicks",
    "pick6": "DraftKings Pick6",
    "underdog": "Underdog Fantasy",
    "betr_us_dfs": "Betr Picks",
}
for key, name in dfs_books.items():
    status = "✅ PRESENT" if key in book_summary else "❌ MISSING"
    markets_found = list(book_summary.get(key, {}).keys())
    print(f"  {name}: {status} — markets: {markets_found if markets_found else 'none'}")

print()

# ─── Step 10: Sharp book check ───────────────────────────────────────────────
print("=" * 60)
print("SHARP / REFERENCE BOOK CHECK")
print("=" * 60)
sharp_books = {
    "pinnacle": "Pinnacle",
    "draftkings": "DraftKings",
    "fanduel": "FanDuel",
    "novig": "Novig",
    "prophetx": "ProphetX",
    "betfair_ex_eu": "Betfair Exchange",
}
for key, name in sharp_books.items():
    status = "✅ PRESENT" if key in book_summary else "❌ MISSING"
    markets_found = list(book_summary.get(key, {}).keys())
    print(f"  {name}: {status} — markets: {markets_found if markets_found else 'none'}")

print()

# ─── Step 11: Save output ────────────────────────────────────────────────────
with open("odds_wnba_test.json", "w") as f:
    json.dump(data, f, indent=2)

print("=" * 60)
print("Full raw response saved to odds_wnba_test.json")
print("=" * 60)