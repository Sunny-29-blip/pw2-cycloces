import type { Detection } from "../../types/detection";
import { isValidDetectionCandidate } from "../detectors/constants";

/**
 * Validated, sorted inputs ready for position-based text transformation.
 */
export interface ValidatedRedactionContext {
  readonly sortedDetections: readonly Detection[];
  readonly ignoredIds: ReadonlySet<string>;
}

/**
 * Validates source text, detection boundaries, non-overlap invariants, and ignored IDs
 * without mutating any input arguments or leaking raw PII in error messages.
 */
export function validateRedactionInputs(
  text: string,
  detections: readonly Detection[],
  ignoredIds: ReadonlySet<string> = new Set(),
): ValidatedRedactionContext {
  if (typeof text !== "string") {
    throw new TypeError("Source text must be a string.");
  }
  if (!Array.isArray(detections)) {
    throw new TypeError("Detections must be an array.");
  }
  if (!(ignoredIds instanceof Set)) {
    throw new TypeError("Ignored detection IDs must be provided as a Set.");
  }

  const seenIds = new Set<string>();

  for (const detection of detections) {
    if (!isValidDetectionCandidate(detection)) {
      throw new RangeError("Invalid detection candidate supplied to redaction engine.");
    }
    if (detection.end > text.length) {
      throw new RangeError("Detection span exceeds source text length.");
    }
    if (text.slice(detection.start, detection.end) !== detection.value) {
      throw new RangeError("Detection span does not match source text slice.");
    }
    if (seenIds.has(detection.id)) {
      throw new RangeError("Duplicate detection ID supplied to redaction engine.");
    }
    seenIds.add(detection.id);
  }

  const sortedDetections = [...detections].sort((a, b) => a.start - b.start || a.end - b.end);

  for (let index = 1; index < sortedDetections.length; index += 1) {
    const previous = sortedDetections[index - 1];
    const current = sortedDetections[index];
    if (previous && current && previous.end > current.start) {
      throw new RangeError("Detections supplied to redaction engine must not overlap.");
    }
  }

  for (const ignoredId of ignoredIds) {
    if (typeof ignoredId !== "string" || !seenIds.has(ignoredId)) {
      throw new RangeError("Ignored detection ID does not belong to the supplied detections.");
    }
  }

  return { sortedDetections, ignoredIds };
}

/**
 * Applies position-based replacements across validated, sorted, non-overlapping detections
 * while preserving every character outside non-ignored spans verbatim.
 */
export function applyPositionReplacements(
  text: string,
  sortedDetections: readonly Detection[],
  ignoredIds: ReadonlySet<string>,
  resolveReplacement: (detection: Detection) => string,
): {
  readonly sanitizedText: string;
  readonly redactedCount: number;
  readonly ignoredCount: number;
} {
  if (sortedDetections.length === 0) {
    return { sanitizedText: text, redactedCount: 0, ignoredCount: 0 };
  }

  const segments: string[] = [];
  let cursor = 0;
  let redactedCount = 0;
  let ignoredCount = 0;

  for (const detection of sortedDetections) {
    if (ignoredIds.has(detection.id)) {
      ignoredCount += 1;
      continue;
    }

    segments.push(text.slice(cursor, detection.start));
    segments.push(resolveReplacement(detection));
    cursor = detection.end;
    redactedCount += 1;
  }

  segments.push(text.slice(cursor));

  return {
    sanitizedText: segments.join(""),
    redactedCount,
    ignoredCount,
  };
}
