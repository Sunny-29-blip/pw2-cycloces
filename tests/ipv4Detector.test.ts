import { describe, expect, it } from "vitest";
import { detectIpv4s } from "../src/lib/detectors";

describe("detectIpv4s", () => {
  it("detects valid IPv4 addresses including boundaries 0 and 255", () => {
    const text = "Hosts: 0.0.0.0, 127.0.0.1, 192.168.1.10:8080, and 255.255.255.255.";
    const results = detectIpv4s(text);

    expect(results.map((item) => item.value)).toEqual([
      "0.0.0.0",
      "127.0.0.1",
      "192.168.1.10",
      "255.255.255.255",
    ]);
    for (const item of results) {
      expect(item.confidence).toBe("high");
      expect(item.severity).toBe(2);
      expect(text.slice(item.start, item.end)).toBe(item.value);
    }
  });

  it("rejects out-of-range octets, incomplete addresses, and 999.1.1.1", () => {
    const text = "Bad: 999.1.1.1 256.0.0.1 10.0.0.256 192.168.1 192.168.1. 192.168.01.1";
    expect(detectIpv4s(text)).toHaveLength(0);
  });

  it("rejects partial matches inside 5-octet or alphanumeric boundary tokens", () => {
    const text = "Malformed: 1.2.3.4.5 10.0.0.1.999 v1.2.3.4 192.168.1.1a 10.0.0.1.internal";
    expect(detectIpv4s(text)).toHaveLength(0);
  });

  it("detects IPv4 followed by sentence punctuation and whitespace", () => {
    const text = "Connected to 10.0.0.1. Next step proceeds.";
    const results = detectIpv4s(text);

    expect(results).toHaveLength(1);
    expect(results[0]?.value).toBe("10.0.0.1");
  });
});
