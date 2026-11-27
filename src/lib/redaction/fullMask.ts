import type { Detection } from "../../types/detection";
import type { RedactionResult } from "../../types/redaction";
import { applyPositionReplacements, validateRedactionInputs } from "./shared";

/**
 * Standard placeholder string used by full masking.
 */
export const FULL_MASK_PLACEHOLDER = "[REDACTED]";

/**
 * Replaces every non-ignored detection span with `[REDACTED]` while preserving all
 * surrounding text, punctuation, whitespace, and newlines verbatim.
 */
export function applyFullMask(
  text: string,
  detections: readonly Detection[],
  ignoredIds: ReadonlySet<string> = new Set(),
): RedactionResult {
  const validated = validateRedactionInputs(text, detections, ignoredIds);
  const { sanitizedText, redactedCount, ignoredCount } = applyPositionReplacements(
    text,
    validated.sortedDetections,
    validated.ignoredIds,
    () => FULL_MASK_PLACEHOLDER,
  );

  return {
    mode: "FULL",
    sanitizedText,
    redactedCount,
    ignoredCount,
  };
}
