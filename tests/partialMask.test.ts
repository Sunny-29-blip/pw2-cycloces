import { describe, expect, it } from "vitest";
import { createDetectionId, detectPii } from "../src/lib/detectors";
import { applyPartialMask } from "../src/lib/redaction";
import type { Detection } from "../src/types/detection";

describe("applyPartialMask", () => {
  it("applies entity-specific partial masks across all six categories", () => {
    const text = [
      "Email: john.doe@domain.com",
      "Phone: +91 98765 43210",
      "Card: 4000-0000-0008-1234",
      "Aadhaar: 2345 6789 0124",
      "IP: 192.168.42.19",
      "PAN: ABCPD1234F",
    ].join("\n");

    const detections = detectPii(text);
    const result = applyPartialMask(text, detections);

    expect(result.mode).toBe("PARTIAL");
    expect(result.redactedCount).toBe(6);
    expect(result.sanitizedText).toBe(
      [
        "Email: j***@domain.com",
        "Phone: +** ***** *3210",
        "Card: XXXX-XXXX-XXXX-1234",
        "Aadhaar: XXXX XXXX 0124",
        "IP: 192.168.*.*",
        "PAN: AB*******F",
      ].join("\n"),
    );
    expect(result.sanitizedText).not.toContain(",");
    expect(result.sanitizedText).not.toContain('"');
  });

  it("handles short and unusual inputs safely without exposing full identifiers", () => {
    const text = "a@x.co | 9876543210 | 1234 | ABC | 10.0.0.1";
    const manualDetections: Detection[] = [
      {
        id: createDetectionId("EMAIL", 0, 6),
        type: "EMAIL",
        start: 0,
        end: 6,
        value: "a@x.co",
        confidence: "high",
        reasons: ["Test fixture."],
        severity: 3,
      },
      {
        id: createDetectionId("PHONE", 9, 19),
        type: "PHONE",
        start: 9,
        end: 19,
        value: "9876543210",
        confidence: "medium",
        reasons: ["Test fixture."],
        severity: 3,
      },
      {
        id: createDetectionId("PHONE", 22, 26),
        type: "PHONE",
        start: 22,
        end: 26,
        value: "1234",
        confidence: "low",
        reasons: ["Short synthetic edge case."],
        severity: 3,
      },
      {
        id: createDetectionId("PAN", 29, 32),
        type: "PAN",
        start: 29,
        end: 32,
        value: "ABC",
        confidence: "low",
        reasons: ["Short synthetic edge case."],
        severity: 4,
      },
      {
        id: createDetectionId("IPV4", 35, 43),
        type: "IPV4",
        start: 35,
        end: 43,
        value: "10.0.0.1",
        confidence: "high",
        reasons: ["Test fixture."],
        severity: 2,
      },
    ];

    const result = applyPartialMask(text, manualDetections);
    expect(result.sanitizedText).toBe("a***@x.co | ******3210 | **** | *** | 10.0.*.*");
  });

  it("masks repeated identifiers consistently and respects ignored IDs", () => {
    const text = "Call 98765-43210, then 98765-43210 again, or email j@test.org.";
    const detections = detectPii(text);
    const secondPhone = detections[1];
    expect(secondPhone).toBeDefined();

    const result = applyPartialMask(text, detections, new Set([secondPhone?.id ?? ""]));
    expect(result.sanitizedText).toBe(
      "Call *****-*3210, then 98765-43210 again, or email j***@test.org.",
    );
    expect(result.redactedCount).toBe(2);
    expect(result.ignoredCount).toBe(1);
  });
});
