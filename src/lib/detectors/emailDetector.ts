import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";

const EMAIL_CANDIDATE_PATTERN =
  /(?<![A-Za-z0-9.!#$%&'*+=?^_`{|}~@-])([A-Za-z0-9.!#$%&'*+=?^_`{|}~-]*@[A-Za-z0-9.@-]*)(?![A-Za-z0-9._@-])/g;

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LABEL_LENGTH = 63;

const EMAIL_REASONS: readonly string[] = Object.freeze([
  "RFC-lite email syntax matched.",
  "Local-part and domain boundaries validated.",
  "Valid top-level domain format.",
]);

function isValidLocalPart(email: string, atIndex: number): boolean {
  if (atIndex <= 0 || atIndex > MAX_LOCAL_LENGTH) {
    return false;
  }
  if (email.charCodeAt(0) === 46 || email.charCodeAt(atIndex - 1) === 46) {
    return false;
  }

  let prevDot = false;
  for (let index = 0; index < atIndex; index += 1) {
    const code = email.charCodeAt(index);
    if (code === 46) {
      if (prevDot) {
        return false;
      }
      prevDot = true;
    } else {
      prevDot = false;
    }
  }
  return true;
}

function isValidDomain(email: string, domainStart: number, domainEnd: number): boolean {
  const domainLength = domainEnd - domainStart;
  if (domainLength < 3 || domainLength > MAX_EMAIL_LENGTH) {
    return false;
  }

  const firstCode = email.charCodeAt(domainStart);
  const lastCode = email.charCodeAt(domainEnd - 1);
  if (firstCode === 46 || lastCode === 46 || firstCode === 45 || lastCode === 45) {
    return false;
  }

  let labelCount = 0;
  let labelStart = domainStart;
  let labelHasOnlyLetters = true;

  for (let index = domainStart; index <= domainEnd; index += 1) {
    const isEnd = index === domainEnd;
    const code = isEnd ? 46 : email.charCodeAt(index);

    if (code === 46) {
      const labelLength = index - labelStart;
      if (
        labelLength === 0 ||
        labelLength > MAX_DOMAIN_LABEL_LENGTH ||
        email.charCodeAt(labelStart) === 45 ||
        email.charCodeAt(index - 1) === 45
      ) {
        return false;
      }
      labelCount += 1;
      if (isEnd) {
        return labelCount >= 2 && labelHasOnlyLetters && labelLength >= 2 && labelLength <= 24;
      }
      labelStart = index + 1;
      labelHasOnlyLetters = true;
      continue;
    }

    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (!isLetter) {
      labelHasOnlyLetters = false;
      const isDigitOrHyphen = (code >= 48 && code <= 57) || code === 45;
      if (!isDigitOrHyphen) {
        return false;
      }
    }
  }

  return false;
}

function normalizeEmailToken(rawValue: string): string {
  if (rawValue.endsWith(".") && !rawValue.endsWith("..")) {
    return rawValue.slice(0, -1);
  }
  return rawValue;
}

/**
 * Detects RFC-lite email addresses in text while rejecting malformed boundaries and domains.
 */
export function detectEmails(text: string): readonly Detection[] {
  assertValidInputText(text);
  if (text.length === 0) {
    return [];
  }

  const detections: Detection[] = [];
  EMAIL_CANDIDATE_PATTERN.lastIndex = 0;

  try {
    let match: RegExpExecArray | null;
    while ((match = EMAIL_CANDIDATE_PATTERN.exec(text)) !== null) {
      const rawCandidate = match[1];
      const start = match.index;
      if (rawCandidate === undefined) {
        continue;
      }

      const value = normalizeEmailToken(rawCandidate);
      if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) {
        continue;
      }

      const atIndex = value.indexOf("@");
      if (atIndex < 0 || value.indexOf("@", atIndex + 1) >= 0) {
        continue;
      }

      if (!isValidLocalPart(value, atIndex) || !isValidDomain(value, atIndex + 1, value.length)) {
        continue;
      }

      const end = start + value.length;
      detections.push({
        id: createDetectionId("EMAIL", start, end),
        type: "EMAIL",
        start,
        end,
        value,
        confidence: "high",
        reasons: EMAIL_REASONS,
        severity: ENTITY_SEVERITY.EMAIL,
      });
    }
  } finally {
    EMAIL_CANDIDATE_PATTERN.lastIndex = 0;
  }

  return detections;
}
