import type { Detection, EntityType } from "./detection";

/**
 * Supported deterministic redaction strategies.
 */
export type RedactionMode = "FULL" | "PARTIAL" | "PSEUDONYMIZE";

/**
 * Non-PII metadata summarizing placeholder assignments from a pseudonymization run.
 */
export interface PseudonymMetadata {
  readonly totalPlaceholders: number;
  readonly countsByType: Readonly<Record<EntityType, number>>;
  readonly placeholderByDetectionId: Readonly<Record<string, string>>;
}

/**
 * Result produced by applying a redaction strategy to source text.
 */
export interface RedactionResult {
  readonly mode: RedactionMode;
  readonly sanitizedText: string;
  readonly redactedCount: number;
  readonly ignoredCount: number;
  readonly pseudonymMetadata?: PseudonymMetadata;
}

/**
 * Shared contract implemented by every local redaction strategy.
 */
export type RedactionStrategy = (
  text: string,
  detections: readonly Detection[],
  ignoredIds?: ReadonlySet<string>,
) => RedactionResult;
