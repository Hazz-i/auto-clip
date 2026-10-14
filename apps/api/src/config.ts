import path from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { AiConfig } from "./types.ts";

export type SttProvider = "elevenlabs" | "proxy";

export interface AppConfig extends AiConfig {
  storage: string;
  port: number;
  uploadsDir: string;
  sttProvider: SttProvider;
  elevenlabsApiKey: string;
  elevenlabsSttModel: string;
}

const envPath = path.resolve(import.meta.dir, "../.env");

function resolveUploadsDir(): string {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir && envDir.trim()) {
    return path.isAbsolute(envDir)
      ? path.normalize(envDir)
      : path.resolve(import.meta.dir, envDir);
  }
  return path.resolve(import.meta.dir, "../../uploads");
}

const defaultSttProvider: SttProvider =
  process.env.STT_PROVIDER === "elevenlabs" || process.env.STT_PROVIDER === "proxy"
    ? process.env.STT_PROVIDER
    : process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0
    ? "elevenlabs"
    : "proxy";

export const config: AppConfig = {
  baseUrl: process.env.NINEROUTER_BASE_URL || "https://nine.hazz.biz.id/v1",
  apiKey: process.env.NINEROUTER_API_KEY || "",
  chatModel: process.env.NINEROUTER_CHAT_MODEL || "gpt-4o-mini",
  sttModel: process.env.NINEROUTER_STT_MODEL || "el/scribe_v2",
  storage: process.env.STORAGE || "local",
  port: Number(process.env.PORT) || 3000,
  uploadsDir: resolveUploadsDir(),
  sttProvider: defaultSttProvider,
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  elevenlabsSttModel: process.env.ELEVENLABS_STT_MODEL || "scribe_v2",
};

// Ensure uploads directory exists on config load
try {
  mkdirSync(config.uploadsDir, { recursive: true });
} catch {
  // ignore
}

export function validateConfig(): void {
  if (config.sttProvider === "proxy" && !config.apiKey) {
    console.warn("[WARN] NINEROUTER_API_KEY is empty. AI proxy calls may fail if proxy requires authentication.");
  }
  if (config.sttProvider === "elevenlabs" && !config.elevenlabsApiKey) {
    console.warn("[WARN] ELEVENLABS_API_KEY is empty. Direct ElevenLabs STT will fail without an API key.");
  }
  if (!config.baseUrl) {
    console.warn("[WARN] NINEROUTER_BASE_URL is empty. Falling back to default.");
  }
}

export interface AiConfigUpdates extends Partial<AiConfig> {
  sttProvider?: SttProvider;
  elevenlabsApiKey?: string;
  elevenlabsSttModel?: string;
}

export function updateAiConfig(updates: AiConfigUpdates): ReturnType<typeof getMaskedAiConfig> {
  if (updates.baseUrl !== undefined) config.baseUrl = updates.baseUrl;
  if (updates.apiKey !== undefined) config.apiKey = updates.apiKey;
  if (updates.chatModel !== undefined) config.chatModel = updates.chatModel;
  if (updates.sttModel !== undefined) config.sttModel = updates.sttModel;
  if (updates.sttProvider !== undefined) config.sttProvider = updates.sttProvider;
  if (updates.elevenlabsApiKey !== undefined) config.elevenlabsApiKey = updates.elevenlabsApiKey;
  if (updates.elevenlabsSttModel !== undefined) config.elevenlabsSttModel = updates.elevenlabsSttModel;

  if (process.env.NODE_ENV === "test") {
    return getMaskedAiConfig();
  }

  try {
    let envContent = "";
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, "utf-8");
    }
    const lines = envContent ? envContent.split("\n") : [];
    const setKey = (k: string, v: string) => {
      const idx = lines.findIndex((l) => l.startsWith(`${k}=`));
      if (idx >= 0) {
        lines[idx] = `${k}=${v}`;
      } else {
        lines.push(`${k}=${v}`);
      }
    };

    setKey("NINEROUTER_BASE_URL", config.baseUrl);
    if (config.apiKey) setKey("NINEROUTER_API_KEY", config.apiKey);
    setKey("NINEROUTER_CHAT_MODEL", config.chatModel);
    setKey("NINEROUTER_STT_MODEL", config.sttModel);
    setKey("STT_PROVIDER", config.sttProvider);
    if (config.elevenlabsApiKey) setKey("ELEVENLABS_API_KEY", config.elevenlabsApiKey);
    setKey("ELEVENLABS_STT_MODEL", config.elevenlabsSttModel);

    writeFileSync(envPath, lines.filter((l) => l.trim().length > 0).join("\n") + "\n");
  } catch (err) {
    console.warn("[WARN] Failed to write updated config to .env:", err);
  }

  return getMaskedAiConfig();
}

export function getMaskedAiConfig() {
  return {
    baseUrl: config.baseUrl,
    chatModel: config.chatModel,
    sttModel: config.sttModel,
    apiKeyConfigured: !!config.apiKey,
    apiKeyMasked: config.apiKey ? `***${config.apiKey.slice(-4)}` : "",
    sttProvider: config.sttProvider,
    elevenlabsApiKeyConfigured: !!config.elevenlabsApiKey,
    elevenlabsApiKeyMasked: config.elevenlabsApiKey ? `***${config.elevenlabsApiKey.slice(-4)}` : "",
    elevenlabsSttModel: config.elevenlabsSttModel,
  };
}
