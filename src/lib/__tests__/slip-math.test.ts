import { describe, expect, it } from "vitest";
import { computeHeterogeneousSlipEV } from "../slip-math";
import { getSlipById, legBreakEvenProbability } from "../slip-types";

describe("legBreakEvenProbability", () => {
  it("Power plays solve to payout^(-1/n)", () => {
    expect(legBreakEvenProbability(getSlipById("pp_power_2"))).toBeCloseTo(1 / Math.sqrt(3), 6);
    expect(legBreakEvenProbability(getSlipById("pp_power_5"))).toBeCloseTo(Math.pow(20, -1 / 5), 6);
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
