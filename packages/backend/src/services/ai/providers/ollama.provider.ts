import axios from 'axios';
import { buildEnhancePrompts } from './enhance-prompts';
import { AIGeneratedRecipe, AISubstitutionSuggestion, ScannedPantryItem } from '@nommable/shared';
import {
  IAIProvider,
  RecipeGenerationOptions,
  MealPlanGenerationOptions,
  MealPlanSuggestion,
  ImageInput,
} from '../types';

export class OllamaProvider implements IAIProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model?: string) {
    this.baseUrl = baseUrl;
    this.model = (model && model.trim()) || 'llama3.2';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test with a simple generation request
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: 'Hello',
          stream: false,
        },
        { timeout: 10000 }
      );

      if (response.data && response.data.response) {
        return {
          success: true,
          message: `Successfully connected to Ollama at ${this.baseUrl} using model ${this.model}`,
        };
      }

      return {
        success: false,
        message: 'Unexpected response format from Ollama',
      };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running.`,
        };
      }
      if (error.response?.status === 404) {
        return {
          success: false,
          message: `Model "${this.model}" not found. Pull it with: ollama pull ${this.model}`,
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to connect to Ollama',
      };
    }
  }

  async generateRecipe(
    prompt: string,
    options?: RecipeGenerationOptions
  ): Promise<AIGeneratedRecipe> {
    const systemPrompt = `You are a professional chef and recipe creator. Generate detailed, practical recipes in JSON format only. Always respond with valid JSON.`;
    const userPrompt = this.buildRecipePrompt(prompt, options);

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
      format: 'json',
    });

    const text = response.data.response;
    return JSON.parse(text);
  }

  async enhanceRecipe(recipe: any, enhancementType: string): Promise<string> {
    const { systemPrompt, userPrompt } = buildEnhancePrompts(recipe, enhancementType);

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
    });

    return response.data.response;
  }

  async substituteIngredient(
    ingredient: string,
    reason?: string,
    context?: string
  ): Promise<AISubstitutionSuggestion[]> {
    const prompt = `Suggest 3 substitutes for "${ingredient}"${reason ? ` (reason: ${reason})` : ''}${context ? ` in the context of: ${context}` : ''}. Return as JSON object with a "substitutions" array, where each item has: substitute, ratio, notes. Only return valid JSON.`;

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt,
      stream: false,
      format: 'json',
    });

    const result = JSON.parse(response.data.response);
    return result.substitutions || [];
  }

  async generateMealPlan(options: MealPlanGenerationOptions): Promise<MealPlanSuggestion> {
    const prompt = `Create a ${options.days}-day meal plan for ${options.servings} servings per meal.
${options.dietary?.length ? `Dietary requirements: ${options.dietary.join(', ')}` : ''}
${options.cuisine?.length ? `Preferred cuisines: ${options.cuisine.join(', ')}` : ''}
${options.excludeIngredients?.length ? `Exclude: ${options.excludeIngredients.join(', ')}` : ''}
${options.budget ? `Budget: ${options.budget}` : ''}

Return a JSON object with a 'days' array, where each day has a 'date' and 'meals' array. Each meal should have 'mealType' (breakfast/lunch/dinner/snack) and 'recipeSuggestion' with title, description, and estimatedTime. Only return valid JSON.`;

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt,
      stream: false,
      format: 'json',
    });

    return JSON.parse(response.data.response);
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

  async extractRecipeFromImages(_images: ImageInput[]): Promise<AIGeneratedRecipe> {
    throw new Error('Image-based recipe extraction is not supported with Ollama. Please use OpenAI (GPT-4 Vision), Anthropic (Claude 3+), or Google (Gemini) for this feature.');
  }

  async extractRecipeFromText(rawText: string): Promise<AIGeneratedRecipe> {
    const prompt = `You are a professional chef and recipe parser. Extract structured recipe information from the following raw, unformatted, or poorly formatted website/document text, ignoring ads, navigation menus, blog stories, and comments.

Return ONLY a valid JSON object with:
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

    const response = await axios.post(`${this.baseUrl}/api/generate`, {
      model: this.model,
      prompt,
      stream: false,
      format: 'json',
    });

    return JSON.parse(response.data.response);
  }

  async extractIngredientsFromImage(_image: ImageInput): Promise<string[]> {
    throw new Error('Ingredient detection requires vision AI (OpenAI, Anthropic, or Google). Ollama does not support vision capabilities.');
  }

  async scanPantryFromImages(_images: ImageInput[], _locationHint?: string): Promise<ScannedPantryItem[]> {
    throw new Error('Pantry photo scanning requires vision AI (OpenAI, Anthropic, or Google). Ollama does not support vision capabilities.');
  }
}
