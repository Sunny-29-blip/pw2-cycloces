import type { RedactionMode } from "../types/redaction";

/**
 * Maximum permitted client-side file upload size (2 MB).
 */
export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Supported upload file extensions.
 */
export type SupportedFileExtension = ".txt" | ".csv";

/**
 * Result of validating a user-selected local file prior to reading.
 */
export type FileValidationResult =
  | { readonly ok: true; readonly extension: SupportedFileExtension }
  | { readonly ok: false; readonly error: string };

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

function extractExtension(filename: string): SupportedFileExtension | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".txt")) {
    return ".txt";
  }
  if (lower.endsWith(".csv")) {
    return ".csv";
  }
  return null;
}

/**
 * Validates file extension, optional MIME type, non-empty size, and 2 MB cap.
 */
export function validateUploadFile(file: File): FileValidationResult {
  const extension = extractExtension(file.name);
  if (extension === null) {
    return {
      ok: false,
      error: "Unsupported file format. Please select a .txt or .csv file.",
    };
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      ok: false,
      error: "Unsupported file MIME type. Only plain text (.txt) and CSV (.csv) files are allowed.",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: "The selected file is empty. Please choose a file containing text.",
    };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      ok: false,
      error: "File exceeds the 2 MB local processing limit.",
    };
  }

  return { ok: true, extension };
}

/**
 * Reads a validated File completely inside browser memory as UTF-8 text.
 */
export async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file as text."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read local file."));
    };
    reader.readAsText(file);
  });
}

/**
 * Builds the download filename and MIME type preserving the source extension when present.
 */
export function buildSanitizedDownloadMeta(
  sourceFileName: string | null,
  extension: SupportedFileExtension,
  mode: RedactionMode,
): { readonly filename: string; readonly mimeType: string } {
  const modeSlug = mode.toLowerCase();
  const mimeType = extension === ".csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";

  if (sourceFileName) {
    const trimmed = sourceFileName.trim();
    const baseName = trimmed.replace(/\.(txt|csv)$/i, "") || "document";
    return {
      filename: `${baseName}.sanitized-${modeSlug}${extension}`,
      mimeType,
    };
  }

  return {
    filename: `cyloces-sanitized-${modeSlug}${extension}`,
    mimeType,
  };
}

/**
 * Triggers an in-browser file download and immediately revokes the temporary object URL.
 */
export function triggerBrowserDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}
