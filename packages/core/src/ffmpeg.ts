import type { ProbeResult } from './types.js';

/**
 * Extract audio from video file to 16kHz mono MP3 optimized for speech recognition
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  const proc = Bun.spawn([
    'ffmpeg',
    '-y',
    '-i',
    videoPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-b:a',
    '64k',
    outputPath,
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg extractAudio failed (code ${exitCode}): ${errText}`);
  }

  return outputPath;
}

/**
 * Probe video stream duration, width, and height using ffprobe
 */
export async function probe(videoPath: string): Promise<ProbeResult> {
  const proc = Bun.spawn([
    'ffprobe',
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,duration',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    videoPath,
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`ffprobe failed (code ${exitCode}): ${errText}`);
  }

  const rawJson = await new Response(proc.stdout).text();
  const parsed = JSON.parse(rawJson);
  const stream = parsed.streams?.[0] || {};
  const format = parsed.format || {};

  const width = Number(stream.width || 0);
  const height = Number(stream.height || 0);
  const duration = Number(stream.duration || format.duration || 0);

  return { width, height, duration };
}

/**
 * Build FFmpeg crop filter for 9:16 aspect ratio centered around faceX_smooth
 * @param faceX_smooth Smoothed X coordinate of face center
 * @param layout 'fill' (single vertical 9:16) or 'split' (stacked 2x 9:8 frames)
 * @param videoWidth Source video width (default: 1920)
 * @param videoHeight Source video height (default: 1080)
 */
export function buildCropFilter(
  faceX_smooth: number,
  layout: 'fill' | 'split' = 'fill',
  videoWidth = 1920,
  videoHeight = 1080
): string {
  // Target 9:16 width: targetW = videoHeight * 9 / 16
  const targetW = Math.round((videoHeight * 9) / 16);
  const halfTargetW = Math.round(targetW / 2);

  // Clamp crop start X within [0, videoWidth - targetW]
  const minX = 0;
  const maxX = Math.max(0, videoWidth - targetW);
  const rawX = Math.round(faceX_smooth - halfTargetW);
  const clampedX = Math.max(minX, Math.min(maxX, rawX));

  if (layout === 'fill') {
    return `crop=${targetW}:${videoHeight}:${clampedX}:0`;
  }

  // ponytail: split layout defaults to top face crop + bottom center crop. Add dynamic multi-face detection when speaker diarization lands.
  const splitH = Math.round(videoHeight / 2);
  return `crop=${targetW}:${videoHeight}:${clampedX}:0,split=2[top][bot];[top]crop=${targetW}:${splitH}:0:0[topout];[bot]crop=${targetW}:${splitH}:0:${splitH}[botout];[topout][botout]vstack`;
}
