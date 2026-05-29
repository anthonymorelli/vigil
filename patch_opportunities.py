#!/usr/bin/env python3
"""
patch_opportunities.py  — Vigil mock data variance
Run from prop-screen-web/:  python3 patch_opportunities.py

Varies Novig / ProphetX / DraftKings / FanDuel / Fliff odds so the
board shows the full hit-cell.ts color spectrum instead of one flat
65.3% across every row.

DFS books (PrizePicks, Underdog, Betr, Pick6) are never touched.

All fair-% targets verified with:
    fairOver = impliedOver / (impliedOver + impliedUnder)
    impliedOver(-X) = X/(X+100)
    impliedOver(+X) = 100/(X+100)
"""

import json, random, os, sys

random.seed(7)   # change seed for a different but reproducible shuffle
BOOK_SEED_NOISE = 3  # ±N units of random noise added per book

TARGET = "public/opportunities.json"
SHARP  = {"Novig", "ProphetX", "DraftKings", "FanDuel", "Fliff"}
DFS    = {"PrizePicks", "Underdog", "Betr", "Pick6"}

if not os.path.exists(TARGET):
    print(f"✗  {TARGET} not found — run from prop-screen-web/")
    sys.exit(1)

with open(TARGET) as f:
    data = json.load(f)
markets = data["markets"]
print(f"Loaded {len(markets)} markets\n")

# ─────────────────────────────────────────────────────────────────────────
# Scenarios
# Format: { BookName: (over_odds, under_odds) }
# under_odds is applied only if the entry already has a non-null under.
#
# Math verified for each target (5 % overround):
#   strong:   fairOver ~60-62 %  →  δ ≥ +6 pp   → bright blue
#   solid:    fairOver ~57-59 %  →  δ +3–5 pp    → solid blue
#   marginal: fairOver ~54.5-56% →  δ +0.5–1.5pp → dim blue
#   soft_red: fairOver ~52.5-54% →  δ -0.5–-1.5pp→ soft red
#   bright_red: fairOver ~44-51% →  δ ≤ -3 pp    → bright red
# ─────────────────────────────────────────────────────────────────────────
SCENARIOS = {
    "strong": [
        # ~62 %  (δ ≈ 7.75 pp)
        {"Novig":(-185,150),"ProphetX":(-183,148),"DraftKings":(-184,164),"FanDuel":(-183,162),"Fliff":(-180,160)},
        # ~60 %  (δ ≈ 5.75 pp)
        {"Novig":(-170,138),"ProphetX":(-168,136),"DraftKings":(-169,149),"FanDuel":(-168,148),"Fliff":(-165,145)},
        # ~63 %  (δ ≈ 8.75 pp)
        {"Novig":(-195,163),"ProphetX":(-192,160),"DraftKings":(-194,174),"FanDuel":(-192,172),"Fliff":(-189,169)},
    ],
    "solid": [
        # ~58 %  (δ ≈ 3.75 pp)
        {"Novig":(-156,127),"ProphetX":(-153,124),"DraftKings":(-155,135),"FanDuel":(-153,133),"Fliff":(-150,130)},
        # ~57 %  (δ ≈ 2.75 pp)
        {"Novig":(-149,121),"ProphetX":(-146,118),"DraftKings":(-148,128),"FanDuel":(-146,126),"Fliff":(-143,123)},
        # ~59 %  (δ ≈ 4.75 pp)
        {"Novig":(-163,132),"ProphetX":(-160,129),"DraftKings":(-162,142),"FanDuel":(-160,140),"Fliff":(-157,137)},
    ],
    "marginal": [
        # ~55.5 % (δ ≈ 1.25 pp)
        {"Novig":(-140,114),"ProphetX":(-137,111),"DraftKings":(-139,119),"FanDuel":(-137,117),"Fliff":(-134,114)},
        # ~54.8 % (δ ≈ 0.55 pp)
        {"Novig":(-136,111),"ProphetX":(-133,108),"DraftKings":(-135,115),"FanDuel":(-133,113),"Fliff":(-130,110)},
        # ~55.2 % (δ ≈ 0.95 pp)
        {"Novig":(-138,112),"ProphetX":(-135,109),"DraftKings":(-137,117),"FanDuel":(-135,115),"Fliff":(-132,112)},
    ],
    "soft_red": [
        # ~53.5 % (δ ≈ -0.75 pp)
        {"Novig":(-128,105),"ProphetX":(-125,102),"DraftKings":(-127,107),"FanDuel":(-125,105),"Fliff":(-122,102)},
        # ~52.5 % (δ ≈ -1.75 pp)
        {"Novig":(-123,100),"ProphetX":(-120, 97),"DraftKings":(-122,102),"FanDuel":(-120,100),"Fliff":(-117, 97)},
        # ~53.0 % (δ ≈ -1.25 pp)
        {"Novig":(-125,102),"ProphetX":(-122, 99),"DraftKings":(-124,104),"FanDuel":(-122,102),"Fliff":(-119, 99)},
    ],
    "bright_red": [
        # ~51 %  (δ ≈ -3.25 pp)  — both sides negative (just off neutral)
        {"Novig":(-115,-106),"ProphetX":(-112,-103),"DraftKings":(-114,-108),"FanDuel":(-113,-107),"Fliff":(-110,-103)},
        # ~49 %  (δ ≈ -5.25 pp)
        {"Novig":( 94,-115),"ProphetX":( 97,-118),"DraftKings":( 92,-112),"FanDuel":( 93,-114),"Fliff":( 96,-117)},
        # ~47 %  (δ ≈ -7.25 pp)
        {"Novig":(102,-125),"ProphetX":(105,-128),"DraftKings":(100,-122),"FanDuel":(101,-124),"Fliff":(104,-127)},
        # ~44 %  (δ ≈ -10.25 pp)
        {"Novig":(116,-143),"ProphetX":(119,-147),"DraftKings":(114,-140),"FanDuel":(115,-142),"Fliff":(118,-145)},
    ],
}

TIERS   = ["strong","solid","marginal","soft_red","bright_red"]
WEIGHTS = [   0.10,   0.20,     0.25,      0.25,        0.20]

counts  = {t: 0 for t in TIERS}
skipped = 0

for mkt in markets:
    offs = mkt.get("offerings", {})
    if not any(b in offs for b in SHARP):
        skipped += 1
        continue

    tier     = random.choices(TIERS, weights=WEIGHTS, k=1)[0]
    scenario = random.choice(SCENARIOS[tier])

    for book, (o_odds, u_odds) in scenario.items():
        if book not in offs:
            continue
        entry = offs[book]
        no = random.randint(-BOOK_SEED_NOISE, BOOK_SEED_NOISE)
        nu = random.randint(-BOOK_SEED_NOISE, BOOK_SEED_NOISE)
        entry["over"] = o_odds + no
        if entry.get("under") is not None:
            entry["under"] = u_odds + nu

    counts[tier] += 1

with open(TARGET, "w") as f:
    json.dump(data, f, indent=2)

total = sum(counts.values())
print(f"✓  Patched {total} markets  ({skipped} skipped — no sharp books)\n")
print("Distribution:")
for t in TIERS:
    pct = counts[t] / total * 100 if total else 0
    bar = "█" * int(pct / 2.5)
    print(f"  {t:12s}  {counts[t]:4d}  {pct:5.1f}%  {bar}")

print()
print("Tier → hit-cell color:")
print("  strong     bright blue + glow   (δ ≥ 4 pp above break-even)")
print("  solid      solid blue            (δ 2–4 pp)")
print("  marginal   dim blue              (δ 0–2 pp)")
print("  soft_red   soft red              (δ -2–0 pp)")
print("  bright_red bright red            (δ ≤ -2 pp)")
print()
print("Reload localhost:3000 — you should see all 5 pill colors.")
