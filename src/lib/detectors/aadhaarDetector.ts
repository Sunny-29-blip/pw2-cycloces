import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";
import { isValidVerhoeff } from "./verhoeff";

const AADHAAR_CANDIDATE_PATTERN =
  /(?<![\dA-Za-z]|\d[ -])(?:\d{12}|\d{4} \d{4} \d{4})(?![\dA-Za-z]|[ -]\d)/g;

const AADHAAR_DIGIT_COUNT = 12;

const AADHAAR_SPACED_REASONS: readonly string[] = Object.freeze([
  "12-digit spaced 4-4-4 format validated.",
  "First-digit constraint passed.",
  "Verhoeff checksum passed.",
]);

const AADHAAR_COMPACT_REASONS: readonly string[] = Object.freeze([
  "12-digit format validated.",
  "First-digit constraint passed.",
  "Verhoeff checksum passed.",
]);

/**
 * Detects 12-digit continuous and 4-4-4 space-separated Aadhaar numbers verified by Verhoeff checksum.
 */
export function detectAadhaars(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];
  AADHAAR_CANDIDATE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = AADHAAR_CANDIDATE_PATTERN.exec(text)) !== null) {
      const value = match[0];
      const start = match.index;
      const firstCode = value.charCodeAt(0);
      if (firstCode < 50 || firstCode > 57) {
        continue;
      }

      const isSpaced = value.length === 14;
      const digits = isSpaced
        ? `${value.slice(0, 4)}${value.slice(5, 9)}${value.slice(10, 14)}`
        : value;

      if (digits.length !== AADHAAR_DIGIT_COUNT || !isValidVerhoeff(digits)) {
        continue;
      }

      const end = start + value.length;
      detections.push({
        id: createDetectionId("AADHAAR", start, end),
        type: "AADHAAR",
        start,
        end,
        value,
        confidence: "high",
        reasons: isSpaced ? AADHAAR_SPACED_REASONS : AADHAAR_COMPACT_REASONS,
        severity: ENTITY_SEVERITY.AADHAAR,
      });
    }
  } finally {
    AADHAAR_CANDIDATE_PATTERN.lastIndex = 0;
  }

  return detections;
}
