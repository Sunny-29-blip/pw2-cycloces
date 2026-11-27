# Local-First PII Sanitization Application

> **Every redaction is explainable, reviewable, and never leaves your browser.**

## 1. Project Overview

An explainable, auditable, local-first Personally Identifiable Information (PII) sanitization web application built with React, TypeScript, Vite, and Tailwind CSS.

**Current Status:** **Prompt A — Project Foundation** is implemented. Core PII detection, explainability scoring, redaction modes, Web Workers, risk calculation, and optional AI features are **planned** for subsequent phases and are not yet implemented.

---

## 2. Problem Statement

Teams, analysts, engineers, and everyday users frequently need to share logs, transcripts, customer support tickets, and structured datasets without exposing sensitive personal data. Existing tools often operate as opaque cloud black boxes—requiring users to upload sensitive text to remote servers without transparent evidence of what was detected, why it was flagged, or how it was transformed.

This project solves that problem by providing a **100% browser-resident, explainable, and auditable sanitization workbench**.

---

## 3. Core Objectives

### Implemented (Prompt A)

- Strict TypeScript, Vite, React, and Tailwind CSS project foundation.
- Working Vitest unit test runner, ESLint, and Prettier code quality checks.
- Static Vercel deployment configuration with strict Content Security Policy (CSP) HTTP headers.
- Continuous Integration workflow via GitHub Actions.
- Clear modular directory structure separating components, detectors, redaction, risk analysis, Web Workers, and shared types.

### Planned (Prompts B–F)

- **Prompt B (Detection & Explainability):** Client-side PII detection with validator-backed confidence and human-readable explanations.
- **Prompt C (Redaction Engine):** Multiple reversible/irreversible redaction and pseudonymization modes.
- **Prompt D (Frontend & Privacy Audit):** Apple-caliber interactive review workspace, file/CSV handling, Web Worker offloading, risk scoring, and client-side privacy audit verification.
- **Prompt E (Optional Gemini Integration):** Strictly opt-in, user-controlled AI assistance with explicit disclosure.
- **Prompt F (Hardening & Documentation):** Security hardening, performance verification, and final documentation.

---

## 4. Technology Stack

| Layer                      | Technology                             | Status      |
| -------------------------- | -------------------------------------- | ----------- |
| Build Tool                 | Vite                                   | Implemented |
| UI Library                 | React + TypeScript (Strict Mode)       | Implemented |
| Styling                    | Tailwind CSS                           | Implemented |
| Testing                    | Vitest + Testing Library (`jsdom`)     | Implemented |
| Linting & Formatting       | ESLint + Prettier                      | Implemented |
| Hosting & Security Headers | Vercel Static Deployment + CSP Headers | Implemented |
| CI Pipeline                | GitHub Actions                         | Implemented |

---

## 5. Planned Architecture

The application is structured around strict separation of concerns so that all core sanitization logic remains pure, testable, and decoupled from the React UI:

1. **Detection Layer (`src/lib/detectors/` — Planned):** Pure TypeScript modules for locating candidate PII spans, validating checksums/formats, and emitting structured evidence explaining why each span matched.
2. **Redaction Layer (`src/lib/redaction/` — Planned):** Deterministic transformation engines (masking, token replacement, pseudonymization) operating on verified detection spans.
3. **Risk Layer (`src/lib/risk/` — Planned):** Transparent exposure and sensitivity scoring calculated from detected entities and document context.
4. **Worker Layer (`src/workers/` — Planned):** Dedicated Web Workers to keep heavy scanning and batch processing off the main UI thread.
5. **Presentation Layer (`src/components/` — Planned):** Accessible, keyboard-navigable React UI for inspecting flagged items, toggling decisions, and exporting sanitized outputs.
6. **Type Contracts (`src/types/` — Planned):** Shared strict TypeScript domain models across workers, engines, and UI components.

---

## 6. Privacy-First Approach

- **Zero Server Storage:** No backend database or server-side text processing endpoints exist.
- **Strict Content Security Policy:** Production headers in `vercel.json` lock down `script-src`, `connect-src`, `font-src`, `form-action`, `object-src`, and `frame-ancestors` to prevent unauthorized network egress, third-party script injection, and framing.
- **No External Fonts or Analytics:** Uses system font stacks only; zero telemetry or tracking scripts.
- **Local-First Execution (Planned):** All parsing, detection, risk scoring, and redaction execute strictly inside the user's browser.

---

## 7. Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml          # CI pipeline (lint, typecheck, test, build)
├── src/
│   ├── components/         # UI components (planned in Prompt D)
│   ├── lib/
│   │   ├── detectors/      # PII detection & explainability (planned in Prompt B)
│   │   ├── redaction/      # Redaction transformations (planned in Prompt C)
│   │   └── risk/           # Risk scoring logic (planned in Prompt D)
│   ├── types/              # Shared TypeScript interfaces (planned in Prompt B+)
│   ├── workers/            # Web Workers for off-thread execution (planned in Prompt D)
│   ├── App.tsx             # Root foundation shell (implemented)
│   ├── index.css           # Tailwind CSS entry & base accessibility styles (implemented)
│   └── main.tsx            # Application mount point (implemented)
├── tests/                  # Vitest unit tests (minimal foundation test implemented)
├── .env.example            # Environment variable documentation
├── .gitignore              # Git ignore rules
├── AGENTS.md               # Permanent engineering, UI, and testing standards
├── PROMPT_LOG.md           # Chronological prompt & implementation log
├── README.md               # Project documentation
├── index.html              # HTML entry point
├── package.json            # Dependencies and npm scripts
├── tsconfig.json           # Root TypeScript configuration
├── tsconfig.app.json       # Strict TypeScript config for application code
├── tsconfig.node.json      # Strict TypeScript config for tooling
├── vercel.json             # Vercel static build & strict CSP response headers
└── vite.config.ts          # Vite & Vitest configuration
```

---

## 8. Installation and Local Development

### Prerequisites

- Node.js 20+ (tested with Node 24)
- npm 10+

### Setup

```bash
npm install
```

### Available Scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the local Vite development server              |
| `npm run build`     | Build the production static bundle into `dist/`      |
| `npm run preview`   | Preview the production build locally                 |
| `npm run lint`      | Run ESLint across the repository                     |
| `npm run typecheck` | Run TypeScript strict type checking (`tsc --noEmit`) |
| `npm test`          | Run Vitest unit tests once in non-watch mode         |

---

## 9. Testing Instructions

Run the full verification suite locally:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All tests in `tests/` execute via Vitest in `jsdom` without watch mode so `npm test` terminates cleanly in CI environments.

---

## 10. Vercel Deployment Instructions

1. Push the repository to GitHub.
2. Import the repository into Vercel as a **Vite** static frontend project.
3. Vercel uses `vercel.json` automatically:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Security Headers:** Applies strict `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` HTTP headers to all routes.
4. No environment variables are required for deployment.

---

## 11. Requirement-to-File Mapping

| Requirement                              | Status             | File(s)                                                                                                          |
| ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Build tooling & Tailwind CSS integration | Implemented        | [package.json](package.json), [vite.config.ts](vite.config.ts), [src/index.css](src/index.css)                   |
| Strict TypeScript configuration          | Implemented        | [tsconfig.json](tsconfig.json), [tsconfig.app.json](tsconfig.app.json), [tsconfig.node.json](tsconfig.node.json) |
| ESLint & Prettier configuration          | Implemented        | [eslint.config.js](eslint.config.js), [.prettierrc](.prettierrc)                                                 |
| Minimal root application shell           | Implemented        | [index.html](index.html), [src/main.tsx](src/main.tsx), [src/App.tsx](src/App.tsx)                               |
| Unit testing setup & baseline test       | Implemented        | [vite.config.ts](vite.config.ts), [tests/app.test.tsx](tests/app.test.tsx)                                       |
| Production CSP & Vercel static config    | Implemented        | [vercel.json](vercel.json)                                                                                       |
| Continuous Integration workflow          | Implemented        | [.github/workflows/ci.yml](.github/workflows/ci.yml)                                                             |
| Engineering & UI standards               | Implemented        | [AGENTS.md](AGENTS.md)                                                                                           |
| Development prompt log                   | Implemented        | [PROMPT_LOG.md](PROMPT_LOG.md)                                                                                   |
| PII detectors & explainability           | Planned (Prompt B) | `src/lib/detectors/`, `src/types/`                                                                               |
| Redaction & pseudonymization engine      | Planned (Prompt C) | `src/lib/redaction/`                                                                                             |
| Risk calculation, Web Workers, & full UI | Planned (Prompt D) | `src/lib/risk/`, `src/workers/`, `src/components/`                                                               |
