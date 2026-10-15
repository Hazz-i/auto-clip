import { describe, expect, it } from 'bun:test';
import {
  HOOK_MAX_CLIPS,
  buildCandidateWindows,
  combineScore,
  hookCountForDuration,
  normalizeToUnit,
  pickHooks,
  selectHooks,
  type HookCandidate,
} from '../src/hook.js';

describe('hook selection (pure)', () => {
  describe('hookCountForDuration', () => {
    it('ceil(durasi/60) dibatasi minimal 1', () => {
      expect(hookCountForDuration(0)).toBe(1);
      expect(hookCountForDuration(-5)).toBe(1);
      expect(hookCountForDuration(30)).toBe(1);
      expect(hookCountForDuration(60)).toBe(1);
      expect(hookCountForDuration(61)).toBe(2);
    });

    it('dibatasi maksimal 10', () => {
      expect(hookCountForDuration(600)).toBe(10);
      expect(hookCountForDuration(60_000)).toBe(HOOK_MAX_CLIPS);
    });
  });

  describe('combineScore', () => {
    it('menggabungkan audio dan scene dengan bobot', () => {
      expect(combineScore(1, 0)).toBeCloseTo(0.6, 5);
      expect(combineScore(0, 1)).toBeCloseTo(0.4, 5);
      expect(combineScore(0.5, 0.5)).toBeCloseTo(0.5, 5);
    });

    it('clamp nilai di luar 0..1 dan NaN ke 0', () => {
      expect(combineScore(2, -1)).toBeCloseTo(0.6, 5);
      expect(combineScore(Number.NaN, 0)).toBe(0);
    });
  });

  describe('normalizeToUnit', () => {
    it('min-max ke 0..1', () => {
      expect(normalizeToUnit([10, 20, 30])).toEqual([0, 0.5, 1]);
    });

    it('sinyal datar -> semua 0', () => {
      expect(normalizeToUnit([5, 5, 5])).toEqual([0, 0, 0]);
    });
  });

  describe('buildCandidateWindows', () => {
    it('membuat jendela berdurasi klip dengan skor rata-rata', () => {
      const timeline = Array.from({ length: 100 }, (_, i) => ({ t: i, score: i / 99 }));
      const windows = buildCandidateWindows(timeline, 100, 45, 5);
      expect(windows.length).toBeGreaterThan(0);
      expect(windows[0]!.end - windows[0]!.start).toBeCloseTo(45, 5);
      // jendela awal lebih rendah dari jendela akhir (skor timeline naik)
      expect(windows[windows.length - 1]!.score).toBeGreaterThan(windows[0]!.score);
    });

    it('video sangat pendek tetap menghasilkan satu jendela', () => {
      const timeline = [{ t: 0, score: 1 }];
      const windows = buildCandidateWindows(timeline, 3, 45, 5);
      expect(windows.length).toBe(1);
      expect(windows[0]).toEqual({ start: 0, end: 3, score: 1 });
    });
  });

  describe('pickHooks', () => {
    it('memilih tepat sejumlah count', () => {
      const cands: HookCandidate[] = [
        { start: 0, end: 45, score: 0.5 },
        { start: 50, end: 95, score: 0.9 },
        { start: 100, end: 145, score: 0.7 },
        { start: 150, end: 195, score: 0.3 },
      ];
      expect(pickHooks(cands, 2).length).toBe(2);
      expect(pickHooks(cands, 10).length).toBe(4);
      expect(pickHooks(cands, 0).length).toBe(0);
    });

    it('menghasilkan klip non-overlap', () => {
      const cands: HookCandidate[] = [
        { start: 0, end: 45, score: 0.4 },
        { start: 10, end: 55, score: 0.9 }, // overlap [0,45]
        { start: 60, end: 105, score: 0.8 }, // overlap [50,95]
        { start: 50, end: 95, score: 0.7 },
        { start: 0, end: 45, score: 0.6 }, // duplikat [0,45]
      ];
      const picked = pickHooks(cands, 5);
      for (let i = 0; i < picked.length; i++) {
        for (let j = i + 1; j < picked.length; j++) {
          const a = picked[i]!;
          const b = picked[j]!;
          expect(a.end <= b.start || b.end <= a.start).toBe(true);
        }
      }
      // kandidat skor tertinggi [10,55] diambil, yang overlap dibuang
      expect(picked[0]).toEqual({ start: 10, end: 55, score: 0.9 });
      expect(picked.some((c) => c.start === 0 && c.end === 45)).toBe(false);
    });

    it('mengurutkan hasil menurun berdasarkan skor', () => {
      const cands: HookCandidate[] = [
        { start: 0, end: 45, score: 0.2 },
        { start: 50, end: 95, score: 0.9 },
        { start: 100, end: 145, score: 0.5 },
      ];
      const scores = pickHooks(cands, 3).map((c) => c.score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
      }
    });
  });

  describe('selectHooks', () => {
    it('menghasilkan klip ber-id, non-overlap, sesuai jumlah', () => {
      const duration = 180;
      // 3 puncak terpisah (>45 dtk) agar 3 klip non-overlap bisa dipilih
      const isPeak = (i: number) => i < 45 || (i >= 60 && i < 105) || (i >= 120 && i < 165);
      const timeline = Array.from({ length: duration }, (_, i) => ({
        t: i,
        score: isPeak(i) ? 1 : 0.05,
      }));
      const clips = selectHooks(timeline, duration, hookCountForDuration(duration));
      expect(hookCountForDuration(duration)).toBe(3);
      expect(clips.length).toBe(3);
      expect(clips[0]!.id).toBe('hook_1');
      expect(clips.map((c) => c.start)).toEqual([0, 60, 120]);
      for (const c of clips) {
        expect(c.end).toBeGreaterThan(c.start);
      }
      for (let i = 0; i < clips.length; i++) {
        for (let j = i + 1; j < clips.length; j++) {
          const a = clips[i]!;
          const b = clips[j]!;
          expect(a.end <= b.start || b.end <= a.start).toBe(true);
        }
      }
    });
  });
});
