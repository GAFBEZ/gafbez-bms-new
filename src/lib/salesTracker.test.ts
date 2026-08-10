import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysToWindow, rangeToWindow } from "./salesTracker";

// Deliberately never uses a date-only ISO string ("2026-07-14") anywhere
// in this file, for input or expectations -- those parse as UTC
// midnight, which lands on a different LOCAL calendar day depending on
// the test runner's timezone and would make these assertions flaky.
// new Date(year, monthIndex, day) is always local, matching how
// daysToWindow/rangeToWindow themselves build dates.

describe("daysToWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 14, 15, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an open-ended window (no since/until) when days is omitted", () => {
    expect(daysToWindow(undefined)).toEqual({});
  });

  it("sets since to local midnight on the given date for a 1-day window", () => {
    const window = daysToWindow(1);
    expect(window.since?.toDateString()).toBe(new Date(2026, 6, 14).toDateString());
    expect(window.since?.getHours()).toBe(0);
    expect(window.until).toBeUndefined();
  });

  it("counts back inclusively for a multi-day window (7 days includes today)", () => {
    const window = daysToWindow(7);
    expect(window.since?.toDateString()).toBe(new Date(2026, 6, 8).toDateString());
  });
});

describe("rangeToWindow", () => {
  it("normalizes since to local midnight of the from date", () => {
    const window = rangeToWindow(new Date(2026, 6, 1, 18, 45), new Date(2026, 6, 1, 18, 45));
    expect(window.since?.getHours()).toBe(0);
    expect(window.since?.getMinutes()).toBe(0);
  });

  it("sets until to midnight of the day AFTER the to date (exclusive upper bound)", () => {
    const window = rangeToWindow(new Date(2026, 6, 1), new Date(2026, 6, 5));
    expect(window.until?.toDateString()).toBe(new Date(2026, 6, 6).toDateString());
  });

  it("produces a single inclusive day when from and to are the same date", () => {
    const window = rangeToWindow(new Date(2026, 6, 1), new Date(2026, 6, 1));
    expect(window.since?.toDateString()).toBe(new Date(2026, 6, 1).toDateString());
    expect(window.until?.toDateString()).toBe(new Date(2026, 6, 2).toDateString());
  });

  it("handles a range spanning a month boundary correctly", () => {
    const window = rangeToWindow(new Date(2026, 6, 30), new Date(2026, 6, 31));
    expect(window.until?.toDateString()).toBe(new Date(2026, 7, 1).toDateString());
  });
});
