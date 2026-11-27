import { describe, expect, it, vi } from "vitest";
import { buildCompliancePrompt, handleSummaryRequest } from "../api/summary";
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
  it("accepts valid metadata requests and returns Gemini summary using configured model", async () => {
    const generateSpy = vi.fn(async () => "Informational summary based on aggregate counts.");
    const response = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key", GEMINI_MODEL: "gemini-2.5-flash" },
      createGenerator: () => ({ generate: generateSpy }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { summary: string; model: string; disclaimer: string };
    expect(json.summary).toBe("Informational summary based on aggregate counts.");
    expect(json.model).toBe("gemini-2.5-flash");
    expect(json.disclaimer).toContain("not a legal compliance certification");
    expect(generateSpy).toHaveBeenCalledTimes(1);

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

    const getRes = await handleSummaryRequest(
      new Request("https://cyloces.example/api/summary", { method: "GET" }),
      { env: { GEMINI_API_KEY: "fake-test-key" } },
    );
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("allow")).toBe("POST");

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

  it("returns 503 when GEMINI_API_KEY is missing and 502 when Gemini fails", async () => {
    const missingKeyRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: {},
    });
    expect(missingKeyRes.status).toBe(503);

    const failedRes = await handleSummaryRequest(createJsonRequest(VALID_BODY), {
      env: { GEMINI_API_KEY: "fake-test-key" },
      createGenerator: () => ({
        generate: async () => {
          throw new Error("Upstream error");
        },
      }),
    });
    expect(failedRes.status).toBe(502);
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
