import { describe, expect, it } from "vitest";
import { detectPhones } from "../src/lib/detectors";

describe("detectPhones", () => {
  it("detects Indian 10-digit mobile numbers starting with 6-9", () => {
    const text = "Primary: 9876543210, Alt: 87654 32109, Backup: 76543-21098, Desk: 654-321-0987.";
    const results = detectPhones(text);

    expect(results.map((item) => item.value)).toEqual([
      "9876543210",
      "87654 32109",
      "76543-21098",
      "654-321-0987",
    ]);
    for (const item of results) {
      expect(item.confidence).toBe("medium");
      expect(item.severity).toBe(3);
      expect(text.slice(item.start, item.end)).toBe(item.value);
    }
  });

  it("detects +91 and international E.164 phone formats", () => {
    const text = "IN: +91 98765 43210, US: +1 (415) 555-0199, UK: +44 20 7946 0958.";
    const results = detectPhones(text);

    expect(results.map((item) => item.value)).toEqual([
      "+91 98765 43210",
      "+1 (415) 555-0199",
      "+44 20 7946 0958",
    ]);
    for (const item of results) {
      expect(item.confidence).toBe("high");
    }
  });

  it("rejects invalid lengths, invalid +91 subscriber digits, dates, and identifiers", () => {
    const text = [
      "short: 987654321",
      "long: 98765432101",
      "badPrefix: 5876543210",
      "badPlus91: +91 5876543210",
      "tooShortIntl: +1 2345",
      "tooLongIntl: +1234567890123456",
      "date: 2026-11-27",
      "order: ORD-9876543210",
      "decimal: 9876543210.25",
    ].join(" | ");

    expect(detectPhones(text)).toHaveLength(0);
  });

  it("does not extract 10-digit phone substrings inside credit cards or Aadhaar numbers", () => {
    const text = "Card: 6070940000000009 Aadhaar: 987654321096 Spaced: 9876 5432 1096";
    expect(detectPhones(text)).toHaveLength(0);
  });
});
