import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildEnhancePrompts } from './enhance-prompts';
import { AIGeneratedRecipe, AISubstitutionSuggestion } from '@nommable/shared';
import {
  IAIProvider,
  RecipeGenerationOptions,
  MealPlanGenerationOptions,
  MealPlanSuggestion,
  ImageInput,
} from '../types';

export class GoogleProvider implements IAIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash as default (stable, fast, cost-effective)
    // As of Jan 2026, available models:
    // - Gemini 3: gemini-3-flash-preview, gemini-3-pro-preview
    // - Gemini 2.5: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
    this.model = model || 'gemini-2.5-flash';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent('Hello');
      const response = await result.response;

      if (response.text()) {
        return {
          success: true,
          message: `Successfully connected to Google AI using model ${this.model}`,
        };
      }

      return {
        success: false,
        message: 'Unexpected response from Google AI',
      };
    } catch (error: any) {
      console.error('Google AI test error:', error);

      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        return {
          success: false,
          message: 'Invalid API key. Get a key from https://makersuite.google.com/app/apikey',
        };
      }

      if (error.message?.includes('models/') || error.status === 404) {
        return {
          success: false,
          message: `Model "${this.model}" not found. Available models: gemini-2.5-flash (recommended), gemini-2.5-pro, gemini-3-flash-preview, gemini-3-pro-preview`,
        };
      }

      if (error.message?.includes('PERMISSION_DENIED')) {
        return {
          success: false,
          message: 'Permission denied. Check your API key has access to Gemini models.',
        };
      }

      return {
        success: false,
        message: `Error: ${error.message || 'Failed to connect to Google AI'}`,
      };
    }
  }

  async generateRecipe(
    prompt: string,
    options?: RecipeGenerationOptions
  ): Promise<AIGeneratedRecipe> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const systemPrompt = `You are a professional chef and recipe creator. Generate detailed, practical recipes in JSON format only.`;
    const userPrompt = this.buildRecipePrompt(prompt, options);

    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    return JSON.parse(jsonText);
  }

  async enhanceRecipe(recipe: any, enhancementType: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const { systemPrompt, userPrompt } = buildEnhancePrompts(recipe, enhancementType);

    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const response = await result.response;
    return response.text();
  }

  async substituteIngredient(
    ingredient: string,
    reason?: string,
    context?: string
  ): Promise<AISubstitutionSuggestion[]> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const prompt = `Suggest 3 substitutes for "${ingredient}"${reason ? ` (reason: ${reason})` : ''}${context ? ` in the context of: ${context}` : ''}. Return as JSON object with a "substitutions" array, where each item has: substitute, ratio, notes. Only return valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const parsed = JSON.parse(jsonText);
    return parsed.substitutions || [];
  }

  async generateMealPlan(options: MealPlanGenerationOptions): Promise<MealPlanSuggestion> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const prompt = `Create a ${options.days}-day meal plan for ${options.servings} servings per meal.
${options.dietary?.length ? `Dietary requirements: ${options.dietary.join(', ')}` : ''}
${options.cuisine?.length ? `Preferred cuisines: ${options.cuisine.join(', ')}` : ''}
${options.excludeIngredients?.length ? `Exclude: ${options.excludeIngredients.join(', ')}` : ''}
${options.budget ? `Budget: ${options.budget}` : ''}

Return a JSON object with a 'days' array, where each day has a 'date' and 'meals' array. Each meal should have 'mealType' (breakfast/lunch/dinner/snack) and 'recipeSuggestion' with title, description, and estimatedTime. Only return valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    return JSON.parse(jsonText);
  }

  async extractRecipeFromImages(images: ImageInput[]): Promise<AIGeneratedRecipe> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const prompt = `Extract the complete recipe from the provided image(s). Look for:
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

Return ONLY a JSON object with: title, description, servings, prepTime (minutes), cookTime (minutes), difficulty (easy/medium/hard), ingredients (array of {quantity, unit, name, notes, section}), instructions (array of strings - each string is the instruction text WITHOUT step numbers), tags (array), categories (array), and nutrition (object with calories, protein, carbohydrates, fat) if available.

If the recipe spans multiple images, combine all information into one complete recipe.`;

    // Convert images to Gemini format
    const parts: Array<any> = [{ text: prompt }];

    for (const image of images) {
      // Ensure data is a string (base64)
      const base64Data = (image.data instanceof Buffer
        ? image.data.toString('base64')
        : image.data) as string;

      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: base64Data,
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    return JSON.parse(jsonText);
  }

  async extractIngredientsFromImage(image: ImageInput): Promise<string[]> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const prompt = `Analyze this image and identify all food ingredients visible. Return a JSON object with an "ingredients" array containing ingredient names as strings. Only include edible ingredients - ignore containers, equipment, packaging, and non-food items. Be specific (e.g., "red bell pepper" not just "pepper", "cherry tomatoes" not just "tomatoes"). Only return valid JSON.`;

    // Ensure data is a string (base64)
    const base64Data = (image.data instanceof Buffer
      ? image.data.toString('base64')
      : image.data) as string;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: base64Data,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const parsed = JSON.parse(jsonText);
    return parsed.ingredients || [];
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

    fullPrompt += `\nReturn ONLY a JSON object with: title, description, servings, prepTime (minutes), cookTime (minutes), difficulty (easy/medium/hard), ingredients (array of {quantity, unit, name, notes, section}), instructions (array of strings), tags (array of relevant tags like "vegetarian", "quick", "healthy"), categories (array like "Breakfast", "Dinner", "Italian", "Dessert"), and nutrition (object with calories, protein, carbohydrates, fat).`;

    return fullPrompt;
  }
}
