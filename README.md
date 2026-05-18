# prop-screen

Python data pipeline for **Vigil** — a +EV DFS prop betting scanner. Ingests odds from exchange and DFS platform APIs, deviggs against exchange consensus to derive fair probabilities, and calculates per-leg expected value against PrizePicks, Underdog Fantasy, and Betr slip structures.

The frontend (Next.js) lives at [prop-screen-web](https://github.com/anthonymorelli/prop-screen-web).

---

## What It Does

1. **Ingests** raw odds from OddsBlaze API across 17+ sportsbooks and DFS platforms
2. **Deviggs** exchange prices (Novig + ProphetX) using proportional devigging to derive a vig-free fair probability for each player prop
3. **Calculates EV** for each DFS platform offering vs the fair probability
4. **Exports** a structured `opportunities.json` consumed by the Next.js frontend

### Why exchange-only devigging?

Novig and ProphetX are peer-to-peer exchanges with no house vig. Their midpoints approximate true market probability more accurately than retail sportsbooks (which bake in 4–8% vig) or prediction markets (which introduce unrelated liquidity dynamics). This is the same methodology used by sharp bettors and tools like Upside.

---

## Core Math

### Devigging

For each player prop with both Over and Under prices on an exchange:

```
fair_over = p_over / (p_over + p_under)
```

Where `p_over` and `p_under` are the implied probabilities from American odds. When multiple exchanges have the prop, fair probabilities are averaged across them.

### EV Calculation

```
ev_pct = (fair_prob × decimal_odds) - (1 - fair_prob)
```

Expressed as a percentage. Positive EV means the DFS platform is offering better than fair odds for that leg.

### Kelly Criterion

```
kelly_pct = (fair_prob × b - (1 - fair_prob)) / b
```

Where `b` is the decimal odds minus 1. Hard cap: 2–3% of bankroll per leg recommended on DFS slips.

---

## Project Structure

```
prop-screen/
├── pipeline.py          ← Main pipeline: load → devig → EV → export
├── capture_oddsblaze.py ← Snapshot tool: captures OddsBlaze API responses
├── app.py               ← Streamlit prototype (precursor to Next.js frontend)
├── .env.example         ← Environment variable template
└── .gitignore
```

---

## Setup

```bash
# Clone
git clone https://github.com/anthonymorelli/prop-screen.git
cd prop-screen

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install pandas python-dotenv requests numpy

# Configure environment
cp .env.example .env
# Add your OddsBlaze API key to .env
```

`.env.example`:
```
ODDSBLAZE_API_KEY=your_key_here
```

---

## Usage

### 1. Capture a snapshot

```bash
python capture_oddsblaze.py
```

Hits the OddsBlaze API across all configured books and leagues, saves raw JSON responses to `oddsblaze_snapshot/run_<timestamp>/`. Rate-limited to 30 req/min.

### 2. Run the pipeline

```bash
python pipeline.py
```

Finds the latest snapshot, deviggs exchange prices, joins with DFS platform offerings, calculates EV and Kelly, and exports to `opportunities.json`.

### 3. Export to frontend

The pipeline auto-exports to `../prop-screen-web/public/opportunities.json` when run directly. To export to a custom path:

```python
from pipeline import export_to_json
export_to_json("path/to/output.json")
```

---

## Pipeline Internals

### Reference books (sharp/exchange)
- **Novig** — peer-to-peer exchange, zero vig
- **ProphetX** — peer-to-peer exchange, zero vig

### Target books (DFS platforms evaluated for EV)
- PrizePicks (standard + alt lines)
- Underdog Fantasy
- Betr

### Key functions

| Function | Description |
|---|---|
| `find_latest_run()` | Locates most recent OddsBlaze snapshot |
| `load_book_odds()` | Normalizes a single book's JSON into a flat DataFrame |
| `compute_exchange_fair_probs()` | Proportional devig across exchange books |
| `compute_ev()` | Joins DFS prices with fair probs, calculates EV + Kelly |
| `fetch_opportunities_from_snapshot()` | Full pipeline entry point |
| `export_to_json()` | Serializes output for Next.js consumption |

---

## Output Schema

`opportunities.json` — array of objects:

```json
{
  "Player": "Shai Gilgeous-Alexander",
  "Team": "OKC",
  "Matchup": "PHO @ OKC",
  "Market": "Player Points",
  "Line": 31.5,
  "Side": "Over",
  "Book": "PrizePicks",
  "Odds": -119,
  "Fair Odds": -165,
  "Fair %": 62.3,
  "EV %": 14.1,
  "Kelly %": 8.2,
  "Updated": "2026-04-18T22:14:03",
  "Reference": "novig,prophetx"
}
```

---

## Data Source

Currently running against an OddsBlaze snapshot from April 18, 2026 (trial period). Live data integration via [The Odds API](https://the-odds-api.com/) is the planned next step — their `us_dfs` region covers PrizePicks, Underdog, and Pinnacle in a single endpoint.

| Budget | Source | Coverage |
|---|---|---|
| $0 | OddsBlaze snapshot (current) | 17 books, static |
| $119/mo | The Odds API | PP + Underdog + Pinnacle |
| $249/mo | OddsBlaze real-time | Sub-second SSE, 20+ US books |

---

## Context

Built as both a personal tool (active use, verified Top 10% NBA Bettor on Pikkit) and a portfolio piece demonstrating:

- Probability math — devigging, EV calculation, Kelly sizing
- Data pipeline architecture — ingestion, normalization, transformation, export
- API integration and rate limiting
- Python/pandas data modeling

Part of the Vigil project. Frontend: [prop-screen-web](https://github.com/anthonymorelli/prop-screen-web).
