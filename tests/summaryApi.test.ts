import { describe, expect, it, vi } from "vitest";
import summaryEndpoint, {
  buildCompliancePrompt,
  DEFAULT_GEMINI_MODEL,
  handleSummaryRequest,
} from "../api/summary";
import { requestComplianceSummary } from "../src/lib/complianceClient";
import {
  buildComplianceRequestPayload,
  validateComplianceRequest,
} from "../src/lib/complianceValidation";
import { detectPii } from "../src/lib/detectors";

const VALID_BODY = {
  countsByType: {
    EMAIL: 4,
    PHONE: 2,
    IPV4: 1,
    PAN: 0,
    AADHAAR: 1,
    CREDIT_CARD: 2,
  },
  riskScore: 65,
};

function createJsonRequest(
  body: unknown,
  options: { method?: string; contentType?: string; origin?: string; host?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.contentType !== undefined) {
    headers["content-type"] = options.contentType;
  } else {
    headers["content-type"] = "application/json";
  }
  if (options.origin) {
    headers.origin = options.origin;
  }
  if (options.host) {
    headers.host = options.host;
  }

  return new Request("https://cyloces.example/api/summary", {
    method: options.method ?? "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("compliance validation and /api/summary", () => {
  it("uses gemini-3.5-flash-lite by default and allows GEMINI_MODEL override", async () => {
    const generateSpy = vi.fn(async () => "Informational summary based on aggregate counts.");

    const defaultRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: () => ({ generate: generateSpy }),
    });

    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(defaultRes.status).toBe(200);
    const defaultJson = (await defaultRes.json()) as {
      summary: string;
      model: string;
      disclaimer: string;
    };
    expect(defaultJson.summary).toBe("Informational summary based on aggregate counts.");
    expect(defaultJson.model).toBe("gemini-3.5-flash-lite");
    expect(defaultJson.disclaimer).toContain("not a legal compliance certification");

    const overrideRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key", GEMINI_MODEL: "gemini-3.5-flash" },
      createGenerator: () => ({ generate: generateSpy }),
    });

    expect(overrideRes.status).toBe(200);
    const overrideJson = (await overrideRes.json()) as { model: string };
    expect(overrideJson.model).toBe("gemini-3.5-flash");
    expect(generateSpy).toHaveBeenCalledTimes(2);

    const promptText = buildCompliancePrompt(VALID_BODY);
    expect(promptText).toContain("EMAIL: 4");
    expect(promptText).toContain("Unredacted Privacy Risk Score (0-100): 65");
  });

  it("rejects missing counts, invalid entity types, negative counts, and invalid risk scores", async () => {
    const invalidPayloads: unknown[] = [
      { countsByType: { EMAIL: 1 }, riskScore: 10 },
      { countsByType: { ...VALID_BODY.countsByType, SSN: 1 }, riskScore: 10 },
      { countsByType: { ...VALID_BODY.countsByType, EMAIL: -1 }, riskScore: 10 },
      { countsByType: { ...VALID_BODY.countsByType, EMAIL: 1.5 }, riskScore: 10 },
      { countsByType: VALID_BODY.countsByType, riskScore: -5 },
      { countsByType: VALID_BODY.countsByType, riskScore: 101 },
      { countsByType: VALID_BODY.countsByType, riskScore: 42.5 },
    ];

    for (const payload of invalidPayloads) {
      expect(validateComplianceRequest(payload).ok).toBe(false);
      const response = await handleSummaryRequest(createJsonRequest(payload), {
        env: { GEMINI_API_KEY: "fake-test-key" },
      });
      expect(response.status).toBe(400);
    }
  });

  it("rejects unexpected fields and requests containing document text or raw PII", async () => {
    const generateSpy = vi.fn(async () => "Should never execute");

    const payloadsWithPii = [
      { ...VALID_BODY, documentText: "Contact sunny@example.com" },
      { ...VALID_BODY, text: "4111 1111 1111 1111" },
      { ...VALID_BODY, rawValues: ["2345 6789 0124"] },
      { ...VALID_BODY, filename: "secret.csv" },
    ];

    for (const payload of payloadsWithPii) {
      const response = await handleSummaryRequest(createJsonRequest(payload), {
        env: { GEMINI_API_KEY: "fake-test-key" },
        createGenerator: () => ({ generate: generateSpy }),
      });
      expect(response.status).toBe(400);
    }

    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies, non-POST requests, unsupported content types, and cross-origin requests", async () => {
    const oversized = JSON.stringify({ ...VALID_BODY, padding: "x".repeat(1200) });
    const tooLargeRes = await handleSummaryRequest(createJsonRequest(oversized), {
      env: { GEMINI_API_KEY: "fake-test-key" },
    });
    expect(tooLargeRes.status).toBe(413);

    const chunkedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(600)));
        controller.enqueue(new TextEncoder().encode("y".repeat(600)));
        controller.close();
      },
    });
    const chunkedTooLargeRes = await handleSummaryRequest(
      new Request("https://cyloces.example/api/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: chunkedStream,
        duplex: "half",
      } as RequestInit),
      { env: { GEMINI_API_KEY: "fake-test-key" } },
    );
    expect(chunkedTooLargeRes.status).toBe(413);

    const getRes = await summaryEndpoint.fetch(
      new Request("https://cyloces.example/api/summary", { method: "GET" }),
    );
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("allow")).toBe("POST");
    expect(getRes.headers.get("content-type")).toContain("application/json");
    const getJson = (await getRes.json()) as { error: string; code: string };
    expect(getJson.code).toBe("METHOD_NOT_ALLOWED");

    const textRes = await handleSummaryRequest(
      createJsonRequest(VALID_BODY, { contentType: "text/plain" }),
      { env: { GEMINI_API_KEY: "fake-test-key" } },
    );
    expect(textRes.status).toBe(415);

    const corsRes = await handleSummaryRequest(
      createJsonRequest(VALID_BODY, {
        origin: "https://evil.example",
        host: "cyloces.example",
      }),
      { env: { GEMINI_API_KEY: "fake-test-key" } },
    );
    expect(corsRes.status).toBe(403);
    expect(corsRes.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("handles missing API key (503), SDK init failure (502), API failure (502), and timeout (504)", async () => {
    const missingKeyRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: {},
    });
    expect(missingKeyRes.status).toBe(503);

    const sdkInitFailedRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: () => {
        throw new Error("SDK constructor failure");
      },
    });
    expect(sdkInitFailedRes.status).toBe(502);
    const sdkJson = (await sdkInitFailedRes.json()) as { code: string };
    expect(sdkJson.code).toBe("API_ERROR");

    const dynamicImportFailedRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: async () => {
        throw new Error("Dynamic SDK import failure");
      },
    });
    expect(dynamicImportFailedRes.status).toBe(502);
    expect(dynamicImportFailedRes.headers.get("content-type")).toContain("application/json");
    const dynamicJson = (await dynamicImportFailedRes.json()) as { code: string };
    expect(dynamicJson.code).toBe("API_ERROR");

    const apiFailedRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: () => ({
        generate: async () => {
          throw new Error("Upstream error");
        },
      }),
    });
    expect(apiFailedRes.status).toBe(502);

    const emptyRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: () => ({
        generate: async () => "   ",
      }),
    });
    expect(emptyRes.status).toBe(502);

    const timeoutRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      timeoutMs: 10,
      createGenerator: () => ({
        generate: ({ abortSignal }) =>
          new Promise<string>((_, reject) => {
            abortSignal.addEventListener("abort", () => {
              reject(new Error("Aborted"));
            });
          }),
      }),
    });
    expect(timeoutRes.status).toBe(504);
  });

  it("catches unexpected internal handler exceptions and returns structured JSON 500", async () => {
    const brokenRequest = {
      method: "POST",
      headers: {
        get() {
          throw new Error("Unexpected internal header failure");
        },
      },
    } as unknown as Request;

    const response = await handleSummaryRequest(brokenRequest);
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    const json = (await response.json()) as { error: string; code: string };
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(json.error).toBe("An unexpected internal server error occurred.");
  });

  it("handles malformed and non-JSON server responses cleanly in requestComplianceSummary", async () => {
    const html500Fetch = vi.fn(
      async () =>
        new Response("<html><body>Internal traceback details</body></html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const htmlOutcome = await requestComplianceSummary(
      VALID_BODY,
      html500Fetch as unknown as typeof fetch,
    );
    expect(htmlOutcome.ok).toBe(false);
    if (!htmlOutcome.ok) {
      expect(htmlOutcome.errorType).toBe("API_ERROR");
      expect(htmlOutcome.message).toContain("HTTP 500");
      expect(htmlOutcome.message).not.toContain("traceback");
      expect(htmlOutcome.message).not.toContain("<html>");
    }

    const malformed200Fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const malformedOutcome = await requestComplianceSummary(
      VALID_BODY,
      malformed200Fetch as unknown as typeof fetch,
    );
    expect(malformedOutcome).toEqual({
      ok: false,
      errorType: "API_ERROR",
      message: "Compliance summary response was missing expected fields.",
    });

    const invalidJson200Fetch = vi.fn(
      async () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    const invalidJsonOutcome = await requestComplianceSummary(
      VALID_BODY,
      invalidJson200Fetch as unknown as typeof fetch,
    );
    expect(invalidJsonOutcome).toEqual({
      ok: false,
      errorType: "API_ERROR",
      message: "Compliance summary API returned an invalid response format.",
    });
  });

  it("builds client metadata payload without raw PII or text", () => {
    const rawDocument = "Secret email sunny@example.com and PAN ABCPD1234F.";
    const detections = detectPii(rawDocument);
    const payload = buildComplianceRequestPayload(detections, 50);

    expect(payload).toEqual({
      countsByType: {
        CREDIT_CARD: 0,
        AADHAAR: 0,
        PAN: 1,
        IPV4: 0,
        EMAIL: 1,
        PHONE: 0,
      },
      riskScore: 50,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("sunny@example.com");
    expect(serialized).not.toContain("ABCPD1234F");
    expect(serialized).not.toContain("Secret email");
  });
});
