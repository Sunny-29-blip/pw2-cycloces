import type { Detection } from "../../types/detection";
import type { RiskAssessment, RiskLevel } from "../../types/risk";
import { isValidDetectionCandidate } from "../detectors/constants";

const LOW_RISK_MAX = 25;
const MODERATE_RISK_MAX = 65;

const RISK_SCORE_EXPLANATION =
  "Measures the severity-weighted proportion of detected identifiers left completely unchanged. It is not a guarantee of anonymity; partial masking may still retain contextual clues.";

function classifyRiskLevel(score: number): RiskLevel {
  if (score <= LOW_RISK_MAX) {
    return "low";
  }
  if (score <= MODERATE_RISK_MAX) {
    return "moderate";
  }
  return "high";
}

function clampRiskScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function assertDetectionsArray(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new TypeError("Detections must be an array.");
  }
}

/**
 * Calculates a 0-100 severity-weighted score representing the proportion of detected
 * sensitive-entity severity that remains completely unredacted (kept).
 */
export function calculatePrivacyRisk(
  detections: readonly Detection[],
  ignoredIds: ReadonlySet<string> = new Set(),
): RiskAssessment {
  assertDetectionsArray(detections);
  if (!(ignoredIds instanceof Set)) {
    throw new TypeError("Ignored detection IDs must be provided as a Set.");
  }

  let totalSeverity = 0;
  let unredactedSeverity = 0;

  for (const detection of detections) {
    if (!isValidDetectionCandidate(detection)) {
      continue;
    }

    totalSeverity += detection.severity;
    if (ignoredIds.has(detection.id)) {
      unredactedSeverity += detection.severity;
    }
  }

  if (totalSeverity === 0) {
    return {
      score: 0,
      level: "low",
      totalSeverity: 0,
      unredactedSeverity: 0,
      explanation: RISK_SCORE_EXPLANATION,
    };
  }

  const score = clampRiskScore((100 * unredactedSeverity) / totalSeverity);

  return {
    score,
    level: classifyRiskLevel(score),
    totalSeverity,
    unredactedSeverity,
    explanation: RISK_SCORE_EXPLANATION,
  };
}
