/**
 * Parse a fraction or mixed number string into a decimal number
 * Handles formats like: "1/3", "2 1/2", "0.5", "1.5", "1/2 cup" (extracts just the fraction)
 */
export function parseFraction(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }

  // Clean the string - remove any unit text and trim
  let cleaned = value.toString().trim();

  // Extract just the number part (before any letters)
  const numericPart = cleaned.match(/^[\d\s./]+/);
  if (!numericPart) {
    return undefined;
  }
  cleaned = numericPart[0].trim();

  // Handle simple decimal numbers
  if (/^\d+\.?\d*$/.test(cleaned)) {
    return parseFloat(cleaned);
  }

  // Handle fractions (e.g., "1/3", "2/3")
  const fractionMatch = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator === 0) return undefined;
    return numerator / denominator;
  }

  // Handle mixed numbers (e.g., "2 1/2", "1 3/4")
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator === 0) return undefined;
    return whole + (numerator / denominator);
  }

  // If we can't parse it, return undefined
  return undefined;
}
