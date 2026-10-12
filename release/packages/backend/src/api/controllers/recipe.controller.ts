import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { RecipeService } from '../../services/recipe';
import { ScraperService } from '../../services/scraper';
import { AIService } from '../../services/ai';
import { RecipeCategorizerService } from '../../services/recipe/recipe-categorizer.service';
import { processImage } from '../../utils/image-processor';
import { parseFraction } from '../../utils/fraction-parser';
import { ImageInput } from '../../services/ai/types';

export class RecipeController {
  private recipeService = new RecipeService();
  private scraperService = new ScraperService();

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recipeData = req.body;

      // Parse ingredient quantities (handles fractions like "1/3", "2 1/2")
      if (recipeData.ingredients) {
        recipeData.ingredients = recipeData.ingredients.map((ing: any) => ({
          ...ing,
          quantity: parseFraction(ing.quantity),
        }));
      }

      // Auto-categorize if not already categorized
      if (!recipeData.categories || recipeData.categories.length === 0 || !recipeData.tags || recipeData.tags.length === 0) {
        const { categories, tags } = RecipeCategorizerService.autoCategorizRecipe(recipeData);
        if (!recipeData.categories || recipeData.categories.length === 0) {
          recipeData.categories = categories;
        }
        if (!recipeData.tags || recipeData.tags.length === 0) {
          recipeData.tags = tags;
        }
      }

      const recipe = await this.recipeService.create(req.userId!, recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recipes = await this.recipeService.findAll(req.query);
      res.json(recipes);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recipe = await this.recipeService.findById(req.params.id);
      res.json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recipeData = req.body;

      // Parse ingredient quantities (handles fractions like "1/3", "2 1/2")
      if (recipeData.ingredients) {
        recipeData.ingredients = recipeData.ingredients.map((ing: any) => ({
          ...ing,
          quantity: parseFraction(ing.quantity),
        }));
      }

      const recipe = await this.recipeService.update(req.params.id, recipeData);
      res.json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await this.recipeService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async importFromUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { url } = req.body;
      const scrapedData = await this.scraperService.scrapeRecipe(url);

      const recipe = await this.recipeService.create(req.userId!, {
        ...scrapedData,
        sourceUrl: url,
      } as any);
      res.status(201).json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async generateWithAI(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await AIService.getProvider();

      if (!provider) {
        return res.status(400).json({ error: 'AI provider not configured' });
      }

      const { prompt, ingredients, dietary, cuisine, servings } = req.body;

      const generatedRecipe = await provider.generateRecipe(prompt, {
        ingredients,
        dietary,
        cuisine,
        servings,
      });

      // Auto-categorize the AI-generated recipe if needed
      const { categories, tags } = RecipeCategorizerService.autoCategorizRecipe(generatedRecipe);

      const recipe = await this.recipeService.create(
        req.userId!,
        {
          ...generatedRecipe,
          categories: generatedRecipe.categories || categories,
          tags: generatedRecipe.tags || tags,
          ingredients: generatedRecipe.ingredients.map((ing, index) => ({
            ...ing,
            quantity: parseFraction(ing.quantity),
            order: index,
          })),
        } as any,
        true
      );

      res.status(201).json(recipe);
    } catch (error) {
      next(error);
    }
  }

  async enhanceWithAI(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await AIService.getProvider();

      if (!provider) {
        return res.status(400).json({ error: 'AI provider not configured' });
      }

      const recipe = await this.recipeService.findById(req.params.id);
      const { enhancementType } = req.body;

      const enhancement = await provider.enhanceRecipe(recipe, enhancementType);

      // Strip markdown code fences if the AI wrapped the JSON in them
      const cleaned = enhancement.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

      // Parse the AI response into the structured format the frontend expects
      try {
        const parsed = JSON.parse(cleaned);
        res.json(parsed);
      } catch {
        // Fallback: if the AI didn't return valid JSON, structure it ourselves
        if (enhancementType === 'improve_instructions') {
          const lines = enhancement.split('\n').map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
          res.json({ improvedInstructions: lines });
        } else if (enhancementType === 'add_tips') {
          const lines = enhancement.split('\n').map((l: string) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
          res.json({ tips: lines });
        } else if (enhancementType === 'optimize_ingredients') {
          const lines = enhancement.split('\n').filter((l: string) => l.trim());
          const optimizations = lines.map((line: string) => ({
            original: '',
            suggestion: line.replace(/^[-•*]\s*/, '').trim(),
            reason: '',
          }));
          res.json({ optimizations });
        } else {
          res.json({ enhancement });
        }
      }
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Generate URL for the uploaded image
      const imageUrl = `/uploads/recipes/${req.file.filename}`;

      // If recipe ID is provided, update the recipe with the image
      if (req.params.id) {
        const recipe = await this.recipeService.update(req.params.id, {
          imageUrl,
        });
        return res.json({ imageUrl, recipe });
      }

      // Otherwise, just return the image URL for use during recipe creation
      res.json({ imageUrl });
    } catch (error) {
      next(error);
    }
  }

  async extractFromImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await AIService.getProvider();

      if (!provider) {
        return res.status(400).json({ error: 'AI provider not configured. Please configure an AI provider in settings.' });
      }

      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const files = req.files as Express.Multer.File[];

      // Validate file count (max 5)
      if (files.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 files allowed' });
      }

      const images: ImageInput[] = [];

      // Process each file
      for (const file of files) {
        const mimeType = file.mimetype;

        // Handle image files only
        if (mimeType.startsWith('image/')) {
          // Skip canvas validation for HEIC/HEIF files as canvas doesn't support them
          // AI providers (Google, OpenAI, Anthropic) can handle HEIC directly
          if (mimeType === 'image/heic' || mimeType === 'image/heif' ||
              mimeType === 'image/heic-sequence' || mimeType === 'image/heif-sequence') {
            images.push({
              data: file.buffer,
              mimeType: 'image/jpeg', // Tell AI provider to treat as JPEG for best compatibility
            });
          } else {
            const processedImage = await processImage(file.buffer, mimeType);
            images.push({
              data: processedImage.data,
              mimeType: processedImage.mimeType,
            });
          }
        } else {
          return res.status(400).json({
            error: `Unsupported file type: ${mimeType}. Only image files are supported.`
          });
        }
      }

      // Extract recipe using AI vision
      const generatedRecipe = await provider.extractRecipeFromImages(images);

      // Auto-categorize the extracted recipe if needed
      const { categories, tags } = RecipeCategorizerService.autoCategorizRecipe(generatedRecipe);

      // Return the extracted recipe data for preview/editing
      // Don't save it yet - let the user review and edit first
      res.json({
        ...generatedRecipe,
        categories: generatedRecipe.categories || categories,
        tags: generatedRecipe.tags || tags,
        ingredients: generatedRecipe.ingredients?.map((ing, index) => ({
          ...ing,
          order: index,
        })) || [],
      });
    } catch (error: any) {
      // Check if it's an Ollama unsupported error
      if (error.message?.includes('not supported with Ollama')) {
        return res.status(400).json({
          error: 'Image-based recipe extraction requires OpenAI (GPT-4 Vision), Anthropic (Claude 3+), or Google (Gemini). Ollama does not support vision capabilities.',
        });
      }
      next(error);
    }
  }

  async detectIngredientsFromImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await AIService.getProvider();

      if (!provider) {
        return res.status(400).json({ error: 'AI provider not configured. Please configure an AI provider in settings.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const file = req.file;
      const mimeType = file.mimetype;

      // Handle image files only
      if (!mimeType.startsWith('image/')) {
        return res.status(400).json({
          error: `Unsupported file type: ${mimeType}. Only image files are supported.`
        });
      }

      // For HEIC/HEIF files, tell AI provider to treat as JPEG for best compatibility
      const effectiveMimeType = (mimeType === 'image/heic' || mimeType === 'image/heif' ||
                                  mimeType === 'image/heic-sequence' || mimeType === 'image/heif-sequence')
        ? 'image/jpeg'
        : mimeType;

      // Use the buffer directly from multer memory storage
      const ingredients = await provider.extractIngredientsFromImage({
        data: file.buffer,
        mimeType: effectiveMimeType,
      });

      res.json({ ingredients });
    } catch (error: any) {
      // Check if it's an Ollama unsupported error
      if (error.message?.includes('vision AI') || error.message?.includes('vision capabilities')) {
        return res.status(400).json({
          error: 'Ingredient detection requires vision AI (OpenAI, Anthropic, or Google). Ollama does not support vision capabilities.',
        });
      }
      next(error);
    }
  }

  async bulkDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No recipe IDs provided' });
      }

      const deletedCount = await this.recipeService.bulkDelete(ids);

      res.json({ deletedCount, message: `${deletedCount} recipe(s) deleted successfully` });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { ids, tags, categories } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No recipe IDs provided' });
      }

      if (!tags && !categories) {
        return res.status(400).json({ error: 'No updates provided (tags or categories)' });
      }

      const updatedCount = await this.recipeService.bulkUpdate(ids, { tags, categories });

      res.json({ updatedCount, message: `${updatedCount} recipe(s) updated successfully` });
    } catch (error) {
      next(error);
    }
  }
}
