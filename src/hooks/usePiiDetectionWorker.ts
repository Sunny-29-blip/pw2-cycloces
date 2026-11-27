import { useCallback, useEffect, useRef, useState } from "react";
import type { Detection } from "../types/detection";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../types/worker";
import {
  createDetectionWorkerClient,
  type DetectionWorkerClient,
  type WorkerLike,
} from "../workers/workerClient";
import { processDetectionRequest } from "../workers/workerMessageHandler";

function createMicrotaskFallbackWorker(): WorkerLike {
  let active = true;

  const fallbackWorker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message: DetectionWorkerRequest): void {
      queueMicrotask(() => {
        if (!active || !fallbackWorker.onmessage) {
          return;
        }
        const response: DetectionWorkerResponse = processDetectionRequest(message);
        fallbackWorker.onmessage({ data: response } as MessageEvent<DetectionWorkerResponse>);
      });
    },
    terminate(): void {
      active = false;
    },
  };

  return fallbackWorker;
}

function createDefaultWorker(): WorkerLike {
  if (typeof Worker !== "undefined") {
    return new Worker(new URL("../workers/piiWorker.ts", import.meta.url), { type: "module" });
  }
  return createMicrotaskFallbackWorker();
}

/**
 * State and dispatcher returned by `usePiiDetectionWorker`.
 */
export interface UsePiiDetectionWorkerResult {
  readonly detections: readonly Detection[];
  readonly isProcessing: boolean;
  readonly workerError: string | null;
  readonly runDetection: (text: string) => void;
  readonly clearDetections: () => void;
}

/**
 * Manages a persistent local Web Worker instance for off-thread PII detection,
 * clearing stale results and terminating the worker on unmount.
 */
export function usePiiDetectionWorker(
  workerFactory: () => WorkerLike = createDefaultWorker,
): UsePiiDetectionWorkerResult {
  const [detections, setDetections] = useState<readonly Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const clientRef = useRef<DetectionWorkerClient | null>(null);

  useEffect(() => {
    const client = createDetectionWorkerClient(workerFactory, {
      onResult(nextDetections) {
        setDetections(nextDetections);
        setWorkerError(null);
        setIsProcessing(false);
      },
      onError(errorMessage) {
        setDetections([]);
        setWorkerError(errorMessage);
        setIsProcessing(false);
      },
    });

    clientRef.current = client;

    return () => {
      client.terminate();
      clientRef.current = null;
    };
  }, [workerFactory]);

  const runDetection = useCallback((text: string) => {
    setWorkerError(null);

    if (text.length === 0) {
      setDetections([]);
      setIsProcessing(false);
      clientRef.current?.analyze("");
      return;
    }

    setDetections([]);
    setIsProcessing(true);
    clientRef.current?.analyze(text);
  }, []);

  const clearDetections = useCallback(() => {
    setDetections([]);
    setWorkerError(null);
    setIsProcessing(false);
    clientRef.current?.analyze("");
  }, []);

  return {
    detections,
    isProcessing,
    workerError,
    runDetection,
    clearDetections,
  };
}
