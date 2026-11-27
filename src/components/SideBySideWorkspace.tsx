import { type ReactElement, useState } from "react";
import type { OriginalDocumentSegment, SanitizedDocumentSegment } from "../lib/documentSegments";

export interface SideBySideWorkspaceProps {
  readonly hasText: boolean;
  readonly originalSegments: readonly OriginalDocumentSegment[];
  readonly sanitizedSegments: readonly SanitizedDocumentSegment[];
  readonly selectedDetectionId: string | null;
  readonly onSelectDetection: (id: string) => void;
  readonly onToggleDetection: (id: string) => void;
}

type MobilePane = "original" | "sanitized";

/**
 * Safe side-by-side original and live sanitized document workspace rendered solely with React text nodes.
 */
export function SideBySideWorkspace({
  hasText,
  originalSegments,
  sanitizedSegments,
  selectedDetectionId,
  onSelectDetection,
  onToggleDetection,
}: SideBySideWorkspaceProps): ReactElement {
  const [mobilePane, setMobilePane] = useState<MobilePane>("original");

  const handleEntityClick = (id: string) => {
    onSelectDetection(id);
    onToggleDetection(id);
  };

  return (
    <section
      aria-labelledby="workspace-heading"
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="workspace-heading"
            className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Side-by-Side Review
          </h2>
          <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
            Click any highlighted detection on the left to toggle between Redacted and Kept.
          </p>
        </div>

        <div
          role="group"
          aria-label="Document view switcher"
          className="inline-flex rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] p-1 lg:hidden dark:border-[#2d313a] dark:bg-[#1c1f26]"
        >
          <button
            type="button"
            aria-pressed={mobilePane === "original"}
            onClick={() => setMobilePane("original")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mobilePane === "original"
                ? "bg-white text-[#1d1d1f] shadow-xs dark:bg-[#2d313a] dark:text-[#f5f5f7]"
                : "text-[#515154] dark:text-[#a1a1aa]"
            }`}
          >
            Original Document
          </button>
          <button
            type="button"
            aria-pressed={mobilePane === "sanitized"}
            onClick={() => setMobilePane("sanitized")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mobilePane === "sanitized"
                ? "bg-white text-[#1d1d1f] shadow-xs dark:bg-[#2d313a] dark:text-[#f5f5f7]"
                : "text-[#515154] dark:text-[#a1a1aa]"
            }`}
          >
            Sanitized Output
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={mobilePane === "original" ? "block" : "hidden lg:block"}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-[#515154] uppercase dark:text-[#a1a1aa]">
            Original Document
          </h3>
          <div className="min-h-64 overflow-auto rounded-lg border border-[#d2d2d7] bg-[#f9f9fb] p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-[#1d1d1f] dark:border-[#2d313a] dark:bg-[#0b0c0e] dark:text-[#f5f5f7]">
            {!hasText ? (
              <span className="font-sans text-xs text-[#6e6e73] dark:text-[#8e8e93]">
                Original document highlights will appear here.
              </span>
            ) : (
              originalSegments.map((segment) => {
                if (segment.kind === "text") {
                  return <span key={segment.key}>{segment.text}</span>;
                }

                const { detection, isIgnored } = segment;
                const isSelected = detection.id === selectedDetectionId;

                return (
                  <button
                    key={segment.key}
                    type="button"
                    onClick={() => handleEntityClick(detection.id)}
                    onFocus={() => onSelectDetection(detection.id)}
                    aria-pressed={isIgnored}
                    aria-label={`${detection.type}: ${isIgnored ? "Kept unchanged" : "Redacted"}. Activate to ${isIgnored ? "redact" : "keep original"}.`}
                    className={`mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-left font-mono text-xs transition-colors ${
                      isIgnored
                        ? "border-[#d97706] bg-[#fef9ec] text-[#7c4a03] dark:border-[#f59e0b] dark:bg-[#291d0e] dark:text-[#fcd34d]"
                        : "border-[#0066cc] bg-[#e8f2ff] text-[#004499] dark:border-[#4da3ff] dark:bg-[#132238] dark:text-[#93c5fd]"
                    } ${isSelected ? "ring-2 ring-[#0066cc] dark:ring-[#4da3ff]" : ""}`}
                  >
                    <span>{detection.value}</span>
                    <span className="rounded bg-white/80 px-1 py-0.2 text-[10px] font-semibold uppercase dark:bg-[#0b0c0e]/70">
                      {detection.type} · {isIgnored ? "KEPT" : "REDACT"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={mobilePane === "sanitized" ? "block" : "hidden lg:block"}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-[#515154] uppercase dark:text-[#a1a1aa]">
            Live Sanitized Output
          </h3>
          <div
            aria-label="Live sanitized document output"
            className="min-h-64 overflow-auto rounded-lg border border-[#d2d2d7] bg-[#f9f9fb] p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-[#1d1d1f] dark:border-[#2d313a] dark:bg-[#0b0c0e] dark:text-[#f5f5f7]"
          >
            {!hasText ? (
              <span className="font-sans text-xs text-[#6e6e73] dark:text-[#8e8e93]">
                Sanitized output updates automatically as you edit or toggle detections.
              </span>
            ) : (
              sanitizedSegments.map((segment) => {
                if (segment.kind === "text") {
                  return <span key={segment.key}>{segment.text}</span>;
                }

                if (segment.kind === "kept") {
                  return (
                    <span
                      key={segment.key}
                      className="mx-0.5 inline-block rounded border border-[#d97706] bg-[#fef9ec] px-1.5 py-0.5 text-xs font-medium text-[#7c4a03] dark:border-[#f59e0b] dark:bg-[#291d0e] dark:text-[#fcd34d]"
                    >
                      {segment.text}
                    </span>
                  );
                }

                return (
                  <span
                    key={segment.key}
                    className="mx-0.5 inline-block rounded border border-[#1a7f37] bg-[#edf8f0] px-1.5 py-0.5 text-xs font-semibold text-[#125b2d] dark:border-[#22543d] dark:bg-[#132a1e] dark:text-[#86efac]"
                  >
                    {segment.text}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
