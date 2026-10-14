import { config } from "../config.ts";
import type { SpeechSegment, TranscriptResult, WordTiming } from "../types.ts";
import { chunkWords, type Word, type Chunk } from "@cliper/core";

export { chunkWords };

export interface TranscribeOptions {
  model?: string;
  language?: string;
  filename?: string;
  duration?: number;
  speechSegments?: SpeechSegment[];
}

export interface NormalizeOptions {
  duration?: number;
  speechSegments?: SpeechSegment[];
}

/**
 * Allocate words proportionally to speech segments weighted by character counts
 */
export function allocateTokensToSegments(
  tokens: string[],
  segments: SpeechSegment[]
): Array<{ segment: SpeechSegment; words: string[] }> {
  if (segments.length === 0) return [];
  if (segments.length === 1) {
    return [{ segment: segments[0]!, words: tokens }];
  }

  const tokenWeights = tokens.map((t) => Math.max(1, t.length));
  const totalChars = tokenWeights.reduce((a, b) => a + b, 0);

  const segmentDurations = segments.map((s) => Math.max(0.01, s.end - s.start));
  const totalDuration = segmentDurations.reduce((a, b) => a + b, 0);

  const result: Array<{ segment: SpeechSegment; words: string[] }> = [];
  let tokenIdx = 0;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]!;
    if (sIdx === segments.length - 1) {
      result.push({ segment: seg, words: tokens.slice(tokenIdx) });
      break;
    }

    const segmentsRemaining = segments.length - 1 - sIdx;
    const targetRatio = segmentDurations[sIdx]! / totalDuration;
    const targetChars = totalChars * targetRatio;

    let accumulatedChars = 0;
    const segWords: string[] = [];

    while (tokenIdx < tokens.length) {
      const remainingTokensCount = tokens.length - tokenIdx;
      if (segWords.length > 0 && remainingTokensCount <= segmentsRemaining) {
        break;
      }

      const word = tokens[tokenIdx]!;
      const wordWeight = tokenWeights[tokenIdx]!;

      if (segWords.length > 0 && accumulatedChars + wordWeight > targetChars) {
        const diffWithout = Math.abs(accumulatedChars - targetChars);
        const diffWith = Math.abs(accumulatedChars + wordWeight - targetChars);
        if (diffWithout <= diffWith) {
          break;
        }
      }

      segWords.push(word);
      accumulatedChars += wordWeight;
      tokenIdx++;

      if (accumulatedChars >= targetChars && remainingTokensCount > segmentsRemaining) {
        break;
      }
    }

    result.push({ segment: seg, words: segWords });
  }

  return result;
}

export function normalizeTranscription(data: any, opts?: NormalizeOptions): TranscriptResult {
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  let words: WordTiming[] = [];

  // Case 1: Words array (Whisper style: {word,start,end} OR ElevenLabs Scribe style: {text,start,end} OR ms timestamps)
  const rawWords = Array.isArray(data?.words)
    ? data.words
    : Array.isArray(data?.transcription?.words)
    ? data.transcription.words
    : null;

  if (rawWords && rawWords.length > 0) {
    words = rawWords
      .map((w: any) => {
        const wordText = String(w.word ?? w.text ?? "").trim();
        const isMs = typeof w.start_ms === "number" || typeof w.end_ms === "number";
        const rawStart = Number(w.start ?? w.start_time ?? w.start_ms ?? 0);
        const rawEnd = Number(w.end ?? w.end_time ?? w.end_ms ?? rawStart);
        const start = isMs ? Number((rawStart / 1000).toFixed(2)) : rawStart;
        const end = isMs ? Number((rawEnd / 1000).toFixed(2)) : rawEnd;
        return {
          word: wordText,
          start: isNaN(start) ? 0 : start,
          end: isNaN(end) ? (isNaN(start) ? 0 : start) : end,
        };
      })
      .filter((w: WordTiming) => w.word.length > 0);
  }
  // Case 2: Segments-based words (whisper / gpt-4o-transcribe segment structure)
  else if (Array.isArray(data?.segments) && data.segments.length > 0) {
    for (const seg of data.segments) {
      if (Array.isArray(seg.words) && seg.words.length > 0) {
        for (const w of seg.words) {
          const wordText = String(w.word ?? w.text ?? "").trim();
          if (wordText) {
            words.push({
              word: wordText,
              start: Number(w.start ?? seg.start ?? 0),
              end: Number(w.end ?? seg.end ?? 0),
            });
          }
        }
      } else {
        // Approximate timing from segment text when word-level timestamps omitted
        const segText = String(seg.text || "").trim();
        if (segText) {
          const segWords = segText.split(/\s+/).filter(Boolean);
          const segStart = Number(seg.start ?? 0);
          const segEnd = Number(seg.end ?? segStart + 1);
          const segDuration = Math.max(0.1, segEnd - segStart);
          const step = segDuration / segWords.length;

          segWords.forEach((word: string, i: number) => {
            words.push({
              word,
              start: Number((segStart + i * step).toFixed(2)),
              end: Number((segStart + (i + 1) * step).toFixed(2)),
            });
          });
        }
      }
    }
  }

  // If words present, chunk normally
  if (words.length > 0) {
    const chunks = chunkWords(words);
    return {
      text,
      words,
      chunks,
      noTimestamps: false,
      speechSegments: opts?.speechSegments,
    };
  }

  // Case 3: Fallback when words array is empty but text exists
  if (text) {
    const tokens = text.split(/\s+/).filter((w: string) => w.length > 0);
    if (tokens.length > 0) {
      let fallbackWords: WordTiming[] = [];

      // If speechSegments provided and non-empty, allocate words proportionally to segments
      if (opts?.speechSegments && opts.speechSegments.length > 0) {
        const allocated = allocateTokensToSegments(tokens, opts.speechSegments);
        for (const item of allocated) {
          const seg = item.segment;
          const wordsInSeg = item.words;
          if (wordsInSeg.length === 0) continue;

          const segDuration = Math.max(0.01, seg.end - seg.start);
          const step = segDuration / wordsInSeg.length;

          for (let k = 0; k < wordsInSeg.length; k++) {
            const word = wordsInSeg[k]!;
            const start = Number((seg.start + k * step).toFixed(2));
            const end = Number((seg.start + (k + 1) * step).toFixed(2));
            fallbackWords.push({ word, start, end });
          }
        }
      }

      // If speechSegments was empty or produced 0 words, fallback to full duration linear
      if (fallbackWords.length === 0) {
        const totalDuration =
          typeof opts?.duration === "number" && opts.duration > 0
            ? opts.duration
            : tokens.length * 0.4;
        const step = totalDuration / tokens.length;
        fallbackWords = tokens.map((token: string, i: number) => ({
          word: token,
          start: Number((i * step).toFixed(2)),
          end: Number(((i + 1) * step).toFixed(2)),
        }));
      }

      const chunks = chunkWords(fallbackWords);
      return {
        text,
        words: fallbackWords,
        chunks,
        noTimestamps: true,
        speechSegments: opts?.speechSegments,
      };
    }
  }

  // Safe fallback if data completely empty - do not crash
  return {
    text: "",
    words: [],
    chunks: [],
    noTimestamps: true,
    speechSegments: opts?.speechSegments,
  };
}

export async function transcribe(
  file: Blob | Buffer | Uint8Array,
  opts?: TranscribeOptions
): Promise<TranscriptResult> {
  const model = opts?.model || config.sttModel;
  const isElevenLabs = model.startsWith("el/");

  const formData = new FormData();
  const filename = opts?.filename || "audio.mp3";
  const mimeType = filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  const fileBlob = file instanceof Blob ? file : new Blob([file], { type: mimeType });
  formData.append("file", fileBlob, filename);
  formData.append("model", model);

  if (isElevenLabs) {
    formData.append("response_format", "json");
  } else {
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
  }

  if (opts?.language) {
    formData.append("language", opts.language);
  }

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ninerouter STT failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as any;
  return normalizeTranscription(json, {
    duration: opts?.duration,
    speechSegments: opts?.speechSegments,
  });
}

export async function chat(
  messages: Array<{ role: string; content: string }>,
  model?: string
): Promise<{ content: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || config.chatModel,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ninerouter chat failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { content };
}
