import { describe, expect, it } from "vitest";
import { detectPans, PAN_HOLDER_CATEGORIES } from "../src/lib/detectors";

describe("detectPans", () => {
  it("detects valid PANs across all supported holder categories", () => {
    for (const category of PAN_HOLDER_CATEGORIES) {
      const pan = `ABC${category}E1234F`;
      const text = `Taxpayer PAN: ${pan} verified.`;
      const results = detectPans(text);

      expect(results).toHaveLength(1);
      expect(results[0]?.value).toBe(pan);
      expect(results[0]?.confidence).toBe("high");
      expect(results[0]?.severity).toBe(4);
      expect(results[0]?.reasons).toContain(
        `Valid holder-category character '${category}' verified.`,
      );
    }
  });

  it("rejects invalid fourth-character holder categories", () => {
    const invalidCategories = [
      "D",
      "E",
      "I",
      "K",
      "M",
      "N",
      "O",
      "Q",
      "R",
      "S",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ];
    for (const category of invalidCategories) {
      expect(detectPans(`ID: ABC${category}E1234F`)).toHaveLength(0);
    }
  });

  it("rejects invalid lengths, lowercase inputs, and unseparated tokens", () => {
    const text = "Invalid: ABCP1234F ABCPE1234FX 1ABCPE1234F abcpe1234f ABCPE12345";
    expect(detectPans(text)).toHaveLength(0);
  });
});
