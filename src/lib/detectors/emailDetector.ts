import type { Detection } from "../../types/detection";
import { assertValidInputText, createDetectionId, ENTITY_SEVERITY } from "./constants";

const EMAIL_CANDIDATE_PATTERN =
  /(?<![A-Za-z0-9.!#$%&'*+=?^_`{|}~@-])([A-Za-z0-9.!#$%&'*+=?^_`{|}~-]*@[A-Za-z0-9.@-]*)(?![A-Za-z0-9._@-])/g;

const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+=?^_`{|}~-]+$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9-]+$/;
const TLD_PATTERN = /^[A-Za-z]{2,24}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LABEL_LENGTH = 63;

function isValidLocalPart(localPart: string): boolean {
  if (localPart.length === 0 || localPart.length > MAX_LOCAL_LENGTH) {
    return false;
  }
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return false;
  }
  return LOCAL_PART_PATTERN.test(localPart);
}

function isValidDomain(domain: string): boolean {
  if (domain.length < 3 || domain.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  if (
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.startsWith("-") ||
    domain.endsWith("-") ||
    domain.includes("..")
  ) {
    return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) {
    return false;
  }

  for (const label of labels) {
    if (
      label.length === 0 ||
      label.length > MAX_DOMAIN_LABEL_LENGTH ||
      label.startsWith("-") ||
      label.endsWith("-") ||
      !DOMAIN_LABEL_PATTERN.test(label)
    ) {
      return false;
    }
  }

  const tld = labels[labels.length - 1];
  return tld !== undefined && TLD_PATTERN.test(tld);
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

  for (const match of text.matchAll(EMAIL_CANDIDATE_PATTERN)) {
    const rawCandidate = match[1];
    const start = match.index;
    if (rawCandidate === undefined || start === undefined) {
      continue;
    }

    const value = normalizeEmailToken(rawCandidate);
    if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) {
      continue;
    }

    const parts = value.split("@");
    if (parts.length !== 2) {
      continue;
    }

    const [localPart, domain] = parts;
    if (
      localPart === undefined ||
      domain === undefined ||
      !isValidLocalPart(localPart) ||
      !isValidDomain(domain)
    ) {
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
      reasons: [
        "RFC-lite email syntax matched.",
        "Local-part and domain boundaries validated.",
        "Valid top-level domain format.",
      ],
      severity: ENTITY_SEVERITY.EMAIL,
    });
  }

  return detections;
}
