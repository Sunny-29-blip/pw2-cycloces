import { type ReactElement, useId, useMemo, useState } from "react";
import { requestComplianceSummary } from "../lib/complianceClient";
import { ENTITY_PRIORITY_ORDER } from "../lib/detectors";
import type { ComplianceSummaryRequest, ComplianceSummaryResponse } from "../types/compliance";

export interface AiComplianceSummaryProps {
  readonly payload: ComplianceSummaryRequest;
  readonly fetchFn?: typeof fetch;
}

type SummaryStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "success"; readonly data: ComplianceSummaryResponse }
  | {
      readonly kind: "error";
      readonly errorType: "CONFIGURATION_ERROR" | "NETWORK_ERROR" | "API_ERROR";
      readonly message: string;
    };

const ERROR_TITLES: Readonly<
  Record<"CONFIGURATION_ERROR" | "NETWORK_ERROR" | "API_ERROR", string>
> = {
  CONFIGURATION_ERROR: "Server Configuration Required",
  NETWORK_ERROR: "Network Error",
  API_ERROR: "API Error",
};

/**
 * Optional, opt-in AI Compliance Summary panel requiring explicit user consent
 * and transmitting only aggregate counts by type and the 0-100 risk score.
 */
export function AiComplianceSummary({ payload, fetchFn }: AiComplianceSummaryProps): ReactElement {
  const headingId = useId();
  const consentId = useId();

  const [hasConsented, setHasConsented] = useState(false);
  const [status, setStatus] = useState<SummaryStatus>({ kind: "idle" });
  const [lastPayloadSignature, setLastPayloadSignature] = useState<string>(() =>
    JSON.stringify(payload),
  );

  const payloadSignature = useMemo(() => JSON.stringify(payload), [payload]);
  const effectiveStatus: SummaryStatus =
    payloadSignature !== lastPayloadSignature && status.kind !== "loading"
      ? { kind: "idle" }
      : status;

  const isLoading = effectiveStatus.kind === "loading";

  const handleGenerate = async () => {
    if (!hasConsented || isLoading) {
      return;
    }

    setLastPayloadSignature(payloadSignature);
    setStatus({ kind: "loading" });

    const outcome = await requestComplianceSummary(payload, fetchFn);
    if (outcome.ok) {
      setStatus({ kind: "success", data: outcome.data });
    } else {
      setStatus({
        kind: "error",
        errorType: outcome.errorType,
        message: outcome.message,
      });
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={headingId}
              className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              AI Compliance Summary
            </h2>
            <span className="rounded bg-[#f5f5f7] px-2 py-0.5 text-xs font-medium text-[#515154] dark:bg-[#1c1f26] dark:text-[#a1a1aa]">
              Optional · Opt-In
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#515154] dark:text-[#a1a1aa]">
            Your original document text and raw identifiers remain in your browser. When you enable
            this AI summary, aggregate entity counts and the privacy risk score are sent to Google
            Gemini through our serverless API. No original text or raw PII is transmitted.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#e5e5ea] bg-[#f9f9fb] p-4 dark:border-[#2d313a] dark:bg-[#0b0c0e]">
        <p className="text-xs font-semibold tracking-wide text-[#515154] uppercase dark:text-[#a1a1aa]">
          Exact Metadata Transmitted Upon Generation
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {ENTITY_PRIORITY_ORDER.map((entityType) => (
            <span
              key={entityType}
              className="rounded border border-[#d2d2d7] bg-white px-2.5 py-1 font-mono text-[#1d1d1f] dark:border-[#2d313a] dark:bg-[#15171c] dark:text-[#f5f5f7]"
            >
              {entityType}: {payload.countsByType[entityType]}
            </span>
          ))}
          <span className="rounded border border-[#d2d2d7] bg-white px-2.5 py-1 font-mono font-semibold text-[#1d1d1f] dark:border-[#2d313a] dark:bg-[#15171c] dark:text-[#f5f5f7]">
            riskScore: {payload.riskScore}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label
          htmlFor={consentId}
          className="flex cursor-pointer items-start gap-2.5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]"
        >
          <input
            id={consentId}
            type="checkbox"
            checked={hasConsented}
            onChange={(event) => setHasConsented(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0066cc] dark:accent-[#4da3ff]"
          />
          <span>
            I consent to sending only these aggregate counts and risk score to the serverless Gemini
            API.
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            void handleGenerate();
          }}
          disabled={!hasConsented || isLoading}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#0066cc] bg-[#0066cc] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0052a3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#0a84ff] dark:bg-[#0a84ff] dark:text-[#0b0c0e] dark:hover:bg-[#4da3ff]"
        >
          {isLoading ? "Generating Summary…" : "Generate Summary"}
        </button>
      </div>

      {effectiveStatus.kind === "loading" && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-xs font-medium text-[#0066cc] dark:text-[#4da3ff]"
        >
          Requesting compliance summary from serverless Gemini endpoint…
        </p>
      )}

      {effectiveStatus.kind === "error" && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-[#f5c2c7] bg-[#fdf2f4] p-4 text-xs text-[#842029] sm:flex-row sm:items-center sm:justify-between dark:border-[#7f1d1d] dark:bg-[#2a1215] dark:text-[#fca5a5]"
        >
          <div>
            <p className="font-semibold">{ERROR_TITLES[effectiveStatus.errorType]}</p>
            <p className="mt-1">{effectiveStatus.message}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={!hasConsented}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#842029] bg-white px-3 py-1.5 text-xs font-semibold text-[#842029] hover:bg-[#fdf2f4] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#fca5a5] dark:bg-[#15171c] dark:text-[#fca5a5]"
          >
            Retry
          </button>
        </div>
      )}

      {effectiveStatus.kind === "success" && (
        <div
          aria-live="polite"
          className="mt-4 space-y-3 rounded-lg border border-[#b7dfc4] bg-[#edf8f0] p-4 text-[#1d1d1f] dark:border-[#22543d] dark:bg-[#132a1e] dark:text-[#f5f5f7]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#125b2d] dark:text-[#86efac]">
            <span className="font-semibold">Generated Compliance Summary</span>
            <span>Model: {effectiveStatus.data.model}</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {effectiveStatus.data.summary}
          </p>
          <p className="border-t border-[#b7dfc4] pt-2 text-xs text-[#125b2d] dark:border-[#22543d] dark:text-[#86efac]">
            {effectiveStatus.data.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
