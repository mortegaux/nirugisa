import { aiApi } from '@/services/api';

export interface AIConfigStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  provider: string | null;
}

/**
 * Check if AI is properly configured and enabled
 */
export async function checkAIConfiguration(): Promise<AIConfigStatus> {
  try {
    const response = await aiApi.getStatus();
    return response.data;
  } catch {
    return {
      isConfigured: false,
      isEnabled: false,
      provider: null,
    };
  }
}
