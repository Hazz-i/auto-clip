import { describe, expect, it } from 'bun:test';
import { formatSrtTimestamp, chunksToSrt, parseWordsJson } from '../src/srt.js';
import type { Chunk } from '../src/types.js';

describe('srt', () => {
  it('formats seconds to SRT timestamp correctly', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(65.123)).toBe('00:01:05,123');
    expect(formatSrtTimestamp(3661.05)).toBe('01:01:01,050');
  });

  it('builds valid SRT string from chunks', () => {
    const chunks: Chunk[] = [
      {
        text: 'Halo kawan',
        start: 1.0,
        end: 2.5,
        words: [
          { word: 'Halo', start: 1.0, end: 1.8 },
          { word: 'kawan', start: 1.9, end: 2.5 },
        ],
      },
      {
        text: 'Selamat datang',
        start: 3.0,
        end: 4.2,
        words: [
          { word: 'Selamat', start: 3.0, end: 3.6 },
          { word: 'datang', start: 3.7, end: 4.2 },
        ],
      },
    ];

    const srt = chunksToSrt(chunks);
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:02,500\nHalo kawan');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:04,200\nSelamat datang');
  });

  it('parses words_json in various formats', () => {
    const rawArray = JSON.stringify([
      { word: 'halo', start: 0.1, end: 0.5 },
      { word: 'dunia', start: 0.6, end: 1.0 },
    ]);
    expect(parseWordsJson(rawArray)).toEqual([
      { word: 'halo', start: 0.1, end: 0.5, score: undefined },
      { word: 'dunia', start: 0.6, end: 1.0, score: undefined },
    ]);

    const whisperVerbose = JSON.stringify({
      text: 'halo dunia',
      words: [{ word: 'halo', start: 0.1, end: 0.5, confidence: 0.98 }],
    });
    expect(parseWordsJson(whisperVerbose)).toEqual([
      { word: 'halo', start: 0.1, end: 0.5, score: 0.98 },
    ]);

    const whisperSegments = JSON.stringify({
      segments: [
        {
          words: [{ word: 'segmen', start: 1.0, end: 1.5 }],
        },
      ],
    });
    expect(parseWordsJson(whisperSegments)).toEqual([
      { word: 'segmen', start: 1.0, end: 1.5, score: undefined },
    ]);
  });
});
