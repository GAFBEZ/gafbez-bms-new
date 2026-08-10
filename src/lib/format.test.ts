import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatFileSize, formatTime } from "./format";

describe("formatCurrency", () => {
  it("formats a whole Naira amount with the currency symbol and no decimals", () => {
    expect(formatCurrency(500000)).toBe("₦500,000");
  });

  it("rounds off fractional kobo rather than showing decimals", () => {
    expect(formatCurrency(1500.75)).toBe("₦1,501");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₦0");
  });

  it("formats a negative amount (e.g. a refund/adjustment)", () => {
    expect(formatCurrency(-2000)).toBe("-₦2,000");
  });
});

describe("formatFileSize", () => {
  it("renders an em dash for null", () => {
    expect(formatFileSize(null)).toBe("—");
  });

  it("formats bytes under 1KB as bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes with one decimal place", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes with one decimal place", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("treats exactly 1024 bytes as the KB boundary", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });
});

describe("formatDate and formatTime", () => {
  it("formats a date string into day/month/year", () => {
    expect(formatDate("2026-07-14T10:00:00Z")).toMatch(/14 Jul 2026/);
  });

  it("formats a Date object the same way as an equivalent string", () => {
    const date = new Date("2026-07-14T10:00:00Z");
    expect(formatDate(date)).toBe(formatDate("2026-07-14T10:00:00Z"));
  });

  it("formats a time string as hour:minute", () => {
    expect(formatTime("2026-07-14T10:05:00Z")).toMatch(/^\d{1,2}:\d{2}/);
  });
});
