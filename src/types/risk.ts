/**
 * Qualitative exposure levels derived from the 0-100 privacy risk score.
 */
export type RiskLevel = "low" | "moderate" | "high";

/**
 * Severity-weighted assessment of unredacted sensitive detections.
 */
export interface RiskAssessment {
  readonly score: number;
  readonly level: RiskLevel;
  readonly totalSeverity: number;
  readonly unredactedSeverity: number;
  readonly explanation: string;
}
