# Prompt Log

This file records the actual prompts used during the development of CYLOCES, along with honest, verifiable records of what each phase implemented.

---

## Prompt A: Project Foundation

- **Status:** Completed
- **Objective:** Establish a clean, strict, deployable Vite + React + TypeScript + Tailwind CSS + Vitest + ESLint + Prettier project foundation with Vercel static deployment, strict Content Security Policy headers, CI workflow, `AGENTS.md`, and `README.md`.
- **Outcome:** Scaffolded configuration, directory layout, CSP headers, CI pipeline, and baseline test; verified via `lint`, `typecheck`, `test`, `build`, and `dev`.

---

## Prompt B: Detection and Explainability

- **Status:** Completed
- **Objective:** Implement deterministic client-side PII detectors for `EMAIL`, `PHONE`, `IPV4`, `PAN`, `AADHAAR`, and `CREDIT_CARD` with reusable Luhn and Verhoeff checksum validation, explainability metadata (`confidence`, `reasons`, `severity`), deterministic IDs, and priority-ordered overlap resolution.
- **Outcome:** Created `src/types/detection.ts` and modular detectors under `src/lib/detectors/` backed by synthetic Vitest suites.

---

## Prompt C: Redaction Engine

- **Status:** Completed
- **Objective:** Implement `FULL`, `PARTIAL`, and `PSEUDONYMIZE` redaction strategies operating safely on validated `[start, end)` positions with `ignoredIds` support, session-local normalized counters, and CSV/newline preservation.
- **Outcome:** Created `src/types/redaction.ts` and modular strategies under `src/lib/redaction/` with unit tests covering all three modes, ignored IDs, and CSV/CRLF integrity.

---

## Prompt D: CYLOCES Application (Frontend, Web Worker, Risk Meter, and Privacy Audit)

- **Status:** Completed
- **Prompt Summary:** Build the complete, Apple-inspired, accessible CYLOCES single-page application reusing existing detection and redaction engines without rewriting core logic:
  - Light/dark theme, generous whitespace, 8px spacing grid, system font stack, WCAG AA contrast, keyboard accessibility, and reduced-motion support.
  - Dedicated Web Worker (`src/workers/`) with typed messages, loading state, error handling, stale-response protection, and unmount termination.
  - Side-by-side original and live sanitized views rendered solely via React text nodes (no `dangerouslySetInnerHTML`), with click-to-toggle Keep/Redact controls and explainable detection inspector.
  - Severity-weighted `0–100` Privacy Risk Meter (`src/lib/risk/`).
  - Local `.txt`/`.csv` upload (2 MB cap), synthetic noisy sample loader, sanitized file download, and PII-free JSON/CSV audit report exports (`src/lib/audit/`).

---

## Prompt E: Optional Gemini Integration

- **Status:** Pending
- **Notes:** Reserved for recording the actual Prompt E instructions and verified implementation outcomes when executed.

---

## Prompt F: Hardening and Documentation

- **Status:** Pending
- **Notes:** Reserved for recording the actual Prompt F instructions and verified implementation outcomes when executed.
