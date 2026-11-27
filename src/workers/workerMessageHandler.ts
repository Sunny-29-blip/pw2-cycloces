import { detectPii } from "../lib/detectors";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../types/worker";

function isValidWorkerRequest(payload: unknown): payload is DetectionWorkerRequest {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.requestId === "number" &&
    Number.isInteger(candidate.requestId) &&
    candidate.requestId >= 0 &&
    typeof candidate.text === "string"
  );
}

/**
 * Processes a typed PII detection worker request locally and returns a typed response
 * without leaking raw document text in error messages.
 */
export function processDetectionRequest(payload: unknown): DetectionWorkerResponse {
  if (!isValidWorkerRequest(payload)) {
    return {
      requestId: -1,
      ok: false,
      error: "Invalid detection worker request payload.",
    };
  }

  try {
    if (payload.text.length === 0) {
      return {
        requestId: payload.requestId,
        ok: true,
        detections: [],
      };
    }

    const detections = detectPii(payload.text);
    return {
      requestId: payload.requestId,
      ok: true,
      detections,
    };
  } catch (error) {
    const safeMessage =
      error instanceof Error && error.message.length > 0
        ? "Local PII detection failed due to an invalid input state."
        : "Local PII detection failed unexpectedly.";

    return {
      requestId: payload.requestId,
      ok: false,
      error: safeMessage,
    };
  }
}
