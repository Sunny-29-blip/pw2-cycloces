import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetectionInspector, INSPECTOR_PAGE_SIZE } from "../src/components/DetectionInspector";
import {
  HIGH_DENSITY_DETECTION_THRESHOLD,
  SideBySideWorkspace,
  WORKSPACE_PAGE_DETECTION_SIZE,
} from "../src/components/SideBySideWorkspace";
import {
  buildAuditReport,
  serializeAuditReportCsv,
  serializeAuditReportJson,
} from "../src/lib/audit";
import { createDetectionId, ENTITY_SEVERITY } from "../src/lib/detectors";
import { computeDetectionPageWindow } from "../src/lib/documentSegments";
import { redactText } from "../src/lib/redaction";
import type { Detection } from "../src/types/detection";

function buildHighDensityFixture(count: number): {
  readonly text: string;
  readonly detections: readonly Detection[];
} {
  const chunks: string[] = [];
  const detections: Detection[] = [];
  let cursor = 0;

  for (let index = 0; index < count; index += 1) {
    const prefix = `Item ${index}: `;
    const email = `user${index}@example.com`;
    const suffix = "\n";

    chunks.push(prefix, email, suffix);
    const start = cursor + prefix.length;
    const end = start + email.length;
    detections.push({
      id: createDetectionId("EMAIL", start, end),
      type: "EMAIL",
      start,
      end,
      value: email,
      confidence: "high",
      reasons: ["RFC-lite email syntax matched."],
      severity: ENTITY_SEVERITY.EMAIL,
    });
    cursor += prefix.length + email.length + suffix.length;
  }

  return { text: chunks.join(""), detections };
}

describe("High-density UI pagination", () => {
  it("paginates DetectionInspector at 50 items per page and preserves toggle state", () => {
    const { detections } = buildHighDensityFixture(120);
    const ignoredIds = new Set<string>([detections[54]?.id ?? ""]);
    const onSelect = vi.fn();
    const onToggle = vi.fn();

    render(
      <DetectionInspector
        detections={detections}
        selectedDetectionId={detections[0]?.id ?? null}
        ignoredIds={ignoredIds}
        onSelectDetection={onSelect}
        onToggleDetection={onToggle}
      />,
    );

    expect(screen.getByText(`Page 1 of 3 (120 total)`)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Detected entities" });
    expect(within(list).getAllByRole("button")).toHaveLength(INSPECTOR_PAGE_SIZE);
    expect(within(list).getByRole("button", { name: /#1 EMAIL/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
    expect(screen.getByText("Page 2 of 3 (120 total)")).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /#55 EMAIL \(Kept\)/ })).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /#55 EMAIL \(Kept\)/ }));
    expect(onSelect).toHaveBeenCalledWith(detections[54]?.id);
  });

  it("paginates SideBySideWorkspace above threshold without losing detections or toggles", () => {
    const totalCount = HIGH_DENSITY_DETECTION_THRESHOLD + 50;
    const { text, detections } = buildHighDensityFixture(totalCount);
    const keptTarget = detections[120];
    expect(keptTarget).toBeDefined();

    const ignoredIds = new Set<string>([keptTarget?.id ?? ""]);
    const redactionResult = redactText(text, detections, "FULL", ignoredIds);
    const onSelect = vi.fn();
    const onToggle = vi.fn();

    render(
      <SideBySideWorkspace
        documentText={text}
        detections={detections}
        redactionMode="FULL"
        ignoredIds={ignoredIds}
        redactionResult={redactionResult}
        selectedDetectionId={null}
        onSelectDetection={onSelect}
        onToggleDetection={onToggle}
      />,
    );

    expect(
      screen.getByText(
        `High-density view: showing detections 1–${WORKSPACE_PAGE_DETECTION_SIZE} of ${totalCount}. Full downloads remain complete.`,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next Section" }));
    expect(
      screen.getByText(
        `High-density view: showing detections ${WORKSPACE_PAGE_DETECTION_SIZE + 1}–${WORKSPACE_PAGE_DETECTION_SIZE * 2} of ${totalCount}. Full downloads remain complete.`,
      ),
    ).toBeInTheDocument();

    const sanitizedOutput = screen.getByLabelText("Live sanitized document output");
    expect(sanitizedOutput.textContent).toContain("user120@example.com");

    // Verify full document coverage across all computed page windows
    const pageCount = Math.ceil(totalCount / WORKSPACE_PAGE_DETECTION_SIZE);
    let reconstructed = "";
    let coveredDetections = 0;
    for (let page = 0; page < pageCount; page += 1) {
      const win = computeDetectionPageWindow(
        text.length,
        detections,
        page,
        WORKSPACE_PAGE_DETECTION_SIZE,
      );
      reconstructed += text.slice(win.startOffset, win.endOffset);
      coveredDetections += win.detections.length;
    }
    expect(reconstructed).toBe(text);
    expect(coveredDetections).toBe(totalCount);

    // Full-document redaction and audit exports remain complete regardless of UI section paging
    expect(redactionResult.redactedCount).toBe(totalCount - 1);
    expect(redactionResult.ignoredCount).toBe(1);
    expect(redactionResult.sanitizedText).not.toContain("user0@example.com");
    expect(redactionResult.sanitizedText).not.toContain(`user${totalCount - 1}@example.com`);
    expect(redactionResult.sanitizedText).toContain("user120@example.com");

    const auditReport = buildAuditReport(detections, "FULL", ignoredIds);
    expect(auditReport.detections).toHaveLength(totalCount);
    expect(serializeAuditReportJson(auditReport)).toContain(`"totalDetections": ${totalCount}`);
    const csvLines = serializeAuditReportCsv(auditReport).trim().split("\r\n");
    expect(csvLines.filter((line) => line.startsWith("DETECTION,"))).toHaveLength(totalCount);
  });

  it("preserves kept and restored detection state across page changes without omissions or duplicates", () => {
    const totalCount = 125;
    const { text, detections } = buildHighDensityFixture(totalCount);

    function StatefulPaginationHarness() {
      const [ignoredIds, setIgnoredIds] = useState<Set<string>>(() => new Set());
      const [selectedId, setSelectedId] = useState<string | null>(detections[0]?.id ?? null);

      const handleToggle = (id: string) => {
        setIgnoredIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      };

      return (
        <DetectionInspector
          detections={detections}
          selectedDetectionId={selectedId}
          ignoredIds={ignoredIds}
          onSelectDetection={setSelectedId}
          onToggleDetection={handleToggle}
        />
      );
    }

    render(<StatefulPaginationHarness />);

    const seenLabels: string[] = [];
    for (let page = 0; page < 3; page += 1) {
      const list = screen.getByRole("list", { name: "Detected entities" });
      for (const btn of within(list).getAllByRole("button")) {
        seenLabels.push(btn.textContent ?? "");
      }
      if (page === 1) {
        fireEvent.click(within(list).getByRole("button", { name: /#55 EMAIL/ }));
        fireEvent.click(screen.getByRole("button", { name: "Keep original" }));
      }
      if (page < 2) {
        fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
      }
    }

    expect(seenLabels).toHaveLength(totalCount);
    expect(new Set(seenLabels).size).toBe(totalCount);
    expect(text.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Previous Page" }));
    const page2List = screen.getByRole("list", { name: "Detected entities" });
    expect(
      within(page2List).getByRole("button", { name: /#55 EMAIL \(Kept\)/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Redact again" }));
    expect(
      within(page2List).getByRole("button", { name: /#55 EMAIL \(Redacted\)/ }),
    ).toBeInTheDocument();
  });
});
