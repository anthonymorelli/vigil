"""
Prop Screen Pipeline — The Odds API
Fetches live player props from The Odds API and writes opportunities.json
for Vigil (prop-screen-web) to consume.
"""

import os
import json
import time
from pathlib import Path
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# CONFIG
# ============================================================================

API_KEY   = os.getenv("ODDS_API_KEY")
BASE_URL  = "https://api.the-odds-api.com/v4"
OUT_PATH  = Path("../prop-screen-web/public/opportunities.json")

SPORTS = [
    "basketball_nba",
    "basketball_wnba",
]

REGIONS = "us_dfs,us_ex,us,us2"

MARKETS = [
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
    "player_blocks_steals",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
]

BOOK_ID_MAP = {
    "prizepicks":    "PrizePicks",
    "pick6":         "Pick6",
    "underdog":      "Underdog",
    "betr_us_dfs":   "Betr",
    "novig":         "Novig",
    "prophetx":      "ProphetX",
    "draftkings":    "DraftKings",
    "fanduel":       "FanDuel",
    "fanatics":      "Fanatics",
    "fliff":         "Fliff",
    "pinnacle":      "Pinnacle",
    "betmgm":        "BetMGM",
    "caesars":       "Caesars",
    "betrivers":     "BetRivers",
    "bet365":        "bet365",
    "hardrockbet":   "HardRock",
    "betonlineag":   "BetOnline",
    "bovada":        "Bovada",
}

DFS_BOOKS = {"prizepicks", "pick6", "underdog", "betr_us_dfs"}

MARKET_LABELS = {
    "player_points":                   "Player Points",
    "player_points_alternate":         "Player Points",
    "player_rebounds":                 "Player Rebounds",
    "player_rebounds_alternate":       "Player Rebounds",
    "player_assists":                  "Player Assists",
    "player_assists_alternate":        "Player Assists",
    "player_threes":                   "Player Threes",
    "player_threes_alternate":         "Player Threes",
    "player_blocks":                   "Player Blocks",
    "player_steals":                   "Player Steals",
    "player_blocks_steals":            "Player Blks+Stls",
    "player_points_rebounds_assists":  "Player PRA",
    "player_points_rebounds":          "Player P+R",
    "player_points_assists":           "Player P+A",
}


# ============================================================================
# HELPERS
# ============================================================================

def dedup_outcomes(outcomes: list) -> list:
    seen = set()
    unique = []
    for o in outcomes:
        key = (o.get("description"), o.get("point"), o.get("multiplier"))
        if key not in seen:
            seen.add(key)
            unique.append(o)
    return unique


def classify_dfs_type(price: int, book_key: str, market_key: str) -> str:
    """Classify a DFS line as goblin, demon, or standard.

    Standard lines come from non-alternate market keys — applies to all books.
    Alternate markets are alt lines regardless of book.

    PP-specific: alternate -137 = goblin, alternate +100 = demon.
    All other DFS books: alternate market = goblin (filtered as alt line).
    """
    is_alternate = market_key.endswith("_alternate")
    if not is_alternate:
        return "standard"
    # Alternate market — classify by book
    if book_key == "prizepicks":
        if price == -137:
            return "goblin"
        if price == 100:
            return "demon"
        return "goblin"  # PP alternate fallback
    # Underdog, Betr, Pick6 — any alternate market = alt line
    return "goblin"


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-").replace("'", "")


def make_player_id(player: str, market_label: str, line: float) -> str:
    return f"{slugify(player)}-{slugify(market_label)}-{line}"


# ============================================================================
# FETCH
# ============================================================================

def fetch_events(sport: str) -> list:
    res = requests.get(
        f"{BASE_URL}/sports/{sport}/events",
        params={"apiKey": API_KEY},
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def fetch_event_odds(sport: str, event_id: str) -> dict | None:
    res = requests.get(
        f"{BASE_URL}/sports/{sport}/events/{event_id}/odds",
        params={
            "apiKey":             API_KEY,
            "regions":            REGIONS,
            "markets":            ",".join(MARKETS),
            "oddsFormat":         "american",
            "includeMultipliers": "true",
        },
        timeout=10,
    )
    if res.status_code == 422:
        return None
    res.raise_for_status()
    remaining = res.headers.get("x-requests-remaining", "?")
    used = res.headers.get("x-requests-last", "?")
    print(f"    credits used: {used} | remaining: {remaining}")

    # Debug: print all book keys returned so you can verify BOOK_ID_MAP coverage
    data = res.json()
    found_keys = set(b["key"] for b in data.get("bookmakers", []))
    unmapped = found_keys - set(BOOK_ID_MAP.keys())
    if unmapped:
        print(f"    [unmapped books]: {unmapped}")

    return data


# ============================================================================
# NORMALIZE
# ============================================================================

def normalize_event(event_data: dict) -> list[dict]:
    if not event_data:
        return []

    home = event_data.get("home_team", "")
    away = event_data.get("away_team", "")
    matchup = f"{away} @ {home}" if away and home else None
    game_time = event_data.get("commence_time")

    rows = []

    for book in event_data.get("bookmakers", []):
        book_key = book["key"]
        if book_key not in BOOK_ID_MAP:
            continue
        canonical = BOOK_ID_MAP[book_key]

        for market in book.get("markets", []):
            market_key = market["key"]
            market_label = MARKET_LABELS.get(market_key)
            if not market_label:
                continue

            raw_outcomes = market.get("outcomes", [])
            if book_key == "pick6":
                raw_outcomes = dedup_outcomes(raw_outcomes)

            for o in raw_outcomes:
                player = o.get("description")
                side = o.get("name")
                point = o.get("point")
                price = o.get("price")
                multiplier = o.get("multiplier")

                if not all([player, side, point is not None, price is not None]):
                    continue
                if side not in ("Over", "Under"):
                    continue

                dfs_type = (
                    classify_dfs_type(price, book_key, market_key)
                    if book_key in DFS_BOOKS
                    else "standard"
                )

                rows.append({
                    "book_key":   book_key,
                    "book":       canonical,
                    "matchup":    matchup,
                    "game_time":  game_time,
                    "player":     player,
                    "market":     market_label,
                    "market_key": market_key,
                    "line":       float(point),
                    "side":       side,
                    "price":      int(price),
                    "multiplier": multiplier,
                    "dfs_type":   dfs_type,
                })

    return rows


# ============================================================================
# BUILD MARKETS
# ============================================================================

def build_markets(all_rows: list[dict]) -> list[dict]:
    grouped: dict[tuple, dict] = {}

    for r in all_rows:
        key = (r["player"], r["market"], r["line"])

        if key not in grouped:
            grouped[key] = {
                "playerId":  make_player_id(r["player"], r["market"], r["line"]),
                "player":    r["player"],
                "team":      None,
                "matchup":   r["matchup"],
                "gameTime":  r["game_time"],
                "market":    r["market"],
                "line":      r["line"],
                "offerings": {},
            }

        book = r["book"]
        if book not in grouped[key]["offerings"]:
            grouped[key]["offerings"][book] = {
                "over":       None,
                "under":      None,
                "multiplier": None,
                "type":       r["dfs_type"],
            }

        side = r["side"].lower()
        grouped[key]["offerings"][book][side] = r["price"]

        if r["multiplier"] is not None:
            grouped[key]["offerings"][book]["multiplier"] = r["multiplier"]

    markets = list(grouped.values())
    markets.sort(key=lambda m: (m["player"], m["market"], m["line"]))
    return markets


# ============================================================================
# MAIN
# ============================================================================

def main(out_path: Path = OUT_PATH) -> None:
    if not API_KEY:
        raise RuntimeError("ODDS_API_KEY not set in .env")

    all_rows: list[dict] = []
    total_events = 0

    for sport in SPORTS:
        print(f"\nFetching events for {sport}...")
        try:
            events = fetch_events(sport)
        except Exception as e:
            print(f"  Error fetching events: {e}")
            continue

        print(f"  {len(events)} events found")

        for event in events:
            eid = event["id"]
            home = event.get("home_team", "")
            away = event.get("away_team", "")
            print(f"  → {away} @ {home}")

            try:
                data = fetch_event_odds(sport, eid)
            except Exception as e:
                print(f"    Error: {e}")
                continue

            if data:
                rows = normalize_event(data)
                all_rows.extend(rows)
                total_events += 1

            time.sleep(0.25)

    print(f"\n{len(all_rows):,} total offering rows across {total_events} events")

    markets = build_markets(all_rows)
    print(f"{len(markets)} unique (player, market, line) markets")

    payload = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "source":  "the-odds-api",
        "markets": markets,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"\nWrote → {out_path}")
    print("Sample markets:")
    for m in markets[:3]:
        books = ", ".join(sorted(m["offerings"].keys()))
        print(f"  {m['player']} | {m['market']} {m['line']} | {books}")


if __name__ == "__main__":
    main()