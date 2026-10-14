import { describe, expect, it } from 'bun:test';
import { chunkWords, chunkWordsByRhythm } from '../src/chunker.js';
import type { Word } from '../src/types.js';

describe('chunker', () => {
  it('returns empty array for empty words input', () => {
    expect(chunkWords([])).toEqual([]);
  });

  it('splits when words count reaches maxWords (5)', () => {
    const words: Word[] = [
      { word: 'satu', start: 0.0, end: 0.2 },
      { word: 'dua', start: 0.3, end: 0.5 },
      { word: 'tiga', start: 0.6, end: 0.8 },
      { word: 'empat', start: 0.9, end: 1.1 },
      { word: 'lima', start: 1.2, end: 1.4 },
      { word: 'enam', start: 1.5, end: 1.7 },
      { word: 'tujuh', start: 1.8, end: 2.0 },
    ];

    const chunks = chunkWords(words, { maxWords: 5 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].words.length).toBe(5);
    expect(chunks[0].text).toBe('satu dua tiga empat lima');
    expect(chunks[0].start).toBe(0.0);
    expect(chunks[0].end).toBe(1.4);

    expect(chunks[1].words.length).toBe(2);
    expect(chunks[1].text).toBe('enam tujuh');
    expect(chunks[1].start).toBe(1.5);
    expect(chunks[1].end).toBe(2.0);
  });

  it('splits when chunk duration exceeds maxDuration (2.5s)', () => {
    const words: Word[] = [
      { word: 'halo', start: 0.0, end: 1.0 },
      { word: 'semua', start: 1.2, end: 2.7 }, // duration from 0.0 to 2.7 is 2.7s > 2.5s
    ];

    const chunks = chunkWords(words, { maxDuration: 2.5 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toBe('halo');
    expect(chunks[1].text).toBe('semua');
  });

  it('splits when gap between words exceeds maxGap (0.8s)', () => {
    const words: Word[] = [
      { word: 'halo', start: 0.0, end: 0.5 },
      { word: 'kawan', start: 1.5, end: 1.9 }, // gap is 1.5 - 0.5 = 1.0s > 0.8s
    ];

    const chunks = chunkWords(words, { maxGap: 0.8 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toBe('halo');
    expect(chunks[1].text).toBe('kawan');
  });

  it('splits on punctuation [. ? !]', () => {
    const words: Word[] = [
      { word: 'Halo.', start: 0.0, end: 0.4 },
      { word: 'Apa', start: 0.5, end: 0.7 },
      { word: 'kabar?', start: 0.8, end: 1.0 },
      { word: 'Luar', start: 1.1, end: 1.3 },
      { word: 'biasa!', start: 1.4, end: 1.6 },
    ];

    const chunks = chunkWords(words);
    expect(chunks.length).toBe(3);
    expect(chunks[0].text).toBe('Halo.');
    expect(chunks[1].text).toBe('Apa kabar?');
    expect(chunks[2].text).toBe('Luar biasa!');
  });

  describe('chunkWordsByRhythm', () => {
    it('returns empty array on empty input', () => {
      expect(chunkWordsByRhythm([])).toEqual([]);
    });

    it('splits when pause between words exceeds maxPause (0.6s)', () => {
      const words: Word[] = [
        { word: 'Halo', start: 0.0, end: 0.4 },
        { word: 'kawan', start: 0.5, end: 0.8 }, // pause = 0.5 - 0.4 = 0.1s
        { word: 'semua', start: 1.5, end: 1.9 }, // pause = 1.5 - 0.8 = 0.7s > 0.6s
      ];

      const chunks = chunkWordsByRhythm(words, { maxPause: 0.6 });
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toBe('Halo kawan');
      expect(chunks[0].start).toBe(0.0);
      expect(chunks[0].end).toBe(0.8);

      expect(chunks[1].text).toBe('semua');
      expect(chunks[1].start).toBe(1.5);
      expect(chunks[1].end).toBe(1.9);
    });

    it('splits when total characters exceed maxChars (42)', () => {
      const words: Word[] = [
        { word: 'Pertanggungjawaban', start: 0.0, end: 0.8 }, // 18 chars
        { word: 'penyelenggaraan', start: 0.85, end: 1.6 },   // 15 chars (total with spaces: 18 + 1 + 15 = 34)
        { word: 'pemerintahan', start: 1.65, end: 2.4 },       // 12 chars (34 + 1 + 12 = 47 > 42)
      ];

      const chunks = chunkWordsByRhythm(words, { maxChars: 42 });
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toBe('Pertanggungjawaban penyelenggaraan');
      expect(chunks[1].text).toBe('pemerintahan');
    });

    it('splits when previous word ends with punctuation and duration exceeds 1.0s', () => {
      const words: Word[] = [
        { word: 'Selamat', start: 0.0, end: 0.5 },
        { word: 'pagi.', start: 0.55, end: 1.2 }, // ends with '.' and duration = 1.2s > 1.0s
        { word: 'Semoga', start: 1.3, end: 1.7 },
      ];

      const chunks = chunkWordsByRhythm(words);
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toBe('Selamat pagi.');
      expect(chunks[1].text).toBe('Semoga');
    });

    it('does not produce double spaces in text', () => {
      const words: Word[] = [
        { word: '  Halo  ', start: 0.0, end: 0.4 },
        { word: '  kawan  ', start: 0.5, end: 0.8 },
      ];
      const chunks = chunkWordsByRhythm(words);
      expect(chunks[0].text).toBe('Halo kawan');
    });
  });
});
