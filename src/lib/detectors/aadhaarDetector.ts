import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";
import { isValidVerhoeff } from "./verhoeff";

const AADHAAR_CANDIDATE_PATTERN =
  /(?<![\dA-Za-z]|\d[ -])(?:\d{12}|\d{4} \d{4} \d{4})(?![\dA-Za-z]|[ -]\d)/g;

const AADHAAR_DIGITS_PATTERN = /^[2-9]\d{11}$/;
const AADHAAR_DIGIT_COUNT = 12;

/**
 * Detects 12-digit continuous and 4-4-4 space-separated Aadhaar numbers verified by Verhoeff checksum.
 */
export function detectAadhaars(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];

  for (const match of text.matchAll(AADHAAR_CANDIDATE_PATTERN)) {
    const value = match[0];
    const start = match.index;
    if (start === undefined) {
      continue;
    }

    const digits = value.replaceAll(" ", "");
    if (digits.length !== AADHAAR_DIGIT_COUNT || !AADHAAR_DIGITS_PATTERN.test(digits)) {
      continue;
    }

    if (!isValidVerhoeff(digits)) {
      continue;
    }

    const end = start + value.length;
    const formatReason = value.includes(" ")
      ? "12-digit spaced 4-4-4 format validated."
      : "12-digit format validated.";

    detections.push({
      id: createDetectionId("AADHAAR", start, end),
      type: "AADHAAR",
      start,
      end,
      value,
      confidence: "high",
      reasons: [formatReason, "First-digit constraint passed.", "Verhoeff checksum passed."],
      severity: ENTITY_SEVERITY.AADHAAR,
    });
  }

  return detections;
}
