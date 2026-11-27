import { describe, expect, it } from "vitest";
import { detectPii } from "../src/lib/detectors";
import { applyFullMask } from "../src/lib/redaction";

describe("applyFullMask", () => {
  it("replaces every detected entity type with [REDACTED]", () => {
    const text = [
      "Email: john@example.com",
      "Phone: +91 98765 43210",
      "Card: 4111 1111 1111 1111",
      "Aadhaar: 2345 6789 0124",
      "IP: 192.168.1.1",
      "PAN: ABCPD1234F",
    ].join("\n");

    const detections = detectPii(text);
    const result = applyFullMask(text, detections);

    expect(result.mode).toBe("FULL");
    expect(result.redactedCount).toBe(6);
    expect(result.ignoredCount).toBe(0);
    expect(result.sanitizedText).toBe(
      [
        "Email: [REDACTED]",
        "Phone: [REDACTED]",
        "Card: [REDACTED]",
        "Aadhaar: [REDACTED]",
        "IP: [REDACTED]",
        "PAN: [REDACTED]",
      ].join("\n"),
    );
  });

  it("handles multiple occurrences while preserving unaffected text and newlines", () => {
    const text = "First: alice@example.com; Second: bob@example.org; Repeat: alice@example.com!";
    const detections = detectPii(text);
    const result = applyFullMask(text, detections);

    expect(result.redactedCount).toBe(3);
    expect(result.sanitizedText).toBe("First: [REDACTED]; Second: [REDACTED]; Repeat: [REDACTED]!");
  });

  it("preserves ignored detections without mutating the supplied Set or detections", () => {
    const text = "Keep alice@example.com, hide bob@example.org, keep 10.0.0.1.";
    const detections = detectPii(text);
    const firstEmail = detections[0];
    const ipDetection = detections[2];
    expect(firstEmail).toBeDefined();
    expect(ipDetection).toBeDefined();

    const ignoredIds = new Set<string>([firstEmail?.id ?? "", ipDetection?.id ?? ""]);
    const snapshotSize = ignoredIds.size;
    const result = applyFullMask(text, detections, ignoredIds);

    expect(result.redactedCount).toBe(1);
    expect(result.ignoredCount).toBe(2);
    expect(result.sanitizedText).toBe("Keep alice@example.com, hide [REDACTED], keep 10.0.0.1.");
    expect(ignoredIds.size).toBe(snapshotSize);
  });

  it("handles empty input and documents with no detections", () => {
    expect(applyFullMask("", [])).toEqual({
      mode: "FULL",
      sanitizedText: "",
      redactedCount: 0,
      ignoredCount: 0,
    });

    const plainText = "System operational. No personal data present.";
    expect(applyFullMask(plainText, detectPii(plainText))).toEqual({
      mode: "FULL",
      sanitizedText: plainText,
      redactedCount: 0,
      ignoredCount: 0,
    });
  });

  it("throws when an ignored ID does not belong to the supplied detections", () => {
    const text = "Contact alice@example.com";
    const detections = detectPii(text);

    expect(() => applyFullMask(text, detections, new Set(["EMAIL:999:1005"]))).toThrow(RangeError);
  });
});
