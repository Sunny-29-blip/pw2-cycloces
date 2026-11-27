import type { Detection } from "../../types/detection";
import {
  assertValidInputText,
  createDetectionId,
  ENTITY_SEVERITY,
  PAN_HOLDER_CATEGORIES,
} from "./constants";

const PAN_CANDIDATE_PATTERN = /(?<![A-Za-z0-9])([A-Z]{5}[0-9]{4}[A-Z])(?![A-Za-z0-9])/g;
const PAN_EXACT_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Detects Indian Permanent Account Number (PAN) identifiers and validates holder-category codes.
 */
export function detectPans(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];

  for (const match of text.matchAll(PAN_CANDIDATE_PATTERN)) {
    const value = match[1];
    const start = match.index;
    if (value === undefined || start === undefined || !PAN_EXACT_PATTERN.test(value)) {
      continue;
    }

    const holderCategory = value.charAt(3);
    if (!PAN_HOLDER_CATEGORIES.has(holderCategory)) {
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
      reasons: [
        "PAN format matched.",
        `Valid holder-category character '${holderCategory}' verified.`,
      ],
      severity: ENTITY_SEVERITY.PAN,
    });
  }

  return detections;
}
