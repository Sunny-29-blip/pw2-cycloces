/**
 * Supported sensitive information categories detected locally in the browser.
 */
export type EntityType = "EMAIL" | "PHONE" | "IPV4" | "PAN" | "AADHAAR" | "CREDIT_CARD";

/**
 * Confidence classification derived strictly from executed format and validation checks.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Integer severity scale from 1 (lowest) to 5 (highest).
 */
export type SeverityScore = 1 | 2 | 3 | 4 | 5;

/**
 * Supported payment card issuer classifications.
 */
export type CardIssuer = "VISA" | "MASTERCARD" | "AMEX" | "RUPAY" | "UNKNOWN";

/**
 * Explainable, deterministic PII detection record aligned with JavaScript string indices.
 */
export interface Detection {
  readonly id: string;
  readonly type: EntityType;
  readonly start: number;
  readonly end: number;
  readonly value: string;
  readonly confidence: ConfidenceLevel;
  readonly reasons: readonly string[];
  readonly severity: SeverityScore;
}
