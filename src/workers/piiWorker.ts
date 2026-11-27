import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../types/worker";
import { processDetectionRequest } from "./workerMessageHandler";

interface DedicatedWorkerScopeLike {
  onmessage: ((event: MessageEvent<DetectionWorkerRequest>) => void) | null;
  postMessage(message: DetectionWorkerResponse): void;
}

const workerScope = globalThis as unknown as DedicatedWorkerScopeLike;

workerScope.onmessage = (event: MessageEvent<DetectionWorkerRequest>) => {
  const response = processDetectionRequest(event.data);
  workerScope.postMessage(response);
};
