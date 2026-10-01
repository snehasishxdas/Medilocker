import crypto from 'crypto';

/**
 * Generates a unique, non-guessable 9-digit MediLocker Unit ID.
 * Format: ML-XXX-XXX-XXX (where XXX are uppercase alphanumeric/numeric blocks)
 * Example: ML-842-195-730
 */
export function generateMediLockerId(): string {
  const randomNumbers: number[] = [];
  for (let i = 0; i < 9; i++) {
    randomNumbers.push(crypto.randomInt(0, 10));
  }

  const part1 = randomNumbers.slice(0, 3).join('');
  const part2 = randomNumbers.slice(3, 6).join('');
  const part3 = randomNumbers.slice(6, 9).join('');

  return `ML-${part1}-${part2}-${part3}`;
}
