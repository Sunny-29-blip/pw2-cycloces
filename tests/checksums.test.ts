import { describe, expect, it } from "vitest";
import { isValidLuhn, isValidVerhoeff } from "../src/lib/detectors";

describe("isValidLuhn", () => {
  it("accepts valid Luhn digit strings", () => {
    expect(isValidLuhn("4111111111111111")).toBe(true);
    expect(isValidLuhn("378282246310005")).toBe(true);
    expect(isValidLuhn("79927398713")).toBe(true);
  });

  it("rejects single-digit corruption and non-digit inputs", () => {
    expect(isValidLuhn("4111111111111112")).toBe(false);
    expect(isValidLuhn("79927398710")).toBe(false);
    expect(isValidLuhn("")).toBe(false);
    expect(isValidLuhn("4")).toBe(false);
    expect(isValidLuhn("4111-1111-1111-1111")).toBe(false);
  });
});

describe("isValidVerhoeff", () => {
  it("accepts valid Verhoeff digit strings", () => {
    expect(isValidVerhoeff("2363")).toBe(true);
    expect(isValidVerhoeff("234567890124")).toBe(true);
    expect(isValidVerhoeff("987654321096")).toBe(true);
    expect(isValidVerhoeff("555566667771")).toBe(true);
  });

  it("rejects corrupted digits, adjacent transpositions, and non-digits", () => {
    expect(isValidVerhoeff("2364")).toBe(false);
    expect(isValidVerhoeff("234567890125")).toBe(false);
    expect(isValidVerhoeff("234567890214")).toBe(false);
    expect(isValidVerhoeff("")).toBe(false);
    expect(isValidVerhoeff("2345 6789 0124")).toBe(false);
  });
});
