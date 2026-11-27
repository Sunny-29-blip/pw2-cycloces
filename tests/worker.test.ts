import { describe, expect, it, vi } from "vitest";
import type { Detection } from "../src/types/detection";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../src/types/worker";
import { createDetectionWorkerClient, type WorkerLike } from "../src/workers/workerClient";
import { processDetectionRequest } from "../src/workers/workerMessageHandler";

function createFakeWorker() {
  const postedMessages: DetectionWorkerRequest[] = [];
  let terminated = false;

  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message: DetectionWorkerRequest) {
      postedMessages.push(message);
    },
    terminate() {
      terminated = true;
    },
  };

  return {
    worker,
    postedMessages,
    isTerminated: () => terminated,
    emitResponse(response: DetectionWorkerResponse) {
      worker.onmessage?.({ data: response } as MessageEvent<DetectionWorkerResponse>);
    },
    emitError() {
      worker.onerror?.(new ErrorEvent("error"));
    },
  };
}

describe("Web Worker detection pipeline", () => {
  it("processes valid, empty, and malformed requests in workerMessageHandler", () => {
    const validResponse = processDetectionRequest({
      requestId: 1,
      text: "Reach alice@example.com from 10.0.0.1",
    });
    expect(validResponse.ok).toBe(true);
    if (validResponse.ok) {
      expect(validResponse.requestId).toBe(1);
      expect(validResponse.detections.map((d) => d.type)).toEqual(["EMAIL", "IPV4"]);
    }

    const emptyResponse = processDetectionRequest({ requestId: 2, text: "" });
    expect(emptyResponse).toEqual({ requestId: 2, ok: true, detections: [] });

    const invalidResponse = processDetectionRequest({ requestId: "bad", text: 123 });
    expect(invalidResponse.ok).toBe(false);
  });

  it("ignores stale responses when newer detection requests are issued", () => {
    const fake = createFakeWorker();
    const onResult = vi.fn();
    const onError = vi.fn();

    const client = createDetectionWorkerClient(() => fake.worker, { onResult, onError });

    const firstId = client.analyze("First text alice@example.com");
    const secondId = client.analyze("Second text bob@example.org");
    expect(secondId).toBeGreaterThan(firstId);
    expect(fake.postedMessages).toHaveLength(2);

    // Late stale response for firstId must be ignored
    const staleDetections: Detection[] = [];
    fake.emitResponse({ requestId: firstId, ok: true, detections: staleDetections });
    expect(onResult).not.toHaveBeenCalled();

    // Active response for secondId must be delivered
    const latestResponse = processDetectionRequest(fake.postedMessages[1]);
    expect(latestResponse.ok).toBe(true);
    fake.emitResponse(latestResponse);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      latestResponse.ok ? latestResponse.detections : [],
      secondId,
    );
    expect(onError).not.toHaveBeenCalled();

    client.terminate();
    expect(fake.isTerminated()).toBe(true);
  });

  it("handles worker error payloads and onerror events cleanly", () => {
    const fake = createFakeWorker();
    const onResult = vi.fn();
    const onError = vi.fn();

    const client = createDetectionWorkerClient(() => fake.worker, { onResult, onError });

    const req1 = client.analyze("Test 1");
    fake.emitResponse({ requestId: req1, ok: false, error: "Worker failure." });
    expect(onError).toHaveBeenCalledWith("Worker failure.", req1);

    const req2 = client.analyze("Test 2");
    fake.emitError();
    expect(onError).toHaveBeenCalledWith(
      "Local PII detection worker encountered an unexpected error.",
      req2,
    );
    expect(onResult).not.toHaveBeenCalled();

    client.terminate();
    expect(() => client.analyze("After terminate")).toThrow();
  });
});
