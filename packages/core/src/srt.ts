import type { Chunk, Word } from './types.js';

/**
 * Format seconds into SRT timestamp string: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Build standard SRT string from array of chunks
 */
export function chunksToSrt(chunks: Chunk[]): string {
  if (!chunks || chunks.length === 0) return '';

  return (
    chunks
      .map((chunk, index) => {
        const idx = index + 1;
        const start = formatSrtTimestamp(chunk.start);
        const end = formatSrtTimestamp(chunk.end);
        return `${idx}\n${start} --> ${end}\n${chunk.text}`;
      })
      .join('\n\n') + '\n'
  );
}

/**
 * Parse Whisper / STT words_json into normalized Word[] array.
 * Supports:
 * - Array of words: [{ word: '...', start: 0, end: 1 }]
 * - Whisper verbose JSON: { words: [...] }
 * - Whisper segments JSON: { segments: [{ words: [...] }] }
 */
export function parseWordsJson(input: string | unknown): Word[] {
  let data: any = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(`Failed to parse words JSON: ${(e as Error).message}`);
    }
  }

  let rawList: any[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.words)) {
      rawList = data.words;
    } else if (Array.isArray(data.segments)) {
      rawList = data.segments.flatMap((s: any) => (Array.isArray(s.words) ? s.words : []));
    }
  }

  return rawList
    .map((item: any): Word => ({
      word: String(item.word ?? item.text ?? '').trim(),
      start: Number(item.start ?? 0),
      end: Number(item.end ?? item.start ?? 0),
      score:
        typeof item.score === 'number'
          ? item.score
          : typeof item.confidence === 'number'
            ? item.confidence
            : undefined,
    }))
    .filter((w) => w.word.length > 0 && !isNaN(w.start) && !isNaN(w.end));
}
