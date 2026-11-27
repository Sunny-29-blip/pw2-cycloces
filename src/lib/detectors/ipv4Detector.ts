import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";

const IPV4_CANDIDATE_PATTERN = /(?<![A-Za-z0-9.])(\d+(?:\.\d+)+)(?![A-Za-z0-9]|\.\d|\.[A-Za-z])/g;
const EXPECTED_OCTETS = 4;
const MAX_OCTET_VALUE = 255;

const IPV4_REASONS: readonly string[] = Object.freeze([
  "Four-octet dotted IPv4 structure matched.",
  "All four octets validated within 0-255 range.",
  "Token boundaries verified.",
]);

function isValidIpv4Address(candidate: string): boolean {
  let octetCount = 0;
  let octetLength = 0;
  let octetValue = 0;
  let startsWithZero = false;

  for (let index = 0; index <= candidate.length; index += 1) {
    const isEnd = index === candidate.length;
    const code = isEnd ? 46 : candidate.charCodeAt(index);

    if (code === 46) {
      if (
        octetLength === 0 ||
        octetLength > 3 ||
        (octetLength > 1 && startsWithZero) ||
        octetValue > MAX_OCTET_VALUE
      ) {
        return false;
      }
      octetCount += 1;
      if (octetCount > EXPECTED_OCTETS) {
        return false;
      }
      octetLength = 0;
      octetValue = 0;
      startsWithZero = false;
      continue;
    }

    const digit = code - 48;
    if (digit < 0 || digit > 9) {
      return false;
    }
    if (octetLength === 0) {
      startsWithZero = digit === 0;
    }
    octetLength += 1;
    if (octetLength > 3) {
      return false;
    }
    octetValue = octetValue * 10 + digit;
  }

  return octetCount === EXPECTED_OCTETS;
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
  IPV4_CANDIDATE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = IPV4_CANDIDATE_PATTERN.exec(text)) !== null) {
      const value = match[1];
      const start = match.index;
      if (value === undefined || !isValidIpv4Address(value)) {
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
        reasons: IPV4_REASONS,
        severity: ENTITY_SEVERITY.IPV4,
      });
    }
  } finally {
    IPV4_CANDIDATE_PATTERN.lastIndex = 0;
  }

  return detections;
}
