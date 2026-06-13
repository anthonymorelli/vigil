# Vigil

**+EV DFS prop scanner.** Ingests player prop lines from PrizePicks, Underdog Fantasy, Pick6, and Betr, deviggs against sharp sportsbook and exchange references, and surfaces plays ranked by statistical edge on a real-time decision dashboard.

Live at **[prop-screen-web.vercel.app](https://prop-screen-web.vercel.app/board)**

![Vigil Board](https://prop-screen-web.vercel.app/board)

---

## What it does

- Fetches prop lines across DFS platforms (PrizePicks, Underdog, Pick6, Betr)
- Cross-references against sharp reference books (Novig, ProphetX, Pinnacle) and removes bookmaker margin via a devigging model
- Computes a consensus fair probability weighted across reference books
- Calculates break-even thresholds per slip type (PrizePicks Flex 5/6, Power, Underdog Flex, etc.) using exact payout grid math
- Ranks every prop by edge above break-even and displays a tiered signal system — glow intensity maps directly to +EV magnitude
- Flags cross-line discrepancies when a reference book prices a different line than the DFS anchor
- Multi-sport: NBA, MLB, NHL, WNBA, Esports

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui |
| Data pipeline | Python 3.11 · pandas |
| Deployment | Vercel |
| Fonts | Geist Sans / Geist Mono |

---

## Architecture

```
prop-screen/ (Python pipeline)
  pipeline.py         → fetches odds, normalizes, deviggs, writes JSON
  
prop-screen-web/ (this repo)
  src/app/board/      → main decision dashboard
  src/lib/devig.ts    → devig math, weighted consensus fair probability
  src/lib/slip-types.ts → break-even math per slip type via payout grids
  src/lib/hit-cell.ts → tiered color system (glow = edge signal)
  public/opportunities.json → pipeline output consumed by the frontend
```

The pipeline runs locally and writes `opportunities.json` to `public/`. The Next.js frontend fetches it statically. The planned architecture converts the pipeline to a FastAPI server that the frontend polls.

---

## Running locally

```bash
# Frontend
cd prop-screen-web
npm install
npm run dev
# → localhost:3000/board
```

```bash
# Pipeline (requires ODDS_API_KEY in .env)
cd prop-screen
source venv/bin/activate
python3 pipeline.py
# writes → prop-screen-web/public/opportunities.json
```

---

## Devig model

Fair probability is computed via the [power method](https://www.medicine.mcgill.ca/epidemiology/hanley/bios601/Likelihood/devig.pdf) across a weighted consensus of reference books. Exchanges (Novig, ProphetX) are treated as zero-vig reference points and weighted above sportsbooks. The resulting `fairPct` is compared against the break-even probability for the active slip type to produce the EV delta.

Break-even per slip is solved numerically: given a payout grid `[0, 0, 0, ..., multiplier]` at each hit count, find the leg probability `p` where `E[slip] = 1`. This means break-even shifts with slip type — Flex 5 (54.25%) vs Flex 6 (58.98%) vs Power 5 (54.93%).

---

## Kelly sizing

Standard Kelly per leg. Never exceed 2–3% of bankroll per leg on DFS slips given parlayed variance.

---

## Data source

Current deployment runs on a static snapshot. Live data requires a valid [The Odds API](https://the-odds-api.com) key (`us_dfs` region covers PrizePicks, Underdog Fantasy, Pick6, Betr with Demons/Goblins via `_alternate` markets).

---

## Pikkit

Verified Top 10% NBA bettor · [@puffersnoopy](https://pikkit.com)
