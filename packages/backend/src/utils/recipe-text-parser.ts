import { AIGeneratedRecipe } from '@nommable/shared';
import { parseFraction } from './fraction-parser';

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const COMMON_UNITS = [
  'tablespoons', 'tablespoon', 'tbsp', 'tbsps', 'tbs',
  'teaspoons', 'teaspoon', 'tsp', 'tsps',
  'cups', 'cup', 'c',
  'Fluid Ounces', 'fluid ounces', 'fl oz', 'ounces', 'ounce', 'oz',
  'pounds', 'pound', 'lbs', 'lb',
  'kilograms', 'kilogram', 'kg',
  'grams', 'gram', 'g',
  'milliliters', 'milliliter', 'ml',
  'liters', 'liter', 'l',
  'quarts', 'quart', 'qt',
  'pints', 'pint', 'pt',
  'gallons', 'gallon', 'gal',
  'cloves', 'clove',
  'cans', 'can',
  'packages', 'package', 'pkg', 'pkgs',
  'packets', 'packet',
  'pinches', 'pinch',
  'dashes', 'dash',
  'slices', 'slice',
  'pieces', 'piece',
  'sticks', 'stick',
  'stalks', 'stalk',
  'heads', 'head',
  'bunches', 'bunch',
  'sprigs', 'sprig',
  'handfuls', 'handful',
  'bottles', 'bottle',
  'jars', 'jar',
  'boxes', 'box',
  'bags', 'bag',
  'medium', 'large', 'small',
];

const COOKING_VERBS = /^(?:preheat|heat|warm|melt|boil|simmer|bring|cook|bake|roast|broil|grill|fry|saute|sauté|sear|brown|mix|stir|whisk|beat|blend|combine|fold|toss|add|pour|transfer|place|set|arrange|spread|layer|top|sprinkle|season|garnish|serve|chop|dice|mince|slice|cut|peel|grate|drain|rinse|wash|pat|cover|uncover|remove|let|allow|cool|chill|refrigerate|freeze|marinate|knead|roll|shape|form|coat|dip|dredge|brush|grease|line|prepare|in a |meanwhile|once |when |after |using |to make )/i;

const NOISE_LINE_PATTERNS = [
  /^(?:(?:jump|skip)\s+to\s+recipe|print(?:\s+recipe)?|pin(?:\s+recipe|\s+it)?|save(?:\s+recipe)?|rate(?:\s+(?:this\s+)?recipe)?|share(?:\s+recipe)?|leave\s+a\s+(?:review|comment)|[\s|•·\-–/])+$/i,
  /^share(?:\s+on\s+\w+)?$/i,
  /^advertisement$/i,
  /^sponsored$/i,
  /^leave\s+a\s+(?:comment|reply|review)$/i,
  /^\d+(?:\.\d+)?\s*(?:out of\s*5\s*)?stars?(?:\s*\(\d+\s*(?:votes|reviews|ratings)\))?$/i,
  /^\d+(?:\.\d+)?\s+from\s+\d+\s+(?:votes|reviews|ratings)$/i,
  /^author\s*:/i,
  /^published\s*:/i,
  /^updated\s*:/i,
  /^us\s+customary\s*[-–|/]?\s*metric$/i,
  /^1x\s+2x\s+3x$/i,
  /^scale\s*:?\s*1x/i,
  /^cook\s+mode/i,
  /^prevent\s+your\s+screen\s+from\s+going\s+dark/i,
];

function normalizeText(raw: string): string {
  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&frac12;/gi, ' 1/2')
    .replace(/&frac14;/gi, ' 1/4')
    .replace(/&frac34;/gi, ' 3/4')
    .replace(/&frac13;/gi, ' 1/3')
    .replace(/&frac23;/gi, ' 2/3');

  // Replace unicode fractions with ASCII fractions, adding a space if preceded by a digit
  for (const [uni, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.replace(new RegExp(`(\\d)${uni}`, 'g'), `$1 ${ascii}`);
    text = text.replace(new RegExp(uni, 'g'), ascii);
  }

  return text;
}

function parseDurationMinutes(text: string, labelPattern: string): number | undefined {
  const regex = new RegExp(
    `(?:${labelPattern})\\s*(?:time)?\\s*[:\\n-]?\\s*(?:(\\d+)\\s*(?:hrs?|hours?)\\s*(?:and\\s*)?)?(?:(\\d+)\\s*(?:mins?|minutes?))?`,
    'i'
  );
  const match = text.match(regex);
  if (!match) return undefined;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  const total = hours * 60 + mins;
  return total > 0 ? total : undefined;
}

export function parseIngredientLine(
  rawLine: string,
  currentSection?: string
): {
  quantity?: number;
  unit?: string;
  name: string;
  notes?: string;
  section?: string;
} | null {
  // Strip bullets, checkboxes, markdown list markers
  let cleaned = rawLine
    .replace(/^[\s•*▪▫◦‣⁃\-–—▢☐☑✓✔✗✘+]+/, '')
    .replace(/^\[\s*[xX ]?\s*\]\s*/, '')
    .trim();

  if (!cleaned) return null;

  const notesParts: string[] = [];

  // Extract parenthetical notes like "(about 2 cups)" or "(15 oz)"
  cleaned = cleaned
    .replace(/\(([^)]+)\)/g, (_m, inner) => {
      notesParts.push(inner.trim());
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();

  // Match leading quantity (e.g., "1 1/2", "1/2", "2-3", "1.5", "2")
  const qtyRegex = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?(?:\s*[-–to]+\s*\d+(?:\.\d+)?)?)\s*(.*)$/i;
  const qtyMatch = cleaned.match(qtyRegex);

  let quantity: number | undefined;
  let remainder = cleaned;

  if (qtyMatch) {
    const rawQty = qtyMatch[1].trim();
    remainder = qtyMatch[2].trim();

    if (/[-–]|to/i.test(rawQty)) {
      const rangeParts = rawQty.split(/[-–]|to/i).map((p) => parseFraction(p.trim()));
      if (rangeParts[0] !== undefined && rangeParts[1] !== undefined) {
        quantity = Number(((rangeParts[0] + rangeParts[1]) / 2).toFixed(2));
      } else {
        quantity = rangeParts[0];
      }
    } else {
      quantity = parseFraction(rawQty);
    }
  } else if (/^(?:a|an)\s+(pinch|dash|handful|clove|slice|sprig|bunch|can|package|packet|stick)\b/i.test(cleaned)) {
    const aMatch = cleaned.match(/^(?:a|an)\s+(\w+)\s+(?:of\s+)?(.+)$/i);
    if (aMatch) {
      quantity = 1;
      return {
        quantity,
        unit: aMatch[1].toLowerCase(),
        name: aMatch[2].trim(),
        notes: notesParts.length > 0 ? notesParts.join(', ') : undefined,
        section: currentSection,
      };
    }
  }

  // Match unit at the start of remainder
  let unit: string | undefined;
  const unitSorted = [...COMMON_UNITS].sort((a, b) => b.length - a.length);
  for (const candidate of unitSorted) {
    const unitRegex = new RegExp(`^(${candidate})(?:\\.|\\b)\\s*(?:of\\s+)?(.*)$`, 'i');
    const uMatch = remainder.match(unitRegex);
    if (uMatch && uMatch[2].trim().length > 0) {
      unit = uMatch[1].toLowerCase();
      remainder = uMatch[2].trim();
      break;
    }
  }

  // Split trailing comma notes: e.g., "yellow onion, finely diced"
  const commaIdx = remainder.indexOf(',');
  let name = remainder;
  if (commaIdx > 1 && commaIdx < remainder.length - 1) {
    const beforeComma = remainder.slice(0, commaIdx).trim();
    const afterComma = remainder.slice(commaIdx + 1).trim();
    if (beforeComma.length > 1 && afterComma.length > 0) {
      name = beforeComma;
      notesParts.push(afterComma);
    }
  }

  name = name.replace(/^of\s+/i, '').trim();
  if (!name) return null;

  return {
    quantity,
    unit,
    name,
    notes: notesParts.length > 0 ? notesParts.join(', ') : undefined,
    section: currentSection,
  };
}

function isLikelyIngredientLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;

  // Starts with checkbox or bullet
  if (/^[•*▪▫◦‣⁃\-–—▢☐☑✓✔]/.test(trimmed)) {
    return true;
  }

  // Starts with number/fraction followed by a unit or short ingredient description
  if (/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+/.test(trimmed)) {
    // Make sure it's not a numbered instruction like "1. Preheat oven..."
    if (/^\d+[.)]\s+/.test(trimmed) && (COOKING_VERBS.test(trimmed.replace(/^\d+[.)]\s+/, '')) || trimmed.length > 75)) {
      return false;
    }
    return true;
  }

  if (/^(?:a|an|one|two|three)\s+(?:pinch|dash|handful|clove|cup|tbsp|tsp|tablespoon|teaspoon|can|bunch)\b/i.test(trimmed)) {
    return true;
  }

  if (/\b(?:to taste|for garnish|for serving|optional)\b$/i.test(trimmed) && trimmed.length < 60) {
    return true;
  }

  return false;
}

/**
 * Deterministic fallback recipe parser for unformatted or poorly formatted website/document text.
 */
export function parseRecipeFromTextHeuristic(rawText: string): AIGeneratedRecipe {
  const normalized = normalizeText(rawText);

  const prepTime = parseDurationMinutes(normalized, 'prep|preparation') || 15;
  const cookTime = parseDurationMinutes(normalized, 'cook|bake|cooking|roast|simmer') || 25;

  const servingsMatch = normalized.match(/(?:servings|serves|yield|makes)\s*[:\n-]?\s*(\d+)/i);
  const servings = servingsMatch ? parseInt(servingsMatch[1], 10) : 4;

  const caloriesMatch = normalized.match(/(?:calories|energy)\s*[:\n-]?\s*(\d+)\s*(?:kcal|cal)?/i);
  const proteinMatch = normalized.match(/protein\s*[:\n-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const carbsMatch = normalized.match(/(?:carbohydrates|carbs)\s*[:\n-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const fatMatch = normalized.match(/(?:fat|total fat)\s*[:\n-]?\s*(\d+(?:\.\d+)?)\s*g/i);

  const nutrition =
    caloriesMatch || proteinMatch || carbsMatch || fatMatch
      ? {
          calories: caloriesMatch ? parseInt(caloriesMatch[1], 10) : undefined,
          protein: proteinMatch ? parseFloat(proteinMatch[1]) : undefined,
          carbohydrates: carbsMatch ? parseFloat(carbsMatch[1]) : undefined,
          fat: fatMatch ? parseFloat(fatMatch[1]) : undefined,
        }
      : undefined;

  const rawLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Filter noise lines and metadata-only lines
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (NOISE_LINE_PATTERNS.some((rx) => rx.test(line))) continue;

    // Skip standalone metadata labels whose values were on the next line
    if (/^(?:prep\s*time|cook\s*time|total\s*time|additional\s*time|servings|yield|course|cuisine|keyword|calories)\s*:?$/i.test(line)) {
      if (i + 1 < rawLines.length && /^(\d+\s*(?:hrs?|hours?|mins?|minutes?|servings?|kcal|cal)?|\w+)$/i.test(rawLines[i + 1])) {
        i++; // skip the value line too
      }
      continue;
    }

    // Skip inline metadata lines like "Prep Time: 10 mins | Cook Time: 20 mins | Servings: 6" or "Makes 8 slices | Prep: 15 mins"
    if (
      /^(?:prep(?:\s*time)?|cook(?:\s*time)?|bake(?:\s*time)?|total(?:\s*time)?|servings|serves|yield|makes)\b(?:\s*[:|-]|\s+\d+)/i.test(line) &&
      line.length < 100
    ) {
      continue;
    }

    lines.push(line);
  }

  // Locate explicit section headers if present
  const ingHeaderRegex = /^#*\s*(?:ingredients|what\s+you(?:'ll|\s+will)?\s+need|shopping\s+list)\s*:?\s*$/i;
  const instHeaderRegex = /^#*\s*(?:instructions|directions|method|steps|preparation|how\s+to\s+make(?:\s+it)?)\s*:?\s*$/i;
  const stopHeaderRegex = /^#*\s*(?:recipe\s+notes|notes|chef'?s?\s+tips|tips|nutrition(?:\s+facts|\s+information)?|leave\s+a\s+comment|did\s+you\s+make\s+this)\s*:?\s*$/i;

  const ingHeaderIdx = lines.findIndex((l) => ingHeaderRegex.test(l));
  const instHeaderIdx = lines.findIndex((l, idx) => idx > ingHeaderIdx && instHeaderRegex.test(l));

  let title = 'Imported Recipe';
  let description = '';
  const ingredients: AIGeneratedRecipe['ingredients'] = [];
  const instructions: string[] = [];

  if (ingHeaderIdx !== -1 && instHeaderIdx !== -1) {
    // Header-based extraction
    const preLines = lines.slice(0, ingHeaderIdx);
    if (preLines.length > 0) {
      title = preLines[0].replace(/^#+\s*/, '').trim();
      if (preLines.length > 1) {
        description = preLines
          .slice(1)
          .filter((l) => l.length > 20)
          .slice(-2)
          .join(' ');
      }
    }

    const ingSectionLines = lines.slice(ingHeaderIdx + 1, instHeaderIdx);
    let currentSection: string | undefined;
    for (const line of ingSectionLines) {
      if (
        (line.endsWith(':') || /^for\s+the\s+/i.test(line)) &&
        !/^\d/.test(line) &&
        line.length < 55
      ) {
        currentSection = line.replace(/:$/, '').replace(/^#+\s*/, '').trim();
        continue;
      }
      const parsed = parseIngredientLine(line, currentSection);
      if (parsed) {
        ingredients.push(parsed);
      }
    }

    let stopIdx = lines.findIndex((l, idx) => idx > instHeaderIdx && stopHeaderRegex.test(l));
    if (stopIdx === -1) stopIdx = lines.length;

    const instSectionLines = lines.slice(instHeaderIdx + 1, stopIdx);
    for (const line of instSectionLines) {
      if (/^(?:step\s*\d+|\d+[.)]?)\s*:?$/i.test(line)) {
        continue; // Skip standalone "Step 1" header lines
      }
      const cleanedStep = line
        .replace(/^(?:step\s*\d+\s*[:.\-–]?\s*|\d+\s*[.):\-]\s*|[•*▪▫\-–—]\s*)/i, '')
        .trim();
      if (cleanedStep.length > 3) {
        instructions.push(cleanedStep);
      }
    }
  } else {
    // Unstructured / headerless text classification
    let cursor = 0;
    if (lines.length > 0) {
      title = lines[0].replace(/^#+\s*/, '').trim();
      cursor = 1;
    }

    let currentSection: string | undefined;
    const descCandidates: string[] = [];
    let seenIngredients = false;
    let inInstructions = false;

    for (let i = cursor; i < lines.length; i++) {
      const line = lines[i];

      if (stopHeaderRegex.test(line)) break;
      if (ingHeaderRegex.test(line)) {
        seenIngredients = true;
        inInstructions = false;
        continue;
      }
      if (instHeaderRegex.test(line)) {
        inInstructions = true;
        continue;
      }
      if (/^(?:step\s*\d+|\d+[.)]?)\s*:?$/i.test(line)) {
        inInstructions = true;
        continue;
      }

      if (!inInstructions && isLikelyIngredientLine(line)) {
        seenIngredients = true;
        const parsed = parseIngredientLine(line, currentSection);
        if (parsed) {
          ingredients.push(parsed);
          continue;
        }
      }

      if (
        !inInstructions &&
        seenIngredients &&
        (line.endsWith(':') || /^for\s+the\s+/i.test(line)) &&
        line.length < 50
      ) {
        currentSection = line.replace(/:$/, '').trim();
        continue;
      }

      if (seenIngredients || COOKING_VERBS.test(line) || /^\d+[.)]\s+/.test(line)) {
        inInstructions = true;
        const cleanedStep = line
          .replace(/^(?:step\s*\d+\s*[:.\-–]?\s*|\d+\s*[.):\-]\s*|[•*▪▫\-–—]\s*)/i, '')
          .trim();
        if (cleanedStep.length > 3) {
          instructions.push(cleanedStep);
        }
      } else if (!seenIngredients) {
        descCandidates.push(line);
      }
    }

    if (descCandidates.length > 0) {
      description = descCandidates.slice(0, 2).join(' ');
    }
  }

  // Final safety fallback if text was a single giant paragraph
  if (ingredients.length === 0 && instructions.length === 0 && lines.length > 1) {
    for (const line of lines.slice(1)) {
      const cleanedStep = line
        .replace(/^(?:step\s*\d+\s*[:.\-–]?\s*|\d+\s*[.):\-]\s*)/i, '')
        .trim();
      if (cleanedStep) instructions.push(cleanedStep);
    }
  }

  return {
    title: title.slice(0, 200) || 'Imported Recipe',
    description: description ? description.slice(0, 500) : '',
    servings,
    prepTime,
    cookTime,
    difficulty: 'medium',
    ingredients,
    instructions,
    tags: [],
    categories: [],
    nutrition,
  };
}

/**
 * Normalize raw JSON if a user still pastes a JSON recipe object into the text box.
 */
export function normalizeRawRecipeJson(raw: any): AIGeneratedRecipe {
  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients = rawIngredients
    .map((ing: any) => {
      if (typeof ing === 'string') {
        return parseIngredientLine(ing);
      }
      return {
        quantity: typeof ing.quantity === 'number' ? ing.quantity : parseFraction(ing.quantity),
        unit: ing.unit || undefined,
        name: ing.name || String(ing),
        notes: ing.notes || undefined,
        section: ing.section || undefined,
      };
    })
    .filter(Boolean) as AIGeneratedRecipe['ingredients'];

  const rawInstructions = Array.isArray(raw.instructions)
    ? raw.instructions
    : typeof raw.instructions === 'string'
    ? raw.instructions.split('\n')
    : [];

  const instructions = rawInstructions
    .map((step: any) => (typeof step === 'string' ? step : step?.text || ''))
    .map((s: string) => s.replace(/^(?:step\s*\d+\s*[:.\-–]?\s*|\d+\s*[.):\-]\s*)/i, '').trim())
    .filter(Boolean);

  return {
    title: raw.title || raw.name || 'Imported Recipe',
    description: raw.description || '',
    servings: Number(raw.servings) || 4,
    prepTime: Number(raw.prepTime) || 15,
    cookTime: Number(raw.cookTime) || 25,
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium',
    ingredients,
    instructions,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    nutrition: raw.nutrition,
  };
}
