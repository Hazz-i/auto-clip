import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FaceBox, FaceTrackPoint } from './types.js';
import { probe } from './ffmpeg.js';

export interface FaceTrackOptions {
  alpha?: number; // EMA smoothing factor (default: 0.15)
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Extract 1 frame per second from video using FFmpeg
 */
export async function extractFrames1Fps(
  videoPath: string,
  outputDir: string,
  maxDuration?: number
): Promise<{ framePath: string; t: number }[]> {
  await mkdir(outputDir, { recursive: true });

  const args = ['ffmpeg', '-y'];
  if (maxDuration) {
    args.push('-t', String(maxDuration));
  }
  args.push(
    '-i',
    videoPath,
    '-vf',
    'fps=1',
    '-q:v',
    '2',
    join(outputDir, 'frame_%04d.jpg')
  );

  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract frames at 1fps (code ${exitCode}): ${errText}`);
  }

  const files = (await readdir(outputDir))
    .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
    .sort();

  return files.map((f, i) => ({
    framePath: join(outputDir, f),
    t: i,
  }));
}

/**
 * Apply Exponential Moving Average (EMA) smoothing over detected face centers.
 * Formula: X_smooth = alpha * X_now + (1 - alpha) * X_prev
 */
export function applyEmaSmoothing(
  rawPoints: { t: number; xCentre: number }[],
  alpha = 0.15
): FaceTrackPoint[] {
  const first = rawPoints[0];
  if (!first || rawPoints.length === 0) return [];

  const smoothed: FaceTrackPoint[] = [];
  let prevSmoothedX = first.xCentre;

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    if (!pt) continue;
    const smoothedX = i === 0 ? pt.xCentre : alpha * pt.xCentre + (1 - alpha) * prevSmoothedX;
    prevSmoothedX = smoothedX;
    smoothed.push({
      t: pt.t,
      cropXCentre: Math.round(smoothedX),
    });
  }

  return smoothed;
}

/**
 * Heuristic face center detector fallback.
 * Calculates center X at videoWidth / 2.
 */
export function heuristicFaceCenter(videoWidth: number, videoHeight: number, t: number): FaceBox {
  const w = Math.round(videoWidth * 0.3);
  const h = Math.round(videoHeight * 0.4);
  const x = Math.round((videoWidth - w) / 2);
  const y = Math.round(videoHeight * 0.2);
  return { x, y, w, h, t, confidence: 1.0 };
}

/**
 * Generate smoothed face track points for video.
 *
 * NOTE on @mediapipe/tasks-vision:
 * MediaPipe tasks-vision was tested in Bun/Node headless runtime, but requires
 * browser DOM globals (`document is not defined` error).
 *
 * TODO (Phase 2):
 * 1. Implement pure Node/Bun ONNX Runtime runner (`onnxruntime-node`) using YuNet (1.4MB)
 *    or UltraFace model for headless server-side face detection without OpenCV or Python.
 * 2. Or execute MediaPipe via headless worker/browser if DevTools MCP or browser environment is available.
 *
 * Currently using: Heuristic Center Detector + 1fps extraction + EMA smoothing (alpha=0.15).
 */
export async function generateFaceTrack(
  videoPath: string,
  options: FaceTrackOptions = {}
): Promise<FaceTrackPoint[]> {
  const alpha = options.alpha ?? 0.15;
  let duration = options.duration;
  let width = options.width;
  let height = options.height;

  if (!duration || !width || !height) {
    const probed = await probe(videoPath);
    duration = duration ?? probed.duration;
    width = width ?? probed.width;
    height = height ?? probed.height;
  }

  const totalFrames = Math.max(1, Math.floor(duration));
  const rawPoints: { t: number; xCentre: number }[] = [];

  for (let t = 0; t < totalFrames; t++) {
    // ponytail: heuristic center fallback. Replace detector call with native ONNX YuNet when model binary is provisioned.
    const box = heuristicFaceCenter(width, height, t);
    const xCentre = box.x + box.w / 2;
    rawPoints.push({ t, xCentre });
  }

  return applyEmaSmoothing(rawPoints, alpha);
}
