import { type ReactElement, useState } from "react";
import type { Detection } from "../types/detection";

export const INSPECTOR_PAGE_SIZE = 50;

export interface DetectionInspectorProps {
  readonly detections: readonly Detection[];
  readonly selectedDetectionId: string | null;
  readonly ignoredIds: ReadonlySet<string>;
  readonly onSelectDetection: (id: string) => void;
  readonly onToggleDetection: (id: string) => void;
}

/**
 * Explainability panel exposing entity type, confidence, severity, validation reasons,
 * and an explicit Keep/Redact control with 50-item pagination for high-density documents.
 */
export function DetectionInspector({
  detections,
  selectedDetectionId,
  ignoredIds,
  onSelectDetection,
  onToggleDetection,
}: DetectionInspectorProps): ReactElement {
  const [pageState, setPageState] = useState<{
    readonly anchorSelectedId: string | null;
    readonly page: number;
  }>({
    anchorSelectedId: null,
    page: 0,
  });

  const matchedIndex =
    selectedDetectionId !== null
      ? detections.findIndex((item) => item.id === selectedDetectionId)
      : -1;
  const selectedIndex = matchedIndex >= 0 ? matchedIndex : detections.length > 0 ? 0 : -1;
  const activeDetection = selectedIndex >= 0 ? (detections[selectedIndex] ?? null) : null;

  const totalPages = Math.max(1, Math.ceil(detections.length / INSPECTOR_PAGE_SIZE));

  const derivedPage = selectedIndex >= 0 ? Math.floor(selectedIndex / INSPECTOR_PAGE_SIZE) : 0;
  const activePage = Math.max(
    0,
    Math.min(
      totalPages - 1,
      pageState.anchorSelectedId === selectedDetectionId ? pageState.page : derivedPage,
    ),
  );

  const pageStart = activePage * INSPECTOR_PAGE_SIZE;
  const pageDetections = detections.slice(pageStart, pageStart + INSPECTOR_PAGE_SIZE);

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, nextPage));
    setPageState({ anchorSelectedId: selectedDetectionId, page: clamped });
  };

  return (
    <section
      aria-labelledby="detection-inspector-heading"
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="detection-inspector-heading"
            className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Explainable Detection Inspector
          </h2>
          <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
            Select any entity below or in the document to review exact validation checks.
          </p>
        </div>

        {totalPages > 1 && (
          <nav
            aria-label="Detection inspector pagination"
            className="flex items-center gap-2 text-xs"
          >
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 0}
              className="rounded-md border border-[#d2d2d7] bg-[#f5f5f7] px-2.5 py-1 font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7]"
            >
              Previous Page
            </button>
            <span aria-live="polite" className="text-[#515154] dark:text-[#a1a1aa]">
              Page {activePage + 1} of {totalPages} ({detections.length.toLocaleString()} total)
            </span>
            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage >= totalPages - 1}
              className="rounded-md border border-[#d2d2d7] bg-[#f5f5f7] px-2.5 py-1 font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7]"
            >
              Next Page
            </button>
          </nav>
        )}
      </div>

      {activeDetection === null ? (
        <p className="mt-4 rounded-lg border border-dashed border-[#d2d2d7] bg-[#f9f9fb] p-4 text-xs text-[#515154] dark:border-[#2d313a] dark:bg-[#0b0c0e] dark:text-[#a1a1aa]">
          No PII detections to inspect yet. Paste text, upload a file, or load the sample document.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <ul className="flex flex-wrap gap-2" aria-label="Detected entities">
            {pageDetections.map((item, localIndex) => {
              const globalIndex = pageStart + localIndex;
              const isSelected = item.id === activeDetection.id;
              const isKept = ignoredIds.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectDetection(item.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-[#0066cc] bg-[#0066cc] text-white dark:border-[#4da3ff] dark:bg-[#4da3ff] dark:text-[#0b0c0e]"
                        : "border-[#d2d2d7] bg-[#f9f9fb] text-[#1d1d1f] hover:bg-[#ececf1] dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7] dark:hover:bg-[#262a33]"
                    }`}
                  >
                    #{globalIndex + 1} {item.type} ({isKept ? "Kept" : "Redacted"})
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-lg border border-[#e5e5ea] bg-[#f9f9fb] p-4 dark:border-[#2d313a] dark:bg-[#1c1f26]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {activeDetection.type}
                  </span>
                  <span className="rounded bg-[#e5e5ea] px-2 py-0.5 text-xs font-medium text-[#1d1d1f] dark:bg-[#2d313a] dark:text-[#f5f5f7]">
                    Confidence: {activeDetection.confidence.toUpperCase()}
                  </span>
                  <span className="rounded bg-[#e5e5ea] px-2 py-0.5 text-xs font-medium text-[#1d1d1f] dark:bg-[#2d313a] dark:text-[#f5f5f7]">
                    Severity: {activeDetection.severity} / 5
                  </span>
                </div>
                <p className="text-xs text-[#515154] dark:text-[#a1a1aa]">
                  Offsets {activeDetection.start}–{activeDetection.end} (
                  {activeDetection.end - activeDetection.start} chars) · Status:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {ignoredIds.has(activeDetection.id) ? "Kept unchanged" : "Redacted"}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => onToggleDetection(activeDetection.id)}
                aria-pressed={ignoredIds.has(activeDetection.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  ignoredIds.has(activeDetection.id)
                    ? "border-[#0066cc] bg-[#0066cc] text-white hover:bg-[#0052a3] dark:border-[#4da3ff] dark:bg-[#4da3ff] dark:text-[#0b0c0e]"
                    : "border-[#b45309] bg-[#fef9ec] text-[#7c4a03] hover:bg-[#fdeec8] dark:border-[#d97706] dark:bg-[#291d0e] dark:text-[#fcd34d]"
                }`}
              >
                {ignoredIds.has(activeDetection.id) ? "Redact again" : "Keep original"}
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold tracking-wide text-[#515154] uppercase dark:text-[#a1a1aa]">
                Validation Reasons
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                {activeDetection.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
