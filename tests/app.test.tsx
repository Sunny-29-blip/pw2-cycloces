import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("CYLOCES Application", () => {
  it("renders CYLOCES branding, accurate privacy disclosure, and theme switcher", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "CYLOCES" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Document text and raw identifiers remain in your browser during sanitization.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Compliance Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Summary" })).toBeDisabled();

    const themeButton = screen.getByRole("button", { name: "Switch to Dark Theme" });
    fireEvent.click(themeButton);
    expect(screen.getByRole("button", { name: "Switch to Light Theme" })).toBeInTheDocument();
  });

  it("loads synthetic sample text, prevents false positives, and switches redaction modes live", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Load sample text" }));

    const sanitizedRegion = screen.getByLabelText("Live sanitized document output");
    await waitFor(() => {
      expect(sanitizedRegion.textContent).toContain("[REDACTED]");
    });

    // Invalid false-positive fixtures inside sample text must remain unredacted
    expect(sanitizedRegion.textContent).toContain("5432 1098 7654 3211");
    expect(sanitizedRegion.textContent).toContain("2345 6789 0125");
    expect(sanitizedRegion.textContent).toContain("ABCDE1234F");
    expect(sanitizedRegion.textContent).toContain("999.1.1.1");

    // Switch to PARTIAL MASK
    fireEvent.click(screen.getByRole("radio", { name: /PARTIAL MASK/i }));
    expect(sanitizedRegion.textContent).toContain("s***@example.com");
    expect(sanitizedRegion.textContent).toContain("XXXX-XXXX-XXXX-1111");
    expect(sanitizedRegion.textContent).toContain("XXXX XXXX 0124");

    // Switch to CONSISTENT PSEUDONYMIZATION
    fireEvent.click(screen.getByRole("radio", { name: /CONSISTENT PSEUDONYMIZATION/i }));
    expect(sanitizedRegion.textContent).toContain("EMAIL_01");
    expect(sanitizedRegion.textContent).toContain("CARD_01");
    expect(sanitizedRegion.textContent).toContain("AADHAAR_01");
  });

  it("toggles individual detections, updates risk score, and resets ignored state on new input", async () => {
    render(<App />);

    const textarea = screen.getByLabelText("Document text to scan for PII");
    fireEvent.change(textarea, {
      target: { value: "Contact alice@example.com from 10.0.0.1." },
    });

    const sanitizedRegion = screen.getByLabelText("Live sanitized document output");
    await waitFor(() => {
      expect(sanitizedRegion.textContent).toBe("Contact [REDACTED] from [REDACTED].");
    });

    const progressbar = screen.getByRole("progressbar", {
      name: "Unredacted privacy risk score",
    });
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");

    // Keep email unchanged by toggling its inline button
    const emailToggle = screen.getByRole("button", {
      name: /EMAIL: Redacted\. Activate to keep original\./i,
    });
    fireEvent.click(emailToggle);

    expect(sanitizedRegion.textContent).toBe("Contact alice@example.com from [REDACTED].");
    // Email severity 3 / (3 + 2) = 60
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");

    // Toggle email back to redacted
    fireEvent.click(
      screen.getByRole("button", {
        name: /EMAIL: Kept unchanged\. Activate to redact\./i,
      }),
    );
    expect(sanitizedRegion.textContent).toBe("Contact [REDACTED] from [REDACTED].");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");

    // Keep email again, then change document -> ignored IDs & detections must reset cleanly
    fireEvent.click(
      screen.getByRole("button", {
        name: /EMAIL: Redacted\. Activate to keep original\./i,
      }),
    );
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");

    fireEvent.change(textarea, {
      target: { value: "Updated bob@example.org only." },
    });

    await waitFor(() => {
      expect(sanitizedRegion.textContent).toBe("Updated [REDACTED] only.");
    });
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");

    // Explainability inspector displays actual detector reasons
    const inspector = screen.getByRole("region", { name: "Explainable Detection Inspector" });
    expect(within(inspector).getByText("RFC-lite email syntax matched.")).toBeInTheDocument();
  });

  it("validates uploaded files and reads valid .txt and .csv files locally", async () => {
    const { container } = render(<App />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) {
      return;
    }

    // Reject unsupported extension
    const pdfFile = new File(["test"], "notes.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported file format. Please select a .txt or .csv file.",
    );

    // Reject empty file
    const emptyTxt = new File([""], "empty.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [emptyTxt] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("The selected file is empty.");

    // Reject oversized file (> 2 MB)
    const oversizedPayload = new Uint8Array(2 * 1024 * 1024 + 1);
    const oversizedTxt = new File([oversizedPayload], "huge.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [oversizedTxt] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File exceeds the 2 MB local processing limit.",
    );

    // Accept valid .csv file
    const csvContent = 'name,email\n"Alice","alice@example.com"';
    const validCsv = new File([csvContent], "records.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [validCsv] } });

    await waitFor(() => {
      expect(screen.getByText("File: records.csv")).toBeInTheDocument();
    });
    const sanitizedRegion = screen.getByLabelText("Live sanitized document output");
    await waitFor(() => {
      expect(sanitizedRegion.textContent).toBe('name,email\n"Alice","[REDACTED]"');
    });
  });
});
