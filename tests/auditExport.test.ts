import { describe, expect, it } from "vitest";
import {
  buildAuditReport,
  serializeAuditReportCsv,
  serializeAuditReportJson,
} from "../src/lib/audit";
import { detectPii } from "../src/lib/detectors";

describe("audit export", () => {
  it("builds accurate JSON and CSV audit exports without any raw PII or text snippets", () => {
    const sourceFilename = "confidential-customer-dump.csv";
    const text = [
      "Customer email: sensitive.user@private.org",
      "Phone: +91 98765 43210",
      "Card: 4111 1111 1111 1111",
      "PAN: ABCPD1234F",
      "Aadhaar: 2345 6789 0124",
      "IP: 192.168.55.12",
    ].join("\n");

    const detections = detectPii(text);
    expect(detections).toHaveLength(6);

    const keptDetection = detections[1];
    expect(keptDetection).toBeDefined();

    const report = buildAuditReport(
      detections,
      "PARTIAL",
      new Set([keptDetection?.id ?? ""]),
      "2026-11-27T11:15:00.000Z",
    );

    expect(report.redactionMode).toBe("PARTIAL");
    expect(report.totalDetections).toBe(6);
    expect(report.redactedCount).toBe(5);
    expect(report.keptCount).toBe(1);
    expect(report.countsByType).toEqual({
      CREDIT_CARD: 1,
      AADHAAR: 1,
      PAN: 1,
      IPV4: 1,
      EMAIL: 1,
      PHONE: 1,
    });

    expect(report.detections[0]).toEqual({
      id: detections[0]?.id,
      type: detections[0]?.type,
      start: detections[0]?.start,
      end: detections[0]?.end,
      status: "REDACTED",
    });
    expect(report.detections[1]?.status).toBe("KEPT");

    const jsonOutput = serializeAuditReportJson(report);
    const csvOutput = serializeAuditReportCsv(report);

    const forbiddenFragments = [
      "sensitive.user@private.org",
      "98765 43210",
      "4111 1111 1111 1111",
      "ABCPD1234F",
      "2345 6789 0124",
      "192.168.55.12",
      "Customer email:",
      sourceFilename,
      '"value"',
    ];

    for (const fragment of forbiddenFragments) {
      expect(jsonOutput).not.toContain(fragment);
      expect(csvOutput).not.toContain(fragment);
    }

    const csvLines = csvOutput.split("\r\n");
    expect(csvLines[0]).toBe(
      "record_kind,redaction_mode,total_detections,redacted_count,kept_count,entity_type,entity_count,start,end,status",
    );
    expect(csvLines[1]).toBe("SUMMARY,PARTIAL,6,5,1,ALL,6,,,");
    expect(csvLines).toHaveLength(1 + 1 + 6 + 6);
    expect(csvLines.some((line) => line.endsWith(",KEPT"))).toBe(true);
    expect(csvLines.some((line) => line.endsWith(",REDACTED"))).toBe(true);
  });
});
