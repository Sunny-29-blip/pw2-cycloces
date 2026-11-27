import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";

const IPV4_CANDIDATE_PATTERN = /(?<![A-Za-z0-9.])(\d+(?:\.\d+)+)(?![A-Za-z0-9]|\.\d|\.[A-Za-z])/g;
const DIGITS_ONLY_PATTERN = /^\d+$/;
const EXPECTED_OCTETS = 4;
const MAX_OCTET_VALUE = 255;

function isValidOctet(octet: string): boolean {
  if (octet.length === 0 || octet.length > 3 || !DIGITS_ONLY_PATTERN.test(octet)) {
    return false;
  }
  if (octet.length > 1 && octet.startsWith("0")) {
    return false;
  }
  const numericValue = Number(octet);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= MAX_OCTET_VALUE;
}

function isValidIpv4Address(candidate: string): boolean {
  const octets = candidate.split(".");
  if (octets.length !== EXPECTED_OCTETS) {
    return false;
  }
  return octets.every(isValidOctet);
}

/**
 * Detects four-octet IPv4 addresses with strict octet range and token-boundary validation.
 */
export function detectIpv4s(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];

  for (const match of text.matchAll(IPV4_CANDIDATE_PATTERN)) {
    const value = match[1];
    const start = match.index;
    if (value === undefined || start === undefined || !isValidIpv4Address(value)) {
      continue;
    }

    const end = start + value.length;
    detections.push({
      id: createDetectionId("IPV4", start, end),
      type: "IPV4",
      start,
      end,
      value,
      confidence: "high",
      reasons: [
        "Four-octet dotted IPv4 structure matched.",
        "All four octets validated within 0-255 range.",
        "Token boundaries verified.",
      ],
      severity: ENTITY_SEVERITY.IPV4,
    });
  }

  return detections;
}
