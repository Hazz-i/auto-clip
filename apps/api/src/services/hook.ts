import {
  combineScore,
  normalizeToUnit,
  probe,
  selectHooks,
  hookCountForDuration,
  HOOK_WINDOW_SECONDS,
  type HookClip,
  type HookTimelinePoint,
} from "@cliper/core";

interface FfmpegOutput {
  code: number;
  stdout: string;
  stderr: string;
}

async function runFfmpeg(args: string[]): Promise<FfmpegOutput> {
  const proc = Bun.spawn(["ffmpeg", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, stdout, stderr };
}

/**
 * Parse ebur128=framelog=verbose log lines ("t: 0.1  M: -20.0 ...") into
 * per-window average momentary loudness (LUFS). Bucket tanpa nilai -> -70 (bisu).
 */
export function parseEbur128Loudness(
  output: string,
  windowSeconds: number = HOOK_WINDOW_SECONDS
): number[] {
  const re = /t:\s*([0-9]+(?:\.[0-9]+)?).*?\bM:\s*(-?[0-9]+(?:\.[0-9]+)?)/g;
  const sums: number[] = [];
  const counts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    const idx = Math.floor(Number(m[1]) / windowSeconds);
    sums[idx] = (sums[idx] ?? 0) + Number(m[2]);
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const values: number[] = [];
  for (let i = 0; i < counts.length; i++) {
    values.push(counts[i] ? sums[i]! / counts[i]! : -70);
  }
  return values;
}

/**
 * Parse metadata=print output ("pts_time:X" + "lavfi.scene_score=Y") into
 * per-window summed scene-change score.
 */
export function parseSceneScores(
  output: string,
  windowSeconds: number = HOOK_WINDOW_SECONDS
): number[] {
  const lines = output.split(/\r?\n/);
  const sums: number[] = [];
  let currentTime: number | null = null;
  for (const line of lines) {
    const timeMatch = line.match(/pts_time:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (timeMatch) {
      currentTime = Number(timeMatch[1]);
      continue;
    }
    const scoreMatch = line.match(/scene_score[=:]\s*([0-9]+(?:\.[0-9]+)?)/);
    if (scoreMatch && currentTime !== null) {
      const idx = Math.floor(currentTime / windowSeconds);
      sums[idx] = (sums[idx] ?? 0) + Number(scoreMatch[1]);
    }
  }
  const values: number[] = [];
  for (let i = 0; i < sums.length; i++) values.push(sums[i] ?? 0);
  return values;
}

/** Rata-rata momentary loudness (LUFS) per window. [] jika tidak ada audio. */
export async function analyzeAudioLoudness(
  videoPath: string,
  windowSeconds: number = HOOK_WINDOW_SECONDS
): Promise<number[]> {
  const { code, stdout, stderr } = await runFfmpeg([
    "-hide_banner",
    "-nostdin",
    "-i",
    videoPath,
    "-af",
    "ebur128=framelog=verbose",
    "-f",
    "null",
    "-",
  ]);
  if (code !== 0) return [];
  return parseEbur128Loudness(`${stdout}\n${stderr}`, windowSeconds);
}

/** Jumlah skor perubahan scene per window. [] jika tidak ada scene change. */
export async function analyzeSceneChanges(
  videoPath: string,
  windowSeconds: number = HOOK_WINDOW_SECONDS
): Promise<number[]> {
  const { code, stdout, stderr } = await runFfmpeg([
    "-hide_banner",
    "-nostdin",
    "-i",
    videoPath,
    "-vf",
    "select='gt(scene,0)',metadata=print:file=-",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  if (code !== 0) return [];
  return parseSceneScores(`${stdout}\n${stderr}`, windowSeconds);
}

/**
 * Rekomendasikan potongan (hook) tanpa transkrip: gabungkan energi audio + perubahan
 * scene menjadi skor per detik, lalu pilih jendela non-overlap terbaik.
 */
export async function suggestHooks(
  videoPath: string
): Promise<{ clips: HookClip[]; duration: number }> {
  const probed = await probe(videoPath);
  const duration = probed.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Tidak bisa menentukan durasi video");
  }

  const [audioRaw, sceneRaw] = await Promise.all([
    analyzeAudioLoudness(videoPath).catch(() => [] as number[]),
    analyzeSceneChanges(videoPath).catch(() => [] as number[]),
  ]);

  const audioNorm = normalizeToUnit(audioRaw);
  const sceneNorm = normalizeToUnit(sceneRaw);

  const buckets = Math.max(1, Math.ceil(duration / HOOK_WINDOW_SECONDS));
  const timeline: HookTimelinePoint[] = [];
  for (let i = 0; i < buckets; i++) {
    timeline.push({
      t: i * HOOK_WINDOW_SECONDS,
      score: combineScore(audioNorm[i] ?? 0, sceneNorm[i] ?? 0),
    });
  }

  const count = hookCountForDuration(duration);
  const clips = selectHooks(timeline, duration, count);
  return { clips, duration: Number(duration.toFixed(2)) };
}
