import type { ReactElement } from "react";

export interface AuditExportBarProps {
  readonly hasText: boolean;
  readonly onDownloadSanitized: () => void;
  readonly onDownloadAuditJson: () => void;
  readonly onDownloadAuditCsv: () => void;
}

/**
 * Export controls for sanitized document output and PII-free JSON/CSV audit reports.
 */
export function AuditExportBar({
  hasText,
  onDownloadSanitized,
  onDownloadAuditJson,
  onDownloadAuditCsv,
}: AuditExportBarProps): ReactElement {
  return (
    <section
      aria-labelledby="export-heading"
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="export-heading"
            className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Export & Privacy Audit
          </h2>
          <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
            All exports are generated locally in browser memory. Audit reports never include source
            text, raw PII values, or filenames.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDownloadSanitized}
            disabled={!hasText}
            className="rounded-lg border border-[#0066cc] bg-[#0066cc] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0052a3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#0a84ff] dark:bg-[#0a84ff] dark:text-[#0b0c0e] dark:hover:bg-[#4da3ff]"
          >
            Download Sanitized Output
          </button>
          <button
            type="button"
            onClick={onDownloadAuditJson}
            disabled={!hasText}
            className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#1d1d1f] transition-colors hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7] dark:hover:bg-[#262a33]"
          >
            Download Audit JSON
          </button>
          <button
            type="button"
            onClick={onDownloadAuditCsv}
            disabled={!hasText}
            className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#1d1d1f] transition-colors hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7] dark:hover:bg-[#262a33]"
          >
            Download Audit CSV
          </button>
        </div>
      </div>
    </section>
  );
}
