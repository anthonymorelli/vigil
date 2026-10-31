# prop-screen

Python data pipeline for [Vigil](https://github.com/anthonymorelli/prop-screen-web) — a +EV NBA prop betting scanner.

Fetches live player prop odds from [The Odds API](https://the-odds-api.com), normalizes across sportsbooks and DFS platforms, and writes `opportunities.json` for the Next.js frontend to consume.

## What it does

1. Fetches all active NBA (and WNBA) events
2. For each event, pulls player prop markets across 18 books and DFS platforms — PrizePicks, Underdog, Betr, Pick6, Pinnacle, DraftKings, FanDuel, and more
3. Normalizes odds into a unified `(player, market, line)` structure with per-book over/under prices
4. Classifies PrizePicks alternate lines as goblins (−137, easier line) or demons (+100, harder line)
5. Writes `opportunities.json` to the frontend's `public/` directory

The frontend devig logic (in `prop-screen-web`) then computes fair value probabilities using a weighted consensus across sharp and exchange books (Pinnacle, Novig, ProphetX), calculates +EV against each DFS platform's implied break-even, and surfaces the best plays ranked by edge.

## Stack

- Python 3.11+
- `requests` — API calls
- `python-dotenv` — API key management
- No database — output is a single flat JSON file

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install requests python-dotenv
```

Create a `.env` file:

```
ODDS_API_KEY=your_key_here
```

Get a key at [the-odds-api.com](https://the-odds-api.com). The `$119/mo` tier (5M credits) covers full NBA season scanning across all markets.

## Usage

```bash
python3 pipeline.py
```

Output is written to `../prop-screen-web/public/opportunities.json` by default. Override with:

```python
from pipeline import main
from pathlib import Path
main(out_path=Path("./output.json"))
```

## Output format

```json
{
  "updated": "2026-04-18T22:00:00+00:00",
  "source": "the-odds-api",
  "markets": [
    {
      "playerId": "jalen-williams-player-points-15.5",
      "player": "Jalen Williams",
      "matchup": "San Antonio Spurs @ Oklahoma City Thunder",
      "gameTime": "2026-04-18T23:10:00Z",
      "market": "Player Points",
      "line": 15.5,
      "offerings": {
        "PrizePicks": { "over": -119, "under": -119, "type": "standard" },
        "Pinnacle":   { "over": -112, "under": -108, "type": "standard" }
      }
    }
  ]
}
```

## Markets covered

NBA player props: Points, Rebounds, Assists, Threes, Blocks, Steals, Blks+Stls, PRA, P+R, P+A — plus alternate lines for each.

## Planned

- FastAPI wrapper so Vigil can fetch live data on demand (replacing static JSON)
- WNBA, MLB, NFL, NHL market expansion
- Scheduled runs via Railway or similar
- Hit rate backtesting against OddsBlaze Rewind dataset

## Related

[prop-screen-web](https://github.com/anthonymorelli/prop-screen-web) — the Next.js frontend (Vigil)
