import type { ReactElement } from "react";

export type ThemeMode = "light" | "dark";

export interface HeaderProps {
  readonly theme: ThemeMode;
  readonly onToggleTheme: () => void;
}

/**
 * Top application bar presenting CYLOCES branding, accurate local-first privacy status, and theme switcher.
 */
export function Header({ theme, onToggleTheme }: HeaderProps): ReactElement {
  const isDark = theme === "dark";

  return (
    <header className="border-b border-[#d2d2d7] bg-white/95 dark:border-[#2d313a] dark:bg-[#15171c]/95">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              CYLOCES
            </h1>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-[#b7dfc4] bg-[#edf8f0] px-3 py-1 text-xs font-medium text-[#125b2d] dark:border-[#22543d] dark:bg-[#132a1e] dark:text-[#86efac]"
              aria-label="Privacy status: document text and raw identifiers remain in your browser during sanitization; optional AI summary sends aggregate counts only upon explicit consent"
            >
              <span className="h-2 w-2 rounded-full bg-[#1a7f37] dark:bg-[#4ade80]" aria-hidden />
              Local-First Sanitization · Opt-In AI Metadata
            </span>
          </div>
          <p className="text-sm text-[#515154] dark:text-[#a1a1aa]">
            Document text and raw identifiers remain in your browser during sanitization.
          </p>
          <p className="text-xs text-[#515154] dark:text-[#a1a1aa]">
            Every redaction is explainable, reviewable, and never leaves your browser.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={isDark}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-[#e8e8ed] dark:border-[#2d313a] dark:bg-[#1c1f26] dark:text-[#f5f5f7] dark:hover:bg-[#262a33]"
        >
          {isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
        </button>
      </div>
    </header>
  );
}
