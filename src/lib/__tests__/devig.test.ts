import { describe, expect, it } from "vitest";
import {
  americanToProb,
  consensusFairProb,
  devigBookOver,
  evPct,
  probToAmerican,
  type WeightMap,
} from "../devig";

describe("americanToProb", () => {
  it("converts favorites and underdogs", () => {
    expect(americanToProb(-110)).toBeCloseTo(110 / 210, 10);
    expect(americanToProb(100)).toBeCloseTo(0.5, 10);
    expect(americanToProb(+150)).toBeCloseTo(0.4, 10);
  });
});

describe("probToAmerican", () => {
  it("round-trips common prices", () => {
    expect(probToAmerican(0.6)).toBe(-150);
    expect(probToAmerican(0.4)).toBe(150);
  });
  it("returns 0 for degenerate probabilities", () => {
    expect(probToAmerican(0)).toBe(0);
    expect(probToAmerican(1)).toBe(0);
  });
});

describe("devigBookOver (proportional)", () => {
  it("a symmetric -110/-110 market devigs to exactly 50%", () => {
    expect(devigBookOver({ over: -110, under: -110 })).toBeCloseTo(0.5, 10);
  });
  it("matches a hand-computed asymmetric case", () => {
    // -150 -> 0.6, +130 -> 100/230; total 1.034783; fair over = 0.579832
    expect(devigBookOver({ over: -150, under: 130 })).toBeCloseTo(0.579832, 5);
  });
  it("returns null when a side is missing", () => {
    expect(devigBookOver({ over: -110, under: null })).toBeNull();
  });
});

describe("consensusFairProb", () => {
  const on = { enabled: true, weight: 1 };
  const weights: WeightMap = { Pinnacle: on, Novig: on, PrizePicks: on };

  it("weighted-averages reference books and ignores target books", () => {
    const r = consensusFairProb(
      {
        Pinnacle: { over: -110, under: -110 },
        Novig: { over: -150, under: 130 },
        PrizePicks: { over: -119, under: -119 },
      },
      weights,
    );
    expect(r.fairOver).toBeCloseTo((0.5 + 0.579832) / 2, 5);
    expect(r.contributingBooks.sort()).toEqual(["Novig", "Pinnacle"]);
  });

  it("respects weights", () => {
    const r = consensusFairProb(
      {
        Pinnacle: { over: -110, under: -110 },
        Novig: { over: -150, under: 130 },
      },
      { Pinnacle: { enabled: true, weight: 3 }, Novig: { enabled: true, weight: 1 } },
    );
    expect(r.fairOver).toBeCloseTo((3 * 0.5 + 0.579832) / 4, 5);
  });

  it("returns null when nothing is eligible", () => {
    expect(consensusFairProb({}, weights).fairOver).toBeNull();
  });
});

describe("evPct", () => {
  it("is zero at the break-even price and positive above it", () => {
    expect(evPct(0.5, 100)).toBeCloseTo(0, 10);
    expect(evPct(0.55, 100)).toBeCloseTo(10, 10);
  });
});
