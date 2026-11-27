import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("App", () => {
  it("renders the application title and privacy tagline", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Local-First PII Sanitizer" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Every redaction is explainable, reviewable, and never leaves your browser.",
      ),
    ).toBeInTheDocument();
  });
});
