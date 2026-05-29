"""
generate_esports_mock.py
Generates mock esports markets (LOL, Valorant, CS2, Dota 2) and merges them
into the existing opportunities.json.

Run from the prop-screen-web directory:
    python3 generate_esports_mock.py

Or from the pipeline directory pointing to the right path.
"""

import json
import random
from pathlib import Path

OUT_PATH = Path("../prop-screen-web/public/opportunities.json")

# ── Matchups ──────────────────────────────────────────────────────────────

MATCHUPS = {
    "lol": [
        {"matchup": "T1 vs G2 Esports", "game_time": "2026-05-22T18:00:00Z"},
        {"matchup": "Cloud9 vs Team Liquid", "game_time": "2026-05-22T21:00:00Z"},
    ],
    "valorant": [
        {"matchup": "Sentinels vs NRG Esports", "game_time": "2026-05-22T19:00:00Z"},
        {"matchup": "LOUD vs FunPlus Phoenix", "game_time": "2026-05-22T22:00:00Z"},
    ],
    "cs2": [
        {"matchup": "Natus Vincere vs Team Vitality", "game_time": "2026-05-22T17:00:00Z"},
        {"matchup": "FaZe Clan vs G2 Esports", "game_time": "2026-05-22T20:00:00Z"},
    ],
    "dota2": [
        {"matchup": "Team Spirit vs OG", "game_time": "2026-05-22T15:00:00Z"},
        {"matchup": "Evil Geniuses vs Team Liquid", "game_time": "2026-05-22T23:00:00Z"},
    ],
}

# ── Players per matchup ───────────────────────────────────────────────────

PLAYERS = {
    "T1 vs G2 Esports": [
        {"player": "Faker", "team": "T1"},
        {"player": "Gumayusi", "team": "T1"},
        {"player": "Caps", "team": "G2 Esports"},
        {"player": "Hans Sama", "team": "G2 Esports"},
        {"player": "Keria", "team": "T1"},
    ],
    "Cloud9 vs Team Liquid": [
        {"player": "Blaber", "team": "Cloud9"},
        {"player": "Fudge", "team": "Cloud9"},
        {"player": "APA", "team": "Team Liquid"},
        {"player": "Yeon", "team": "Team Liquid"},
    ],
    "Sentinels vs NRG Esports": [
        {"player": "TenZ", "team": "Sentinels"},
        {"player": "zekken", "team": "Sentinels"},
        {"player": "crashies", "team": "NRG Esports"},
        {"player": "Victor", "team": "NRG Esports"},
        {"player": "s0m", "team": "NRG Esports"},
    ],
    "LOUD vs FunPlus Phoenix": [
        {"player": "aspas", "team": "LOUD"},
        {"player": "Less", "team": "LOUD"},
        {"player": "ANGE1", "team": "FunPlus Phoenix"},
        {"player": "SUYGETSU", "team": "FunPlus Phoenix"},
    ],
    "Natus Vincere vs Team Vitality": [
        {"player": "iM", "team": "Natus Vincere"},
        {"player": "b1t", "team": "Natus Vincere"},
        {"player": "ZywOo", "team": "Team Vitality"},
        {"player": "apEX", "team": "Team Vitality"},
        {"player": "Spinx", "team": "Team Vitality"},
    ],
    "FaZe Clan vs G2 Esports": [
        {"player": "NiKo", "team": "FaZe Clan"},
        {"player": "rain", "team": "FaZe Clan"},
        {"player": "karrigan", "team": "FaZe Clan"},
        {"player": "m0NESY", "team": "G2 Esports"},
        {"player": "HooXi", "team": "G2 Esports"},
    ],
    "Team Spirit vs OG": [
        {"player": "Yatoro", "team": "Team Spirit"},
        {"player": "TORONTOTOKYO", "team": "Team Spirit"},
        {"player": "Bzm", "team": "OG"},
        {"player": "Resolut1on", "team": "OG"},
    ],
    "Evil Geniuses vs Team Liquid": [
        {"player": "Arteezy", "team": "Evil Geniuses"},
        {"player": "Fly", "team": "Evil Geniuses"},
        {"player": "Miracle-", "team": "Team Liquid"},
        {"player": "GH", "team": "Team Liquid"},
        {"player": "qojqva", "team": "Team Liquid"},
    ],
}

# ── Market configs per game ───────────────────────────────────────────────
# Each entry: (market_label, line_range, fair_prob_range)
# fair_prob is the probability of Over being true (from exchange perspective)

MARKET_CONFIGS = {
    "lol": [
        ("Player Maps 1-3 Kills", (4.5, 8.5), (0.48, 0.62)),
        ("Player Map 1 Kills", (2.5, 5.5), (0.50, 0.60)),
        ("Player Maps 1-3 Assists", (6.5, 12.5), (0.50, 0.60)),
        ("Player Maps 1-3 Deaths", (3.5, 6.5), (0.48, 0.58)),
    ],
    "valorant": [
        ("Player Maps 1-3 Kills", (15.5, 25.5), (0.48, 0.63)),
        ("Player Map 1 Kills", (8.5, 14.5), (0.50, 0.62)),
        ("Player Maps 1-3 Assists", (4.5, 9.5), (0.49, 0.59)),
        ("Player Maps 1-3 Deaths", (8.5, 14.5), (0.48, 0.57)),
    ],
    "cs2": [
        ("Player Maps 1-3 Kills", (20.5, 32.5), (0.49, 0.64)),
        ("Player Map 1 Kills", (10.5, 18.5), (0.50, 0.62)),
        ("Player Map 1 Headshots", (4.5, 9.5), (0.49, 0.61)),
        ("Player Maps 1-3 Deaths", (10.5, 16.5), (0.48, 0.58)),
    ],
    "dota2": [
        ("Player Maps 1-3 Kills", (5.5, 12.5), (0.49, 0.62)),
        ("Player Maps 1-3 Assists", (8.5, 18.5), (0.50, 0.61)),
        ("Player Maps 1-3 Deaths", (4.5, 9.5), (0.48, 0.59)),
    ],
}

# ── Helpers ───────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    return s.lower().replace(" ", "-").replace("'", "").replace(".", "").replace("-", "-")

def prob_to_american(p: float) -> int:
    if p >= 0.5:
        return -round(p / (1 - p) * 100)
    return round((1 - p) / p * 100)

def make_offerings(fair_prob: float) -> dict:
    """Build realistic offerings given a fair over probability."""
    # Exchange odds (vig-free, tight)
    novig_over = prob_to_american(fair_prob + random.uniform(-0.01, 0.01))
    novig_under = prob_to_american(1 - fair_prob + random.uniform(-0.01, 0.01))
    px_over = prob_to_american(fair_prob + random.uniform(-0.01, 0.01))
    px_under = prob_to_american(1 - fair_prob + random.uniform(-0.01, 0.01))

    # Retail (add ~4% vig)
    dk_over = prob_to_american(fair_prob + 0.02 + random.uniform(-0.01, 0.01))
    dk_under = prob_to_american(1 - fair_prob + 0.02 + random.uniform(-0.01, 0.01))
    fd_over = prob_to_american(fair_prob + 0.02 + random.uniform(-0.01, 0.01))
    fd_under = prob_to_american(1 - fair_prob + 0.02 + random.uniform(-0.01, 0.01))

    # PrizePicks at -137 standard
    offerings = {
        "Novig": {"over": novig_over, "under": novig_under, "multiplier": None, "type": "standard"},
        "ProphetX": {"over": px_over, "under": px_under, "multiplier": None, "type": "standard"},
        "DraftKings": {"over": dk_over, "under": dk_under, "multiplier": None, "type": "standard"},
        "FanDuel": {"over": fd_over, "under": fd_under, "multiplier": None, "type": "standard"},
        "PrizePicks": {"over": -137, "under": -137, "multiplier": None, "type": "standard"},
    }

    # Sometimes add Fliff
    if random.random() > 0.4:
        fl_over = prob_to_american(fair_prob + 0.025 + random.uniform(-0.01, 0.01))
        fl_under = prob_to_american(1 - fair_prob + 0.025 + random.uniform(-0.01, 0.01))
        offerings["Fliff"] = {"over": fl_over, "under": fl_under, "multiplier": None, "type": "standard"}

    return offerings

def generate_markets() -> list:
    markets = []
    seen_ids = set()

    for game, matchup_list in MATCHUPS.items():
        game_configs = MARKET_CONFIGS[game]

        for m in matchup_list:
            matchup = m["matchup"]
            game_time = m["game_time"]
            players = PLAYERS.get(matchup, [])

            for p in players:
                # Pick 2-3 random market types per player
                chosen = random.sample(game_configs, k=min(2, len(game_configs)))

                for (market_label, line_range, fp_range) in chosen:
                    # Pick a realistic line
                    lo, hi = line_range
                    line = round(random.uniform(lo, hi) * 2) / 2  # nearest 0.5

                    fair_prob = random.uniform(*fp_range)

                    player_id = f"{slugify(p['player'])}-{slugify(market_label)}-{line}"

                    # Avoid duplicate player/market/line combos
                    if player_id in seen_ids:
                        continue
                    seen_ids.add(player_id)

                    markets.append({
                        "playerId": player_id,
                        "player": p["player"],
                        "team": p["team"],
                        "matchup": matchup,
                        "gameTime": game_time,
                        "market": market_label,
                        "line": line,
                        "sport": "esports",
                        "offerings": make_offerings(fair_prob),
                    })

    return markets

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    if not OUT_PATH.exists():
        print(f"Could not find {OUT_PATH}. Run from prop-screen-web root or adjust OUT_PATH.")
        return

    with open(OUT_PATH) as f:
        data = json.load(f)

    existing = data.get("markets", [])

    # Remove any existing esports markets before regenerating
    existing_non_esports = [m for m in existing if m.get("sport") != "esports"]

    esports = generate_markets()
    print(f"Generated {len(esports)} esports markets across LOL, Valorant, CS2, Dota 2")

    data["markets"] = existing_non_esports + esports

    with open(OUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Merged into {OUT_PATH}")
    print(f"Total markets: {len(data['markets'])} ({len(existing_non_esports)} existing + {len(esports)} esports)")

if __name__ == "__main__":
    main()
