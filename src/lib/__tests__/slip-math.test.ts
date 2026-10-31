import { describe, expect, it } from "vitest";
import { computeHeterogeneousSlipEV } from "../slip-math";
import { SLIP_TYPES, getSlipById, legBreakEvenProbability } from "../slip-types";

describe("legBreakEvenProbability", () => {
  it("Power plays solve to payout^(-1/n)", () => {
    expect(legBreakEvenProbability(getSlipById("pp_power_2"))).toBeCloseTo(1 / Math.sqrt(3), 6);
    expect(legBreakEvenProbability(getSlipById("pp_power_5"))).toBeCloseTo(Math.pow(20, -1 / 5), 6);
  });

  it("Underdog 4-pick Standard pays 12x (break-even 12^(-1/4))", () => {
    expect(getSlipById("ud_std_4").payoutGrid).toEqual([0, 0, 0, 0, 12]);
    expect(legBreakEvenProbability(getSlipById("ud_std_4"))).toBeCloseTo(Math.pow(12, -1 / 4), 6);
  });

  it("PrizePicks 2-pick Flex break-even is the golden-ratio root, (sqrt(5) - 1) / 2", () => {
    // 2p^2 + 0.5 * 2p(1 - p) = 1  ->  p^2 + p - 1 = 0
    expect(legBreakEvenProbability(getSlipById("pp_flex_2"))).toBeCloseTo((Math.sqrt(5) - 1) / 2, 6);
  });

  it("every available grid has length picks + 1 and is non-decreasing in hits", () => {
    for (const s of SLIP_TYPES.filter((x) => x.available)) {
      expect(s.payoutGrid.length).toBe(s.picks + 1);
      for (let k = 1; k < s.payoutGrid.length; k++) {
        expect(s.payoutGrid[k]).toBeGreaterThanOrEqual(s.payoutGrid[k - 1]);
      }
    }
  });

  it("Flex 5 break-even is about 54.25%", () => {
    expect(legBreakEvenProbability(getSlipById("pp_flex_5"))).toBeCloseTo(0.5425, 2);
  });
});

describe("computeHeterogeneousSlipEV", () => {
  it("2-leg Power at p=0.5: EV = 0.25 * 3 - 1 = -25%", () => {
    const { ev, scenarios } = computeHeterogeneousSlipEV([0.5, 0.5], getSlipById("pp_power_2"));
    expect(ev).toBeCloseTo(-25, 8);
    expect(scenarios.map((s) => s.prob)).toEqual([0.25, 0.5, 0.25]);
  });

  it("3-leg heterogeneous case matches a hand computation", () => {
    // p = [0.6, 0.5, 0.4], Power 3 at 5x: P(all hit) = 0.12, EV = 0.12 * 5 - 1 = -40%
    const slip = { ...getSlipById("pp_power_2"), picks: 3, payoutGrid: [0, 0, 0, 5] };
    expect(computeHeterogeneousSlipEV([0.6, 0.5, 0.4], slip).ev).toBeCloseTo(-40, 8);
  });

  it("Flex 5 at p=0.5 returns -25% (0.4*10/32 + 2*5/32 + 10*1/32 = 0.75)", () => {
    const { ev } = computeHeterogeneousSlipEV(Array(5).fill(0.5), getSlipById("pp_flex_5"));
    expect(ev).toBeCloseTo(-25, 8);
  });

  it("is zero-EV at the solved break-even probability", () => {
    const slip = getSlipById("pp_flex_5");
    const p = legBreakEvenProbability(slip);
    expect(computeHeterogeneousSlipEV(Array(5).fill(p), slip).ev).toBeCloseTo(0, 4);
  });

  it("outcome probabilities sum to 1", () => {
    const { scenarios } = computeHeterogeneousSlipEV([0.55, 0.61, 0.48, 0.52, 0.58, 0.5], getSlipById("pp_flex_6"));
    expect(scenarios.reduce((a, s) => a + s.prob, 0)).toBeCloseTo(1, 12);
  });
});
