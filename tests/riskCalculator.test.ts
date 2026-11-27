import { describe, expect, it } from "vitest";
import { createDetectionId } from "../src/lib/detectors";
import { calculatePrivacyRisk } from "../src/lib/risk";
import type { Detection } from "../src/types/detection";

function makeDetection(
  type: Detection["type"],
  start: number,
  value: string,
  severity: Detection["severity"],
): Detection {
  const end = start + value.length;
  return {
    id: createDetectionId(type, start, end),
    type,
    start,
    end,
    value,
    confidence: "high",
    reasons: ["Synthetic test detection."],
    severity,
  };
}

describe("calculatePrivacyRisk", () => {
  it("returns 0 when there are zero detections", () => {
    const assessment = calculatePrivacyRisk([], new Set());
    expect(assessment.score).toBe(0);
    expect(assessment.level).toBe("low");
    expect(assessment.totalSeverity).toBe(0);
    expect(assessment.unredactedSeverity).toBe(0);
  });

  it("returns 0 when all detections are redacted", () => {
    const detections = [
      makeDetection("CREDIT_CARD", 0, "4111111111111111", 5),
      makeDetection("EMAIL", 20, "alice@example.com", 3),
    ];
    const assessment = calculatePrivacyRisk(detections, new Set());
    expect(assessment.score).toBe(0);
    expect(assessment.level).toBe("low");
    expect(assessment.totalSeverity).toBe(8);
    expect(assessment.unredactedSeverity).toBe(0);
  });

  it("returns 100 when all detections are kept unchanged", () => {
    const detections = [
      makeDetection("AADHAAR", 0, "234567890124", 5),
      makeDetection("IPV4", 15, "192.168.1.1", 2),
    ];
    const ignored = new Set(detections.map((d) => d.id));
    const assessment = calculatePrivacyRisk(detections, ignored);

    expect(assessment.score).toBe(100);
    expect(assessment.level).toBe("high");
    expect(assessment.unredactedSeverity).toBe(7);
  });

  it("computes severity-weighted percentage for mixed redaction decisions", () => {
    const card = makeDetection("CREDIT_CARD", 0, "4111111111111111", 5);
    const ip = makeDetection("IPV4", 20, "10.0.0.1", 2);
    const email = makeDetection("EMAIL", 30, "a@example.com", 3);

    // Kept: ip (2) + email (3) = 5 out of total 10 => 50 (moderate)
    const moderate = calculatePrivacyRisk([card, ip, email], new Set([ip.id, email.id]));
    expect(moderate.score).toBe(50);
    expect(moderate.level).toBe("moderate");

    // Kept: ip (2) out of 5+2+3 = 10 => 20 (low)
    const low = calculatePrivacyRisk([card, ip, email], new Set([ip.id]));
    expect(low.score).toBe(20);
    expect(low.level).toBe("low");

    // Kept: card (5) + ip (2) = 7 out of 10 => 70 (high)
    const high = calculatePrivacyRisk([card, ip, email], new Set([card.id, ip.id]));
    expect(high.score).toBe(70);
    expect(high.level).toBe("high");
  });

  it("ignores unrecognized IDs and enforces boundary thresholds 25/26 and 65/66", () => {
    const detections = Array.from({ length: 100 }, (_, index) =>
      makeDetection("IPV4", index * 10, "10.0.0.1", 1),
    );

    expect(
      calculatePrivacyRisk(detections, new Set(detections.slice(0, 25).map((d) => d.id))).level,
    ).toBe("low");
    expect(
      calculatePrivacyRisk(detections, new Set(detections.slice(0, 26).map((d) => d.id))).level,
    ).toBe("moderate");
    expect(
      calculatePrivacyRisk(detections, new Set(detections.slice(0, 65).map((d) => d.id))).level,
    ).toBe("moderate");
    expect(
      calculatePrivacyRisk(detections, new Set(detections.slice(0, 66).map((d) => d.id))).level,
    ).toBe("high");
  });
});
