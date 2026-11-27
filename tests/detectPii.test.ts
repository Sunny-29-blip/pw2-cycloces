import { describe, expect, it } from "vitest";
import { createDetectionId, detectPii, resolveOverlaps } from "../src/lib/detectors";
import type { Detection } from "../src/types/detection";

describe("detectPii and resolveOverlaps", () => {
  it("resolves card versus phone and Aadhaar versus phone overlaps using priority", () => {
    const text = "Card: 6070940000000009, Aadhaar: 987654321096, Phone: +91 98765 43210";
    const results = detectPii(text);

    expect(results.map((item) => item.type)).toEqual(["CREDIT_CARD", "AADHAAR", "PHONE"]);
    expect(results.map((item) => item.value)).toEqual([
      "6070940000000009",
      "987654321096",
      "+91 98765 43210",
    ]);
  });

  it("enforces explicit priority and longest-match rules in overlap resolution", () => {
    const candidates: Detection[] = [
      {
        id: createDetectionId("PHONE", 0, 10),
        type: "PHONE",
        start: 0,
        end: 10,
        value: "9876543210",
        confidence: "medium",
        reasons: ["Test phone overlap."],
        severity: 3,
      },
      {
        id: createDetectionId("AADHAAR", 0, 12),
        type: "AADHAAR",
        start: 0,
        end: 12,
        value: "987654321096",
        confidence: "high",
        reasons: ["Test Aadhaar priority."],
        severity: 5,
      },
      {
        id: createDetectionId("EMAIL", 20, 32),
        type: "EMAIL",
        start: 20,
        end: 32,
        value: "a@b.co.uk.in",
        confidence: "high",
        reasons: ["Shorter email."],
        severity: 3,
      },
      {
        id: createDetectionId("EMAIL", 18, 35),
        type: "EMAIL",
        start: 18,
        end: 35,
        value: "x.a@b.co.uk.in.us",
        confidence: "high",
        reasons: ["Longer equal-priority email."],
        severity: 3,
      },
    ];

    const resolved = resolveOverlaps(candidates);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.type).toBe("AADHAAR");
    expect(resolved[1]?.value).toBe("x.a@b.co.uk.in.us");
  });

  it("rejects malformed candidate detections before overlap resolution", () => {
    const invalidCandidate = {
      id: "WRONG:0:5",
      type: "PAN",
      start: 0,
      end: 5,
      value: "ABCDE",
      confidence: "high",
      reasons: [],
      severity: 9,
    } as unknown as Detection;

    expect(resolveOverlaps([invalidCandidate])).toEqual([]);
  });

  it("sorts detections by start offset, preserves exact slices, and uses deterministic IDs", () => {
    const text = "Call +1 (415) 555-0199 or mail ops@example.org from 10.0.0.1 for PAN ABCPD1234F.";

    const firstRun = detectPii(text);
    const secondRun = detectPii(text);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.map((item) => item.type)).toEqual(["PHONE", "EMAIL", "IPV4", "PAN"]);

    for (let index = 0; index < firstRun.length; index += 1) {
      const current = firstRun[index];
      const next = firstRun[index + 1];
      expect(current).toBeDefined();
      if (!current) {
        continue;
      }
      expect(text.slice(current.start, current.end)).toBe(current.value);
      expect(current.id).toBe(`${current.type}:${current.start}:${current.end}`);
      expect(["high", "medium", "low"]).toContain(current.confidence);
      expect(Number.isInteger(current.severity)).toBe(true);
      expect(current.severity).toBeGreaterThanOrEqual(1);
      expect(current.severity).toBeLessThanOrEqual(5);
      expect(current.reasons.length).toBeGreaterThan(0);
      if (next) {
        expect(current.end).toBeLessThanOrEqual(next.start);
      }
    }
  });

  it("handles empty strings, rejects non-string input, and scales to large text", () => {
    expect(detectPii("")).toEqual([]);
    expect(() => detectPii(null as unknown as string)).toThrow(TypeError);

    const filler = "Non-sensitive audit log line with normal timestamps 2026-11-27. ".repeat(1800);
    const largeInput = `${filler}Contact alice@example.com from 192.168.10.20. ${filler}`;
    const results = detectPii(largeInput);

    expect(results.map((item) => item.value)).toEqual(["alice@example.com", "192.168.10.20"]);
  });
});
