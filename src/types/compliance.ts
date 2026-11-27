import type { EntityType } from "./detection";

/**
 * Strictly allowlisted aggregate metadata payload sent to the optional Gemini summary endpoint.
 * Never contains document text, raw values, offsets, filenames, or pseudonym mappings.
 */
export interface ComplianceSummaryRequest {
  readonly countsByType: Readonly<Record<EntityType, number>>;
  readonly riskScore: number;
}

/**
 * Response returned by `/api/summary`.
 */
export interface ComplianceSummaryResponse {
  readonly summary: string;
  readonly model: string;
  readonly disclaimer: string;
}

/**
 * Structured error payload returned by `/api/summary`.
 */
export interface ComplianceErrorResponse {
  readonly error: string;
  readonly code:
    | "VALIDATION_ERROR"
    | "METHOD_NOT_ALLOWED"
    | "PAYLOAD_TOO_LARGE"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "FORBIDDEN_ORIGIN"
    | "CONFIGURATION_ERROR"
    | "API_ERROR";
}
