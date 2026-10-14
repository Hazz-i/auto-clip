import type { Word, Chunk } from './types.js';

export interface ChunkerOptions {
  maxWords?: number;
  maxDuration?: number;
  maxGap?: number;
  punctuationRegex?: RegExp;
}

const DEFAULT_MAX_WORDS = 5;
const DEFAULT_MAX_DURATION = 2.5;
const DEFAULT_MAX_GAP = 0.8;
const DEFAULT_PUNCTUATION_REGEX = /[.?!]$/;

/**
 * Port of caption.py chunking logic:
 * - Max 5 words per chunk
 * - Max duration 2.5s
 * - Max gap between consecutive words 0.8s
 * - Split at sentence punctuation (. ? !)
 */
export function chunkWords(words: Word[], options: ChunkerOptions = {}): Chunk[] {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const maxDuration = options.maxDuration ?? DEFAULT_MAX_DURATION;
  const maxGap = options.maxGap ?? DEFAULT_MAX_GAP;
  const punctuationRegex = options.punctuationRegex ?? DEFAULT_PUNCTUATION_REGEX;

  if (!words || words.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let currentWords: Word[] = [];

  const flush = () => {
    if (currentWords.length === 0) return;
    const firstWord = currentWords[0];
    const lastWord = currentWords[currentWords.length - 1];
    if (!firstWord || !lastWord) return;

    const text = currentWords.map((w) => w.word.trim()).join(' ');
    const start = firstWord.start;
    const end = lastWord.end;
    chunks.push({
      words: [...currentWords],
      text,
      start,
      end,
    });
    currentWords = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    if (currentWords.length === 0) {
      currentWords.push(word);
      if (punctuationRegex.test(word.word.trim())) {
        flush();
      }
      continue;
    }

    const prevWord = currentWords[currentWords.length - 1];
    const firstWord = currentWords[0];
    if (!prevWord || !firstWord) {
      currentWords.push(word);
      continue;
    }

    const chunkStart = firstWord.start;
    const durationIfAdded = word.end - chunkStart;
    const gap = word.start - prevWord.end;

    const hitWordLimit = currentWords.length >= maxWords;
    const hitDurationLimit = durationIfAdded > maxDuration;
    const hitGapLimit = gap > maxGap;

    if (hitWordLimit || hitDurationLimit || hitGapLimit) {
      flush();
    }

    currentWords.push(word);

    if (punctuationRegex.test(word.word.trim())) {
      flush();
    }
  }

  flush();
  return chunks;
}

export interface RhythmChunkerOptions {
  maxChars?: number; // default: 42
  maxDuration?: number; // default: 3.5
  maxPause?: number; // default: 0.6
  punctuationRegex?: RegExp; // default: /[.?!]$/
}

/**
 * Rhythm-based subtitle cue chunking ported from auto-capt/main.py:
 * Closes current cue when ANY of the following occurs:
 * 1. Total characters > maxChars (42)
 * 2. Total duration > maxDuration (3.5s)
 * 3. Pause between words (next.start - prev.end) > maxPause (0.6s)
 * 4. Previous word ends with punctuation (. ? !) AND current cue duration > 1.0s
 */
export function chunkWordsByRhythm(
  words: Word[],
  options: RhythmChunkerOptions = {}
): Chunk[] {
  const maxChars = options.maxChars ?? 42;
  const maxDuration = options.maxDuration ?? 3.5;
  const maxPause = options.maxPause ?? 0.6;
  const punctuationRegex = options.punctuationRegex ?? /[.?!]$/;

  if (!words || words.length === 0) {
    return [];
  }

  const validWords = words.filter(
    (w) => w && typeof w.word === 'string' && w.word.trim().length > 0
  );
  if (validWords.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentCue: Word[] = [];

  for (let i = 0; i < validWords.length; i++) {
    const w = validWords[i]!;

    if (currentCue.length === 0) {
      currentCue.push(w);
      continue;
    }

    const firstWord = currentCue[0]!;
    const lastWord = currentCue[currentCue.length - 1]!;

    const startTime = firstWord.start;
    const duration = w.end - startTime;
    const pause = w.start - lastWord.end;

    // Total characters with spaces if w is appended to currentCue
    const currentChars = currentCue.reduce((sum, item) => sum + item.word.trim().length, 0);
    const chars = currentChars + currentCue.length + w.word.trim().length;

    const lastWordPunct = punctuationRegex.test(lastWord.word.trim());

    if (
      chars > maxChars ||
      duration > maxDuration ||
      pause > maxPause ||
      (lastWordPunct && duration > 1.0)
    ) {
      const text = currentCue.map((x) => x.word.trim()).join(' ');
      chunks.push({
        words: [...currentCue],
        text,
        start: firstWord.start,
        end: lastWord.end,
      });
      currentCue = [w];
    } else {
      currentCue.push(w);
    }
  }

  if (currentCue.length > 0) {
    const firstWord = currentCue[0]!;
    const lastWord = currentCue[currentCue.length - 1]!;
    const text = currentCue.map((x) => x.word.trim()).join(' ');
    chunks.push({
      words: [...currentCue],
      text,
      start: firstWord.start,
      end: lastWord.end,
    });
  }

  return chunks;
}
