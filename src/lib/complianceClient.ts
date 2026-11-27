import type {
  ComplianceErrorResponse,
  ComplianceSummaryRequest,
  ComplianceSummaryResponse,
} from "../types/compliance";
import { validateComplianceRequest } from "./complianceValidation";

/**
 * Categorized outcome returned to the UI when requesting an optional AI compliance summary.
 */
export type ComplianceClientOutcome =
  | { readonly ok: true; readonly data: ComplianceSummaryResponse }
  | {
      readonly ok: false;
      readonly errorType: "CONFIGURATION_ERROR" | "NETWORK_ERROR" | "API_ERROR";
      readonly message: string;
    };

function isErrorPayload(value: unknown): value is ComplianceErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.error === "string" && typeof candidate.code === "string";
}

function isSuccessPayload(value: unknown): value is ComplianceSummaryResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.summary === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.disclaimer === "string"
  );
}

/**
 * Sends strictly allowlisted aggregate compliance metadata to `/api/summary`.
 * Rejects invalid payloads locally before making any network request.
 */
export async function requestComplianceSummary(
  payload: ComplianceSummaryRequest,
  fetchFn: typeof fetch = fetch,
): Promise<ComplianceClientOutcome> {
  const validation = validateComplianceRequest(payload);
  if (!validation.ok) {
    return {
      ok: false,
      errorType: "API_ERROR",
      message: validation.error,
    };
  }

  let response: Response;
  try {
    response = await fetchFn("/api/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.data),
    });
  } catch {
    return {
      ok: false,
      errorType: "NETWORK_ERROR",
      message:
        "Network error while contacting the compliance summary endpoint. Your local sanitization results remain intact.",
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      errorType: response.status === 503 ? "CONFIGURATION_ERROR" : "API_ERROR",
      message: `Compliance summary API returned an invalid response (HTTP ${response.status}).`,
    };
  }

  if (!response.ok) {
    if (isErrorPayload(parsed)) {
      const errorType =
        response.status === 503 || parsed.code === "CONFIGURATION_ERROR"
          ? "CONFIGURATION_ERROR"
          : "API_ERROR";
      return {
        ok: false,
        errorType,
        message: parsed.error,
      };
    }

    return {
      ok: false,
      errorType: response.status === 503 ? "CONFIGURATION_ERROR" : "API_ERROR",
      message: `Compliance summary request failed (HTTP ${response.status}).`,
    };
  }

  if (!isSuccessPayload(parsed)) {
    return {
      ok: false,
      errorType: "API_ERROR",
      message: "Compliance summary response was missing expected fields.",
    };
  }

  return { ok: true, data: parsed };
}
