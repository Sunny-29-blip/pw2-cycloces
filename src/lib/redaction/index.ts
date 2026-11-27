import type { Detection } from "../../types/detection";
import type { RedactionMode, RedactionResult, RedactionStrategy } from "../../types/redaction";
import { applyFullMask } from "./fullMask";
import { applyPartialMask } from "./partialMask";
import { applyPseudonymization } from "./pseudonymize";

const STRATEGY_BY_MODE: Readonly<Record<RedactionMode, RedactionStrategy>> = {
  FULL: applyFullMask,
  PARTIAL: applyPartialMask,
  PSEUDONYMIZE: applyPseudonymization,
};

/**
 * Applies the selected redaction strategy to source text using validated detections
 * and an optional set of ignored detection IDs.
 */
export function redactText(
  text: string,
  detections: readonly Detection[],
  mode: RedactionMode,
  ignoredIds: ReadonlySet<string> = new Set(),
): RedactionResult {
  const strategy = STRATEGY_BY_MODE[mode];
  if (!strategy) {
    throw new RangeError("Unsupported redaction mode.");
  }
  return strategy(text, detections, ignoredIds);
}

export { applyFullMask, FULL_MASK_PLACEHOLDER } from "./fullMask";
export { applyPartialMask, maskEntityValuePartially } from "./partialMask";
export { applyPseudonymization } from "./pseudonymize";
export type {
  PseudonymMetadata,
  RedactionMode,
  RedactionResult,
  RedactionStrategy,
} from "../../types/redaction";
