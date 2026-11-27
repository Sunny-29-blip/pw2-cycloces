import type { ConfidenceLevel, Detection, EntityType, SeverityScore } from "../../types/detection";

/**
 * Ordered list of all supported PII entity types from highest to lowest overlap priority.
 */
export const ENTITY_PRIORITY_ORDER: readonly EntityType[] = [
  "CREDIT_CARD",
  "AADHAAR",
  "PAN",
  "IPV4",
  "EMAIL",
  "PHONE",
] as const;

/**
 * Numeric overlap resolution priority per entity type (higher value wins).
 */
export const ENTITY_PRIORITY: Readonly<Record<EntityType, number>> = {
  CREDIT_CARD: 6,
  AADHAAR: 5,
  PAN: 4,
  IPV4: 3,
  EMAIL: 2,
  PHONE: 1,
} as const;

/**
 * Centralized severity rating (integer 1-5) assigned per entity category.
 */
export const ENTITY_SEVERITY: Readonly<Record<EntityType, SeverityScore>> = {
  CREDIT_CARD: 5,
  AADHAAR: 5,
  PAN: 4,
  PHONE: 3,
  EMAIL: 3,
  IPV4: 2,
} as const;

/**
 * Valid fourth-character holder category codes for Indian PAN identifiers.
 */
export const PAN_HOLDER_CATEGORIES: ReadonlySet<string> = new Set([
  "P",
  "C",
  "H",
  "F",
  "A",
  "B",
  "G",
  "J",
  "L",
  "T",
]);

const VALID_CONFIDENCE_LEVELS: ReadonlySet<ConfidenceLevel> = new Set(["high", "medium", "low"]);
const VALID_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(ENTITY_PRIORITY_ORDER);

/**
 * Generates a deterministic identifier for a detection based on entity type and span offsets.
 */
export function createDetectionId(type: EntityType, start: number, end: number): string {
  return `${type}:${start}:${end}`;
}

/**
 * Validates raw input text at detector module boundaries.
 */
export function assertValidInputText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new TypeError("Detection input must be a string.");
  }
}

function parseCanonicalUintSlice(value: string, startIndex: number, endIndex: number): number {
  const length = endIndex - startIndex;
  if (length <= 0) {
    return -1;
  }
  const firstCode = value.charCodeAt(startIndex);
  if (firstCode < 48 || firstCode > 57) {
    return -1;
  }
  if (length > 1 && firstCode === 48) {
    return -1;
  }

  let parsed = firstCode - 48;
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) {
      return -1;
    }
    parsed = parsed * 10 + (code - 48);
  }
  return parsed;
}

function matchesDetectionId(id: string, type: EntityType, start: number, end: number): boolean {
  const typeLength = type.length;
  if (id.length < typeLength + 4 || !id.startsWith(type) || id.charCodeAt(typeLength) !== 58) {
    return false;
  }

  const secondColon = id.indexOf(":", typeLength + 1);
  if (secondColon <= typeLength + 1 || secondColon >= id.length - 1) {
    return false;
  }

  const parsedStart = parseCanonicalUintSlice(id, typeLength + 1, secondColon);
  if (parsedStart !== start) {
    return false;
  }

  const parsedEnd = parseCanonicalUintSlice(id, secondColon + 1, id.length);
  return parsedEnd === end;
}

/**
 * Checks whether a candidate detection conforms to structural, range, and explainability invariants.
 */
export function isValidDetectionCandidate(candidate: Detection): boolean {
  if (!VALID_ENTITY_TYPES.has(candidate.type)) {
    return false;
  }
  if (!VALID_CONFIDENCE_LEVELS.has(candidate.confidence)) {
    return false;
  }
  if (!Number.isInteger(candidate.start) || !Number.isInteger(candidate.end)) {
    return false;
  }
  if (candidate.start < 0 || candidate.end <= candidate.start) {
    return false;
  }
  if (candidate.value.length !== candidate.end - candidate.start) {
    return false;
  }
  if (!Number.isInteger(candidate.severity) || candidate.severity < 1 || candidate.severity > 5) {
    return false;
  }
  if (candidate.reasons.length === 0) {
    return false;
  }
  return matchesDetectionId(candidate.id, candidate.type, candidate.start, candidate.end);
}
