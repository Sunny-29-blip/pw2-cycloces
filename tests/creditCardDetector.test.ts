import { describe, expect, it } from "vitest";
import { classifyCardIssuer, detectCreditCards } from "../src/lib/detectors";

describe("detectCreditCards", () => {
  it("detects Luhn-valid synthetic Visa, Mastercard, Amex, and RuPay numbers", () => {
    const text = [
      "Visa16: 4111 1111 1111 1111",
      "Visa13: 4111111111119",
      "Visa19: 4000000000000000006",
      "MC5: 5555-5555-5555-4444",
      "MC2: 2223000048400011",
      "Amex: 3782-822463-10005",
      "RuPay: 6070 9400 0000 0009",
    ].join(" | ");

    const results = detectCreditCards(text);
    expect(results).toHaveLength(7);

    for (const item of results) {
      expect(item.confidence).toBe("high");
      expect(item.severity).toBe(5);
      expect(item.reasons).toContain("Luhn checksum passed.");
      expect(text.slice(item.start, item.end)).toBe(item.value);
    }

    expect(results[0]?.reasons).toContain("Visa prefix and length recognized.");
    expect(results[3]?.reasons).toContain("Mastercard prefix and length recognized.");
    expect(results[5]?.reasons).toContain("American Express prefix and length recognized.");
    expect(results[6]?.reasons).toContain("RuPay prefix and length recognized.");
  });

  it("classifies uncertain valid-Luhn card numbers as UNKNOWN with medium confidence", () => {
    const text = "Other Luhn card: 6011-1111-1111-1117";
    const results = detectCreditCards(text);

    expect(results).toHaveLength(1);
    expect(classifyCardIssuer("6011111111111117")).toBe("UNKNOWN");
    expect(results[0]?.confidence).toBe("medium");
    expect(results[0]?.reasons).toContain(
      "Issuer prefix not in recognized set; classified as UNKNOWN.",
    );
  });

  it("rejects Luhn-invalid numbers and invalid lengths", () => {
    const text = [
      "badLuhn: 4111 1111 1111 1112",
      "random16: 5432 1098 7654 3211",
      "tooShort12: 411111111116",
      "tooLong20: 41111111111111111112",
    ].join(" ");

    expect(detectCreditCards(text)).toHaveLength(0);
  });
});
