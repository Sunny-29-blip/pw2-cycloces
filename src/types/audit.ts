import type { EntityType } from "./detection";
import type { RedactionMode } from "./redaction";

/**
 * Decision status recorded for each detected span in an audit report.
 */
export type AuditEntityStatus = "REDACTED" | "KEPT";

/**
 * Privacy-safe audit entry containing positional and status metadata without raw PII.
 */
export interface AuditDetectionRecord {
  readonly id: string;
  readonly type: EntityType;
  readonly start: number;
  readonly end: number;
  readonly status: AuditEntityStatus;
}

/**
 * Privacy-safe audit report summarizing sanitization coverage without raw content.
 */
export interface AuditReport {
  readonly generatedAt: string;
  readonly redactionMode: RedactionMode;
  readonly totalDetections: number;
  readonly redactedCount: number;
  readonly keptCount: number;
  readonly countsByType: Readonly<Record<EntityType, number>>;
  readonly detections: readonly AuditDetectionRecord[];
}
