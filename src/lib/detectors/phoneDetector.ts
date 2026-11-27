import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";
import { resolveOverlaps } from "./overlapResolver";

const INTERNATIONAL_PHONE_PATTERN =
  /(?<![A-Za-z0-9+])(\+[1-9](?:[ -]?(?:\(\d{1,5}\)|\d))+)(?![A-Za-z0-9]|\.\d|-[A-Za-z0-9])/g;

const DOMESTIC_INDIAN_PHONE_PATTERN =
  /(?<![A-Za-z0-9+]|[A-Za-z]-|\d[ -]|\d\.)(?:[6-9]\d{9}|[6-9]\d{4}[ -]\d{5}|[6-9]\d{2}[ -]\d{3}[ -]\d{4}|[6-9]\d{3}[ -]\d{3}[ -]\d{3}|\([6-9]\d{2}\)[ -]?\d{3}[ -]?\d{4})(?![A-Za-z0-9]|[ -]?\d|\.\d|-[A-Za-z0-9])/g;

const MIN_E164_DIGITS = 7;
const MAX_E164_DIGITS = 15;
const INDIAN_LOCAL_DIGITS = 10;
const INDIAN_E164_DIGITS = 12;
const MAX_SEPARATOR_GROUPS = 5;

function hasBalancedParentheses(value: string): boolean {
  let openCount = 0;
  let closeCount = 0;

  for (const char of value) {
    if (char === "(") {
      openCount += 1;
    } else if (char === ")") {
      closeCount += 1;
      if (closeCount > openCount) {
        return false;
      }
    }
  }

  return openCount === closeCount && openCount <= 1;
}

function buildInternationalDetection(value: string, start: number): Detection | null {
  if (!hasBalancedParentheses(value)) {
    return null;
  }

  const groups = value
    .slice(1)
    .split(/[ ()-]+/)
    .filter((group) => group.length > 0);

  if (groups.length === 0 || groups.length > MAX_SEPARATOR_GROUPS) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) {
    return null;
  }

  const end = start + value.length;

  if (digits.startsWith("91")) {
    const subscriber = digits.slice(2);
    if (digits.length !== INDIAN_E164_DIGITS || !/^[6-9]\d{9}$/.test(subscriber)) {
      return null;
    }

    return {
      id: createDetectionId("PHONE", start, end),
      type: "PHONE",
      start,
      end,
      value,
      confidence: "high",
      reasons: [
        "Indian +91 country code matched.",
        "10-digit subscriber number starting with 6-9 validated.",
        "E.164 total digit length (12) validated.",
      ],
      severity: ENTITY_SEVERITY.PHONE,
    };
  }

  return {
    id: createDetectionId("PHONE", start, end),
    type: "PHONE",
    start,
    end,
    value,
    confidence: "high",
    reasons: [
      "International '+' country-code prefix matched.",
      "E.164 digit length (7-15 digits) validated.",
      "Separator and grouping boundaries validated.",
    ],
    severity: ENTITY_SEVERITY.PHONE,
  };
}

function buildDomesticIndianDetection(value: string, start: number): Detection | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== INDIAN_LOCAL_DIGITS || !/^[6-9]\d{9}$/.test(digits)) {
    return null;
  }

  const end = start + value.length;
  return {
    id: createDetectionId("PHONE", start, end),
    type: "PHONE",
    start,
    end,
    value,
    confidence: "medium",
    reasons: [
      "Indian 10-digit mobile pattern (6-9 prefix) matched.",
      "Numeric boundary checks passed.",
    ],
    severity: ENTITY_SEVERITY.PHONE,
  };
}

/**
 * Detects Indian 10-digit, +91, and international E.164-compatible phone numbers.
 */
export function detectPhones(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const candidates: Detection[] = [];

  for (const match of text.matchAll(INTERNATIONAL_PHONE_PATTERN)) {
    const value = match[1];
    const start = match.index;
    if (value === undefined || start === undefined) {
      continue;
    }
    const detection = buildInternationalDetection(value, start);
    if (detection !== null) {
      candidates.push(detection);
    }
  }

  for (const match of text.matchAll(DOMESTIC_INDIAN_PHONE_PATTERN)) {
    const value = match[0];
    const start = match.index;
    if (start === undefined) {
      continue;
    }
    const detection = buildDomesticIndianDetection(value, start);
    if (detection !== null) {
      candidates.push(detection);
    }
  }

  return resolveOverlaps(candidates);
}
