import type { Detection } from "../../types/detection";
import {
  assertValidInputText,
  createDetectionId,
  ENTITY_SEVERITY,
  PAN_HOLDER_CATEGORIES,
} from "./constants";

const PAN_CANDIDATE_PATTERN = /(?<![A-Za-z0-9])([A-Z]{5}[0-9]{4}[A-Z])(?![A-Za-z0-9])/g;

const PAN_REASONS_BY_CATEGORY: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Array.from(PAN_HOLDER_CATEGORIES, (category) => [
    category,
    Object.freeze([
      "PAN format matched.",
      `Valid holder-category character '${category}' verified.`,
    ]),
  ]),
);

/**
 * Detects Indian Permanent Account Number (PAN) identifiers and validates holder-category codes.
 */
export function detectPans(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];
  PAN_CANDIDATE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = PAN_CANDIDATE_PATTERN.exec(text)) !== null) {
      const value = match[1];
      const start = match.index;
      if (value === undefined) {
        continue;
      }

      const reasons = PAN_REASONS_BY_CATEGORY[value.charAt(3)];
      if (reasons === undefined) {
        continue;
      }

      const end = start + value.length;
      detections.push({
        id: createDetectionId("PAN", start, end),
        type: "PAN",
        start,
        end,
        value,
        confidence: "high",
        reasons,
        severity: ENTITY_SEVERITY.PAN,
      });
    }
  } finally {
    PAN_CANDIDATE_PATTERN.lastIndex = 0;
  }

  return detections;
}
