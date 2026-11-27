import type { Detection, EntityType } from "../../types/detection";
import type { PseudonymMetadata, RedactionResult } from "../../types/redaction";
import { applyPositionReplacements, validateRedactionInputs } from "./shared";

const PSEUDONYM_PREFIXES: Readonly<Record<EntityType, string>> = {
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  CREDIT_CARD: "CARD",
  AADHAAR: "AADHAAR",
  PAN: "PAN",
  IPV4: "IPV4",
};

function createEmptyCountsByType(): Record<EntityType, number> {
  return {
    EMAIL: 0,
    PHONE: 0,
    CREDIT_CARD: 0,
    AADHAAR: 0,
    PAN: 0,
    IPV4: 0,
  };
}

function extractDigitsFast(value: string): string {
  let digits = "";
  let allDigits = true;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) {
      if (!allDigits) {
        digits += value.charAt(index);
      }
    } else if (allDigits) {
      allDigits = false;
      digits = value.slice(0, index);
    }
  }

  return allDigits ? value : digits;
}

function normalizeIpv4(value: string): string {
  const trimmed = value.trim();
  const dot1 = trimmed.indexOf(".");
  if (dot1 < 0) {
    return trimmed;
  }
  const dot2 = trimmed.indexOf(".", dot1 + 1);
  if (dot2 < 0) {
    return trimmed;
  }
  const dot3 = trimmed.indexOf(".", dot2 + 1);
  if (dot3 < 0 || trimmed.indexOf(".", dot3 + 1) >= 0) {
    return trimmed;
  }

  const o1 = Number(trimmed.slice(0, dot1));
  const o2 = Number(trimmed.slice(dot1 + 1, dot2));
  const o3 = Number(trimmed.slice(dot2 + 1, dot3));
  const o4 = Number(trimmed.slice(dot3 + 1));
  return `${o1}.${o2}.${o3}.${o4}`;
}

function normalizeEntityValue(type: EntityType, value: string): string {
  switch (type) {
    case "EMAIL":
      return value.trim().toLowerCase();
    case "PHONE":
    case "CREDIT_CARD":
    case "AADHAAR":
      return extractDigitsFast(value);
    case "PAN":
      return value.trim().toUpperCase();
    case "IPV4":
      return normalizeIpv4(value);
  }
}

/**
 * Replaces non-ignored detections with consistent session-local placeholders
 * (e.g., `EMAIL_01`, `CARD_01`) using independent per-type counters and normalized keys.
 */
export function applyPseudonymization(
  text: string,
  detections: readonly Detection[],
  ignoredIds: ReadonlySet<string> = new Set(),
): RedactionResult {
  const validated = validateRedactionInputs(text, detections, ignoredIds);

  const countsByType = createEmptyCountsByType();
  const entityMaps: Readonly<Record<EntityType, Map<string, string>>> = {
    EMAIL: new Map(),
    PHONE: new Map(),
    CREDIT_CARD: new Map(),
    AADHAAR: new Map(),
    PAN: new Map(),
    IPV4: new Map(),
  };
  const placeholderByDetectionId: Record<string, string> = {};
  let totalPlaceholders = 0;

  const { sanitizedText, redactedCount, ignoredCount } = applyPositionReplacements(
    text,
    validated.sortedDetections,
    validated.ignoredIds,
    (detection) => {
      const normalized = normalizeEntityValue(detection.type, detection.value);
      const typeMap = entityMaps[detection.type];
      let placeholder = typeMap.get(normalized);

      if (placeholder === undefined) {
        const nextCount = countsByType[detection.type] + 1;
        countsByType[detection.type] = nextCount;
        totalPlaceholders += 1;
        placeholder = `${PSEUDONYM_PREFIXES[detection.type]}_${String(nextCount).padStart(2, "0")}`;
        typeMap.set(normalized, placeholder);
      }

      placeholderByDetectionId[detection.id] = placeholder;
      return placeholder;
    },
  );

  const pseudonymMetadata: PseudonymMetadata = {
    totalPlaceholders,
    countsByType,
    placeholderByDetectionId,
  };

  return {
    mode: "PSEUDONYMIZE",
    sanitizedText,
    redactedCount,
    ignoredCount,
    pseudonymMetadata,
  };
}
