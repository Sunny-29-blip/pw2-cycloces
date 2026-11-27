import type { ReactElement } from "react";
import type { RedactionMode } from "../types/redaction";

export interface ModeSelectorProps {
  readonly mode: RedactionMode;
  readonly onModeChange: (mode: RedactionMode) => void;
}

interface ModeOption {
  readonly value: RedactionMode;
  readonly label: string;
  readonly description: string;
  readonly example: string;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  {
    value: "FULL",
    label: "FULL MASK",
    description: "Replaces every redacted entity completely with [REDACTED].",
    example: "alice@example.com → [REDACTED]",
  },
  {
    value: "PARTIAL",
    label: "PARTIAL MASK",
    description: "Masks sensitive characters while preserving limited format context.",
    example: "alice@example.com → a***@example.com",
  },
  {
    value: "PSEUDONYMIZE",
    label: "CONSISTENT PSEUDONYMIZATION",
    description: "Assigns deterministic session placeholders per normalized identifier.",
    example: "alice@example.com → EMAIL_01",
  },
] as const;

/**
 * Accessible configuration selector for choosing the active redaction strategy.
 */
export function ModeSelector({ mode, onModeChange }: ModeSelectorProps): ReactElement {
  return (
    <fieldset className="rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-xs dark:border-[#2d313a] dark:bg-[#15171c]">
      <legend className="px-1 text-base font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
        Redaction Mode
      </legend>
      <p className="mt-1 text-xs text-[#515154] dark:text-[#a1a1aa]">
        Switching modes recalculates the sanitized document immediately without re-scanning.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-colors ${
                isSelected
                  ? "border-[#0066cc] bg-[#f0f7ff] dark:border-[#4da3ff] dark:bg-[#132238]"
                  : "border-[#d2d2d7] bg-[#f9f9fb] hover:bg-[#f2f2f6] dark:border-[#2d313a] dark:bg-[#1c1f26] dark:hover:bg-[#232730]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="redaction-mode"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onModeChange(option.value)}
                  className="mt-1 h-4 w-4 accent-[#0066cc] dark:accent-[#4da3ff]"
                />
                <div className="space-y-1">
                  <span className="block text-xs font-semibold tracking-wide text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {option.label}
                  </span>
                  <span className="block text-xs leading-relaxed text-[#515154] dark:text-[#a1a1aa]">
                    {option.description}
                  </span>
                </div>
              </div>
              <p className="mt-3 rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-[#424245] dark:bg-[#0b0c0e]/70 dark:text-[#d4d4d8]">
                {option.example}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
