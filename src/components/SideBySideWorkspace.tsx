import { type ReactElement, useMemo, useState } from "react";
import { buildDocumentViewSegments, computeDetectionPageWindow } from "../lib/documentSegments";
import type { Detection } from "../types/detection";
import type { RedactionMode, RedactionResult } from "../types/redaction";

export const HIGH_DENSITY_DETECTION_THRESHOLD = 250;
export const WORKSPACE_PAGE_DETECTION_SIZE = 100;

export interface SideBySideWorkspaceProps {
  readonly documentText: string;
  readonly detections: readonly Detection[];
  readonly redactionMode: RedactionMode;
  readonly ignoredIds: ReadonlySet<string>;
  readonly redactionResult: RedactionResult;
  readonly selectedDetectionId: string | null;
  readonly onSelectDetection: (id: string) => void;
  readonly onToggleDetection: (id: string) => void;
}

type MobilePane = "original" | "sanitized";

/**
 * Safe side-by-side original and live sanitized document workspace rendered solely with React
 * text nodes, automatically paginating high-density documents to protect UI responsiveness.
 */
export function SideBySideWorkspace({
  documentText,
  detections,
  redactionMode,
  ignoredIds,
  redactionResult,
  selectedDetectionId,
  onSelectDetection,
  onToggleDetection,
}: SideBySideWorkspaceProps): ReactElement {
  const [mobilePane, setMobilePane] = useState<MobilePane>("original");
  const [pageState, setPageState] = useState<{
    readonly anchorSelectedId: string | null;
    readonly page: number;
  }>({
    anchorSelectedId: null,
    page: 0,
  });

  const isHighDensity = detections.length > HIGH_DENSITY_DETECTION_THRESHOLD;
  const totalPages = isHighDensity
    ? Math.max(1, Math.ceil(detections.length / WORKSPACE_PAGE_DETECTION_SIZE))
    : 1;

  const selectedIndex = selectedDetectionId
    ? detections.findIndex((item) => item.id === selectedDetectionId)
    : -1;
  const derivedPage =
    selectedIndex >= 0 ? Math.floor(selectedIndex / WORKSPACE_PAGE_DETECTION_SIZE) : 0;

  const activePage = isHighDensity
    ? Math.max(
        0,
        Math.min(
          totalPages - 1,
          pageState.anchorSelectedId === selectedDetectionId ? pageState.page : derivedPage,
        ),
      )
    : 0;

  const pageWindow = useMemo(
    () =>
      isHighDensity
        ? computeDetectionPageWindow(
            documentText.length,
            detections,
            activePage,
            WORKSPACE_PAGE_DETECTION_SIZE,
          )
        : undefined,
    [isHighDensity, documentText.length, detections, activePage],
  );

  const { originalSegments, sanitizedSegments } = useMemo(
    () =>
      buildDocumentViewSegments(
        documentText,
        detections,
        redactionMode,
        ignoredIds,
        redactionResult,
        pageWindow,
      ),
    [documentText, detections, redactionMode, ignoredIds, redactionResult, pageWindow],
  );

  const handleEntityClick = (id: string) => {
    onSelectDetection(id);
    onToggleDetection(id);
  };

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, nextPage));
    setPageState({ anchorSelectedId: selectedDetectionId, page: clamped });
  };

  const hasText = documentText.length > 0;
  const rangeStart = activePage * WORKSPACE_PAGE_DETECTION_SIZE + 1;
  const rangeEnd = Math.min(detections.length, (activePage + 1) * WORKSPACE_PAGE_DETECTION_SIZE);

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

      {isHighDensity && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#d2d2d7] bg-[#f9f9fb] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-[#2d313a] dark:bg-[#1c1f26]">
          <p className="text-[#515154] dark:text-[#a1a1aa]">
            High-density view: showing detections {rangeStart}–{rangeEnd} of{" "}
            {detections.length.toLocaleString()}. Full downloads remain complete.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 0}
              className="rounded-md border border-[#d2d2d7] bg-white px-2.5 py-1 font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#15171c] dark:text-[#f5f5f7]"
            >
              Previous Section
            </button>
            <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              Section {activePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage >= totalPages - 1}
              className="rounded-md border border-[#d2d2d7] bg-white px-2.5 py-1 font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#15171c] dark:text-[#f5f5f7]"
            >
              Next Section
            </button>
          </div>
        </div>
      )}

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
