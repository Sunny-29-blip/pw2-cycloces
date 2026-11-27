import type { Detection } from "../../types/detection";
import { detectAadhaars } from "./aadhaarDetector";
import { assertValidInputText } from "./constants";
import { detectCreditCards } from "./creditCardDetector";
import { detectEmails } from "./emailDetector";
import { detectIpv4s } from "./ipv4Detector";
import { resolveOverlaps } from "./overlapResolver";
import { detectPans } from "./panDetector";
import { detectPhones } from "./phoneDetector";

/**
 * Runs all six local PII detectors against input text and returns deterministic,
 * non-overlapping, explainable detections sorted by starting position.
 */
export function detectPii(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const candidates: Detection[] = [
    ...detectCreditCards(text),
    ...detectAadhaars(text),
    ...detectPans(text),
    ...detectIpv4s(text),
    ...detectEmails(text),
    ...detectPhones(text),
  ];

  return resolveOverlaps(candidates);
}

export { detectAadhaars } from "./aadhaarDetector";
export {
  createDetectionId,
  ENTITY_PRIORITY,
  ENTITY_PRIORITY_ORDER,
  ENTITY_SEVERITY,
  PAN_HOLDER_CATEGORIES,
} from "./constants";
export { classifyCardIssuer, detectCreditCards } from "./creditCardDetector";
export { detectEmails } from "./emailDetector";
export { detectIpv4s } from "./ipv4Detector";
export { isValidLuhn } from "./luhn";
export { resolveOverlaps } from "./overlapResolver";
export { detectPans } from "./panDetector";
export { detectPhones } from "./phoneDetector";
export { isValidVerhoeff } from "./verhoeff";
