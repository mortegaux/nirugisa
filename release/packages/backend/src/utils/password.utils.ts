/**
 * Generate a random password with specified length
 * Password will contain uppercase, lowercase, numbers, and special characters
 */
export function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Generate username suggestions based on first name and last name
 */
export function generateUsernameSuggestions(
  firstName: string,
  lastName: string,
  existingUsernames: string[] = []
): string[] {
  const suggestions: string[] = [];
  const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Basic combinations
  const baseSuggestions = [
    `${first}.${last}`,
    `${first}${last}`,
    `${first}_${last}`,
    `${first}${last.charAt(0)}`,
    `${first.charAt(0)}${last}`,
  ];

  // Add base suggestions if they don't exist
  for (const suggestion of baseSuggestions) {
    if (!existingUsernames.includes(suggestion)) {
      suggestions.push(suggestion);
      if (suggestions.length >= 5) break;
    }
  }

  // If we need more suggestions, add numbered variants
  let counter = 1;
  while (suggestions.length < 5) {
    const numbered = `${first}.${last}${counter}`;
    if (!existingUsernames.includes(numbered)) {
      suggestions.push(numbered);
    }
    counter++;
  }

  return suggestions.slice(0, 5);
}
