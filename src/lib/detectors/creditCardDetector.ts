import type { CardIssuer, Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";
import { isValidLuhn } from "./luhn";

const CARD_CANDIDATE_PATTERN = /(?<![\dA-Za-z+]|\d[ -])(?:\d[ -]?){12,18}\d(?![\dA-Za-z]|[ -]\d)/g;

const MIN_CARD_DIGITS = 13;
const MAX_CARD_DIGITS = 19;

const REASONS_BY_ISSUER: Readonly<Record<CardIssuer, readonly string[]>> = {
  VISA: Object.freeze([
    "Valid card-number length.",
    "Luhn checksum passed.",
    "Visa prefix and length recognized.",
  ]),
  MASTERCARD: Object.freeze([
    "Valid card-number length.",
    "Luhn checksum passed.",
    "Mastercard prefix and length recognized.",
  ]),
  AMEX: Object.freeze([
    "Valid card-number length.",
    "Luhn checksum passed.",
    "American Express prefix and length recognized.",
  ]),
  RUPAY: Object.freeze([
    "Valid card-number length.",
    "Luhn checksum passed.",
    "RuPay prefix and length recognized.",
  ]),
  UNKNOWN: Object.freeze([
    "Valid card-number length.",
    "Luhn checksum passed.",
    "Issuer prefix not in recognized set; classified as UNKNOWN.",
  ]),
};

function extractCardDigitsIfValid(candidate: string): string | null {
  let hasSeparator = false;
  let runLength = 0;
  let digits = "";

  for (let index = 0; index < candidate.length; index += 1) {
    const code = candidate.charCodeAt(index);
    if (code === 32 || code === 45) {
      if (runLength < 2) {
        return null;
      }
      if (!hasSeparator) {
        hasSeparator = true;
        digits = candidate.slice(0, index);
      }
      runLength = 0;
    } else {
      runLength += 1;
      if (hasSeparator) {
        digits += candidate.charAt(index);
      }
    }
  }

  if (hasSeparator && runLength < 2) {
    return null;
  }

  return hasSeparator ? digits : candidate;
}

/**
 * Classifies a validated digit-only payment card number into a supported issuer or UNKNOWN.
 */
export function classifyCardIssuer(digits: string): CardIssuer {
  const length = digits.length;
  const firstTwo = Number(digits.slice(0, 2));
  const firstThree = Number(digits.slice(0, 3));
  const firstFour = Number(digits.slice(0, 4));

  if (digits.startsWith("4") && (length === 13 || length === 16 || length === 19)) {
    return "VISA";
  }

  if ((digits.startsWith("34") || digits.startsWith("37")) && length === 15) {
    return "AMEX";
  }

  if (
    length === 16 &&
    ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720))
  ) {
    return "MASTERCARD";
  }

  if (
    length === 16 &&
    ((firstFour >= 6061 && firstFour <= 6085) ||
      firstFour === 6521 ||
      firstFour === 6522 ||
      (firstFour >= 5085 && firstFour <= 5089) ||
      firstTwo === 81 ||
      firstTwo === 82 ||
      firstThree === 353 ||
      firstThree === 356)
  ) {
    return "RUPAY";
  }

  return "UNKNOWN";
}

/**
 * Detects Luhn-valid payment card numbers (13-19 digits) with spaces or hyphens.
 */
export function detectCreditCards(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];
  CARD_CANDIDATE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = CARD_CANDIDATE_PATTERN.exec(text)) !== null) {
      const value = match[0];
      const start = match.index;
      const digits = extractCardDigitsIfValid(value);
      if (digits === null || digits.length < MIN_CARD_DIGITS || digits.length > MAX_CARD_DIGITS) {
        continue;
      }

      if (!isValidLuhn(digits)) {
        continue;
      }

      const issuer = classifyCardIssuer(digits);
      const confidence = issuer === "UNKNOWN" ? "medium" : "high";
      const end = start + value.length;

      detections.push({
        id: createDetectionId("CREDIT_CARD", start, end),
        type: "CREDIT_CARD",
        start,
        end,
        value,
        confidence,
        reasons: REASONS_BY_ISSUER[issuer],
        severity: ENTITY_SEVERITY.CREDIT_CARD,
      });
    }
  } finally {
    CARD_CANDIDATE_PATTERN.lastIndex = 0;
  }

  return detections;
}
