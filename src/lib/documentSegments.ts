import { createDetectionId } from "./detectors";
import { applyPartialMask, FULL_MASK_PLACEHOLDER } from "./redaction";
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

  const reanchored: Detection = {
    ...detection,
    id: createDetectionId(detection.type, 0, detection.value.length),
    start: 0,
    end: detection.value.length,
  };

  return applyPartialMask(detection.value, [reanchored]).sanitizedText;
}

/**
 * Builds aligned original and sanitized React-safe text segments from the current
 * document, detections, ignored IDs, and single-source-of-truth redaction result.
 */
export function buildDocumentViewSegments(
  text: string,
  detections: readonly Detection[],
  mode: RedactionMode,
  ignoredIds: ReadonlySet<string>,
  redactionResult: RedactionResult,
): {
  readonly originalSegments: readonly OriginalDocumentSegment[];
  readonly sanitizedSegments: readonly SanitizedDocumentSegment[];
} {
  if (text.length === 0) {
    return { originalSegments: [], sanitizedSegments: [] };
  }

  if (detections.length === 0) {
    return {
      originalSegments: [{ kind: "text", key: "orig-plain", text }],
      sanitizedSegments: [{ kind: "text", key: "san-plain", text }],
    };
  }

  const originalSegments: OriginalDocumentSegment[] = [];
  const sanitizedSegments: SanitizedDocumentSegment[] = [];
  let cursor = 0;

  for (const detection of detections) {
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

  if (cursor < text.length) {
    const tail = text.slice(cursor);
    originalSegments.push({ kind: "text", key: `orig-txt-${cursor}`, text: tail });
    sanitizedSegments.push({ kind: "text", key: `san-txt-${cursor}`, text: tail });
  }

  return { originalSegments, sanitizedSegments };
}
