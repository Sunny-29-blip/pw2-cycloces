import { describe, expect, it } from "vitest";
import { detectPii } from "../src/lib/detectors";
import { applyPseudonymization } from "../src/lib/redaction";

describe("applyPseudonymization", () => {
  it("normalizes email casing so repeated emails map to the same placeholder", () => {
    const text = "Contact sunny@example.com.\nAgain: SUNNY@example.com.\nOther: dev@example.com.";
    const detections = detectPii(text);
    const result = applyPseudonymization(text, detections);

    expect(result.sanitizedText).toBe("Contact EMAIL_01.\nAgain: EMAIL_01.\nOther: EMAIL_02.");
    expect(result.sanitizedText).not.toContain("sunny@example.com");
    expect(result.pseudonymMetadata?.countsByType.EMAIL).toBe(2);
  });

  it("normalizes differently formatted cards, Aadhaar numbers, and phones consistently", () => {
    const text = [
      "Card A: 4111 1111 1111 1111",
      "Card B: 4111-1111-1111-1111",
      "Card C: 5555555555554444",
      "Phone A: 9876543210",
      "Phone B: 98765 43210",
      "Phone C: +91 98765 43210",
      "Aadhaar A: 234567890124",
      "Aadhaar B: 2345 6789 0124",
    ].join("\n");

    const detections = detectPii(text);
    const result = applyPseudonymization(text, detections);

    expect(result.sanitizedText).toBe(
      [
        "Card A: CARD_01",
        "Card B: CARD_01",
        "Card C: CARD_02",
        "Phone A: PHONE_01",
        "Phone B: PHONE_01",
        "Phone C: PHONE_02",
        "Aadhaar A: AADHAAR_01",
        "Aadhaar B: AADHAAR_01",
      ].join("\n"),
    );
  });

  it("maintains independent per-type counters in order of first appearance", () => {
    const text =
      "Email a@example.com, IP 10.0.0.1, PAN ABCPD1234F, Phone 9876543210, Email b@example.com, IP 10.0.0.2";
    const result = applyPseudonymization(text, detectPii(text));

    expect(result.sanitizedText).toBe(
      "Email EMAIL_01, IP IPV4_01, PAN PAN_01, Phone PHONE_01, Email EMAIL_02, IP IPV4_02",
    );
    expect(result.pseudonymMetadata?.totalPlaceholders).toBe(6);
  });

  it("does not consume counters for ignored detections and starts fresh across sessions", () => {
    const text = "First skip@example.com then active@example.com.";
    const detections = detectPii(text);
    const firstDetection = detections[0];
    expect(firstDetection).toBeDefined();

    const firstRun = applyPseudonymization(text, detections, new Set([firstDetection?.id ?? ""]));
    expect(firstRun.sanitizedText).toBe("First skip@example.com then EMAIL_01.");
    expect(firstRun.pseudonymMetadata?.countsByType.EMAIL).toBe(1);

    const secondText = "New session: other@example.com.";
    const secondRun = applyPseudonymization(secondText, detectPii(secondText));
    expect(secondRun.sanitizedText).toBe("New session: EMAIL_01.");
    expect(secondRun.pseudonymMetadata?.totalPlaceholders).toBe(1);
  });
});
