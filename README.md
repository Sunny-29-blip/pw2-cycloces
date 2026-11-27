# CYLOCES — Local-First PII Sanitizer

> **Every redaction is explainable, reviewable, and never leaves your browser.**

## 1. Product Overview

**CYLOCES** is an explainable, auditable, 100% client-side Personally Identifiable Information (PII) sanitization web application built with React, TypeScript, Vite, Tailwind CSS, and dedicated Web Workers.

**Current Status:** Prompts A–D are implemented:

- **Prompt A:** Strict TypeScript, Vite, Tailwind CSS, Vitest, ESLint, Prettier, CI, and strict CSP static deployment configuration.
- **Prompt B:** Deterministic PII detection and explainability engine (`EMAIL`, `PHONE`, `IPV4`, `PAN`, `AADHAAR`, `CREDIT_CARD`).
- **Prompt C:** Deterministic redaction engine (`FULL`, `PARTIAL`, `PSEUDONYMIZE`) with CSV preservation and ignored-ID support.
- **Prompt D:** Full interactive CYLOCES browser application with Web Worker detection, side-by-side live review, click-to-toggle overrides, explainability inspector, severity-weighted Privacy Risk Meter, `.txt`/`.csv` local file processing, and PII-free JSON/CSV audit exports.

Optional AI-assisted review (Prompt E) and final hardening (Prompt F) remain planned.

---

## 2. Architecture

CYLOCES separates pure domain engines, off-thread execution, and accessible React presentation:

1. **Detection Layer (`src/lib/detectors/`):** Pure regex extraction paired with independent structural and checksum validation (Luhn, Verhoeff, PAN holder categories, RFC-lite email domains, IPv4 octet bounds, E.164/Indian phones) plus priority-ordered overlap resolution.
2. **Redaction Layer (`src/lib/redaction/`):** Position-based text transformations operating strictly on validated `[start, end)` spans so CSV delimiters, quotes, escaped quotes, and newlines stay intact.
3. **Web Worker Layer (`src/workers/` & `src/hooks/usePiiDetectionWorker.ts`):** Offloads `detectPii` off the main UI thread using typed request/response messages, stale-response filtering (`requestId`), and clean worker termination.
4. **Risk & Audit Layer (`src/lib/risk/`, `src/lib/audit/`):** Calculates unredacted severity exposure and generates privacy-safe JSON and CSV audit exports.
5. **Presentation Layer (`src/components/`, `src/App.tsx`):** Modular, WCAG AA accessible React UI with light/dark themes, keyboard navigation, and React text-node rendering (zero `dangerouslySetInnerHTML`).

---

## 3. Privacy-First Processing

- **Browser-Only Execution:** All text scanning, redaction, risk scoring, file reading, and export generation execute exclusively inside browser memory.
- **Zero Network Egress for Document Data:** No backend APIs, analytics, external font requests, or external AI calls exist.
- **Strict Content Security Policy:** Production headers in [vercel.json](vercel.json) restrict `script-src`, `connect-src`, `font-src`, `form-action`, `object-src`, and `frame-ancestors`.
- **No Persistent Document Storage:** Document contents and raw PII are never persisted to `localStorage` or `sessionStorage`.

---

## 4. Web Worker Architecture

- [piiWorker.ts](src/workers/piiWorker.ts) delegates typed `DetectionWorkerRequest` messages (`{ requestId, text }`) to [processDetectionRequest](src/workers/workerMessageHandler.ts) and posts `DetectionWorkerResponse` payloads back to the UI thread.
- [workerClient.ts](src/workers/workerClient.ts) maintains a single persistent worker instance, tracks `latestRequestId`, discards stale responses if the user edits text mid-scan, surfaces safe error messages, and terminates on unmount.

---

## 5. Redaction Modes

| Mode           | Behavior                                                      | Example                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FULL`         | Replaces every non-ignored detection with `[REDACTED]`        | `sunny@example.com` -> `[REDACTED]`                                                                                                                                                            |
| `PARTIAL`      | Masks sensitive portions while keeping limited structure      | `sunny@example.com` -> `s***@example.com`, `4111 1111 1111 1111` -> `XXXX-XXXX-XXXX-1111`, `2345 6789 0124` -> `XXXX XXXX 0124`, `192.168.1.10` -> `192.168.*.*`, `ABCPD1234F` -> `AB*******F` |
| `PSEUDONYMIZE` | Assigns session-local normalized placeholders per entity type | `sunny@example.com` & `SUNNY@example.com` -> `EMAIL_01`                                                                                                                                        |

---

## 6. Explainable Detection System

Every `Detection` carries `id`, `type`, `start`, `end`, `value`, `confidence` (`"high" | "medium" | "low"`), `severity` (`1–5`), and `reasons` reflecting the exact validation checks executed (e.g., `"Luhn checksum passed."`, `"Verhoeff checksum passed."`). Clicking or focusing any entity in the workspace or inspector displays these exact checks without invented explanations.

---

## 7. Risk Score Formula and Limitations

```text
Risk Score = round(100 * sum(severity of ignored detections) / sum(severity of all valid detections))
```

- Returns `0` when there are no detections or all detections are redacted, and `100` when every detection is kept unchanged, clamped to `0–100`.
- **Thresholds:** `0–25` (`Low Risk`), `26–65` (`Moderate Risk`), `66–100` (`High Risk`).
- **Limitation:** The score measures detected identifiers left completely unchanged; it is not a guarantee of anonymity, and partial masking may still retain contextual clues.

---

## 8. Audit Report Format

Audit reports are downloadable locally as JSON (`cyloces-audit-report.json`) or CSV (`cyloces-audit-report.csv`) and include **only**:

- Selected redaction mode, generation timestamp, total detections, redacted count, and kept count.
- Counts by entity type (`CREDIT_CARD`, `AADHAAR`, `PAN`, `IPV4`, `EMAIL`, `PHONE`).
- Per-detection positional offsets (`start`, `end`), `type`, deterministic `id`, and `REDACTED` / `KEPT` status.

Audit reports **never** include original document text, raw detected values, text snippets, pseudonym-to-original mappings, or filenames.

---

## 9. Installation and Usage

```bash
npm install
npm run dev
```

### Verification Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

---

## 10. Requirement-to-File Mapping

| Requirement                                   | Status             | File(s)                                                                                                                                                                                      |
| --------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project config, CSP headers, CI               | Implemented        | [package.json](package.json), [vercel.json](vercel.json), [.github/workflows/ci.yml](.github/workflows/ci.yml)                                                                               |
| Detection data model & 6 detectors            | Implemented        | [src/types/detection.ts](src/types/detection.ts), [src/lib/detectors/](src/lib/detectors/index.ts)                                                                                           |
| Luhn & Verhoeff checksums                     | Implemented        | [src/lib/detectors/luhn.ts](src/lib/detectors/luhn.ts), [src/lib/detectors/verhoeff.ts](src/lib/detectors/verhoeff.ts)                                                                       |
| Full, partial, & pseudonym redaction          | Implemented        | [src/types/redaction.ts](src/types/redaction.ts), [src/lib/redaction/](src/lib/redaction/index.ts)                                                                                           |
| Dedicated Web Worker & client hook            | Implemented        | [src/workers/piiWorker.ts](src/workers/piiWorker.ts), [src/workers/workerClient.ts](src/workers/workerClient.ts), [src/hooks/usePiiDetectionWorker.ts](src/hooks/usePiiDetectionWorker.ts)   |
| Severity-weighted Privacy Risk Meter          | Implemented        | [src/lib/risk/riskCalculator.ts](src/lib/risk/riskCalculator.ts), [src/components/PrivacyRiskMeter.tsx](src/components/PrivacyRiskMeter.tsx)                                                 |
| PII-free JSON & CSV audit exports             | Implemented        | [src/lib/audit/auditExport.ts](src/lib/audit/auditExport.ts), [src/components/AuditExportBar.tsx](src/components/AuditExportBar.tsx)                                                         |
| Local `.txt`/`.csv` upload, download & sample | Implemented        | [src/lib/fileUtils.ts](src/lib/fileUtils.ts), [src/lib/sampleDocument.ts](src/lib/sampleDocument.ts), [src/components/InputPanel.tsx](src/components/InputPanel.tsx)                         |
| Interactive review, toggles & inspector       | Implemented        | [src/App.tsx](src/App.tsx), [src/components/SideBySideWorkspace.tsx](src/components/SideBySideWorkspace.tsx), [src/components/DetectionInspector.tsx](src/components/DetectionInspector.tsx) |
| Optional Gemini integration                   | Planned (Prompt E) | —                                                                                                                                                                                            |
| Final hardening & documentation               | Planned (Prompt F) | —                                                                                                                                                                                            |
