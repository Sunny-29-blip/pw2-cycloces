# Prompt Log

This file records the actual development prompts executed for CYLOCES along with verifiable implementation outcomes.

---

## Prompt A: Project Foundation

- **Status:** Completed
- **Summary:** Initialized Vite, React, TypeScript (strict mode), Tailwind CSS, Vitest, ESLint, Prettier, GitHub Actions CI, `AGENTS.md`, `README.md`, `.env.example`, `.gitignore`, and `vercel.json` with strict CSP headers. No detection, redaction, or AI logic was included in this initialization phase.

---

## Prompt B: PII Detection Engine and Explainability

- **Status:** Completed
- **Summary:** Implemented `src/types/detection.ts` and six modular client-side detectors under `src/lib/detectors/` (`EMAIL`, `PHONE`, `IPV4`, `PAN`, `AADHAAR`, `CREDIT_CARD`) with separate Luhn and Verhoeff checksum functions, deterministic IDs, confidence/severity rules, reason strings, and priority-ordered overlap resolution.

---

## Prompt C: Redaction Engine

- **Status:** Completed
- **Summary:** Implemented `src/types/redaction.ts` and three position-based redaction strategies under `src/lib/redaction/` (`FULL`, `PARTIAL`, `PSEUDONYMIZE`) supporting `ignoredIds`, session-local normalized counters, and CSV/CRLF preservation.

---

## Prompt D: CYLOCES Application, Web Worker, Risk Meter, and Audit Exports

- **Status:** Completed
- **Summary:** Built the full CYLOCES frontend (`src/components/`, `src/App.tsx`), dedicated module Web Worker (`src/workers/piiWorker.ts`, `src/workers/workerClient.ts`, `src/hooks/usePiiDetectionWorker.ts`) with stale-response cancellation, severity-weighted Privacy Risk Meter (`src/lib/risk/`), PII-free JSON/CSV audit exports (`src/lib/audit/`), local `.txt`/`.csv` file validation/download (`src/lib/fileUtils.ts`), and synthetic noisy sample fixture (`src/lib/sampleDocument.ts`). Also resolved the follow-up Vercel `WorkerLike.onerror` `ErrorEvent` type hotfix.

---

## Prompt E: Optional Gemini AI Compliance Summary

- **Status:** Completed
- **Summary:** Added an opt-in, consent-gated AI Compliance Summary (`src/components/AiComplianceSummary.tsx`, `src/lib/complianceClient.ts`, `src/lib/complianceValidation.ts`, `api/summary.ts`) using `@google/genai`, strict allowlist validation (`countsByType` + `riskScore` only), `GEMINI_API_KEY`/`GEMINI_MODEL` server-only env vars, updated privacy wording, and mocked Gemini/UI unit tests.

---

## Prompt F: Final Engineering Hardening

- **Status:** Completed
- **Summary:** Performed full security, accessibility, code quality, worker, and documentation audit:
  - Fixed ARIA semantics in `DetectionInspector.tsx` (`<ul>`/`<li>` instead of `role="list"` around direct buttons) and `SideBySideWorkspace.tsx` (`role="group"` + `aria-pressed` mobile switcher).
  - Updated `AiComplianceSummary.tsx` to clear stale errors as well as stale summaries when document metrics change.
  - Hardened `api/summary.ts` with chunked streaming body byte-cap enforcement and `http:`/`https:` origin protocol verification.
  - Added NUL-byte binary file rejection in `src/App.tsx` and `> 2 MB` upload regression test in `tests/app.test.tsx`.
  - Finalized `README.md` (all 20 sections) and `PROMPT_LOG.md`, and ran `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npx prettier --check .`.

---

## Prompt G–I: Codebase Audit, High-Density Optimization & Production Reliability

- **Status:** Completed
- **Summary:**
  - Replaced the `O(N²)` overlap scan in `src/lib/detectors/overlapResolver.ts` with `O(N log N)` coordinate compression and a `Uint8Array`-backed segment tree (`IntervalOccupancyTree`), verified against an `O(N²)` reference oracle across 2,000 randomized differential trials.
  - Added pure per-entity `maskEntityValuePartially` fast-path for `PARTIAL` workspace previews (`src/lib/redaction/partialMask.ts`, `src/lib/documentSegments.ts`), 50-item pagination in `DetectionInspector.tsx`, and automatic >250-detection section pagination in `SideBySideWorkspace.tsx` while keeping full-document downloads and audit exports complete.
  - Hardened `api/summary.ts` (removed blind trust in `x-forwarded-host`, added `Sec-Fetch-Site: cross-site` rejection, exact `application/json` media-type matching, `Promise.race` timeout guarantee, and nullish SDK text guard) and added request cancellation (`AbortSignal` + Cancel control) in `src/lib/complianceClient.ts` and `src/components/AiComplianceSummary.tsx`.
  - Removed verified unused internal exports/duplicate `default` App export surfaced by Knip, updated `.github/workflows/ci.yml` with Prettier check and `npm audit --audit-level=high`, added reproducible `npm run benchmark` (`scripts/benchmark.mjs`), added `@google/genai` dynamic-import integration tests (`tests/summarySdkIntegration.test.ts`), and verified in Vitest (`jsdom`), production Chrome smoke tests, and live Vercel smoke checks.
