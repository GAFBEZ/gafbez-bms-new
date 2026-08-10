import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPaystackConfig, initiateRefund, isValidRefundResponse } from "./paystack";

describe("hasPaystackConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when PAYSTACK_SECRET_KEY is unset", () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    expect(hasPaystackConfig()).toBe(false);
  });

  it("is true when PAYSTACK_SECRET_KEY is set", () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_something");
    expect(hasPaystackConfig()).toBe(true);
  });
});

describe("isValidRefundResponse", () => {
  it("accepts a well-formed Paystack refund response", () => {
    const body = { status: true, data: { status: "processed", transaction: { reference: "T123" } } };
    expect(isValidRefundResponse(body)).toBe(true);
  });

  it("rejects null and non-object bodies", () => {
    expect(isValidRefundResponse(null)).toBe(false);
    expect(isValidRefundResponse("a string")).toBe(false);
    expect(isValidRefundResponse(undefined)).toBe(false);
  });

  it("rejects a body missing the top-level status flag", () => {
    expect(isValidRefundResponse({ data: { status: "processed", transaction: { reference: "T123" } } })).toBe(false);
  });

  it("rejects a body whose data.transaction is missing a reference", () => {
    expect(isValidRefundResponse({ status: true, data: { status: "processed", transaction: {} } })).toBe(false);
  });

  it("rejects a body with no data object at all", () => {
    expect(isValidRefundResponse({ status: true })).toBe(false);
  });
});

describe("initiateRefund", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws immediately without calling fetch when Paystack is not configured", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(initiateRefund("T123")).rejects.toThrow("Paystack is not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the refund status and reference on a successful response", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_something");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, data: { status: "processed", transaction: { reference: "T123" } } }),
      }),
    );

    await expect(initiateRefund("T123")).resolves.toEqual({ status: "processed", reference: "T123" });
  });

  it("throws Paystack's own message when the request fails with one", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_something");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: false, message: "Transaction already refunded" }),
      }),
    );

    await expect(initiateRefund("T123")).rejects.toThrow("Transaction already refunded");
  });

  it("throws a generic error when the response body can't be parsed as JSON", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_something");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await expect(initiateRefund("T123")).rejects.toThrow("Paystack refund request failed with status 500");
  });

  it("rejects a 200 response whose body doesn't match the expected shape", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_something");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: "shape" }),
      }),
    );

    await expect(initiateRefund("T123")).rejects.toThrow();
  });
});
