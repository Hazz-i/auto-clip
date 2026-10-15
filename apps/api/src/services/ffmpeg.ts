import type { CutSegment, SpeechSegment, VideoLayout } from "../types.ts";
import { probe } from "@cliper/core";

export async function convertToMp3(inputVideoPath: string, outputAudioPath: string): Promise<string> {
  const proc = Bun.spawn([
    "ffmpeg",
    "-y",
    "-i",
    inputVideoPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    outputAudioPath,
  ], {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errorText = await new Response(proc.stderr).text();
    const last5Lines = errorText
      .trim()
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(-5)
      .join("\n");
    throw new Error(`FFmpeg convertToMp3 failed (exit code ${exitCode}):\n${last5Lines}`);
  }

  return outputAudioPath;
}

/**
 * Potong audio (mp3) menjadi slice [startSec, endSec] detik dengan satu panggilan ffmpeg
 */
export async function cutAudio(
  inputAudioPath: string,
  outputAudioPath: string,
  startSec: number,
  endSec: number
): Promise<string> {
  const proc = Bun.spawn([
    "ffmpeg",
    "-y",
    "-i",
    inputAudioPath,
    "-ss",
    String(startSec),
    "-t",
    String(Math.max(0.01, endSec - startSec)),
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    outputAudioPath,
  ], {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errorText = await new Response(proc.stderr).text();
    const last5Lines = errorText
      .trim()
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(-5)
      .join("\n");
    throw new Error(`FFmpeg cutAudio failed (exit code ${exitCode}):\n${last5Lines}`);
  }

  return outputAudioPath;
}

export async function extractAudio16k(inputVideoPath: string, outputAudioPath: string): Promise<void> {
  const proc = Bun.spawn([
    "ffmpeg",
    "-y",
    "-i",
    inputVideoPath,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputAudioPath,
  ], {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errorText = await new Response(proc.stderr).text();
    throw new Error(`FFmpeg audio extraction failed (exit code ${exitCode}): ${errorText}`);
  }
}

/**
 * Parse silencedetect lines from FFmpeg stderr
 */
export function parseSilencesFromStderr(
  stderr: string,
  totalDuration: number
): Array<{ start: number; end: number }> {
  const lines = stderr.split("\n");
  const silences: Array<{ start: number; end: number }> = [];
  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (startMatch && startMatch[1]) {
      currentStart = Number(startMatch[1]);
    }
    const endMatch = line.match(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (endMatch && endMatch[1]) {
      const endVal = Number(endMatch[1]);
      if (currentStart !== null) {
        silences.push({
          start: Math.max(0, currentStart),
          end: Math.max(currentStart, endVal),
        });
        currentStart = null;
      }
    }
  }

  // If there's an unclosed silence_start at the end of audio
  if (currentStart !== null && totalDuration > currentStart) {
    silences.push({
      start: Math.max(0, currentStart),
      end: totalDuration,
    });
  }

  return silences;
}

/**
 * Convert silence intervals into voiced/speech segments:
 * - Complement of silence on [0, totalDuration]
 * - Merge adjacent segments with gap < 0.3s
 * - Drop segments with duration < 0.2s
 */
export function silencesToSpeechSegments(
  silences: Array<{ start: number; end: number }>,
  totalDuration: number
): SpeechSegment[] {
  if (totalDuration <= 0) return [];

  // Clamp silences to [0, totalDuration] and sort by start
  const sortedSilences = silences
    .map((s) => ({
      start: Math.max(0, Math.min(totalDuration, s.start)),
      end: Math.max(0, Math.min(totalDuration, s.end)),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const rawSpeech: SpeechSegment[] = [];
  let cursor = 0;

  for (const sil of sortedSilences) {
    if (sil.start > cursor) {
      rawSpeech.push({
        start: cursor,
        end: sil.start,
      });
    }
    cursor = Math.max(cursor, sil.end);
  }

  if (cursor < totalDuration) {
    rawSpeech.push({
      start: cursor,
      end: totalDuration,
    });
  }

  if (rawSpeech.length === 0) {
    return [];
  }

  // 1. Merge adjacent segments with gap < 0.3s ("gabung segmen berdekatan <0.3 dtk")
  const merged: SpeechSegment[] = [];
  for (const seg of rawSpeech) {
    if (merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }
    const prev = merged[merged.length - 1]!;
    const gap = seg.start - prev.end;
    if (gap < 0.3) {
      prev.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  // 2. Drop segments with duration < 0.2s ("buang segmen <0.2 dtk")
  const filtered = merged
    .filter((seg) => seg.end - seg.start >= 0.2)
    .map((seg) => ({
      start: Number(seg.start.toFixed(2)),
      end: Number(seg.end.toFixed(2)),
    }));

  return filtered;
}

/**
 * Detect voiced speech segments via FFmpeg silencedetect filter (noise=-30dB, d=0.5)
 */
export async function detectSpeechSegments(
  audioPath: string,
  totalDuration?: number
): Promise<SpeechSegment[]> {
  let duration = totalDuration;
  if (!duration || duration <= 0) {
    try {
      const p = await probe(audioPath);
      if (p.duration > 0) duration = p.duration;
    } catch {
      // ignore probe error
    }
  }

  const proc = Bun.spawn([
    "ffmpeg",
    "-i",
    audioPath,
    "-af",
    "silencedetect=noise=-30dB:d=0.5",
    "-f",
    "null",
    "-",
  ], {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stderrText = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    return duration && duration > 0 ? [{ start: 0, end: Number(duration.toFixed(2)) }] : [];
  }

  const silences = parseSilencesFromStderr(stderrText, duration || 0);
  return silencesToSpeechSegments(silences, duration || 0);
}

export function buildRenderCommand(params: {
  inputPath: string;
  outputPath: string;
  cuts?: CutSegment[];
  layout?: VideoLayout;
  cropX?: number;
}): string {
  const { inputPath, outputPath, cuts = [], layout = "portrait", cropX = 0.5 } = params;

  // Video filter base for layout crop
  const layoutFilter =
    layout === "portrait"
      ? `crop=ih*9/16:ih:(iw-ih*9/16)*${cropX}:0,scale=1080:1920`
      : layout === "square"
      ? `crop=ih:ih:(iw-ih)*${cropX}:0,scale=1080:1080`
      : "scale=1920:1080";

  // ponytail: 1-pass ffmpeg preview command generator. Ceiling: command string only. Upgrade path: spawn ffmpeg job with progress tracker.
  if (cuts.length > 0) {
    const filterSegments = cuts
      .map(
        (c, i) =>
          `[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS,${layoutFilter}[v${i}];` +
          `[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}]`
      )
      .join(";");

    const concatInputs = cuts.map((_, i) => `[v${i}][a${i}]`).join("");
    const filterComplex = `"${filterSegments};${concatInputs}concat=n=${cuts.length}:v=1:a=1[outv][outa]"`;

    return `ffmpeg -y -i "${inputPath}" -filter_complex ${filterComplex} -map "[outv]" -map "[outa]" -c:v libx264 -crf 23 -preset veryfast -c:a aac "${outputPath}"`;
  }

  return `ffmpeg -y -i "${inputPath}" -vf "${layoutFilter}" -c:v libx264 -crf 23 -preset veryfast -c:a aac "${outputPath}"`;
}
