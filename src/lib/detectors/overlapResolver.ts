import type { Detection } from "../../types/detection";
import { ENTITY_PRIORITY, isValidDetectionCandidate } from "./constants";

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

function buildUniqueCoordinates(candidates: readonly Detection[]): number[] {
  const rawCoords: number[] = new Array<number>(candidates.length * 2);
  let writeIndex = 0;

  for (const candidate of candidates) {
    rawCoords[writeIndex] = candidate.start;
    rawCoords[writeIndex + 1] = candidate.end;
    writeIndex += 2;
  }

  rawCoords.sort((a, b) => a - b);

  const unique: number[] = [];
  let previous = Number.NaN;
  for (const coord of rawCoords) {
    if (coord !== previous) {
      unique.push(coord);
      previous = coord;
    }
  }
  return unique;
}

function lowerBound(sortedValues: readonly number[], target: number): number {
  let low = 0;
  let high = sortedValues.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    const value = sortedValues[mid];
    if (value !== undefined && value < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

class IntervalOccupancyTree {
  private readonly leafCount: number;
  private readonly occupiedAny: Uint8Array;
  private readonly occupiedAll: Uint8Array;

  public constructor(leafCount: number) {
    this.leafCount = leafCount;
    const size = Math.max(4, leafCount * 4);
    this.occupiedAny = new Uint8Array(size);
    this.occupiedAll = new Uint8Array(size);
  }

  public hasOverlap(queryLeft: number, queryRight: number): boolean {
    if (this.leafCount <= 0 || queryLeft > queryRight) {
      return false;
    }
    return this.queryNode(1, 0, this.leafCount - 1, queryLeft, queryRight);
  }

  public markOccupied(queryLeft: number, queryRight: number): void {
    if (this.leafCount <= 0 || queryLeft > queryRight) {
      return;
    }
    this.updateNode(1, 0, this.leafCount - 1, queryLeft, queryRight);
  }

  private queryNode(
    node: number,
    left: number,
    right: number,
    queryLeft: number,
    queryRight: number,
  ): boolean {
    if (this.occupiedAny[node] === 0) {
      return false;
    }
    if (this.occupiedAll[node] === 1) {
      return true;
    }
    if (queryLeft <= left && right <= queryRight) {
      return this.occupiedAny[node] === 1;
    }

    const mid = (left + right) >>> 1;
    if (queryLeft <= mid && this.queryNode(node * 2, left, mid, queryLeft, queryRight)) {
      return true;
    }
    if (queryRight > mid && this.queryNode(node * 2 + 1, mid + 1, right, queryLeft, queryRight)) {
      return true;
    }
    return false;
  }

  private updateNode(
    node: number,
    left: number,
    right: number,
    queryLeft: number,
    queryRight: number,
  ): void {
    if (this.occupiedAll[node] === 1) {
      return;
    }
    if (queryLeft <= left && right <= queryRight) {
      this.occupiedAny[node] = 1;
      this.occupiedAll[node] = 1;
      return;
    }

    const mid = (left + right) >>> 1;
    const leftChild = node * 2;
    const rightChild = leftChild + 1;

    this.occupiedAny[node] = 1;

    if (queryLeft <= mid) {
      this.updateNode(leftChild, left, mid, queryLeft, queryRight);
    }
    if (queryRight > mid) {
      this.updateNode(rightChild, mid + 1, right, queryLeft, queryRight);
    }

    if (this.occupiedAll[leftChild] === 1 && this.occupiedAll[rightChild] === 1) {
      this.occupiedAll[node] = 1;
    }
  }
}

/**
 * Resolves overlapping candidate detections deterministically in O(N log N) time using
 * coordinate compression and an interval-occupancy segment tree, preserving half-open
 * `[start, end)` priority and longest-match semantics.
 */
export function resolveOverlaps(candidates: readonly Detection[]): readonly Detection[] {
  if (candidates.length === 0) {
    return [];
  }

  const validCandidates = candidates.filter(isValidDetectionCandidate);
  if (validCandidates.length <= 1) {
    return validCandidates;
  }

  const coordinates = buildUniqueCoordinates(validCandidates);
  const elementaryIntervals = coordinates.length - 1;
  if (elementaryIntervals <= 0) {
    return [];
  }

  const prioritized = [...validCandidates].sort(compareCandidateOrder);
  const occupancyTree = new IntervalOccupancyTree(elementaryIntervals);
  const accepted: Detection[] = [];

  for (const candidate of prioritized) {
    const startIdx = lowerBound(coordinates, candidate.start);
    const endIdx = lowerBound(coordinates, candidate.end) - 1;

    if (!occupancyTree.hasOverlap(startIdx, endIdx)) {
      occupancyTree.markOccupied(startIdx, endIdx);
      accepted.push(candidate);
    }
  }

  accepted.sort((a, b) => a.start - b.start || a.end - b.end);
  return accepted;
}
