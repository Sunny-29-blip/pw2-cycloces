import {
  MAX_SUMMARY_REQUEST_BYTES,
  validateComplianceRequest,
} from "../src/lib/complianceValidation.js";
import type {
  ComplianceErrorResponse,
  ComplianceSummaryRequest,
  ComplianceSummaryResponse,
} from "../src/types/compliance.js";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const SUMMARY_TIMEOUT_MS = 12_000;
const SUMMARY_DISCLAIMER =
  "Informational summary generated solely from aggregate entity counts and the privacy risk score. It is not a legal compliance certification or guarantee of anonymity.";

export { DEFAULT_GEMINI_MODEL };

const SYSTEM_INSTRUCTION = [
  "You are a privacy risk analyst summarizing aggregate PII sanitization telemetry.",
  "You receive ONLY aggregate integer counts by entity type and a 0-100 unredacted severity risk score.",
  "Cover four concise points: (1) main categories of detected sensitive information, (2) relative exposure concerns, (3) recommended redaction practices, and (4) a brief explanation of the risk score.",
  "Strict rules: never invent document details, never speculate about unseen text, never claim the document is fully anonymous, and never claim legal or regulatory compliance.",
  "Keep the response concise, factual, and under 180 words.",
].join(" ");

export interface SummaryGenerator {
  generate(params: {
    readonly model: string;
    readonly prompt: string;
    readonly systemInstruction: string;
    readonly abortSignal: AbortSignal;
  }): Promise<string>;
}

export interface SummaryHandlerOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly createGenerator?: (apiKey: string) => SummaryGenerator | Promise<SummaryGenerator>;
  readonly timeoutMs?: number;
}

function jsonResponse(
  body: ComplianceSummaryResponse | ComplianceErrorResponse,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function isAllowedSameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return true;
  }

  try {
    const parsedOrigin = new URL(originHeader);
    if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") {
      return false;
    }
    const rawHostHeader = request.headers.get("host")?.split(",", 1)[0]?.trim().toLowerCase();
    const requestUrlHost = new URL(request.url).host.toLowerCase();
    const requestHost = rawHostHeader && rawHostHeader.length > 0 ? rawHostHeader : requestUrlHost;
    if (rawHostHeader && rawHostHeader !== requestUrlHost) {
      return false;
    }
    return parsedOrigin.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

async function readLimitedBody(request: Request, maxBytes: number): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0 || parsedLength > maxBytes) {
      return null;
    }
  }

  if (!request.body) {
    const rawText = await request.text();
    return Buffer.byteLength(rawText, "utf8") <= maxBytes ? rawText : null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    return "";
  }
}

/**
 * Builds the controlled server-side Gemini prompt containing exclusively aggregate metadata.
 */
export function buildCompliancePrompt(payload: ComplianceSummaryRequest): string {
  const { countsByType, riskScore } = payload;
  return [
    "Summarize the following aggregate sanitization metrics:",
    `- CREDIT_CARD: ${countsByType.CREDIT_CARD}`,
    `- AADHAAR: ${countsByType.AADHAAR}`,
    `- PAN: ${countsByType.PAN}`,
    `- IPV4: ${countsByType.IPV4}`,
    `- EMAIL: ${countsByType.EMAIL}`,
    `- PHONE: ${countsByType.PHONE}`,
    `- Unredacted Privacy Risk Score (0-100): ${riskScore}`,
  ].join("\n");
}

async function createSdkGenerator(apiKey: string): Promise<SummaryGenerator> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  return {
    async generate({ model, prompt, systemInstruction, abortSignal }): Promise<string> {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          maxOutputTokens: 320,
          temperature: 0.2,
          abortSignal,
        },
      });
      return typeof response?.text === "string" ? response.text.trim() : "";
    },
  };
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new Error("Compliance summary request timed out."));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new Error("Compliance summary request timed out."));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function executeSummaryRequest(
  request: Request,
  options: SummaryHandlerOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed. Use POST.", code: "METHOD_NOT_ALLOWED" },
      405,
      { Allow: "POST" },
    );
  }

  if (!isAllowedSameOrigin(request)) {
    return jsonResponse(
      { error: "Cross-origin requests are not permitted.", code: "FORBIDDEN_ORIGIN" },
      403,
    );
  }

  const rawContentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = rawContentType.split(";", 1)[0]?.trim() ?? "";
  if (mediaType !== "application/json") {
    return jsonResponse(
      { error: "Content-Type must be application/json.", code: "UNSUPPORTED_MEDIA_TYPE" },
      415,
    );
  }

  const rawBody = await readLimitedBody(request, MAX_SUMMARY_REQUEST_BYTES);
  if (rawBody === null) {
    return jsonResponse(
      { error: "Request body exceeds maximum allowed size.", code: "PAYLOAD_TOO_LARGE" },
      413,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Malformed JSON request body.", code: "VALIDATION_ERROR" }, 400);
  }

  const validation = validateComplianceRequest(parsedBody);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error, code: "VALIDATION_ERROR" }, 400);
  }

  const env = options.env ?? process.env;
  const apiKey = env.GEMINI_API_KEY?.trim() ?? "";
  if (apiKey.length === 0) {
    return jsonResponse(
      {
        error: "Gemini API is not configured on the server (missing GEMINI_API_KEY).",
        code: "CONFIGURATION_ERROR",
      },
      503,
    );
  }

  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? SUMMARY_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const rawSummary = await raceWithAbort(
      (async () => {
        const generator = await (options.createGenerator ?? createSdkGenerator)(apiKey);
        return generator.generate({
          model,
          prompt: buildCompliancePrompt(validation.data),
          systemInstruction: SYSTEM_INSTRUCTION,
          abortSignal: controller.signal,
        });
      })(),
      controller.signal,
    );
    const summaryText = rawSummary.trim();

    if (summaryText.length === 0) {
      return jsonResponse(
        { error: "Gemini returned an empty compliance summary.", code: "API_ERROR" },
        502,
      );
    }

    return jsonResponse({ summary: summaryText, model, disclaimer: SUMMARY_DISCLAIMER }, 200);
  } catch {
    const timedOut = controller.signal.aborted;
    return jsonResponse(
      {
        error: timedOut
          ? "Compliance summary request timed out."
          : "Unable to generate AI compliance summary right now.",
        code: "API_ERROR",
      },
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handles POST `/api/summary` requests with a top-level error boundary, strict allowlist
 * validation, size caps, same-origin enforcement, and server-only Gemini invocation.
 */
export async function handleSummaryRequest(
  request: Request,
  options: SummaryHandlerOptions = {},
): Promise<Response> {
  try {
    return await executeSummaryRequest(request, options);
  } catch {
    return jsonResponse(
      {
        error: "An unexpected internal server error occurred.",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return handleSummaryRequest(request);
  },
};
