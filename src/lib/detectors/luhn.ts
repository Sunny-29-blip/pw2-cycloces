const DIGITS_ONLY_PATTERN = /^\d+$/;

/**
 * Validates an ASCII digit string using the Luhn (mod-10) checksum algorithm.
 */
export function isValidLuhn(digits: string): boolean {
  if (!DIGITS_ONLY_PATTERN.test(digits) || digits.length < 2) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
