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

const INDIAN_91_REASONS: readonly string[] = Object.freeze([
  "Indian +91 country code matched.",
  "10-digit subscriber number starting with 6-9 validated.",
  "E.164 total digit length (12) validated.",
]);

const INTL_PHONE_REASONS: readonly string[] = Object.freeze([
  "International '+' country-code prefix matched.",
  "E.164 digit length (7-15 digits) validated.",
  "Separator and grouping boundaries validated.",
]);

const DOMESTIC_PHONE_REASONS: readonly string[] = Object.freeze([
  "Indian 10-digit mobile pattern (6-9 prefix) matched.",
  "Numeric boundary checks passed.",
]);

function buildInternationalDetection(value: string, start: number): Detection | null {
  let openParens = 0;
  let closeParens = 0;
  let groupCount = 0;
  let inGroup = false;
  let digitCount = 0;
  let firstDigit = -1;
  let secondDigit = -1;
  let thirdDigit = -1;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code === 40) {
      openParens += 1;
      if (openParens > 1) {
        return null;
      }
    } else if (code === 41) {
      closeParens += 1;
      if (closeParens > openParens) {
        return null;
      }
    }

    if (index > 0) {
      const isSeparator = code === 32 || code === 40 || code === 41 || code === 45;
      if (isSeparator) {
        inGroup = false;
      } else if (!inGroup) {
        inGroup = true;
        groupCount += 1;
        if (groupCount > MAX_SEPARATOR_GROUPS) {
          return null;
        }
      }
    }

    if (code >= 48 && code <= 57) {
      const digit = code - 48;
      if (digitCount === 0) {
        firstDigit = digit;
      } else if (digitCount === 1) {
        secondDigit = digit;
      } else if (digitCount === 2) {
        thirdDigit = digit;
      }
      digitCount += 1;
      if (digitCount > MAX_E164_DIGITS) {
        return null;
      }
    }
  }

  if (openParens !== closeParens || groupCount === 0 || digitCount < MIN_E164_DIGITS) {
    return null;
  }

  const end = start + value.length;

  if (firstDigit === 9 && secondDigit === 1) {
    if (digitCount !== INDIAN_E164_DIGITS || thirdDigit < 6 || thirdDigit > 9) {
      return null;
    }

    return {
      id: createDetectionId("PHONE", start, end),
      type: "PHONE",
      start,
      end,
      value,
      confidence: "high",
      reasons: INDIAN_91_REASONS,
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
    reasons: INTL_PHONE_REASONS,
    severity: ENTITY_SEVERITY.PHONE,
  };
}

function buildDomesticIndianDetection(value: string, start: number): Detection | null {
  let digitCount = 0;
  let firstDigit = -1;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      const digit = code - 48;
      if (digitCount === 0) {
        firstDigit = digit;
      }
      digitCount += 1;
    }
  }

  if (digitCount !== INDIAN_LOCAL_DIGITS || firstDigit < 6 || firstDigit > 9) {
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
    reasons: DOMESTIC_PHONE_REASONS,
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
  INTERNATIONAL_PHONE_PATTERN.lastIndex = 0;
  DOMESTIC_INDIAN_PHONE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = INTERNATIONAL_PHONE_PATTERN.exec(text)) !== null) {
      const value = match[1];
      const start = match.index;
      if (value === undefined) {
        continue;
      }
      const detection = buildInternationalDetection(value, start);
      if (detection !== null) {
        candidates.push(detection);
      }
    }

    while ((match = DOMESTIC_INDIAN_PHONE_PATTERN.exec(text)) !== null) {
      const detection = buildDomesticIndianDetection(match[0], match.index);
      if (detection !== null) {
        candidates.push(detection);
      }
    }
  } finally {
    INTERNATIONAL_PHONE_PATTERN.lastIndex = 0;
    DOMESTIC_INDIAN_PHONE_PATTERN.lastIndex = 0;
  }

  return resolveOverlaps(candidates);
}
