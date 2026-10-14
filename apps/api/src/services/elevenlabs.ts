import { config } from "../config.ts";
import { normalizeTranscription } from "./ninerouter.ts";
import { chunkWordsByRhythm } from "@cliper/core";
import type { SpeechSegment, TranscriptResult, WordTiming } from "../types.ts";

export interface ElevenLabsTranscribeOptions {
  filename?: string;
  language?: string;
  model?: string;
  apiKey?: string;
  duration?: number;
  speechSegments?: SpeechSegment[];
}

/**
 * Normalizes ElevenLabs STT response:
 * 1. Filters tokens where type === "word" (drops "spacing", "audio_event", etc.)
 * 2. Normalizes {text, start, end} to WordTiming[]
 * 3. Chunks words via rhythm-based chunking (chunkWordsByRhythm)
 * 4. Falls back to linear/VAD chunker if words array is empty
 */
export function normalizeElevenLabsResponse(
  json: any,
  opts?: { duration?: number; speechSegments?: SpeechSegment[] }
): TranscriptResult {
  const rawWords: any[] = Array.isArray(json?.words) ? json.words : [];

  // Filter only type === "word" (tolerant if type is absent / undefined)
  const wordTokens = rawWords.filter((w: any) => {
    if (!w) return false;
    if (w.type !== undefined && w.type !== null && w.type !== "word") {
      return false;
    }
    const txt = String(w.text ?? w.word ?? "").trim();
    return txt.length > 0;
  });

  if (wordTokens.length > 0) {
    const words: WordTiming[] = wordTokens.map((w: any) => ({
      word: String(w.text ?? w.word ?? "").trim(),
      start: Number(w.start ?? w.start_time ?? 0),
      end: Number(w.end ?? w.end_time ?? w.start ?? 0),
    }));

    // Chunks using rhythm-based chunker
    const chunks = chunkWordsByRhythm(words);
    const fullText =
      typeof json?.text === "string" && json.text.trim().length > 0
        ? json.text.trim()
        : words.map((w) => w.word).join(" ");

    return {
      text: fullText,
      words,
      chunks,
      noTimestamps: false,
      speechSegments: opts?.speechSegments,
    };
  }

  // Fallback if words is empty -> use normalizeTranscription (linear duration / VAD speech segments)
  return normalizeTranscription(json, {
    duration: opts?.duration,
    speechSegments: opts?.speechSegments,
  });
}

/**
 * Direct ElevenLabs Scribe STT client (bypasses proxy for native word timestamps)
 */
export async function transcribeElevenLabs(
  file: Blob | Buffer | Uint8Array,
  opts?: ElevenLabsTranscribeOptions
): Promise<TranscriptResult> {
  const apiKey = (opts?.apiKey || config.elevenlabsApiKey || "").trim();
  if (!apiKey) {
    throw new Error("ElevenLabs API key is missing. Set ELEVENLABS_API_KEY in apps/api/.env");
  }

  const modelId = opts?.model || config.elevenlabsSttModel || "scribe_v2";
  const filename = opts?.filename || "audio.mp3";
  const mimeType = filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  const fileBlob = file instanceof Blob ? file : new Blob([file], { type: mimeType });

  const formData = new FormData();
  formData.append("file", fileBlob, filename);
  formData.append("model_id", modelId);

  if (opts?.language && opts.language.trim()) {
    formData.append("language_code", opts.language.trim());
  }

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    const first3Lines = errText
      .trim()
      .split("\n")
      .slice(0, 3)
      .join("\n");
    throw new Error(`ElevenLabs STT failed (${res.status}): ${first3Lines}`);
  }

  const json = (await res.json()) as any;
  return normalizeElevenLabsResponse(json, {
    duration: opts?.duration,
    speechSegments: opts?.speechSegments,
  });
}
