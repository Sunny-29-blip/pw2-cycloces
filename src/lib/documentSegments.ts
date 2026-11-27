import { FULL_MASK_PLACEHOLDER, maskEntityValuePartially } from "./redaction";
import type { Detection } from "../types/detection";
import type { RedactionMode, RedactionResult } from "../types/redaction";

/**
 * Segment rendered in the original source pane.
 */
export type OriginalDocumentSegment =
  | { readonly kind: "text"; readonly key: string; readonly text: string }
  | {
      readonly kind: "entity";
      readonly key: string;
      readonly detection: Detection;
      readonly isIgnored: boolean;
    };

/**
 * Segment rendered in the live sanitized output pane.
 */
export type SanitizedDocumentSegment =
  | { readonly kind: "text"; readonly key: string; readonly text: string }
  | {
      readonly kind: "redacted" | "kept";
      readonly key: string;
      readonly detection: Detection;
      readonly text: string;
    };

/**
 * Character and detection window for paginated high-density rendering.
 */
export interface DocumentSegmentWindow {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly detections: readonly Detection[];
}

function resolveReplacementText(
  detection: Detection,
  mode: RedactionMode,
  redactionResult: RedactionResult,
): string {
  if (mode === "FULL") {
    return FULL_MASK_PLACEHOLDER;
  }

  if (mode === "PSEUDONYMIZE") {
    return (
      redactionResult.pseudonymMetadata?.placeholderByDetectionId[detection.id] ??
      FULL_MASK_PLACEHOLDER
    );
  }

  return maskEntityValuePartially(detection.type, detection.value);
}

/**
 * Computes the exact non-overlapping character slice and detection subset for a workspace page.
 */
export function computeDetectionPageWindow(
  textLength: number,
  detections: readonly Detection[],
  pageIndex: number,
  pageSize: number,
): DocumentSegmentWindow {
  if (detections.length === 0) {
    return { startOffset: 0, endOffset: textLength, detections: [] };
  }

  const totalPages = Math.max(1, Math.ceil(detections.length / pageSize));
  const safePage = Math.max(0, Math.min(totalPages - 1, pageIndex));
  const startIndex = safePage * pageSize;
  const endIndex = Math.min(detections.length, startIndex + pageSize);
  const pageDetections = detections.slice(startIndex, endIndex);

  const prevDetection = startIndex > 0 ? detections[startIndex - 1] : undefined;
  const lastPageDetection = pageDetections[pageDetections.length - 1];

  const startOffset = prevDetection ? prevDetection.end : 0;
  const endOffset =
    endIndex >= detections.length || !lastPageDetection ? textLength : lastPageDetection.end;

  return {
    startOffset,
    endOffset,
    detections: pageDetections,
  };
}

/**
 * Builds aligned original and sanitized React-safe text segments from the current
 * document (or active page window), detections, ignored IDs, and redaction result.
 */
export function buildDocumentViewSegments(
  text: string,
  detections: readonly Detection[],
  mode: RedactionMode,
  ignoredIds: ReadonlySet<string>,
  redactionResult: RedactionResult,
  windowBounds?: DocumentSegmentWindow,
): {
  readonly originalSegments: readonly OriginalDocumentSegment[];
  readonly sanitizedSegments: readonly SanitizedDocumentSegment[];
} {
  if (text.length === 0) {
    return { originalSegments: [], sanitizedSegments: [] };
  }

  const startOffset = windowBounds ? windowBounds.startOffset : 0;
  const endOffset = windowBounds ? windowBounds.endOffset : text.length;
  const scopedDetections = windowBounds ? windowBounds.detections : detections;

  if (scopedDetections.length === 0) {
    const slice = text.slice(startOffset, endOffset);
    return {
      originalSegments: [{ kind: "text", key: `orig-plain-${startOffset}`, text: slice }],
      sanitizedSegments: [{ kind: "text", key: `san-plain-${startOffset}`, text: slice }],
    };
  }

  const originalSegments: OriginalDocumentSegment[] = [];
  const sanitizedSegments: SanitizedDocumentSegment[] = [];
  let cursor = startOffset;

  for (const detection of scopedDetections) {
    if (detection.start > cursor) {
      const plainSlice = text.slice(cursor, detection.start);
      originalSegments.push({ kind: "text", key: `orig-txt-${cursor}`, text: plainSlice });
      sanitizedSegments.push({ kind: "text", key: `san-txt-${cursor}`, text: plainSlice });
    }

    const isIgnored = ignoredIds.has(detection.id);

    originalSegments.push({
      kind: "entity",
      key: `orig-ent-${detection.id}`,
      detection,
      isIgnored,
    });

    if (isIgnored) {
      sanitizedSegments.push({
        kind: "kept",
        key: `san-kept-${detection.id}`,
        detection,
        text: detection.value,
      });
    } else {
      sanitizedSegments.push({
        kind: "redacted",
        key: `san-red-${detection.id}`,
        detection,
        text: resolveReplacementText(detection, mode, redactionResult),
      });
    }

    cursor = detection.end;
  }

  if (cursor < endOffset) {
    const tail = text.slice(cursor, endOffset);
    originalSegments.push({ kind: "text", key: `orig-txt-${cursor}`, text: tail });
    sanitizedSegments.push({ kind: "text", key: `san-txt-${cursor}`, text: tail });
  }

  return { originalSegments, sanitizedSegments };
}
