import type { Detection } from "./detection";

/**
 * Message sent from the main UI thread to the local PII detection Web Worker.
 */
export interface DetectionWorkerRequest {
  readonly requestId: number;
  readonly text: string;
}

/**
 * Successful response posted by the PII detection Web Worker.
 */
export interface DetectionWorkerSuccess {
  readonly requestId: number;
  readonly ok: true;
  readonly detections: readonly Detection[];
}

/**
 * Error response posted by the PII detection Web Worker without raw document content.
 */
export interface DetectionWorkerFailure {
  readonly requestId: number;
  readonly ok: false;
  readonly error: string;
}

/**
 * Union of all typed responses emitted by the PII detection Web Worker.
 */
export type DetectionWorkerResponse = DetectionWorkerSuccess | DetectionWorkerFailure;
