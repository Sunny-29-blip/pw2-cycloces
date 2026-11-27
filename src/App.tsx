import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { AiComplianceSummary } from "./components/AiComplianceSummary";
import { AuditExportBar } from "./components/AuditExportBar";
import { DetectionInspector } from "./components/DetectionInspector";
import { DetectionSummary } from "./components/DetectionSummary";
import { Header, type ThemeMode } from "./components/Header";
import { InputPanel } from "./components/InputPanel";
import { ModeSelector } from "./components/ModeSelector";
import { PrivacyRiskMeter } from "./components/PrivacyRiskMeter";
import { SideBySideWorkspace } from "./components/SideBySideWorkspace";
import { usePiiDetectionWorker } from "./hooks/usePiiDetectionWorker";
import { buildAuditReport, serializeAuditReportCsv, serializeAuditReportJson } from "./lib/audit";
import { buildComplianceRequestPayload } from "./lib/complianceValidation";
import { buildDocumentViewSegments } from "./lib/documentSegments";
import {
  buildSanitizedDownloadMeta,
  readFileAsText,
  type SupportedFileExtension,
  triggerBrowserDownload,
  validateUploadFile,
} from "./lib/fileUtils";
import { redactText } from "./lib/redaction";
import { calculatePrivacyRisk } from "./lib/risk";
import { SAMPLE_NOISY_DOCUMENT } from "./lib/sampleDocument";
import type { RedactionMode } from "./types/redaction";

/**
 * Root CYLOCES application coordinating local Web Worker detection, live redaction,
 * explainability inspection, risk scoring, privacy-safe audit exports, and opt-in AI summary.
 */
export function App(): ReactElement {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [documentText, setDocumentText] = useState("");
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [sourceExtension, setSourceExtension] = useState<SupportedFileExtension>(".txt");
  const [fileError, setFileError] = useState<string | null>(null);
  const [redactionMode, setRedactionMode] = useState<RedactionMode>("FULL");
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(() => new Set());
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);

  const { detections, isProcessing, workerError, runDetection, clearDetections } =
    usePiiDetectionWorker();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const applyDocumentChange = useCallback(
    (nextText: string, fileName: string | null, extension: SupportedFileExtension) => {
      setDocumentText(nextText);
      setSourceFileName(fileName);
      setSourceExtension(extension);
      setFileError(null);
      setIgnoredIds(new Set());
      setSelectedDetectionId(null);
      runDetection(nextText);
    },
    [runDetection],
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      const validation = validateUploadFile(file);
      if (!validation.ok) {
        setFileError(validation.error);
        return;
      }

      try {
        const content = await readFileAsText(file);
        if (content.length === 0) {
          setFileError("The selected file contains no readable text.");
          return;
        }
        if (content.includes("\u0000")) {
          setFileError(
            "Binary file content is not supported. Please select a plain text or CSV file.",
          );
          return;
        }
        applyDocumentChange(content, file.name, validation.extension);
      } catch {
        setFileError("Unable to read the selected local file.");
      }
    },
    [applyDocumentChange],
  );

  const handleClear = useCallback(() => {
    setDocumentText("");
    setSourceFileName(null);
    setSourceExtension(".txt");
    setFileError(null);
    setIgnoredIds(new Set());
    setSelectedDetectionId(null);
    clearDetections();
  }, [clearDetections]);

  const handleToggleDetection = useCallback((id: string) => {
    setIgnoredIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const redactionResult = useMemo(
    () => redactText(documentText, detections, redactionMode, ignoredIds),
    [documentText, detections, redactionMode, ignoredIds],
  );

  const riskAssessment = useMemo(
    () => calculatePrivacyRisk(detections, ignoredIds),
    [detections, ignoredIds],
  );

  const compliancePayload = useMemo(
    () => buildComplianceRequestPayload(detections, riskAssessment.score),
    [detections, riskAssessment.score],
  );

  const { originalSegments, sanitizedSegments } = useMemo(
    () =>
      buildDocumentViewSegments(
        documentText,
        detections,
        redactionMode,
        ignoredIds,
        redactionResult,
      ),
    [documentText, detections, redactionMode, ignoredIds, redactionResult],
  );

  const handleDownloadSanitized = useCallback(() => {
    const meta = buildSanitizedDownloadMeta(sourceFileName, sourceExtension, redactionMode);
    triggerBrowserDownload(redactionResult.sanitizedText, meta.filename, meta.mimeType);
  }, [sourceFileName, sourceExtension, redactionMode, redactionResult.sanitizedText]);

  const handleDownloadAuditJson = useCallback(() => {
    const report = buildAuditReport(detections, redactionMode, ignoredIds);
    triggerBrowserDownload(
      serializeAuditReportJson(report),
      "cyloces-audit-report.json",
      "application/json;charset=utf-8",
    );
  }, [detections, redactionMode, ignoredIds]);

  const handleDownloadAuditCsv = useCallback(() => {
    const report = buildAuditReport(detections, redactionMode, ignoredIds);
    triggerBrowserDownload(
      serializeAuditReportCsv(report),
      "cyloces-audit-report.csv",
      "text/csv;charset=utf-8",
    );
  }, [detections, redactionMode, ignoredIds]);

  const activeError = fileError ?? workerError;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#0b0c0e] dark:text-[#f5f5f7]">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <InputPanel
          text={documentText}
          sourceFileName={sourceFileName}
          fileError={activeError}
          isProcessing={isProcessing}
          onTextChange={(nextText) => applyDocumentChange(nextText, null, ".txt")}
          onFileSelect={(file) => {
            void handleFileSelect(file);
          }}
          onLoadSample={() => applyDocumentChange(SAMPLE_NOISY_DOCUMENT, null, ".txt")}
          onClear={handleClear}
        />

        <ModeSelector mode={redactionMode} onModeChange={setRedactionMode} />

        <div className="grid gap-6 lg:grid-cols-2">
          <DetectionSummary
            detections={detections}
            redactedCount={redactionResult.redactedCount}
            keptCount={redactionResult.ignoredCount}
            isProcessing={isProcessing}
          />
          <PrivacyRiskMeter assessment={riskAssessment} />
        </div>

        <SideBySideWorkspace
          hasText={documentText.length > 0}
          originalSegments={originalSegments}
          sanitizedSegments={sanitizedSegments}
          selectedDetectionId={selectedDetectionId}
          onSelectDetection={setSelectedDetectionId}
          onToggleDetection={handleToggleDetection}
        />

        <DetectionInspector
          detections={detections}
          selectedDetectionId={selectedDetectionId}
          ignoredIds={ignoredIds}
          onSelectDetection={setSelectedDetectionId}
          onToggleDetection={handleToggleDetection}
        />

        <AuditExportBar
          hasText={documentText.length > 0}
          onDownloadSanitized={handleDownloadSanitized}
          onDownloadAuditJson={handleDownloadAuditJson}
          onDownloadAuditCsv={handleDownloadAuditCsv}
        />

        <AiComplianceSummary payload={compliancePayload} />
      </main>
    </div>
  );
}

export default App;
