import type { Detection } from "../../types/detection";
import { ENTITY_PRIORITY, isValidDetectionCandidate } from "./constants";

function spansOverlap(a: Detection, b: Detection): boolean {
  return a.start < b.end && b.start < a.end;
}

function compareCandidateOrder(a: Detection, b: Detection): number {
  const priorityDiff = ENTITY_PRIORITY[b.type] - ENTITY_PRIORITY[a.type];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const lengthDiff = b.end - b.start - (a.end - a.start);
  if (lengthDiff !== 0) {
    return lengthDiff;
  }

  const startDiff = a.start - b.start;
  if (startDiff !== 0) {
    return startDiff;
  }

  return a.type.localeCompare(b.type);
}

/**
 * Resolves overlapping candidate detections deterministically using centralized priority
 * and longest-match rules, returning valid non-overlapping detections sorted by start offset.
 */
export function resolveOverlaps(candidates: readonly Detection[]): readonly Detection[] {
  const validCandidates = candidates.filter(isValidDetectionCandidate);
  const prioritized = [...validCandidates].sort(compareCandidateOrder);
  const accepted: Detection[] = [];

  for (const candidate of prioritized) {
    const hasOverlap = accepted.some((existing) => spansOverlap(existing, candidate));
    if (!hasOverlap) {
      accepted.push(candidate);
    }
  }

  accepted.sort((a, b) => a.start - b.start || a.end - b.end);
  return accepted;
}
