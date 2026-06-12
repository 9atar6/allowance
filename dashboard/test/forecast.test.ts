import { describe, expect, it } from "vitest";
import { forecastDepletion } from "@/lib/forecast";

const TODAY = new Date("2026-06-12T12:00:00Z");

describe("forecastDepletion", () => {
  it("projects depletion from the 7-day average (excluding today)", () => {
    // 7 complete days at $1/day + a partial today -> $5 lasts 5 days.
    const costs = [1, 1, 1, 1, 1, 1, 1, 0.4];
    const f = forecastDepletion(5, costs, TODAY);
    expect(f).not.toBeNull();
    expect(f!.days).toBeCloseTo(5);
    expect(f!.dateLabel).toBe("Jun 17");
  });

  it("returns null with no spend history", () => {
    expect(forecastDepletion(5, [0, 0, 0, 0.2], TODAY)).toBeNull();
  });

  it("returns null at zero balance", () => {
    expect(forecastDepletion(0, [1, 1, 1, 1], TODAY)).toBeNull();
  });

  it("returns null when depletion is over a year away", () => {
    expect(forecastDepletion(1000, [0.001, 0.001, 0.001, 0], TODAY)).toBeNull();
  });

  it("handles a short history window", () => {
    // Only 2 complete days of data.
    const f = forecastDepletion(4, [2, 2, 1], TODAY);
    expect(f!.days).toBeCloseTo(2);
  });
});
