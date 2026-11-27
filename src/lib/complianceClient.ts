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
      readonly errorType: "CONFIGURATION_ERROR" | "NETWORK_ERROR" | "API_ERROR" | "CANCELLED";
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

function formatNonJsonHttpError(status: number): {
  readonly errorType: "CONFIGURATION_ERROR" | "API_ERROR";
  readonly message: string;
} {
  if (status === 503) {
    return {
      errorType: "CONFIGURATION_ERROR",
      message: "Compliance summary service is unavailable or not configured on the server.",
    };
  }
  if (status === 504) {
    return {
      errorType: "API_ERROR",
      message: "Compliance summary request timed out. Please try again.",
    };
  }
  if (status >= 500) {
    return {
      errorType: "API_ERROR",
      message: `The compliance summary server encountered an unexpected error (HTTP ${status}). Your local sanitization results remain intact.`,
    };
  }
  return {
    errorType: "API_ERROR",
    message: `Compliance summary API returned an unexpected non-JSON response (HTTP ${status}).`,
  };
}

/**
 * Sends strictly allowlisted aggregate compliance metadata to `/api/summary`.
 * Rejects invalid payloads locally before making any network request.
 */
export async function requestComplianceSummary(
  payload: ComplianceSummaryRequest,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
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
      signal,
    });
  } catch (error: unknown) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      return {
        ok: false,
        errorType: "CANCELLED",
        message: "Compliance summary request cancelled.",
      };
    }
    return {
      ok: false,
      errorType: "NETWORK_ERROR",
      message:
        "Network error while contacting the compliance summary endpoint. Your local sanitization results remain intact.",
    };
  }

  let rawResponseText: string;
  try {
    rawResponseText = await response.text();
  } catch {
    const fallback = formatNonJsonHttpError(response.status);
    return {
      ok: false,
      errorType: fallback.errorType,
      message: response.ok
        ? "Compliance summary API returned an unreadable response."
        : fallback.message,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    if (!response.ok) {
      const fallback = formatNonJsonHttpError(response.status);
      return {
        ok: false,
        errorType: fallback.errorType,
        message: fallback.message,
      };
    }

    return {
      ok: false,
      errorType: "API_ERROR",
      message: "Compliance summary API returned an invalid response format.",
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
