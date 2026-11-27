const DIGITS_ONLY_PATTERN = /^\d+$/;

const MULTIPLICATION_TABLE: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const PERMUTATION_TABLE: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates an ASCII digit string using the Verhoeff dihedral checksum algorithm.
 */
export function isValidVerhoeff(digits: string): boolean {
  if (!DIGITS_ONLY_PATTERN.test(digits)) {
    return false;
  }

  let checksum = 0;

  for (let offset = 0; offset < digits.length; offset += 1) {
    const digit = digits.charCodeAt(digits.length - 1 - offset) - 48;
    const permRow = PERMUTATION_TABLE[offset % 8];
    const multRow = MULTIPLICATION_TABLE[checksum];

    if (!permRow || !multRow) {
      return false;
    }

    const permuted = permRow[digit];
    if (permuted === undefined) {
      return false;
    }

    const nextChecksum = multRow[permuted];
    if (nextChecksum === undefined) {
      return false;
    }

    checksum = nextChecksum;
  }

  return checksum === 0;
}
