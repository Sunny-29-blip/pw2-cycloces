import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiComplianceSummary } from "../src/components/AiComplianceSummary";
import type { ComplianceSummaryRequest } from "../src/types/compliance";

const SAMPLE_PAYLOAD: ComplianceSummaryRequest = {
  countsByType: {
    CREDIT_CARD: 1,
    AADHAAR: 1,
    PAN: 1,
    IPV4: 2,
    EMAIL: 2,
    PHONE: 3,
  },
  riskScore: 40,
};

describe("AiComplianceSummary component", () => {
  it("requires explicit consent and never invokes API automatically on render or prop updates", () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;

    const { rerender } = render(
      <AiComplianceSummary payload={SAMPLE_PAYLOAD} fetchFn={fetchSpy} />,
    );

    const checkbox = screen.getByRole("checkbox");
    const button = screen.getByRole("button", { name: "Generate Summary" });

    expect(checkbox).not.toBeChecked();
    expect(button).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender(
      <AiComplianceSummary payload={{ ...SAMPLE_PAYLOAD, riskScore: 80 }} fetchFn={fetchSpy} />,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends only aggregate metadata upon consent + click and renders summary", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            summary: "Detected financial and contact entities with moderate unredacted exposure.",
            model: "gemini-2.5-flash",
            disclaimer: "Informational only.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    render(
      <AiComplianceSummary
        payload={SAMPLE_PAYLOAD}
        fetchFn={fetchMock as unknown as typeof fetch}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: "Generate Summary" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Detected financial and contact entities with moderate unredacted exposure.",
        ),
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(SAMPLE_PAYLOAD);
  });

  it("handles configuration, network, and API errors cleanly and allows retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Gemini API is not configured on the server.",
            code: "CONFIGURATION_ERROR",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: "Recovered summary after retry.",
            model: "gemini-2.5-flash",
            disclaimer: "Informational only.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    render(
      <AiComplianceSummary
        payload={SAMPLE_PAYLOAD}
        fetchFn={fetchMock as unknown as typeof fetch}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));

    expect(await screen.findByText("Server Configuration Required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Network Error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recovered summary after retry.")).toBeInTheDocument();
  });
});
