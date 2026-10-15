// Pure hook-selection logic for audio+visual (no-transcript) clip suggestion.
// Impure ffmpeg analysis that feeds these functions lives in apps/api/src/services/hook.ts.

/** Jumlah klip = ceil(durasi / HOOK_SECONDS_PER_CLIP), dibatasi [MIN, MAX]. */
export const HOOK_SECONDS_PER_CLIP = 60;
export const HOOK_MIN_CLIPS = 1;
export const HOOK_MAX_CLIPS = 10;

/**
 * Rentang durasi tiap klip hook (detik). Default = batas bawah rentang agar
 * `count` klip (ceil(durasi/60)) masih muat sebagai jendela non-overlap.
 */
export const HOOK_CLIP_MIN_SECONDS = 30;
export const HOOK_CLIP_MAX_SECONDS = 60;
export const HOOK_DEFAULT_CLIP_SECONDS = HOOK_CLIP_MIN_SECONDS;

/** Lebar bucket analisis audio/scene (detik) dan langkah kandidat jendela (detik). */
export const HOOK_WINDOW_SECONDS = 1;
export const HOOK_CANDIDATE_STEP_SECONDS = 5;

/** Bobot gabungan skor: audio dominan, scene sebagai pelengkap. */
export const HOOK_AUDIO_WEIGHT = 0.6;

export interface HookTimelinePoint {
  /** Detik awal bucket. */
  t: number;
  /** Skor gabungan ternormalisasi 0..1. */
  score: number;
}

export interface HookCandidate {
  start: number;
  end: number;
  score: number;
}

export interface HookClip {
  id: string;
  start: number;
  end: number;
  score: number;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round2(x: number): number {
  return Number(x.toFixed(2));
}

/**
 * Tentukan jumlah klip dari durasi video: ceil(durasi / 60), minimal 1, maksimal 10.
 */
export function hookCountForDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return HOOK_MIN_CLIPS;
  const raw = Math.ceil(duration / HOOK_SECONDS_PER_CLIP);
  return Math.max(HOOK_MIN_CLIPS, Math.min(HOOK_MAX_CLIPS, raw));
}

/**
 * Gabungkan skor audio (energi/loudness) dan scene (perubahan visual), keduanya 0..1,
 * menjadi satu skor 0..1.
 */
export function combineScore(
  audio: number,
  scene: number,
  audioWeight: number = HOOK_AUDIO_WEIGHT
): number {
  const w = clamp01(audioWeight);
  const blended = w * clamp01(audio) + (1 - w) * clamp01(scene);
  return Number(blended.toFixed(4));
}

/**
 * Min-max normalize ke 0..1. Sinyal datar / kosong -> semua 0.
 */
export function normalizeToUnit(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-9) {
    return values.map(() => 0);
  }
  return values.map((v) => (Number.isFinite(v) ? (v - min) / (max - min) : 0));
}

/**
 * Bangun jendela kandidat berdurasi `clipDuration` dengan langkah `step`,
 * skor tiap jendela = rata-rata skor timeline di dalamnya.
 */
export function buildCandidateWindows(
  timeline: HookTimelinePoint[],
  duration: number,
  clipDuration: number = HOOK_DEFAULT_CLIP_SECONDS,
  step: number = HOOK_CANDIDATE_STEP_SECONDS
): HookCandidate[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (!Number.isFinite(clipDuration) || clipDuration <= 0) return [];
  const stepSeconds = Number.isFinite(step) && step > 0 ? step : HOOK_CANDIDATE_STEP_SECONDS;
  const clip = Math.min(
    Math.max(clipDuration, HOOK_CLIP_MIN_SECONDS),
    HOOK_CLIP_MAX_SECONDS,
    duration
  );
  const maxStart = Math.max(0, duration - clip);

  const starts = new Set<number>();
  for (let s = 0; s <= maxStart + 1e-6; s += stepSeconds) {
    starts.add(round2(Math.min(s, maxStart)));
  }

  const points = [...timeline].sort((a, b) => a.t - b.t);
  return [...starts]
    .sort((a, b) => a - b)
    .map((start) => {
      const end = Math.min(round2(start + clip), round2(duration));
      let sum = 0;
      let hits = 0;
      for (const p of points) {
        if (p.t >= start && p.t < end) {
          sum += p.score;
          hits += 1;
        }
      }
      return {
        start: round2(start),
        end,
        score: Number((hits > 0 ? sum / hits : 0).toFixed(4)),
      };
    });
}

/**
 * Pilih maksimal `count` kandidat non-overlap dengan skor tertinggi (greedy).
 * Hasil diurutkan menurun berdasarkan skor.
 */
export function pickHooks(candidates: HookCandidate[], count: number): HookCandidate[] {
  const limit = Math.max(0, Math.floor(count));
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.start - b.start);
  const picked: HookCandidate[] = [];
  for (const c of sorted) {
    if (picked.length >= limit) break;
    // [start, end) overlap jika start < end lain dan end > start lain.
    if (picked.every((p) => c.end <= p.start || c.start >= p.end)) {
      picked.push(c);
    }
  }
  return picked;
}

/**
 * Pipeline pure: timeline berskor -> kandidat -> pilih non-overlap -> klip ber-id.
 */
export function selectHooks(
  timeline: HookTimelinePoint[],
  duration: number,
  count: number,
  clipDuration: number = HOOK_DEFAULT_CLIP_SECONDS,
  step: number = HOOK_CANDIDATE_STEP_SECONDS
): HookClip[] {
  const candidates = buildCandidateWindows(timeline, duration, clipDuration, step);
  return pickHooks(candidates, count).map((c, i) => ({
    id: `hook_${i + 1}`,
    start: c.start,
    end: c.end,
    score: c.score,
  }));
}
