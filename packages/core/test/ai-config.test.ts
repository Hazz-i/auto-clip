import { describe, expect, it } from 'bun:test';
import {
  validateNinerouterConfig,
  getNinerouterConfig,
  DEFAULT_NINEROUTER_CONFIG,
} from '../src/ai-config.js';

describe('ai-config', () => {
  it('validates config correctly', () => {
    const invalid = validateNinerouterConfig({});
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);

    const valid = validateNinerouterConfig({
      baseUrl: 'https://api.ninerouter.com/v1',
      apiKey: 'sk-test-123',
      chatModel: 'anthropic/claude-3-5-sonnet',
      sttModel: 'openai/whisper-large-v3',
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toEqual([]);
  });

  it('merges environment variables over default config', () => {
    const config = getNinerouterConfig({
      NINEROUTER_BASE_URL: 'https://custom.router.com/v1',
      NINEROUTER_API_KEY: 'test-key',
    });
    expect(config.baseUrl).toBe('https://custom.router.com/v1');
    expect(config.apiKey).toBe('test-key');
    expect(config.chatModel).toBe(DEFAULT_NINEROUTER_CONFIG.chatModel);
  });
});
