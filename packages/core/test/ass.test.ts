import { describe, expect, it } from 'bun:test';
import {
  buildAss,
  hexToAssColor,
  hexToAssTagColor,
  formatAssTimestamp,
} from '../src/ass.js';

describe('ass karaoke builder', () => {
  it('converts hex colors to ASS style and tag formats', () => {
    // White
    expect(hexToAssColor('#FFFFFF')).toBe('&H00FFFFFF');
    expect(hexToAssTagColor('#FFFFFF')).toBe('&HFFFFFF&');

    // Red: #FF0000 -> B=00, G=00, R=FF
    expect(hexToAssColor('#FF0000')).toBe('&H000000FF');
    expect(hexToAssTagColor('#FF0000')).toBe('&H0000FF&');

    // Gold/Yellow: #FFD700 -> R=FF, G=D7, B=00 -> BGR = 00D7FF
    expect(hexToAssColor('#FFD700')).toBe('&H0000D7FF');
    expect(hexToAssTagColor('#FFD700')).toBe('&H00D7FF&');
  });

  it('formats seconds to centiseconds timestamp H:MM:SS.cc', () => {
    expect(formatAssTimestamp(0)).toBe('0:00:00.00');
    expect(formatAssTimestamp(1.25)).toBe('0:00:01.25');
    expect(formatAssTimestamp(65.5)).toBe('0:01:05.50');
    expect(formatAssTimestamp(3661.05)).toBe('1:01:01.05');
  });

  it('builds valid ASS header with target resolution and chest margin', () => {
    const ass = buildAss({
      chunks: [],
      width: 1080,
      height: 1920,
      style: {
        fontFamily: 'Montserrat',
        fontSize: 64,
        color: '#FFFFFF',
      },
    });

    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('[V4+ Styles]');
    // MarginV ~ 15% of 1920 = 288
    expect(ass).toContain('Style: Default,Montserrat,64,&H00FFFFFF');
    expect(ass).toContain(',288,1');
    expect(ass).toContain('[Events]');
  });

  it('generates karaoke tags \\k, accent overrides, strips cut words, and escapes chars', () => {
    const chunks = [
      {
        id: 'c1',
        start: 1.0,
        end: 3.5,
        words: [
          {
            id: 'w1',
            text: 'Halo',
            start: 1.0,
            end: 1.5, // 0.5s = 50cs
          },
          {
            id: 'w2',
            text: 'kawan',
            start: 1.5,
            end: 2.1, // 0.6s = 60cs
            accent: true,
          },
          {
            id: 'w3',
            text: 'dihapus',
            start: 2.1,
            end: 2.7,
            cut: true, // Should be omitted!
          },
          {
            id: 'w4',
            text: '{spesial}',
            start: 2.7,
            end: 3.5, // 0.8s = 80cs
          },
        ],
      },
    ];

    const ass = buildAss({
      chunks,
      width: 1080,
      height: 1920,
      style: {
        allCaps: true,
        color: '#FFFFFF',
        accentColor: '#FFD700',
      },
    });

    expect(ass).toContain('Dialogue: 0,0:00:01.00,0:00:03.50,Default');
    // Word 1: \k50 with uppercase
    expect(ass).toContain('{\\k50}HALO');
    // Word 2: \k60 with accent color override & primary color reset
    expect(ass).toContain('{\\k60\\c&H00D7FF&}KAWAN{\\c&HFFFFFF&}');
    // Word 3: cut word should NOT be present
    expect(ass).not.toContain('DIHAPUS');
    expect(ass).not.toContain('dihapus');
    // Word 4: { } escaped to ( )
    expect(ass).toContain('{\\k80}(SPESIAL)');
  });
});
