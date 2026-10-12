import { AIProvider } from '@nommable/shared';
import { AppDataSource } from '../../db/data-source';
import { AIConfig } from '../../db/entities';
import { config } from '../../config';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { IAIProvider } from './types';

export class AIService {
  private static providerCache: Map<string, IAIProvider> = new Map();

  static async getProvider(): Promise<IAIProvider | null> {
    // Check cache first
    const cacheKey = 'global';
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    // Get AI config
    const aiConfigRepo = AppDataSource.getRepository(AIConfig);
    const aiConfig = await aiConfigRepo.findOne({
      where: { enabled: true },
    });

    if (!aiConfig) {
      return null;
    }

    const provider = this.createProvider(aiConfig);
    if (provider) {
      this.providerCache.set(cacheKey, provider);
    }

    return provider;
  }

  private static createProvider(aiConfig: AIConfig): IAIProvider | null {
    const provider = aiConfig.provider as AIProvider;

    switch (provider) {
      case 'openai':
        const openaiKey = aiConfig.apiKey || config.ai.openai.apiKey;
        if (!openaiKey) return null;
        return new OpenAIProvider(openaiKey, aiConfig.model || undefined);

      case 'anthropic':
        const anthropicKey = aiConfig.apiKey || config.ai.anthropic.apiKey;
        if (!anthropicKey) return null;
        return new AnthropicProvider(anthropicKey, aiConfig.model || undefined);

      case 'google':
        const googleKey = aiConfig.apiKey || config.ai.google.apiKey;
        if (!googleKey) return null;
        return new GoogleProvider(googleKey, aiConfig.model || undefined);

      case 'ollama':
        const ollamaUrl = aiConfig.baseUrl || config.ai.ollama.baseUrl;
        return new OllamaProvider(ollamaUrl, aiConfig.model || undefined);

      default:
        return null;
    }
  }

  static clearCache() {
    this.providerCache.delete('global');
  }

  static async testConnection(): Promise<{ success: boolean; message: string }> {
    const provider = await this.getProvider();

    if (!provider) {
      return {
        success: false,
        message: 'No AI provider configured. Please configure an AI provider in settings.',
      };
    }

    try {
      return await provider.testConnection();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to test connection',
      };
    }
  }
}
