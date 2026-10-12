import axios from 'axios';
import * as cheerio from 'cheerio';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { RecipeCreateDto } from '@nommable/shared';

const execAsync = promisify(exec);

export class ScraperService {
  async scrapeRecipe(url: string): Promise<Partial<RecipeCreateDto>> {
    // Try Python recipe-scrapers library first (supports 600+ sites)
    try {
      const pythonResult = await this.scrapWithPython(url);
      if (pythonResult) {
        return pythonResult;
      }
    } catch (error) {
      console.warn('Python scraper failed, falling back to cheerio:', error);
    }

    // Fallback to cheerio-based scraping
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Try to extract recipe data from JSON-LD schema first
      const jsonLd = this.extractJsonLd($);
      if (jsonLd) {
        return jsonLd;
      }

      // Try to get partial metadata from incomplete JSON-LD
      const partialJsonLd = this.extractPartialJsonLd($);

      // Fallback to manual scraping, merging any partial JSON-LD metadata
      const manual = this.manualScrape($, url);
      if (partialJsonLd) {
        return {
          ...manual,
          title: partialJsonLd.title || manual.title,
          description: partialJsonLd.description || manual.description,
          imageUrl: partialJsonLd.imageUrl || manual.imageUrl,
          prepTime: partialJsonLd.prepTime || manual.prepTime,
          cookTime: partialJsonLd.cookTime || manual.cookTime,
          servings: partialJsonLd.servings || manual.servings,
          nutrition: partialJsonLd.nutrition || manual.nutrition,
        };
      }
      return manual;
    } catch (error: any) {
      throw new Error(`Failed to scrape recipe: ${error.message}`);
    }
  }

  private async scrapWithPython(url: string): Promise<Partial<RecipeCreateDto> | null> {
    try {
      const scriptPath = path.join(__dirname, 'recipe_scraper.py');
      const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${url}"`, {
        timeout: 30000, // 30 second timeout
      });

      if (stderr) {
        console.warn('Python scraper stderr:', stderr);
      }

      const result = JSON.parse(stdout);

      if (!result.success) {
        throw new Error(result.error);
      }

      const data = result.data;

      // Transform Python scraper output to match our RecipeCreateDto
      return {
        title: data.title,
        description: data.description,
        servings: this.parseServings(data.servings),
        prepTime: data.prepTime || (data.totalTime ? Math.floor(data.totalTime / 2) : undefined),
        cookTime: data.cookTime || (data.totalTime ? Math.ceil(data.totalTime / 2) : undefined),
        imageUrl: data.imageUrl,
        sourceUrl: data.sourceUrl,
        instructions: data.instructions || [],
        ingredients: this.transformPythonIngredients(data.ingredients || []),
        categories: data.categories || [],
        tags: data.tags || [],
        nutrition: data.nutrition || undefined,
      };
    } catch (error: any) {
      // Return null to trigger fallback
      return null;
    }
  }

  private transformPythonIngredients(ingredients: string[]): any[] {
    return ingredients.map((ing, index) => {
      const parsed = this.parseIngredientString(ing);
      return { ...parsed, order: index };
    });
  }

  private extractJsonLd($: cheerio.CheerioAPI): Partial<RecipeCreateDto> | null {
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      try {
        const data = JSON.parse($(scripts[i]).html() || '');
        const recipe = this.findRecipeInJsonLd(data);

        if (recipe) {
          const instructions = this.parseInstructions(recipe.recipeInstructions);
          const ingredients = this.parseIngredients(recipe.recipeIngredient);

          // Skip incomplete JSON-LD (has Recipe type but missing key data)
          // so we fall through to manual scraping
          if (instructions.length === 0 && ingredients.length === 0) {
            continue;
          }

          return {
            title: recipe.name,
            description: recipe.description,
            servings: this.parseServings(recipe.recipeYield),
            prepTime: this.parseDuration(recipe.prepTime),
            cookTime: this.parseDuration(recipe.cookTime),
            imageUrl: this.extractImage(recipe.image),
            instructions,
            ingredients,
            categories: this.parseCategories(recipe.recipeCategory, recipe.recipeCuisine),
            tags: this.parseTags(recipe.keywords, recipe.suitableForDiet),
            nutrition: recipe.nutrition
              ? {
                  calories: this.parseCalories(recipe.nutrition.calories),
                  protein: this.parseNutrient(recipe.nutrition.proteinContent),
                  carbohydrates: this.parseNutrient(recipe.nutrition.carbohydrateContent),
                  fat: this.parseNutrient(recipe.nutrition.fatContent),
                  fiber: this.parseNutrient(recipe.nutrition.fiberContent),
                  sugar: this.parseNutrient(recipe.nutrition.sugarContent),
                  sodium: this.parseNutrient(recipe.nutrition.sodiumContent),
                }
              : undefined,
          };
        }
      } catch (e) {
        // Continue to next script tag
      }
    }

    return null;
  }

  private extractPartialJsonLd($: cheerio.CheerioAPI): Partial<RecipeCreateDto> | null {
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      try {
        const data = JSON.parse($(scripts[i]).html() || '');
        const recipe = this.findRecipeInJsonLd(data);
        if (recipe) {
          return {
            title: recipe.name,
            description: recipe.description,
            servings: this.parseServings(recipe.recipeYield),
            prepTime: this.parseDuration(recipe.prepTime),
            cookTime: this.parseDuration(recipe.cookTime),
            imageUrl: this.extractImage(recipe.image),
            nutrition: recipe.nutrition
              ? {
                  calories: this.parseCalories(recipe.nutrition.calories),
                  protein: this.parseNutrient(recipe.nutrition.proteinContent),
                  carbohydrates: this.parseNutrient(recipe.nutrition.carbohydrateContent),
                  fat: this.parseNutrient(recipe.nutrition.fatContent),
                  fiber: this.parseNutrient(recipe.nutrition.fiberContent),
                  sugar: this.parseNutrient(recipe.nutrition.sugarContent),
                  sodium: this.parseNutrient(recipe.nutrition.sodiumContent),
                }
              : undefined,
          };
        }
      } catch (e) {
        // Continue
      }
    }
    return null;
  }

  private findRecipeInJsonLd(data: any): any {
    if (!data) return null;
    // Direct Recipe type
    const typeStr = Array.isArray(data['@type']) ? data['@type'].join(' ') : data['@type'];
    if (typeStr === 'Recipe') return data;
    // Array of items
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findRecipeInJsonLd(item);
        if (found) return found;
      }
    }
    // @graph wrapper (WordPress/Yoast/WPRM pattern)
    if (data['@graph'] && Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        const found = this.findRecipeInJsonLd(item);
        if (found) return found;
      }
    }
    return null;
  }

  private manualScrape($: cheerio.CheerioAPI, sourceUrl: string): Partial<RecipeCreateDto> {
    const title =
      $('h1[itemprop="name"]').first().text() ||
      $('h1.recipe-title').first().text() ||
      $('h1').first().text() ||
      'Untitled Recipe';

    const description =
      $('[itemprop="description"]').first().text() ||
      $('.recipe-description').first().text() ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    const imageUrl =
      $('[itemprop="image"]').attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      '';

    // Try to extract ingredients and instructions from heading-based sections
    const ingredients = this.extractSectionContent($, [
      'ingredients',
    ]);
    const instructions = this.extractSectionContent($, [
      'directions',
      'instructions',
      'method',
      'steps',
      'preparation',
    ]);

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      imageUrl: imageUrl || undefined,
      sourceUrl,
      instructions: instructions.length > 0
        ? instructions
        : ['Manual entry required - could not auto-extract instructions'],
      ingredients: ingredients.length > 0
        ? ingredients.map((ing, index) => ({ ...this.parseIngredientString(ing), order: index }))
        : [{ name: 'Manual entry required - could not auto-extract ingredients', order: 0 }],
    };
  }

  /**
   * Extract text content from a section identified by a heading containing one of the keywords.
   * Collects list items or text paragraphs from sibling/child elements.
   */
  private extractSectionContent($: cheerio.CheerioAPI, keywords: string[]): string[] {
    const results: string[] = [];

    // Find headings (h1-h4) that match keywords
    $('h1, h2, h3, h4').each((_, el) => {
      if (results.length > 0) return; // Already found content

      const heading = $(el);
      const text = heading.text().toLowerCase().trim();
      if (!keywords.some(kw => text.includes(kw))) return;

      const headingLevel = parseInt(el.tagName.replace('h', ''), 10);

      // Collect sibling elements until the next heading of same/higher level
      let sibling = heading.next();
      while (sibling.length) {
        const tag = sibling.prop('tagName')?.toLowerCase() || '';

        // Stop at next heading of same or higher level
        if (/^h[1-6]$/.test(tag) && parseInt(tag.replace('h', ''), 10) <= headingLevel) {
          break;
        }

        // Extract list items from this element or any nested lists within it
        this.extractListItems($, sibling, results);

        sibling = sibling.next();
      }
    });

    return results;
  }

  /**
   * Recursively extract list items (li) from an element.
   * Handles direct ul/ol elements, or containers (article, div, section) wrapping lists.
   */
  private extractListItems(
    $: cheerio.CheerioAPI,
    el: cheerio.Cheerio<any>,
    results: string[]
  ): void {
    const tag = el.prop('tagName')?.toLowerCase() || '';

    // Direct list — extract li items
    if (tag === 'ul' || tag === 'ol') {
      el.children('li').each((_, li) => {
        const item = $(li).text().trim();
        if (item) results.push(item);
      });
      return;
    }

    // Container (article, div, section, etc.) — look for lists inside
    const nestedLists = el.find('ul, ol');
    if (nestedLists.length > 0) {
      nestedLists.each((_, list) => {
        $(list).children('li').each((_, li) => {
          const item = $(li).text().trim();
          if (item) results.push(item);
        });
      });
      return;
    }

    // No lists found — try to extract text content from paragraphs
    if (tag === 'p') {
      const content = el.text().trim();
      // Skip section sub-headers (short bold-only text like "Cane's Sauce:")
      if (content && !(el.children('strong, b').length > 0 && el.children().text().trim() === content)) {
        const lines = content.split(/\n/).map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
        results.push(...lines);
      }
    }
  }

  private parseServings(yield_: any): number | undefined {
    if (!yield_) return undefined;
    const str = String(yield_);
    // Try to extract number (handles "4", "4 servings", "Serves 4", "4-6", etc.)
    const match = str.match(/\d+/);
    const servings = match ? parseInt(match[0], 10) : undefined;
    // Only return if it's a reasonable number (1-100)
    return servings && servings > 0 && servings <= 100 ? servings : undefined;
  }

  private parseDuration(duration: string): number | undefined {
    if (!duration) return undefined;
    // Parse ISO 8601 duration (e.g., PT30M, PT1H30M)
    const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (isoMatch && (isoMatch[1] || isoMatch[2])) {
      const hours = parseInt(isoMatch[1] || '0', 10);
      const minutes = parseInt(isoMatch[2] || '0', 10);
      return hours * 60 + minutes;
    }
    // Parse human-readable formats (e.g., "1 hour, 30 minutes", "45 minutes")
    let total = 0;
    const hourMatch = duration.match(/(\d+)\s*hours?/i);
    const minMatch = duration.match(/(\d+)\s*min(?:ute)?s?/i);
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) total += parseInt(minMatch[1], 10);
    return total > 0 ? total : undefined;
  }

  private extractImage(image: any): string | undefined {
    if (!image) return undefined;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) {
      // Get the first image, recursively extract if it's an object
      return this.extractImage(image[0]);
    }
    if (typeof image === 'object') {
      // Try different property names
      if (image.url) return image.url;
      if (image.contentUrl) return image.contentUrl;
      if (image['@id']) return image['@id'];
    }
    return undefined;
  }

  private parseInstructions(instructions: any): string[] {
    if (!instructions) return [];
    if (typeof instructions === 'string') return [instructions];
    if (Array.isArray(instructions)) {
      const result: string[] = [];
      for (const inst of instructions) {
        if (typeof inst === 'string') {
          result.push(inst);
        } else if (inst['@type'] === 'HowToSection' && inst.itemListElement) {
          // HowToSection contains nested HowToStep items
          result.push(...this.parseInstructions(inst.itemListElement));
        } else if (inst.text) {
          result.push(inst.text);
        } else if (inst.itemListElement) {
          result.push(...this.parseInstructions(inst.itemListElement));
        }
      }
      return result.filter(Boolean);
    }
    return [];
  }

  private parseIngredients(ingredients: any): any[] {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) {
      return ingredients.map((ing, index) => {
        const parsed = this.parseIngredientString(String(ing));
        return { ...parsed, order: index };
      });
    }
    return [];
  }

  private parseIngredientString(str: string): any {
    // Enhanced ingredient parsing with fraction support
    const cleaned = str.trim();

    // Extract notes (text in parentheses)
    const notesMatch = cleaned.match(/\(([^)]+)\)/);
    const notes = notesMatch ? notesMatch[1] : undefined;
    const withoutNotes = cleaned.replace(/\([^)]+\)/g, '').trim();

    // Common units to look for
    const units = [
      'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
      'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g',
      'kilogram', 'kilograms', 'kg', 'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l',
      'pinch', 'dash', 'clove', 'cloves', 'can', 'cans', 'package', 'packages', 'pkg'
    ];

    // Try to match: quantity + unit + name
    // Supports fractions like "1/2", "1 1/2", decimals, and whole numbers
    const quantityPattern = '(\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+\\.\\d+|\\d+)?';
    const unitPattern = `\\s*(${units.join('|')})?`;
    const regex = new RegExp(`^${quantityPattern}${unitPattern}\\s*(.+)$`, 'i');
    const match = withoutNotes.match(regex);

    if (match) {
      const quantityStr = match[1];
      const unit = match[2];
      const name = match[3] || withoutNotes;

      let quantity: number | undefined;
      if (quantityStr) {
        // Handle mixed fractions (1 1/2)
        if (quantityStr.includes(' ') && quantityStr.includes('/')) {
          const parts = quantityStr.split(' ');
          const whole = parseFloat(parts[0]);
          const fractionParts = parts[1].split('/');
          const numerator = parseFloat(fractionParts[0]);
          const denominator = parseFloat(fractionParts[1]);
          quantity = whole + (numerator / denominator);
        }
        // Handle simple fractions (1/2)
        else if (quantityStr.includes('/')) {
          const fractionParts = quantityStr.split('/');
          const numerator = parseFloat(fractionParts[0]);
          const denominator = parseFloat(fractionParts[1]);
          quantity = numerator / denominator;
        }
        // Handle decimals and whole numbers
        else {
          quantity = parseFloat(quantityStr);
        }
      }

      return {
        quantity,
        unit: unit || undefined,
        name: name.trim(),
        notes,
      };
    }

    // Fallback: treat entire string as name
    return {
      name: withoutNotes,
      notes,
    };
  }

  private parseCalories(calories: string): number | undefined {
    if (!calories) return undefined;
    const match = String(calories).match(/\d+/);
    return match ? parseInt(match[0], 10) : undefined;
  }

  private parseNutrient(nutrient: string): number | undefined {
    if (!nutrient) return undefined;
    const match = String(nutrient).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private parseCategories(category: any, cuisine: any): string[] {
    const categories: string[] = [];

    if (category) {
      if (Array.isArray(category)) {
        categories.push(...category.flatMap((c: string) => c.split(',').map((s: string) => s.trim()).filter(Boolean)));
      } else if (typeof category === 'string') {
        categories.push(...category.split(',').map(s => s.trim()).filter(Boolean));
      }
    }

    if (cuisine) {
      if (Array.isArray(cuisine)) {
        categories.push(...cuisine.flatMap((c: string) => c.split(',').map((s: string) => s.trim()).filter(Boolean)));
      } else if (typeof cuisine === 'string') {
        categories.push(...cuisine.split(',').map(s => s.trim()).filter(Boolean));
      }
    }

    return categories.length > 0 ? categories : undefined as any;
  }

  private parseTags(keywords: any, suitableForDiet: any): string[] {
    const tags: string[] = [];

    // Parse keywords
    if (keywords) {
      if (typeof keywords === 'string') {
        tags.push(...keywords.split(',').map((k: string) => k.trim()));
      } else if (Array.isArray(keywords)) {
        tags.push(...keywords);
      }
    }

    // Parse diet restrictions and convert to standard tags
    if (suitableForDiet) {
      const diets = Array.isArray(suitableForDiet) ? suitableForDiet : [suitableForDiet];
      diets.forEach((diet: string) => {
        const dietStr = String(diet).toLowerCase();
        // Map schema.org diet types to our tag system
        if (dietStr.includes('vegetarian')) tags.push('Vegetarian');
        if (dietStr.includes('vegan')) tags.push('Vegan');
        if (dietStr.includes('glutenfree')) tags.push('Gluten-Free');
        if (dietStr.includes('dairyfree')) tags.push('Dairy-Free');
        if (dietStr.includes('lowcarb')) tags.push('Low-Carb');
        if (dietStr.includes('ketogenic')) tags.push('Keto');
      });
    }

    return tags.length > 0 ? tags : undefined as any;
  }
}
