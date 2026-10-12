/**
 * Converts a decimal number to a fraction string
 * Examples: 0.5 -> "1/2", 0.75 -> "3/4", 1.5 -> "1 1/2", 0.333 -> "1/3"
 */
export function decimalToFraction(decimal: number | undefined): string {
  if (decimal === undefined || decimal === null) return '';

  // Handle whole numbers
  if (Number.isInteger(decimal)) {
    return decimal.toString();
  }

  const wholePart = Math.floor(decimal);
  const decimalPart = decimal - wholePart;

  // Common fractions lookup table for better accuracy
  const commonFractions: { [key: string]: string } = {
    '0.125': '1/8',
    '0.25': '1/4',
    '0.333': '1/3',
    '0.375': '3/8',
    '0.5': '1/2',
    '0.625': '5/8',
    '0.666': '2/3',
    '0.667': '2/3',
    '0.75': '3/4',
    '0.875': '7/8',
  };

  // Round to 3 decimal places and check common fractions
  const roundedDecimal = decimalPart.toFixed(3);
  if (commonFractions[roundedDecimal]) {
    const fraction = commonFractions[roundedDecimal];
    return wholePart > 0 ? `${wholePart} ${fraction}` : fraction;
  }

  // Convert to fraction using GCD
  const tolerance = 1.0e-6;
  let numerator = 1;
  let denominator = 1;

  let x = decimalPart;
  while (Math.abs(x - Math.round(x)) > tolerance) {
    x *= 10;
    denominator *= 10;
  }
  numerator = Math.round(x);

  // Simplify fraction
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;

  // Limit denominator to reasonable values
  if (denominator > 16) {
    return decimal.toFixed(2);
  }

  const fractionStr = `${numerator}/${denominator}`;
  return wholePart > 0 ? `${wholePart} ${fractionStr}` : fractionStr;
}

/**
 * Converts a fraction string to a decimal number
 * Examples: "1/2" -> 0.5, "3/4" -> 0.75, "1 1/2" -> 1.5
 */
export function fractionToDecimal(fraction: string): number {
  if (!fraction || fraction.trim() === '') return 0;

  // Handle plain numbers
  if (!fraction.includes('/')) {
    return parseFloat(fraction) || 0;
  }

  // Handle mixed fractions (e.g., "1 1/2")
  const parts = fraction.trim().split(' ');
  let whole = 0;
  let fractionPart = fraction;

  if (parts.length === 2) {
    whole = parseFloat(parts[0]) || 0;
    fractionPart = parts[1];
  }

  // Parse fraction
  const [numerator, denominator] = fractionPart.split('/').map(s => parseFloat(s.trim()));

  if (!denominator || denominator === 0) {
    return whole || parseFloat(fraction) || 0;
  }

  return whole + (numerator / denominator);
}

/**
 * Format a quantity with unit for display, using fractions for non-weight measurements
 */
export function formatQuantity(quantity: number | undefined, unit: string | undefined): string {
  if (!quantity) return '';

  // Weight units should use decimals
  const weightUnits = ['g', 'kg', 'oz', 'lb', 'lbs', 'gram', 'grams', 'kilogram', 'kilograms', 'ounce', 'ounces', 'pound', 'pounds'];
  const isWeight = unit && weightUnits.some(w => unit.toLowerCase().includes(w));

  if (isWeight) {
    // For weights, show decimals but clean up trailing zeros
    return quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, '');
  }

  // For volume and count measurements, use fractions
  return decimalToFraction(quantity);
}
