/**
 * Realistic synthetic audit fixture demonstrating both positive detections
 * (Luhn-valid card, Verhoeff-valid Aadhaar, valid PAN, email variants, phones, IPv4s)
 * and false-positive rejection (invalid Luhn, invalid Verhoeff, unsupported PAN category, 999.1.1.1).
 */
export const SAMPLE_NOISY_DOCUMENT = [
  "CYLOCES Incident Review Log — 2026-11-27 (Order ORD-9876543210)",
  "",
  "Reporter: sunny@example.com (escalated from SUNNY@example.com)",
  "Primary contact: +91 98765 43210 | Domestic: 9876543210 | US Desk: +1 (415) 555-0199",
  "Source nodes: 192.168.1.10 and 10.0.0.1 (ignored malformed probe 999.1.1.1)",
  "",
  "KYC & Payment Verification:",
  "- Valid PAN: ABCPD1234F (unsupported category check: ABCDE1234F)",
  "- Verified Aadhaar: 2345 6789 0124 (checksum mismatch test: 2345 6789 0125)",
  "- Verified Visa Card: 4111 1111 1111 1111 (Luhn failure test: 5432 1098 7654 3211)",
  "",
  "Routine summary: No internal system tokens or server errors were recorded.",
].join("\n");
