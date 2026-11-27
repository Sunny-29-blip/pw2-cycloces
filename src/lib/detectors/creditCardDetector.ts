import type { CardIssuer, Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";
import { isValidLuhn } from "./luhn";

const CARD_CANDIDATE_PATTERN = /(?<![\dA-Za-z+]|\d[ -])(?:\d[ -]?){12,18}\d(?![\dA-Za-z]|[ -]\d)/g;

const MIN_CARD_DIGITS = 13;
const MAX_CARD_DIGITS = 19;

const ISSUER_REASONS: Readonly<Record<CardIssuer, string>> = {
  VISA: "Visa prefix and length recognized.",
  MASTERCARD: "Mastercard prefix and length recognized.",
  AMEX: "American Express prefix and length recognized.",
  RUPAY: "RuPay prefix and length recognized.",
  UNKNOWN: "Issuer prefix not in recognized set; classified as UNKNOWN.",
};

function hasValidSeparatorGrouping(candidate: string): boolean {
  if (!candidate.includes(" ") && !candidate.includes("-")) {
    return true;
  }
  const chunks = candidate.split(/[ -]/);
  return chunks.every((chunk) => chunk.length >= 2);
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

  for (const match of text.matchAll(CARD_CANDIDATE_PATTERN)) {
    const value = match[0];
    const start = match.index;
    if (start === undefined || !hasValidSeparatorGrouping(value)) {
      continue;
    }

    const digits = value.replace(/[ -]/g, "");
    if (digits.length < MIN_CARD_DIGITS || digits.length > MAX_CARD_DIGITS) {
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
      reasons: ["Valid card-number length.", "Luhn checksum passed.", ISSUER_REASONS[issuer]],
      severity: ENTITY_SEVERITY.CREDIT_CARD,
    });
  }

  return detections;
}
