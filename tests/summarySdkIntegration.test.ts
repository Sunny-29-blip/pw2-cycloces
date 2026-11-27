import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();
const googleGenAiConstructorSpy = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      public readonly models = {
        generateContent: generateContentMock,
      };

      public constructor(options: { apiKey: string }) {
        googleGenAiConstructorSpy(options);
      }
    },
  };
});

describe("/api/summary dynamic @google/genai integration", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    googleGenAiConstructorSpy.mockReset();
  });

  it("dynamically imports @google/genai on POST, passes strict metadata prompt, and handles malformed/null responses", async () => {
    const { handleSummaryRequest } = await import("../api/summary");

    const validBody = {
      countsByType: {
        CREDIT_CARD: 1,
        AADHAAR: 0,
        PAN: 2,
        IPV4: 1,
        EMAIL: 3,
        PHONE: 1,
      },
      riskScore: 42,
    };

    generateContentMock.mockResolvedValueOnce({
      text: "Aggregate summary: financial and contact categories detected.",
    });

    const successRes = await handleSummaryRequest(
      new Request("https://cyloces.example/api/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      { env: { GEMINI_API_KEY: "test-server-key" } },
    );

    expect(successRes.status).toBe(200);
    expect(googleGenAiConstructorSpy).toHaveBeenCalledWith({ apiKey: "test-server-key" });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const callArg = generateContentMock.mock.calls[0]?.[0] as {
      model: string;
      contents: string;
      config: { systemInstruction: string; temperature: number; maxOutputTokens: number };
    };
    expect(callArg.model).toBe("gemini-3.5-flash-lite");
    expect(callArg.contents).toContain("EMAIL: 3");
    expect(callArg.contents).toContain("Unredacted Privacy Risk Score (0-100): 42");

    generateContentMock.mockResolvedValueOnce({ text: null });
    const malformedSdkRes = await handleSummaryRequest(
      new Request("https://cyloces.example/api/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      { env: { GEMINI_API_KEY: "test-server-key" } },
    );
    expect(malformedSdkRes.status).toBe(502);
    const malformedJson = (await malformedSdkRes.json()) as { code: string };
    expect(malformedJson.code).toBe("API_ERROR");
  });
});
