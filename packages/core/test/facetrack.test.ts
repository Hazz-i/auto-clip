import { describe, expect, it } from 'bun:test';
import { applyEmaSmoothing, heuristicFaceCenter } from '../src/facetrack.js';

describe('facetrack', () => {
  it('returns valid heuristic center coordinates', () => {
    const box = heuristicFaceCenter(1920, 1080, 0);
    expect(box.w).toBe(576); // 1920 * 0.3
    expect(box.h).toBe(432); // 1080 * 0.4
    expect(box.x).toBe(672); // (1920 - 576) / 2
    expect(box.y).toBe(216); // 1080 * 0.2
    const centreX = box.x + box.w / 2;
    expect(centreX).toBe(960);
  });

  it('applies EMA smoothing with alpha 0.15', () => {
    // raw points: t=0: 1000, t=1: 1200, t=2: 1200
    // t=0: smoothed = 1000
    // t=1: smoothed = 0.15 * 1200 + 0.85 * 1000 = 180 + 850 = 1030
    // t=2: smoothed = 0.15 * 1200 + 0.85 * 1030 = 180 + 875.5 = 1055.5 -> 1056
    const points = [
      { t: 0, xCentre: 1000 },
      { t: 1, xCentre: 1200 },
      { t: 2, xCentre: 1200 },
    ];

    const smoothed = applyEmaSmoothing(points, 0.15);
    expect(smoothed.length).toBe(3);
    expect(smoothed[0].cropXCentre).toBe(1000);
    expect(smoothed[1].cropXCentre).toBe(1030);
    expect(smoothed[2].cropXCentre).toBe(1056);
  });
});
