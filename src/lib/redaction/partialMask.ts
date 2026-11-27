import type { Detection, EntityType } from "../../types/detection";
import type { RedactionResult } from "../../types/redaction";
import { FULL_MASK_PLACEHOLDER } from "./fullMask";
import { applyPositionReplacements, validateRedactionInputs } from "./shared";

const UNSAFE_CSV_CHARS = /[",]/g;
const VISIBLE_TAIL_DIGITS = 4;

function sanitizeReplacement(value: string): string {
  if (!value.includes('"') && !value.includes(",")) {
    return value;
  }
  return value.replace(UNSAFE_CSV_CHARS, "");
}

function extractTailDigits(
  value: string,
  count: number,
): {
  readonly totalDigits: number;
  readonly tail: string;
} {
  let totalDigits = 0;
  let tail = "";

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      totalDigits += 1;
      if (tail.length < count) {
        tail = value.charAt(index) + tail;
      }
    }
  }

  return { totalDigits, tail };
}

function maskEmail(value: string): string {
  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return FULL_MASK_PLACEHOLDER;
  }

  const domain = value.slice(atIndex + 1);
  const firstChar = value.charAt(0);
  return sanitizeReplacement(`${firstChar}***@${domain}`);
}

function maskPhone(value: string): string {
  let totalDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      totalDigits += 1;
    }
  }

  if (totalDigits <= VISIBLE_TAIL_DIGITS) {
    return "*".repeat(totalDigits || VISIBLE_TAIL_DIGITS);
  }

  const digitsToMask = totalDigits - VISIBLE_TAIL_DIGITS;
  let maskedDigits = 0;
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      if (maskedDigits < digitsToMask) {
        result += "*";
        maskedDigits += 1;
        if (maskedDigits === digitsToMask) {
          result += value.slice(index + 1);
          break;
        }
      } else {
        result += value.slice(index);
        break;
      }
    } else {
      result += value.charAt(index);
    }
  }

  return sanitizeReplacement(result);
}

function maskCreditCard(value: string): string {
  const { totalDigits, tail } = extractTailDigits(value, VISIBLE_TAIL_DIGITS);
  if (totalDigits < VISIBLE_TAIL_DIGITS) {
    return "XXXX";
  }
  return `XXXX-XXXX-XXXX-${tail}`;
}

function maskAadhaar(value: string): string {
  const { totalDigits, tail } = extractTailDigits(value, VISIBLE_TAIL_DIGITS);
  if (totalDigits < VISIBLE_TAIL_DIGITS) {
    return "XXXX XXXX XXXX";
  }
  return `XXXX XXXX ${tail}`;
}

function maskIpv4(value: string): string {
  const dot1 = value.indexOf(".");
  if (dot1 <= 0) {
    return "*.*.*.*";
  }
  const dot2 = value.indexOf(".", dot1 + 1);
  if (dot2 <= dot1 + 1) {
    return "*.*.*.*";
  }
  const dot3 = value.indexOf(".", dot2 + 1);
  if (dot3 <= dot2 + 1 || dot3 >= value.length - 1 || value.indexOf(".", dot3 + 1) >= 0) {
    return "*.*.*.*";
  }

  return sanitizeReplacement(`${value.slice(0, dot2)}.*.*`);
}

function maskPan(value: string): string {
  if (value.length <= 3) {
    return "*".repeat(value.length || 1);
  }
  const prefix = value.slice(0, 2);
  const suffix = value.slice(-1);
  const maskedMiddle = "*".repeat(value.length - 3);
  return sanitizeReplacement(`${prefix}${maskedMiddle}${suffix}`);
}

const PARTIAL_MASK_FORMATTERS: Readonly<Record<EntityType, (value: string) => string>> = {
  EMAIL: maskEmail,
  PHONE: maskPhone,
  CREDIT_CARD: maskCreditCard,
  AADHAAR: maskAadhaar,
  IPV4: maskIpv4,
  PAN: maskPan,
};

/**
 * Applies partial masking to a single validated entity type and value without allocating
 * temporary detection arrays or repeating full-document validation.
 */
export function maskEntityValuePartially(type: EntityType, value: string): string {
  return PARTIAL_MASK_FORMATTERS[type](value);
}

/**
 * Applies entity-specific partial masking to non-ignored detections while preserving
 * surrounding text and preventing CSV delimiter injection inside replacement strings.
 */
export function applyPartialMask(
  text: string,
  detections: readonly Detection[],
  ignoredIds: ReadonlySet<string> = new Set(),
): RedactionResult {
  const validated = validateRedactionInputs(text, detections, ignoredIds);
  const { sanitizedText, redactedCount, ignoredCount } = applyPositionReplacements(
    text,
    validated.sortedDetections,
    validated.ignoredIds,
    (detection) => maskEntityValuePartially(detection.type, detection.value),
  );

  return {
    mode: "PARTIAL",
    sanitizedText,
    redactedCount,
    ignoredCount,
  };
}
