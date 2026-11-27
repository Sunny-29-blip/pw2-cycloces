import { type ChangeEvent, type ReactElement, useId, useRef } from "react";

export interface InputPanelProps {
  readonly text: string;
  readonly sourceFileName: string | null;
  readonly fileError: string | null;
  readonly isProcessing: boolean;
  readonly onTextChange: (nextText: string) => void;
  readonly onFileSelect: (file: File) => void;
  readonly onLoadSample: () => void;
  readonly onClear: () => void;
}

/**
 * Input workspace supporting direct text pasting, local .txt/.csv upload, and sample loading.
 */
export function InputPanel({
  text,
  sourceFileName,
  fileError,
  isProcessing,
  onTextChange,
  onFileSelect,
  onLoadSample,
  onClear,
}: InputPanelProps): ReactElement {
  const textareaId = useId();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = "";
  };

  return (
    <section
      aria-labelledby={`${textareaId}-heading`}
      className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id={`${textareaId}-heading`}
            className="text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            Source Document
          </h2>
          <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
            Paste text directly or load a local .txt / .csv file up to 2 MB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={handleFileChange}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#1d1d1f] transition-colors hover:bg-[#e8e8ed] dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7] dark:hover:bg-[#262a33]"
          >
            Upload .txt / .csv
          </button>
          <button
            type="button"
            onClick={onLoadSample}
            className="rounded-lg border border-[#0066cc] bg-[#0066cc] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0052a3] dark:border-[#0a84ff] dark:bg-[#0a84ff] dark:text-[#0b0c0e] dark:hover:bg-[#4da3ff]"
          >
            Load sample text
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={text.length === 0 && sourceFileName === null}
            className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs font-medium text-[#515154] transition-colors hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d313a] dark:bg-[#15171c] dark:text-[#a1a1aa] dark:hover:bg-[#1c1f26]"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={textareaId} className="sr-only">
          Document text to scan for PII
        </label>
        <textarea
          id={textareaId}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          rows={7}
          placeholder="Paste logs, support transcripts, customer records, or CSV content here. Detection runs automatically in a local Web Worker."
          className="w-full resize-y rounded-lg border border-[#d2d2d7] bg-[#f9f9fb] p-4 font-mono text-sm leading-relaxed text-[#1d1d1f] placeholder:text-[#6e6e73] dark:border-[#2d313a] dark:bg-[#0b0c0e] dark:text-[#f5f5f7] dark:placeholder:text-[#8e8e93]"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#515154] dark:text-[#a1a1aa]">
        <div className="flex flex-wrap items-center gap-4">
          <span>{text.length.toLocaleString()} characters</span>
          {sourceFileName !== null && (
            <span className="rounded bg-[#f5f5f7] px-2 py-1 font-medium text-[#1d1d1f] dark:bg-[#1c1f26] dark:text-[#f5f5f7]">
              File: {sourceFileName}
            </span>
          )}
        </div>
        {isProcessing && (
          <span
            role="status"
            aria-live="polite"
            className="font-medium text-[#0066cc] dark:text-[#4da3ff]"
          >
            Scanning locally in Web Worker…
          </span>
        )}
      </div>

      {fileError !== null && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-[#f5c2c7] bg-[#fdf2f4] px-4 py-3 text-xs font-medium text-[#842029] dark:border-[#7f1d1d] dark:bg-[#2a1215] dark:text-[#fca5a5]"
        >
          {fileError}
        </div>
      )}
    </section>
  );
}
