import { type ReactElement, useMemo } from "react";
import { ENTITY_PRIORITY_ORDER } from "../lib/detectors";
import type { ConfidenceLevel, Detection, EntityType } from "../types/detection";

export interface DetectionSummaryProps {
  readonly detections: readonly Detection[];
  readonly redactedCount: number;
  readonly keptCount: number;
  readonly isProcessing: boolean;
}

const ENTITY_LABELS: Readonly<Record<EntityType, string>> = {
  CREDIT_CARD: "Credit Card",
  AADHAAR: "Aadhaar",
  PAN: "PAN",
  IPV4: "IPv4",
  EMAIL: "Email",
  PHONE: "Phone",
};

/**
 * Live summary card showing total detections, redacted vs kept counts, entity breakdown, and confidence counts.
 */
export function DetectionSummary({
  detections,
  redactedCount,
  keptCount,
  isProcessing,
}: DetectionSummaryProps): ReactElement {
  const { countsByType, countsByConfidence } = useMemo(() => {
    const typeCounts: Record<EntityType, number> = {
      CREDIT_CARD: 0,
      AADHAAR: 0,
      PAN: 0,
      IPV4: 0,
      EMAIL: 0,
      PHONE: 0,
    };

    const confidenceCounts: Record<ConfidenceLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const detection of detections) {
      typeCounts[detection.type] += 1;
      confidenceCounts[detection.confidence] += 1;
    }

    return { countsByType: typeCounts, countsByConfidence: confidenceCounts };
  }, [detections]);

  return (
    <section
      aria-labelledby="detection-summary-heading"
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="detection-summary-heading"
          className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
        >
          Detection Summary
        </h2>
        <span aria-live="polite" className="text-xs font-medium text-[#515154] dark:text-[#a1a1aa]">
          {isProcessing ? "Updating…" : `${detections.length} detected`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e5e5ea] bg-[#f9f9fb] p-3 dark:border-[#2d313a] dark:bg-[#1c1f26]">
          <p className="text-xs text-[#515154] dark:text-[#a1a1aa]">Total</p>
          <p className="mt-1 text-2xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {detections.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#b7dfc4] bg-[#edf8f0] p-3 dark:border-[#22543d] dark:bg-[#132a1e]">
          <p className="text-xs text-[#125b2d] dark:text-[#86efac]">Redacted</p>
          <p className="mt-1 text-2xl font-semibold text-[#125b2d] dark:text-[#86efac]">
            {redactedCount}
          </p>
        </div>
        <div className="rounded-lg border border-[#f5d598] bg-[#fef9ec] p-3 dark:border-[#78350f] dark:bg-[#291d0e]">
          <p className="text-xs text-[#7c4a03] dark:text-[#fcd34d]">Kept</p>
          <p className="mt-1 text-2xl font-semibold text-[#7c4a03] dark:text-[#fcd34d]">
            {keptCount}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ENTITY_PRIORITY_ORDER.map((entityType) => (
          <div
            key={entityType}
            className="flex items-center justify-between rounded-md border border-[#e5e5ea] px-3 py-2 text-xs dark:border-[#2d313a]"
          >
            <span className="text-[#515154] dark:text-[#a1a1aa]">{ENTITY_LABELS[entityType]}</span>
            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {countsByType[entityType]}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[#515154] dark:text-[#a1a1aa]">
        Confidence breakdown: {countsByConfidence.high} high · {countsByConfidence.medium} medium ·{" "}
        {countsByConfidence.low} low
      </p>
    </section>
  );
}
