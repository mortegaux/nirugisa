#!/usr/bin/env python3
"""
Recipe scraper using the recipe-scrapers library.
Supports 600+ cooking websites with automatic schema.org detection.
"""

import sys
import json
import re
from fractions import Fraction
from recipe_scrapers import scrape_me

def decimal_to_fraction(decimal_str):
    """
    Convert decimal number to fraction string using common cooking measurements.

    Examples:
        0.5 -> "1/2"
        0.125 -> "1/8"
        0.13 -> "1/8" (rounds to nearest common fraction)
        1.5 -> "1 1/2"
        0.333 -> "1/3"
        0.67 -> "2/3"
    """
    try:
        decimal = float(decimal_str)

        # Handle whole numbers
        if decimal == int(decimal):
            return str(int(decimal))

        # Common cooking fraction mappings for better readability
        # These handle cases where decimals are slightly off due to rounding
        common_fractions = [
            (1/8, "1/8"),
            (1/6, "1/6"),
            (1/4, "1/4"),
            (1/3, "1/3"),
            (3/8, "3/8"),
            (1/2, "1/2"),
            (5/8, "5/8"),
            (2/3, "2/3"),
            (3/4, "3/4"),
            (7/8, "7/8"),
        ]

        # Check if decimal is close to a common fraction (within 0.02 tolerance)
        for fraction_val, fraction_str in common_fractions:
            if abs(decimal - fraction_val) < 0.02:
                return fraction_str

        # Convert to fraction with max denominator of 16 (common in cooking)
        frac = Fraction(decimal).limit_denominator(16)

        # If it's a mixed number (greater than 1)
        if frac.numerator > frac.denominator:
            whole = frac.numerator // frac.denominator
            remainder = frac.numerator % frac.denominator
            if remainder == 0:
                return str(whole)

            # Check if the fractional part is a common fraction
            frac_part = Fraction(remainder, frac.denominator)
            frac_decimal = float(frac_part)

            for fraction_val, fraction_str in common_fractions:
                if abs(frac_decimal - fraction_val) < 0.02:
                    return f"{whole} {fraction_str}"

            return f"{whole} {remainder}/{frac.denominator}"

        # Simple fraction
        return f"{frac.numerator}/{frac.denominator}"
    except:
        return decimal_str

def clean_ingredient(ingredient):
    """
    Clean ingredient string by converting ALL decimals to fractions.

    Examples:
        "0.66666668653488 cup finely chopped yellow onion" -> "2/3 cup finely chopped yellow onion"
        "0.125 teaspoon salt" -> "1/8 teaspoon salt"
        "1.5 cups flour" -> "1 1/2 cups flour"
        "0.13 teaspoon pepper" -> "1/8 teaspoon pepper"
    """
    def replace_decimal(match):
        decimal_str = match.group(0)
        return decimal_to_fraction(decimal_str)

    # Pattern to match any decimal number (including those not at start)
    # Matches: 0.5, 1.25, 0.125, 0.333333, etc.
    pattern = r'\b\d+\.\d+\b'

    # Replace all decimal numbers with fractions
    result = re.sub(pattern, replace_decimal, ingredient)

    return result

def clean_instructions(instructions):
    """
    Clean instruction list by consolidating fragmented steps.

    Merges steps that are:
    - Continuations (start with lowercase)
    - Following an incomplete sentence
    - Very short fragments
    """
    cleaned = []

    for instruction in instructions:
        # Strip whitespace and skip empty lines
        text = instruction.strip()
        if not text:
            continue

        # Skip if it's just a number (step numbering artifacts)
        if text.isdigit():
            continue

        # Determine if this should be merged with the previous step
        should_merge = False

        if cleaned:
            prev_step = cleaned[-1].rstrip()

            # Merge if current step starts with lowercase (continuation of sentence)
            if text[0].islower():
                should_merge = True

            # Merge if previous step doesn't end with sentence-ending punctuation
            elif not prev_step.endswith(('.', '!', '?')):
                should_merge = True

            # Merge if this is a very short fragment (< 3 words)
            elif len(text.split()) < 3:
                should_merge = True

        if should_merge:
            # Add space between if needed
            if not cleaned[-1].endswith(' '):
                cleaned[-1] += ' '
            cleaned[-1] += text
        else:
            cleaned.append(text)

    return cleaned

def scrape_recipe(url):
    """
    Scrape recipe from URL and return structured data.

    Args:
        url: Recipe URL to scrape

    Returns:
        dict: Recipe data in standardized format
    """
    try:
        # Scrape recipe from URL (supports 606+ cooking websites)
        scraper = scrape_me(url)

        # Extract all available data
        raw_ingredients = scraper.ingredients()
        raw_instructions = scraper.instructions_list() if hasattr(scraper, 'instructions_list') else [scraper.instructions()]

        recipe_data = {
            'title': scraper.title(),
            'description': getattr(scraper, 'description', lambda: None)() or None,
            'totalTime': scraper.total_time() if hasattr(scraper, 'total_time') else None,
            'prepTime': None,  # Will be calculated from total time if needed
            'cookTime': None,
            'servings': scraper.yields() if hasattr(scraper, 'yields') else None,
            'imageUrl': scraper.image() if hasattr(scraper, 'image') else None,
            'ingredients': [clean_ingredient(ing) for ing in raw_ingredients],
            'instructions': clean_instructions(raw_instructions),
            'categories': [],
            'tags': [],
            'nutrition': {},
            'sourceUrl': url
        }

        # Extract nutrition if available
        try:
            nutrients = scraper.nutrients()
            if nutrients:
                recipe_data['nutrition'] = {
                    'calories': parse_number(nutrients.get('calories')),
                    'protein': parse_number(nutrients.get('proteinContent')),
                    'carbohydrates': parse_number(nutrients.get('carbohydrateContent')),
                    'fat': parse_number(nutrients.get('fatContent')),
                    'fiber': parse_number(nutrients.get('fiberContent')),
                    'sugar': parse_number(nutrients.get('sugarContent')),
                    'sodium': parse_number(nutrients.get('sodiumContent')),
                }
        except:
            pass

        # Try to get category/cuisine (may be comma-separated strings)
        try:
            category = scraper.category() if hasattr(scraper, 'category') else None
            if category:
                recipe_data['categories'].extend([c.strip() for c in category.split(',') if c.strip()])
        except:
            pass

        try:
            cuisine = scraper.cuisine() if hasattr(scraper, 'cuisine') else None
            if cuisine:
                recipe_data['categories'].extend([c.strip() for c in cuisine.split(',') if c.strip()])
        except:
            pass

        # Clean up None values
        recipe_data = {k: v for k, v in recipe_data.items() if v is not None and v != [] and v != {}}

        return {
            'success': True,
            'data': recipe_data
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'url': url
        }

def parse_number(value):
    """Parse numeric value from string, handling various formats."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    # Extract first number from string
    match = re.search(r'[\d.]+', str(value))
    return float(match.group()) if match else None

def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python recipe_scraper.py <url>'
        }))
        sys.exit(1)

    url = sys.argv[1]
    result = scrape_recipe(url)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # Exit with error code if scraping failed
    sys.exit(0 if result['success'] else 1)

if __name__ == '__main__':
    main()
