import type { Detection } from "../types/detection";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../types/worker";

/**
 * Minimal Web Worker interface enabling deterministic unit testing without browser globals.
 */
export interface WorkerLike {
  postMessage(message: DetectionWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<DetectionWorkerResponse>) => void) | null;
  onerror: ((event: Event) => void) | null;
}

/**
 * Callbacks invoked for non-stale detection worker outcomes.
 */
export interface WorkerClientHandlers {
  readonly onResult: (detections: readonly Detection[], requestId: number) => void;
  readonly onError: (errorMessage: string, requestId: number) => void;
}

/**
 * Controller managing a single reusable PII detection Web Worker with stale-response filtering.
 */
export interface DetectionWorkerClient {
  analyze(text: string): number;
  terminate(): void;
  getLatestRequestId(): number;
}

/**
 * Creates a reusable worker client that guards against stale asynchronous responses
 * and terminates the underlying worker cleanly on disposal.
 */
export function createDetectionWorkerClient(
  createWorker: () => WorkerLike,
  handlers: WorkerClientHandlers,
): DetectionWorkerClient {
  const worker = createWorker();
  let latestRequestId = 0;
  let isTerminated = false;

  worker.onmessage = (event: MessageEvent<DetectionWorkerResponse>) => {
    if (isTerminated) {
      return;
    }

    const response = event.data;
    if (!response || response.requestId !== latestRequestId) {
      return;
    }

    if (response.ok) {
      handlers.onResult(response.detections, response.requestId);
    } else {
      handlers.onError(response.error, response.requestId);
    }
  };

  worker.onerror = () => {
    if (isTerminated || latestRequestId === 0) {
      return;
    }
    handlers.onError(
      "Local PII detection worker encountered an unexpected error.",
      latestRequestId,
    );
  };

  return {
    analyze(text: string): number {
      if (isTerminated) {
        throw new Error("Cannot analyze document after detection worker termination.");
      }

      latestRequestId += 1;
      const requestId = latestRequestId;

      if (text.length === 0) {
        handlers.onResult([], requestId);
        return requestId;
      }

      worker.postMessage({ requestId, text });
      return requestId;
    },

    terminate(): void {
      if (isTerminated) {
        return;
      }
      isTerminated = true;
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    },

    getLatestRequestId(): number {
      return latestRequestId;
    },
  };
}