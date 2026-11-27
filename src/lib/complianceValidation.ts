import { ENTITY_PRIORITY_ORDER } from "./detectors/constants.js";
import type { ComplianceSummaryRequest } from "../types/compliance.js";
import type { Detection, EntityType } from "../types/detection.js";

/**
 * Maximum count allowed per entity type in aggregate compliance requests.
 */
export const MAX_ENTITY_COUNT = 1_000_000;

/**
 * Maximum JSON request body size accepted by the compliance summary endpoint (1 KB).
 */
export const MAX_SUMMARY_REQUEST_BYTES = 1024;

const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["countsByType", "riskScore"]);
const ALLOWED_ENTITY_KEYS: ReadonlySet<string> = new Set(ENTITY_PRIORITY_ORDER);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Validation result for incoming compliance summary requests.
 */
export type ComplianceValidationResult =
  | { readonly ok: true; readonly data: ComplianceSummaryRequest }
  | { readonly ok: false; readonly error: string };

/**
 * Validates that an unknown payload strictly matches `ComplianceSummaryRequest`
 * and rejects any unexpected fields, invalid entity types, negative/non-integer counts,
 * or out-of-range risk scores.
 */
export function validateComplianceRequest(payload: unknown): ComplianceValidationResult {
  if (!isPlainRecord(payload)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const topKeys = Object.keys(payload);
  if (topKeys.length !== ALLOWED_TOP_LEVEL_KEYS.size) {
    return {
      ok: false,
      error: "Request must contain only 'countsByType' and 'riskScore'.",
    };
  }

  for (const key of topKeys) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return {
        ok: false,
        error: "Unexpected field in compliance summary request.",
      };
    }
  }

  const rawCounts = payload.countsByType;
  if (!isPlainRecord(rawCounts)) {
    return { ok: false, error: "'countsByType' must be a plain object." };
  }

  const countKeys = Object.keys(rawCounts);
  for (const key of countKeys) {
    if (!ALLOWED_ENTITY_KEYS.has(key)) {
      return { ok: false, error: "Unsupported entity type in 'countsByType'." };
    }
  }

  if (countKeys.length !== ENTITY_PRIORITY_ORDER.length) {
    return { ok: false, error: "All supported entity types must be provided in 'countsByType'." };
  }

  const validatedCounts: Record<EntityType, number> = {
    CREDIT_CARD: 0,
    AADHAAR: 0,
    PAN: 0,
    IPV4: 0,
    EMAIL: 0,
    PHONE: 0,
  };

  for (const entityType of ENTITY_PRIORITY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(rawCounts, entityType)) {
      return { ok: false, error: "Missing required entity count in 'countsByType'." };
    }

    const count = rawCounts[entityType];
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > MAX_ENTITY_COUNT
    ) {
      return {
        ok: false,
        error: "Entity counts must be non-negative bounded integers.",
      };
    }
    validatedCounts[entityType] = count;
  }

  const riskScore = payload.riskScore;
  if (
    typeof riskScore !== "number" ||
    !Number.isInteger(riskScore) ||
    riskScore < 0 ||
    riskScore > 100
  ) {
    return { ok: false, error: "'riskScore' must be an integer between 0 and 100." };
  }

  return {
    ok: true,
    data: {
      countsByType: validatedCounts,
      riskScore,
    },
  };
}

/**
 * Derives a strictly allowlisted `ComplianceSummaryRequest` from detections and risk score
 * without reading raw detection values, offsets, IDs, or source text.
 */
export function buildComplianceRequestPayload(
  detections: readonly Detection[],
  riskScore: number,
): ComplianceSummaryRequest {
  const countsByType: Record<EntityType, number> = {
    CREDIT_CARD: 0,
    AADHAAR: 0,
    PAN: 0,
    IPV4: 0,
    EMAIL: 0,
    PHONE: 0,
  };

  for (const detection of detections) {
    countsByType[detection.type] += 1;
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  return {
    countsByType,
    riskScore: normalizedScore,
  };
}
