import { describe, expect, it } from "vitest";
import { createDetectionId, detectPii } from "../src/lib/detectors";
import { redactText } from "../src/lib/redaction";
import type { Detection } from "../src/types/detection";

describe("redaction text and CSV integrity", () => {
  it("preserves CSV quoted fields, embedded commas, escaped quotes, and CRLF newlines", () => {
    const csv = [
      "id,customer_notes,contact_email,ip_address",
      '"101","Said ""call back, urgent"" at 98765 43210","alice@example.com","192.168.1.50"',
      '"102","Multi-line\r\nnote for PAN ABCPD1234F, verified","bob@example.org","10.0.0.2"',
    ].join("\r\n");

    const detections = detectPii(csv);

    const full = redactText(csv, detections, "FULL");
    expect(full.sanitizedText).toBe(
      [
        "id,customer_notes,contact_email,ip_address",
        '"101","Said ""call back, urgent"" at [REDACTED]","[REDACTED]","[REDACTED]"',
        '"102","Multi-line\r\nnote for PAN [REDACTED], verified","[REDACTED]","[REDACTED]"',
      ].join("\r\n"),
    );

    const partial = redactText(csv, detections, "PARTIAL");
    expect(partial.sanitizedText).toBe(
      [
        "id,customer_notes,contact_email,ip_address",
        '"101","Said ""call back, urgent"" at ***** *3210","a***@example.com","192.168.*.*"',
        '"102","Multi-line\r\nnote for PAN AB*******F, verified","b***@example.org","10.0.*.*"',
      ].join("\r\n"),
    );

    const pseudo = redactText(csv, detections, "PSEUDONYMIZE");
    expect(pseudo.sanitizedText).toBe(
      [
        "id,customer_notes,contact_email,ip_address",
        '"101","Said ""call back, urgent"" at PHONE_01","EMAIL_01","IPV4_01"',
        '"102","Multi-line\r\nnote for PAN PAN_01, verified","EMAIL_02","IPV4_02"',
      ].join("\r\n"),
    );
  });

  it("handles adjacent detections and preserves unaffected boundary characters", () => {
    const text = "ABCPD1234Falice@example.com";
    const adjacentDetections: Detection[] = [
      {
        id: createDetectionId("PAN", 0, 10),
        type: "PAN",
        start: 0,
        end: 10,
        value: "ABCPD1234F",
        confidence: "high",
        reasons: ["PAN format matched."],
        severity: 4,
      },
      {
        id: createDetectionId("EMAIL", 10, 27),
        type: "EMAIL",
        start: 10,
        end: 27,
        value: "alice@example.com",
        confidence: "high",
        reasons: ["RFC-lite email syntax matched."],
        severity: 3,
      },
    ];

    expect(redactText(text, adjacentDetections, "FULL").sanitizedText).toBe("[REDACTED][REDACTED]");
    expect(redactText(text, adjacentDetections, "PARTIAL").sanitizedText).toBe(
      "AB*******Fa***@example.com",
    );
    expect(redactText(text, adjacentDetections, "PSEUDONYMIZE").sanitizedText).toBe(
      "PAN_01EMAIL_01",
    );
  });

  it("validates boundaries without exposing raw PII in thrown errors", () => {
    const sensitiveEmail = "secret.person@private.example";
    const validDetection: Detection = {
      id: createDetectionId("EMAIL", 0, sensitiveEmail.length),
      type: "EMAIL",
      start: 0,
      end: sensitiveEmail.length,
      value: sensitiveEmail,
      confidence: "high",
      reasons: ["RFC-lite email syntax matched."],
      severity: 3,
    };

    try {
      redactText("different text of enough length!", [validDetection], "FULL");
      expect.unreachable("Expected RangeError for mismatched slice");
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).not.toContain(sensitiveEmail);
    }

    const overlapping: Detection[] = [
      validDetection,
      {
        id: createDetectionId("PHONE", 5, 15),
        type: "PHONE",
        start: 5,
        end: 15,
        value: "person@pri",
        confidence: "medium",
        reasons: ["Synthetic overlap."],
        severity: 3,
      },
    ];

    expect(() => redactText(sensitiveEmail, overlapping, "FULL")).toThrow(RangeError);
  });
});
