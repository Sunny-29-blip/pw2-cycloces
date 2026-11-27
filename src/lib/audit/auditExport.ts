import type { AuditDetectionRecord, AuditReport } from "../../types/audit";
import type { Detection, EntityType } from "../../types/detection";
import type { RedactionMode } from "../../types/redaction";
import { isValidDetectionCandidate } from "../detectors/constants";

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

function createEmptyTypeCounts(): Record<EntityType, number> {
  return {
    CREDIT_CARD: 0,
    AADHAAR: 0,
    PAN: 0,
    IPV4: 0,
    EMAIL: 0,
    PHONE: 0,
  };
}

function escapeCsvCell(rawValue: string | number): string {
  const stringValue = String(rawValue);
  const safeValue = FORMULA_PREFIX_PATTERN.test(stringValue) ? `'${stringValue}` : stringValue;

  if (
    safeValue.includes(",") ||
    safeValue.includes('"') ||
    safeValue.includes("\n") ||
    safeValue.includes("\r")
  ) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  return safeValue;
}

function assertDetectionsArray(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new TypeError("Detections must be an array.");
  }
}

/**
 * Builds a privacy-safe audit report containing only counts, offsets, entity types,
 * redaction decisions, and mode—never original text, raw values, or filenames.
 */
export function buildAuditReport(
  detections: readonly Detection[],
  redactionMode: RedactionMode,
  ignoredIds: ReadonlySet<string> = new Set(),
  generatedAt: string = new Date().toISOString(),
): AuditReport {
  assertDetectionsArray(detections);
  if (!(ignoredIds instanceof Set)) {
    throw new TypeError("Ignored detection IDs must be provided as a Set.");
  }

  const countsByType = createEmptyTypeCounts();
  const auditRecords: AuditDetectionRecord[] = [];
  let redactedCount = 0;
  let keptCount = 0;

  for (const detection of detections) {
    if (!isValidDetectionCandidate(detection)) {
      continue;
    }

    countsByType[detection.type] += 1;
    const isKept = ignoredIds.has(detection.id);

    if (isKept) {
      keptCount += 1;
    } else {
      redactedCount += 1;
    }

    auditRecords.push({
      id: detection.id,
      type: detection.type,
      start: detection.start,
      end: detection.end,
      status: isKept ? "KEPT" : "REDACTED",
    });
  }

  return {
    generatedAt,
    redactionMode,
    totalDetections: auditRecords.length,
    redactedCount,
    keptCount,
    countsByType,
    detections: auditRecords,
  };
}

/**
 * Serializes an audit report as formatted JSON without raw PII or document text.
 */
export function serializeAuditReportJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Serializes an audit report into RFC 4180-safe CSV containing summary counts and detection spans.
 */
export function serializeAuditReportCsv(report: AuditReport): string {
  const header = [
    "record_kind",
    "redaction_mode",
    "total_detections",
    "redacted_count",
    "kept_count",
    "entity_type",
    "entity_count",
    "start",
    "end",
    "status",
  ].join(",");

  const rows: string[] = [header];

  rows.push(
    [
      "SUMMARY",
      report.redactionMode,
      report.totalDetections,
      report.redactedCount,
      report.keptCount,
      "ALL",
      report.totalDetections,
      "",
      "",
      "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  for (const [entityType, count] of Object.entries(report.countsByType)) {
    rows.push(
      [
        "TYPE_COUNT",
        report.redactionMode,
        report.totalDetections,
        report.redactedCount,
        report.keptCount,
        entityType,
        count,
        "",
        "",
        "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  for (const record of report.detections) {
    rows.push(
      [
        "DETECTION",
        report.redactionMode,
        report.totalDetections,
        report.redactedCount,
        report.keptCount,
        record.type,
        "",
        record.start,
        record.end,
        record.status,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return rows.join("\r\n");
}
