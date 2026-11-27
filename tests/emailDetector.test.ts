import { describe, expect, it } from "vitest";
import { detectEmails } from "../src/lib/detectors";

describe("detectEmails", () => {
  it("detects valid standard and subdomain email addresses", () => {
    const text = "Send logs to alice.smith+audit@sec.example.co.uk or ops_1@corp.org.";
    const results = detectEmails(text);

    expect(results).toHaveLength(2);
    expect(results[0]?.value).toBe("alice.smith+audit@sec.example.co.uk");
    expect(results[0]?.start).toBe(13);
    expect(results[0]?.end).toBe(48);
    expect(results[0]?.confidence).toBe("high");
    expect(results[0]?.severity).toBe(3);
    expect(results[0]?.reasons.length).toBeGreaterThan(0);

    expect(results[1]?.value).toBe("ops_1@corp.org");
    expect(text.slice(results[1]?.start ?? 0, results[1]?.end ?? 0)).toBe("ops_1@corp.org");
  });

  it("rejects invalid domains, missing TLDs, and numeric TLDs", () => {
    const text = "Bad: user@localhost foo@.example.com bar@example..com baz@domain.123 a@b.c";
    expect(detectEmails(text)).toHaveLength(0);
  });

  it("avoids partial matches inside larger invalid tokens", () => {
    const text = [
      "bad..email@example.com",
      ".leading@example.com",
      "trailing.@example.com",
      "double@@example.com",
      "alice@example.com_extra",
      "bob@-example.com",
    ].join(" ");

    expect(detectEmails(text)).toHaveLength(0);
  });
});
