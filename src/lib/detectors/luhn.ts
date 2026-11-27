/**
 * Validates an ASCII digit string using the Luhn (mod-10) checksum algorithm.
 */
export function isValidLuhn(digits: string): boolean {
  if (digits.length < 2) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const digitRaw = digits.charCodeAt(index) - 48;
    if (digitRaw < 0 || digitRaw > 9) {
      return false;
    }

    let digit = digitRaw;
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
