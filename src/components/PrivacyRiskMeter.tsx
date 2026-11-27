import type { ReactElement } from "react";
import type { RiskAssessment, RiskLevel } from "../types/risk";

export interface PrivacyRiskMeterProps {
  readonly assessment: RiskAssessment;
}

const LEVEL_STYLES: Readonly<
  Record<RiskLevel, { readonly label: string; readonly badge: string; readonly bar: string }>
> = {
  low: {
    label: "Low Risk",
    badge:
      "border-[#b7dfc4] bg-[#edf8f0] text-[#125b2d] dark:border-[#22543d] dark:bg-[#132a1e] dark:text-[#86efac]",
    bar: "bg-[#1a7f37] dark:bg-[#4ade80]",
  },
  moderate: {
    label: "Moderate Risk",
    badge:
      "border-[#f5d598] bg-[#fef9ec] text-[#7c4a03] dark:border-[#78350f] dark:bg-[#291d0e] dark:text-[#fcd34d]",
    bar: "bg-[#b45309] dark:bg-[#fbbf24]",
  },
  high: {
    label: "High Risk",
    badge:
      "border-[#f5c2c7] bg-[#fdf2f4] text-[#842029] dark:border-[#7f1d1d] dark:bg-[#2a1215] dark:text-[#fca5a5]",
    bar: "bg-[#b91c1c] dark:bg-[#f87171]",
  },
};

/**
 * Displays the severity-weighted 0-100 unredacted exposure score, progress bar, and scope note.
 */
export function PrivacyRiskMeter({ assessment }: PrivacyRiskMeterProps): ReactElement {
  const styles = LEVEL_STYLES[assessment.level];

  return (
    <section
      aria-labelledby="privacy-risk-heading"
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="privacy-risk-heading"
            className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Privacy Risk Meter
          </h2>
          <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
            Unredacted severity weight: {assessment.unredactedSeverity} / {assessment.totalSeverity}
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          {styles.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          {assessment.score}
        </span>
        <span className="text-sm text-[#515154] dark:text-[#a1a1aa]">/ 100</span>
      </div>

      <div
        role="progressbar"
        aria-label="Unredacted privacy risk score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={assessment.score}
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#e5e5ea] dark:bg-[#2d313a]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${styles.bar}`}
          style={{ width: `${assessment.score}%` }}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#515154] dark:text-[#a1a1aa]">
        {assessment.explanation}
      </p>
    </section>
  );
}
