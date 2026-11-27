import type { ReactElement } from "react";

const APP_TITLE = "Local-First PII Sanitizer";
const APP_TAGLINE = "Every redaction is explainable, reviewable, and never leaves your browser.";

/**
 * Root application shell for the local-first PII sanitization workspace.
 * Currently establishes the verified engineering foundation prior to feature modules.
 */
export function App(): ReactElement {
  return (
    <main className="min-h-screen bg-[#f5f5f7] px-6 py-16 text-[#1d1d1f]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#d2d2d7] bg-white p-8 shadow-xs sm:p-12">
        <header className="space-y-4">
          <p className="text-xs font-semibold tracking-wider text-[#515154] uppercase">
            Foundation Ready
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl">
            {APP_TITLE}
          </h1>
          <p className="text-base leading-relaxed text-[#424245]">{APP_TAGLINE}</p>
        </header>
      </div>
    </main>
  );
}

export default App;
