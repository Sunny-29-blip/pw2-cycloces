import type { Detection, EntityType } from "../../types/detection";
import type { RedactionResult } from "../../types/redaction";
import { FULL_MASK_PLACEHOLDER } from "./fullMask";
import { applyPositionReplacements, validateRedactionInputs } from "./shared";

const UNSAFE_CSV_CHARS = /[",]/g;
const DIGIT_PATTERN = /\d/;
const VISIBLE_TAIL_DIGITS = 4;

function sanitizeReplacement(value: string): string {
  return value.replace(UNSAFE_CSV_CHARS, "");
}

function maskEmail(value: string): string {
  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return FULL_MASK_PLACEHOLDER;
  }

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  const firstChar = localPart.charAt(0);
  return sanitizeReplacement(`${firstChar}***@${domain}`);
}

function maskPhone(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length <= VISIBLE_TAIL_DIGITS) {
    return "*".repeat(digitsOnly.length || VISIBLE_TAIL_DIGITS);
  }

  const digitsToMask = digitsOnly.length - VISIBLE_TAIL_DIGITS;
  let maskedDigits = 0;
  let result = "";

  for (const char of value) {
    if (DIGIT_PATTERN.test(char)) {
      if (maskedDigits < digitsToMask) {
        result += "*";
        maskedDigits += 1;
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return sanitizeReplacement(result);
}

function maskCreditCard(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < VISIBLE_TAIL_DIGITS) {
    return "XXXX";
  }
  return `XXXX-XXXX-XXXX-${digits.slice(-VISIBLE_TAIL_DIGITS)}`;
}

function maskAadhaar(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < VISIBLE_TAIL_DIGITS) {
    return "XXXX XXXX XXXX";
  }
  return `XXXX XXXX ${digits.slice(-VISIBLE_TAIL_DIGITS)}`;
}

function maskIpv4(value: string): string {
  const octets = value.split(".");
  if (octets.length !== 4 || !octets[0] || !octets[1]) {
    return "*.*.*.*";
  }
  return sanitizeReplacement(`${octets[0]}.${octets[1]}.*.*`);
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
    (detection) => PARTIAL_MASK_FORMATTERS[detection.type](detection.value),
  );

  return {
    mode: "PARTIAL",
    sanitizedText,
    redactedCount,
    ignoredCount,
  };
}
