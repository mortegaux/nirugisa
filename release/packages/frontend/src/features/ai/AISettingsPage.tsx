import { useState, useEffect } from 'react';
import { aiApi } from '@/services/api';
import type { AIProvider } from '@nommable/shared';

export default function AISettingsPage() {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await aiApi.getConfig();
      const config = response.data;
      setProvider(config.provider as AIProvider);
      setModel(config.model || '');
      setBaseUrl(config.baseUrl || '');
      setEnabled(config.enabled);
      setHasExisting(true);
      setApiKey(''); // Never load API key for security
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to load AI config:', error);
      }
      // Set defaults for new config
      setHasExisting(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle provider change - clear irrelevant fields
  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setMessage('');
    setTestResult(null);

    // Clear fields based on provider type
    if (newProvider === 'ollama') {
      // Ollama doesn't need API key
      setApiKey('');
    } else if (newProvider === 'none') {
      // Clear everything for none
      setApiKey('');
      setModel('');
      setBaseUrl('');
    } else {
      // Cloud providers don't need baseUrl
      setBaseUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setTestResult(null);
    setSaving(true);

    try {
      const configData = {
        provider,
        apiKey: apiKey || undefined,
        model: model.trim(), // Send empty string to clear, not undefined
        baseUrl: baseUrl.trim(), // Send empty string to clear, not undefined
        enabled,
      };

      if (hasExisting) {
        await aiApi.updateConfig(configData);
        setMessage('AI settings updated successfully');
      } else {
        await aiApi.createConfig(configData);
        setHasExisting(true);
        setMessage('AI settings created successfully');
      }

      // Reload config to ensure we have the latest state
      await loadConfig();
      setApiKey(''); // Clear API key field after saving
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save AI settings';
      setMessage(errorMsg);
      console.error('Failed to save AI config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage('');

    try {
      const response = await aiApi.testConnection();
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test connection. Make sure you have saved your settings first.',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading AI settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-foreground">AI Settings</h1>

      <div className="rounded-lg bg-card border border-border p-6 shadow-sm">
        <p className="mb-6 text-muted-foreground">
          Configure your AI provider to enable AI-powered features like recipe generation,
          meal plan suggestions, and ingredient substitutions.
        </p>

        {message && (
          <div
            className={`mb-4 rounded p-3 ${
              message.toLowerCase().includes('success')
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        {testResult && (
          <div
            className={`mb-4 rounded p-3 ${
              testResult.success
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {testResult.success ? '✓' : '✗'}
              </span>
              <div>
                <strong>{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</strong>
                <p className="mt-1 text-sm">{testResult.message}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-foreground mb-2">
              AI Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="google">Google AI (Gemini)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="none">None (Disable AI)</option>
            </select>
          </div>

          {provider !== 'none' && (
            <>
              {/* API Key for cloud providers */}
              {provider !== 'ollama' && (
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-foreground mb-2">
                    API Key {!hasExisting && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasExisting ? 'Leave blank to keep existing key' : 'Enter API key'}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required={!hasExisting}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasExisting
                      ? 'Leave blank to keep your existing API key'
                      : 'Your API key will be stored securely'}
                  </p>
                </div>
              )}

              {/* Model */}
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-foreground mb-2">
                  Model (Optional)
                </label>
                <input
                  id="model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'openai'
                      ? 'gpt-4-turbo-preview'
                      : provider === 'anthropic'
                        ? 'claude-3-5-sonnet-20241022'
                        : provider === 'google'
                          ? 'gemini-2.5-flash'
                          : 'llama2'
                  }
                  className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank to use default model for this provider
                </p>
              </div>

              {/* Base URL for Ollama */}
              {provider === 'ollama' && (
                <div>
                  <label htmlFor="baseUrl" className="block text-sm font-medium text-foreground mb-2">
                    Base URL <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="baseUrl"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter base URL only (e.g., http://localhost:11434). Do not include /api/generate
                  </p>
                </div>
              )}

              {/* Enable AI Features */}
              <div className="flex items-center">
                <input
                  id="enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="enabled" className="ml-2 text-sm font-medium text-foreground">
                  Enable AI Features
                </label>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-primary-foreground font-medium hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {hasExisting && provider !== 'none' && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </form>

        {/* Provider-specific help text */}
        {provider !== 'none' && (
          <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {provider === 'openai' && 'OpenAI Setup'}
              {provider === 'anthropic' && 'Anthropic Setup'}
              {provider === 'google' && 'Google AI Setup'}
              {provider === 'ollama' && 'Ollama Setup'}
            </h3>
            <div className="text-xs text-muted-foreground space-y-1">
              {provider === 'openai' && (
                <>
                  <p>Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.openai.com/api-keys</a></p>
                  <p>Recommended models: gpt-4-turbo-preview, gpt-3.5-turbo</p>
                </>
              )}
              {provider === 'anthropic' && (
                <>
                  <p>Get your API key from: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com/settings/keys</a></p>
                  <p>Recommended models: claude-3-5-sonnet-20241022, claude-3-opus-20240229</p>
                </>
              )}
              {provider === 'google' && (
                <>
                  <p>Get your API key from: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">makersuite.google.com/app/apikey</a></p>
                  <p>Current models (Jan 2026):</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li><strong>gemini-2.5-flash</strong> - Recommended (stable, fast)</li>
                    <li><strong>gemini-2.5-pro</strong> - Complex reasoning</li>
                    <li><strong>gemini-3-flash-preview</strong> - Latest fast model</li>
                    <li><strong>gemini-3-pro-preview</strong> - Latest advanced model</li>
                  </ul>
                  <p className="text-xs mt-1">Leave blank to use default (gemini-2.5-flash)</p>
                </>
              )}
              {provider === 'ollama' && (
                <>
                  <p>Make sure Ollama is running locally</p>
                  <p>Pull a model: <code className="bg-background px-1 py-0.5 rounded">ollama pull llama2</code></p>
                  <p>Available models: llama2, mistral, codellama, and more</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
