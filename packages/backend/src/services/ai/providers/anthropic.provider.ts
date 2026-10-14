import Anthropic from '@anthropic-ai/sdk';
import { buildEnhancePrompts } from './enhance-prompts';
import { AIGeneratedRecipe, AISubstitutionSuggestion, ScannedPantryItem } from '@nommable/shared';
import {
  IAIProvider,
  RecipeGenerationOptions,
  MealPlanGenerationOptions,
  MealPlanSuggestion,
  ImageInput,
} from '../types';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = (model && model.trim()) || 'claude-3-5-sonnet-20241022';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      });

      if (response.content && response.content.length > 0) {
        return {
          success: true,
          message: `Successfully connected to Anthropic using model ${this.model}`,
        };
      }

      return {
        success: false,
        message: 'Unexpected response from Anthropic',
      };
    } catch (error: any) {
      if (error.status === 401) {
        return {
          success: false,
          message: 'Invalid API key',
        };
      }
      if (error.status === 404) {
        return {
          success: false,
          message: `Model "${this.model}" not found`,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to connect to Anthropic',
      };
    }
  }

  async generateRecipe(
    prompt: string,
    options?: RecipeGenerationOptions
  ): Promise<AIGeneratedRecipe> {
    const systemPrompt = `You are a professional chef and recipe creator. Generate detailed, practical recipes in JSON format only. Always respond with valid JSON.`;

    const userPrompt = this.buildRecipePrompt(prompt, options);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return JSON.parse(content.text);
  }

  async enhanceRecipe(recipe: any, enhancementType: string): Promise<string> {
    const { systemPrompt, userPrompt } = buildEnhancePrompts(recipe, enhancementType);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  }

  async substituteIngredient(
    ingredient: string,
    reason?: string,
    context?: string
  ): Promise<AISubstitutionSuggestion[]> {
    const systemPrompt = `You are a culinary expert. Provide ingredient substitution suggestions in JSON array format only.`;

    const userPrompt = `Suggest 3 substitutes for "${ingredient}"${reason ? ` (reason: ${reason})` : ''}${context ? ` in the context of: ${context}` : ''}. Return as JSON object with a "substitutions" array, where each item has: substitute, ratio, notes.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    const result = JSON.parse(content.text);
    return result.substitutions || [];
  }

  async generateMealPlan(options: MealPlanGenerationOptions): Promise<MealPlanSuggestion> {
    const systemPrompt = `You are a meal planning expert. Create balanced, varied meal plans in JSON format only.`;

    const userPrompt = `Create a ${options.days}-day meal plan for ${options.servings} servings per meal.
${options.dietary?.length ? `Dietary requirements: ${options.dietary.join(', ')}` : ''}
${options.cuisine?.length ? `Preferred cuisines: ${options.cuisine.join(', ')}` : ''}
${options.excludeIngredients?.length ? `Exclude: ${options.excludeIngredients.join(', ')}` : ''}
${options.budget ? `Budget: ${options.budget}` : ''}

Return a JSON object with a 'days' array, where each day has a 'date' and 'meals' array. Each meal should have 'mealType' (breakfast/lunch/dinner/snack) and 'recipeSuggestion' with title, description, and estimatedTime.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return JSON.parse(content.text);
  }

  async extractRecipeFromImages(images: ImageInput[]): Promise<AIGeneratedRecipe> {
    const systemPrompt = `You are a professional chef and recipe expert. Extract recipe information from images (screenshots, photos, or PDF pages) and return structured JSON data only. Always respond with valid JSON.`;

    const userPrompt = `Extract the complete recipe from the provided image(s). Look for:
- Recipe title
- Description/introduction
- Servings/yield
- Prep time and cook time (in minutes)
- Complete ingredients list with quantities, units, and names
- Step-by-step instructions
- Any notes, tips, or variations
- Dietary information or tags (vegetarian, gluten-free, etc.)
- Category/cuisine type

IMPORTANT: For instructions, extract ONLY the instruction text without any step numbers. For example, if the recipe shows "1. Preheat oven to 350°F", you should return "Preheat oven to 350°F" (without the "1."). The step numbers will be added automatically when displaying the recipe.

Return a JSON object with: title, description, servings, prepTime (minutes), cookTime (minutes), difficulty (easy/medium/hard), ingredients (array of {quantity, unit, name, notes, section}), instructions (array of strings - each string is the instruction text WITHOUT step numbers), tags (array), categories (array), and nutrition (object with calories, protein, carbohydrates, fat) if available.

If the recipe spans multiple images, combine all information into one complete recipe.`;

    // Convert images to Anthropic format
    const content: Array<any> = [];

    // Validate media types
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    for (const image of images) {
      const base64Data = (image.data instanceof Buffer
        ? image.data.toString('base64')
        : image.data) as string;

      const mediaType = validMediaTypes.includes(image.mimeType)
        ? image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        : 'image/jpeg';

      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    // Add text prompt after images
    content.push({
      type: 'text',
      text: userPrompt,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic Vision');
    }

    return JSON.parse(responseContent.text);
  }

  async extractRecipeFromText(rawText: string): Promise<AIGeneratedRecipe> {
    const systemPrompt = `You are a professional chef and recipe parser. Extract structured recipe information from raw, unformatted, or poorly formatted website/document text, ignoring ads, navigation menus, blog stories, and comments. Always respond with valid JSON only.`;

    const userPrompt = `Extract the complete recipe from the text below and return ONLY a JSON object with:
- title (string)
- description (concise 1-2 sentence summary)
- servings (number)
- prepTime (in minutes, number)
- cookTime (in minutes, number)
- difficulty ("easy" | "medium" | "hard")
- ingredients (array of { quantity (number, convert fractions like 1/2 to 0.5), unit (string), name (string), notes (string), section (string) })
- instructions (array of strings — each string is the instruction text WITHOUT leading step numbers like "1.")
- tags (array of strings)
- categories (array of strings)
- nutrition (object with calories, protein, carbohydrates, fat as numbers, if available)

Raw text:
${rawText}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    const cleaned = responseContent.text
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim();

    return JSON.parse(cleaned);
  }

  async extractIngredientsFromImage(image: ImageInput): Promise<string[]> {
    const systemPrompt = `You are a food recognition expert. Identify all edible ingredients visible in images. Always respond with valid JSON only.`;

    const userPrompt = `Analyze this image and identify all food ingredients visible. Return a JSON object with an "ingredients" array containing ingredient names as strings. Only include edible ingredients - ignore containers, equipment, packaging, and non-food items. Be specific (e.g., "red bell pepper" not just "pepper", "cherry tomatoes" not just "tomatoes").`;

    const base64Data = (image.data instanceof Buffer
      ? image.data.toString('base64')
      : image.data) as string;

    // Validate media type for Anthropic
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = validMediaTypes.includes(image.mimeType)
      ? image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      : 'image/jpeg'; // default fallback

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic Vision');
    }

    const result = JSON.parse(content.text);
    return result.ingredients || [];
  }

  async scanPantryFromImages(images: ImageInput[], locationHint?: string): Promise<ScannedPantryItem[]> {
    const systemPrompt = `You are a food recognition expert. Identify food and drink items visible in wide photos of pantry shelves, fridges, freezers, and other food storage. Always respond with valid JSON only.`;

    const userPrompt = `These ${images.length} photo(s) show food storage${locationHint ? ` (taken in the ${locationHint})` : ''} — wide shots of shelves / fridge / freezer, not one item per photo. Identify every distinct edible food or drink item visible across all photos.

For each item return: name (product name as printed on the label when readable, e.g. "Heinz Ketchup", "Whole Milk" — not generic "sauce"), quantity (count of visible units of that item, e.g. 2 if you see two cans), unit (the container type: "bottle", "can", "box", "bag", "jar", "carton", "item" — use "item" when unsure), category (exactly one of: "Spices & Seasonings", "Grains & Pasta", "Canned Goods", "Baking", "Oils & Vinegars", "Condiments", "Snacks", "Beverages", "Dairy", "Meat & Seafood", "Produce", "Frozen", "Other"), and confidence (0-1, how sure you are this item is really there).

Merge duplicates: the same product appearing in multiple photos is ONE item with summed quantity. Do not list the same product twice.
Only include edible food/drink items — ignore shelves, containers, equipment, appliances, and non-food items. Items partially hidden behind others still count if identifiable. If you cannot identify an item, leave it out rather than guessing.

Return a JSON object with an "items" array.`;

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const imageParts = images.map((image) => {
      const base64Data = (image.data instanceof Buffer
        ? image.data.toString('base64')
        : image.data) as string;
      const mediaType = validMediaTypes.includes(image.mimeType)
        ? image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        : 'image/jpeg';
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: base64Data },
      };
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [...imageParts, { type: 'text' as const, text: userPrompt }],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic Vision');
    }

    const result = JSON.parse(content.text);
    const items = (result.items || []) as ScannedPantryItem[];
    return items.filter((item) => item && typeof item.name === 'string' && item.name.trim());
  }

  private buildRecipePrompt(prompt: string, options?: RecipeGenerationOptions): string {
    let fullPrompt = `Generate a recipe for: ${prompt}\n\n`;

    if (options?.ingredients?.length) {
      fullPrompt += `Must use these ingredients: ${options.ingredients.join(', ')}\n`;
    }
    if (options?.dietary?.length) {
      fullPrompt += `Dietary requirements: ${options.dietary.join(', ')}\n`;
    }
    if (options?.cuisine) {
      fullPrompt += `Cuisine style: ${options.cuisine}\n`;
    }
    if (options?.servings) {
      fullPrompt += `Servings: ${options.servings}\n`;
    }

    fullPrompt += `\nReturn a JSON object with: title, description, servings, prepTime (minutes), cookTime (minutes), difficulty (easy/medium/hard), ingredients (array of {quantity, unit, name, notes, section}), instructions (array of strings), tags (array of relevant tags like "vegetarian", "quick", "healthy"), categories (array like "Breakfast", "Dinner", "Italian", "Dessert"), and nutrition (object with calories, protein, carbohydrates, fat).`;

    return fullPrompt;
  }
}
