import type { Detection } from "../../types/detection";
import { isValidDetectionCandidate } from "../detectors/constants";

/**
 * Validated, sorted inputs ready for position-based text transformation.
 */
export interface ValidatedRedactionContext {
  readonly sortedDetections: readonly Detection[];
  readonly ignoredIds: ReadonlySet<string>;
}

function containsDetectionId(sortedDetections: readonly Detection[], targetId: string): boolean {
  const firstColon = targetId.indexOf(":");
  if (firstColon <= 0) {
    return false;
  }
  const secondColon = targetId.indexOf(":", firstColon + 1);
  if (secondColon <= firstColon + 1 || secondColon >= targetId.length - 1) {
    return false;
  }

  const targetStart = Number(targetId.slice(firstColon + 1, secondColon));
  if (!Number.isInteger(targetStart) || targetStart < 0) {
    return false;
  }

  let low = 0;
  let high = sortedDetections.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const candidate = sortedDetections[mid];
    if (!candidate) {
      return false;
    }
    if (candidate.start === targetStart) {
      return candidate.id === targetId;
    }
    if (candidate.start < targetStart) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return false;
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

  const textLength = text.length;
  let prevEnd = -1;
  let isAlreadySortedAndDisjoint = true;

  for (let index = 0; index < detections.length; index += 1) {
    const detection = detections[index];
    if (!detection || !isValidDetectionCandidate(detection)) {
      throw new RangeError("Invalid detection candidate supplied to redaction engine.");
    }
    if (detection.end > textLength) {
      throw new RangeError("Detection span exceeds source text length.");
    }
    if (!text.startsWith(detection.value, detection.start)) {
      throw new RangeError("Detection span does not match source text slice.");
    }
    if (isAlreadySortedAndDisjoint && detection.start < prevEnd) {
      isAlreadySortedAndDisjoint = false;
    }
    prevEnd = detection.end;
  }

  let sortedDetections: readonly Detection[];

  if (isAlreadySortedAndDisjoint) {
    sortedDetections = detections;
  } else {
    const seenIds = new Set<string>();
    for (const detection of detections) {
      if (seenIds.has(detection.id)) {
        throw new RangeError("Duplicate detection ID supplied to redaction engine.");
      }
      seenIds.add(detection.id);
    }

    const sortedCopy = [...detections].sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 1; index < sortedCopy.length; index += 1) {
      const previous = sortedCopy[index - 1];
      const current = sortedCopy[index];
      if (previous && current && previous.end > current.start) {
        throw new RangeError("Detections supplied to redaction engine must not overlap.");
      }
    }
    sortedDetections = sortedCopy;
  }

  if (ignoredIds.size > 0) {
    for (const ignoredId of ignoredIds) {
      if (typeof ignoredId !== "string" || !containsDetectionId(sortedDetections, ignoredId)) {
        throw new RangeError("Ignored detection ID does not belong to the supplied detections.");
      }
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
