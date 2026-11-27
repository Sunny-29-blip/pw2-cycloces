import { describe, expect, it } from "vitest";
import { detectAadhaars } from "../src/lib/detectors";

describe("detectAadhaars", () => {
  it("detects continuous and 4-4-4 space-separated Verhoeff-valid Aadhaar numbers", () => {
    const text = "Continuous: 234567890124 and Spaced: 5555 6666 7771.";
    const results = detectAadhaars(text);

    expect(results).toHaveLength(2);
    expect(results[0]?.value).toBe("234567890124");
    expect(results[0]?.confidence).toBe("high");
    expect(results[0]?.severity).toBe(5);
    expect(results[0]?.reasons).toContain("Verhoeff checksum passed.");

    expect(results[1]?.value).toBe("5555 6666 7771");
    expect(text.slice(results[1]?.start ?? 0, results[1]?.end ?? 0)).toBe("5555 6666 7771");
  });

  it("rejects Verhoeff-invalid candidates completely", () => {
    const text = "Invalid checksums: 234567890125 and 5555 6666 7772.";
    expect(detectAadhaars(text)).toHaveLength(0);
  });

  it("rejects invalid first digits (0 or 1), invalid digit counts, and card substrings", () => {
    const text = [
      "startsZero: 034567890120",
      "startsOne: 123456789012",
      "short: 23456789012",
      "long: 2345678901249",
      "spacedCard: 2345 6789 0124 9999",
    ].join(" ");

    expect(detectAadhaars(text)).toHaveLength(0);
  });
});
