import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCropFilter, probe } from '../src/ffmpeg.js';

describe('ffmpeg', () => {
  it('builds fill crop filter within bounds', () => {
    // 1920x1080 -> targetW = 1080 * 9 / 16 = 608
    // face at center (960) -> clampedX = 960 - 304 = 656
    const filter = buildCropFilter(960, 'fill', 1920, 1080);
    expect(filter).toBe('crop=608:1080:656:0');

    // face near left edge (50) -> clampedX = 0
    const filterLeft = buildCropFilter(50, 'fill', 1920, 1080);
    expect(filterLeft).toBe('crop=608:1080:0:0');

    // face near right edge (1900) -> maxX = 1920 - 608 = 1312
    const filterRight = buildCropFilter(1900, 'fill', 1920, 1080);
    expect(filterRight).toBe('crop=608:1080:1312:0');
  });

  it('builds split crop filter for 9:16 layout', () => {
    const filter = buildCropFilter(960, 'split', 1920, 1080);
    expect(filter).toContain('crop=608:1080:656:0');
    expect(filter).toContain('split=2[top][bot]');
    expect(filter).toContain('crop=608:540:0:0[topout]');
    expect(filter).toContain('crop=608:540:0:540[botout]');
    expect(filter).toContain('[topout][botout]vstack');
  });

  it('probes source.mp4 fixture if available', async () => {
    const fixturePath = existsSync('source.mp4')
      ? resolve('source.mp4')
      : resolve('../../source.mp4');
    if (!existsSync(fixturePath)) {
      return;
    }
    const info = await probe(fixturePath);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.duration).toBeGreaterThan(1000);
  });
});
