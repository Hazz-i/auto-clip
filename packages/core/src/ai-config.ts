import type { NinerouterConfig } from './types.js';

export const DEFAULT_NINEROUTER_CONFIG: NinerouterConfig = {
  baseUrl: 'https://nine.hazz.biz.id/v1',
  apiKey: '',
  chatModel: 'anthropic/claude-3-5-sonnet-20241022',
  sttModel: 'el/scribe_v2',
};

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate NineRouter configuration values
 */
export function validateNinerouterConfig(config: Partial<NinerouterConfig>): ConfigValidationResult {
  const errors: string[] = [];

  if (!config.baseUrl || !config.baseUrl.trim()) {
    errors.push('baseUrl is required');
  } else if (!/^https?:\/\//i.test(config.baseUrl)) {
    errors.push('baseUrl must be a valid HTTP/HTTPS URL');
  }

  if (!config.apiKey || !config.apiKey.trim()) {
    errors.push('apiKey is required');
  }

  if (!config.chatModel || !config.chatModel.trim()) {
    errors.push('chatModel is required');
  }

  if (!config.sttModel || !config.sttModel.trim()) {
    errors.push('sttModel is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Resolve NineRouter config merging environment variables with defaults
 */
export function getNinerouterConfig(
  env: Record<string, string | undefined> = process.env
): NinerouterConfig {
  return {
    baseUrl: env.NINEROUTER_BASE_URL || DEFAULT_NINEROUTER_CONFIG.baseUrl,
    apiKey: env.NINEROUTER_API_KEY || DEFAULT_NINEROUTER_CONFIG.apiKey,
    chatModel: env.CHAT_MODEL || DEFAULT_NINEROUTER_CONFIG.chatModel,
    sttModel: env.STT_MODEL || DEFAULT_NINEROUTER_CONFIG.sttModel,
  };
}
