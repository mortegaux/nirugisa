import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { AppDataSource } from '../../db/data-source';
import { AIConfig } from '../../db/entities';
import { AIService } from '../../services/ai';
import { AppError } from '../middleware';

export class AIController {
  async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const aiConfigRepo = AppDataSource.getRepository(AIConfig);
      const config = await aiConfigRepo.findOne({ where: {} });

      if (!config) {
        return res.status(404).json({ error: 'AI configuration not found' });
      }

      // Don't send API key to client
      res.json({
        id: config.id,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
      });
    } catch (error) {
      next(error);
    }
  }

  async createConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { provider, apiKey, model, baseUrl, enabled } = req.body;

      const aiConfigRepo = AppDataSource.getRepository(AIConfig);

      // Check if config already exists
      const existing = await aiConfigRepo.findOne({ where: {} });

      if (existing) {
        throw new AppError(409, 'AI configuration already exists. Use PUT to update.');
      }

      // TODO: Encrypt API key before storing
      const config = aiConfigRepo.create({
        userId: req.userId!,
        provider,
        apiKey,
        model,
        baseUrl,
        enabled: enabled ?? true,
      });

      await aiConfigRepo.save(config);

      // Clear cache
      AIService.clearCache();

      res.status(201).json({
        id: config.id,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const aiConfigRepo = AppDataSource.getRepository(AIConfig);
      const config = await aiConfigRepo.findOne({ where: {} });

      if (!config) {
        throw new AppError(404, 'AI configuration not found');
      }

      const { provider, apiKey, model, baseUrl, enabled } = req.body;

      // Update provider
      if (provider !== undefined) {
        config.provider = provider;
      }

      // Update API key (only if provided, empty string means keep existing)
      if (apiKey !== undefined && apiKey !== '') {
        config.apiKey = apiKey; // TODO: Encrypt
      }

      // Update model (allow empty string to clear it, null/undefined means keep existing)
      if (model !== undefined) {
        config.model = model || null;
      }

      // Update baseUrl (allow empty string to clear it, null/undefined means keep existing)
      if (baseUrl !== undefined) {
        config.baseUrl = baseUrl || null;
      }

      // Update enabled flag
      if (enabled !== undefined) {
        config.enabled = enabled;
      }

      await aiConfigRepo.save(config);

      // Clear cache to force reload of provider
      AIService.clearCache();

      res.json({
        id: config.id,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
      });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await AIService.testConnection();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStatus(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const aiConfigRepo = AppDataSource.getRepository(AIConfig);
      const config = await aiConfigRepo.findOne({ where: {} });

      res.json({
        isConfigured: !!config,
        isEnabled: !!config?.enabled,
        provider: config?.provider ?? null,
      });
    } catch (error) {
      next(error);
    }
  }

  async substituteIngredient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = await AIService.getProvider();

      if (!provider) {
        return res.status(400).json({ error: 'AI provider not configured' });
      }

      const { ingredient, reason, recipeContext } = req.body;

      const substitutions = await provider.substituteIngredient(ingredient, reason, recipeContext);

      res.json({ substitutions });
    } catch (error) {
      next(error);
    }
  }
}
