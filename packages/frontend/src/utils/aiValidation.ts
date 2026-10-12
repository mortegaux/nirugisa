import { aiApi } from '@/services/api';

export interface AIConfigStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  provider: string | null;
  /**
   * False when the status check itself failed at the network level
   * (server unreachable, timeout, connection refused). Distinct from
   * "reachable but not configured" — callers should show a retry
   * message instead of the "AI Not Configured" prompt.
   */
  isReachable: boolean;
}

/**
 * Check if AI is properly configured and enabled.
 * Network failures are reported separately via `isReachable: false`
 * so callers don't mislead with "AI Not Configured" when the backend
 * simply can't be reached.
 */
export async function checkAIConfiguration(): Promise<AIConfigStatus> {
  try {
    const response = await aiApi.getStatus();
    return { ...response.data, isReachable: true };
  } catch (error: any) {
    const isNetworkError =
      !error?.response || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
    return {
      isConfigured: false,
      isEnabled: false,
      provider: null,
      isReachable: !isNetworkError,
    };
  }
}

/**
 * Copy for the AI-unavailable prompt. Callers already rendering
 * <AIConfigAlert> can pass the result straight through:
 *
 *   const status = await checkAIConfiguration();
 *   if (!status.isConfigured || !status.isEnabled) {
 *     setAiAlertMessage(aiUnavailableMessage(status));
 *     setShowAIConfigAlert(true);
 *     return;
 *   }
 *   // <AIConfigAlert onClose={...} message={aiAlertMessage} />
 */
export function aiUnavailableMessage(status: AIConfigStatus): string {
  if (!status.isReachable) {
    return "Couldn't reach the AI service. Check your connection and try again — your work is saved.";
  }
  return 'AI features require configuration before they can be used.';
}
