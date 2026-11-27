import { describe, expect, it } from "vitest";
import {
  createDetectionId,
  ENTITY_PRIORITY,
  ENTITY_SEVERITY,
  resolveOverlaps,
} from "../src/lib/detectors";
import type { Detection, EntityType } from "../src/types/detection";

function referenceNaiveResolveOverlaps(candidates: readonly Detection[]): readonly Detection[] {
  const sorted = [...candidates].sort((a, b) => {
    const pDiff = ENTITY_PRIORITY[b.type] - ENTITY_PRIORITY[a.type];
    if (pDiff !== 0) return pDiff;
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    const sDiff = a.start - b.start;
    if (sDiff !== 0) return sDiff;
    return a.type.localeCompare(b.type);
  });

  const accepted: Detection[] = [];
  for (const candidate of sorted) {
    const overlaps = accepted.some(
      (item) => item.start < candidate.end && candidate.start < item.end,
    );
    if (!overlaps) {
      accepted.push(candidate);
    }
  }
  accepted.sort((a, b) => a.start - b.start || a.end - b.end);
  return accepted;
}

function makeCandidate(type: EntityType, start: number, end: number): Detection {
  return {
    id: createDetectionId(type, start, end),
    type,
    start,
    end,
    value: "x".repeat(end - start),
    confidence: "high",
    reasons: ["Synthetic test candidate."],
    severity: ENTITY_SEVERITY[type],
  };
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const ALL_TYPES: readonly EntityType[] = [
  "CREDIT_CARD",
  "AADHAAR",
  "PAN",
  "IPV4",
  "EMAIL",
  "PHONE",
];

describe("segment-tree resolveOverlaps", () => {
  it("handles empty input, adjacent intervals, exact duplicates, and equal-length ties", () => {
    expect(resolveOverlaps([])).toEqual([]);

    const adjacent = [makeCandidate("PHONE", 5, 10), makeCandidate("EMAIL", 0, 5)];
    expect(resolveOverlaps(adjacent).map((item) => item.start)).toEqual([0, 5]);

    const duplicate = [makeCandidate("PAN", 10, 20), makeCandidate("PAN", 10, 20)];
    expect(resolveOverlaps(duplicate)).toHaveLength(1);

    const equalLengthTie = [makeCandidate("EMAIL", 4, 14), makeCandidate("EMAIL", 0, 10)];
    const tieResolved = resolveOverlaps(equalLengthTie);
    expect(tieResolved).toHaveLength(1);
    expect(tieResolved[0]?.start).toBe(0);
  });

  it("resolves same-priority longest match, different-priority overlaps, and chain overlaps", () => {
    const samePriority = [makeCandidate("EMAIL", 2, 12), makeCandidate("EMAIL", 0, 15)];
    expect(resolveOverlaps(samePriority)).toEqual([samePriority[1]]);

    const differentPriority = [makeCandidate("PHONE", 0, 18), makeCandidate("AADHAAR", 2, 14)];
    expect(resolveOverlaps(differentPriority)).toEqual([differentPriority[1]]);

    const nestedOuterWins = [makeCandidate("CREDIT_CARD", 0, 20), makeCandidate("EMAIL", 4, 14)];
    expect(resolveOverlaps(nestedOuterWins)).toEqual([nestedOuterWins[0]]);

    const chain = [
      makeCandidate("CREDIT_CARD", 0, 5),
      makeCandidate("PAN", 3, 10),
      makeCandidate("EMAIL", 8, 14),
    ];
    expect(resolveOverlaps(chain)).toEqual([chain[0], chain[2]]);
  });

  it("filters invalid boundaries while preserving valid non-overlapping detections", () => {
    const valid = makeCandidate("EMAIL", 10, 22);
    const invalidCandidates: Detection[] = [
      { ...valid, id: createDetectionId("EMAIL", -2, 5), start: -2, end: 5, value: "x".repeat(7) },
      { ...valid, id: createDetectionId("EMAIL", 8, 8), start: 8, end: 8, value: "" },
      { ...valid, id: createDetectionId("EMAIL", 15, 12), start: 15, end: 12, value: "" },
      {
        ...valid,
        id: createDetectionId("EMAIL", Number.NaN, 10),
        start: Number.NaN,
        end: 10,
        value: "",
      },
      valid,
    ];

    expect(resolveOverlaps(invalidCandidates)).toEqual([valid]);
    expect(resolveOverlaps(invalidCandidates.slice(0, 4))).toEqual([]);

    const malformedIds: Detection[] = [
      { ...valid, id: "EMAIL:010:22" },
      { ...valid, id: "EMAIL:10:022" },
      { ...valid, id: "EMAIL:10:22:extra" },
      { ...valid, id: "EMAIL:10:22a" },
      { ...valid, id: "PAN:10:22" },
    ];
    expect(resolveOverlaps(malformedIds)).toEqual([]);
  });

  it("matches the naive reference oracle across 2,000 deterministic randomized candidate sets", () => {
    const nextRand = createSeededRng(20261127);

    for (let trial = 0; trial < 2000; trial += 1) {
      const count = 2 + Math.floor(nextRand() * 20);
      const candidates: Detection[] = [];

      for (let idx = 0; idx < count; idx += 1) {
        const type = ALL_TYPES[Math.floor(nextRand() * ALL_TYPES.length)] ?? "EMAIL";
        const start = Math.floor(nextRand() * 40);
        const length = 1 + Math.floor(nextRand() * 15);
        candidates.push(makeCandidate(type, start, start + length));
      }

      const fastResult = resolveOverlaps(candidates);
      const oracleResult = referenceNaiveResolveOverlaps(candidates);
      expect(fastResult).toEqual(oracleResult);
    }
  });

  it("resolves large 25,000-candidate arrays deterministically", () => {
    const large: Detection[] = [];
    for (let index = 0; index < 25_000; index += 1) {
      const base = index * 20;
      large.push(makeCandidate("PHONE", base, base + 12));
      if (index % 2 === 0) {
        large.push(makeCandidate("AADHAAR", base, base + 12));
      }
    }

    const first = resolveOverlaps(large);
    const second = resolveOverlaps(large);
    expect(first).toEqual(second);
    expect(first).toHaveLength(25_000);
  });
});
