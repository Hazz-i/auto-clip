import path from "path";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { config } from "../config.ts";
import { buildAss, type AssChunkInput, type AssCaptionStyle } from "@cliper/core";

export interface RenderCut {
  start: number;
  end: number;
}

export interface BuildRenderArgsOptions {
  input: string;
  output: string;
  cuts?: RenderCut[];
  layout?: "portrait" | "landscape" | "square";
  cropX?: number;
  assPath?: string;
  fontsDir?: string;
  progress?: boolean;
}

export interface RenderJobState {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RenderParams {
  inputPath: string;
  outputPath: string;
  cuts?: RenderCut[];
  layout?: "portrait" | "landscape" | "square";
  cropX?: number;
  assPath?: string;
  fontsDir?: string;
  targetDuration: number;
  tempAssPath?: string;
}

const jobRegistry = new Map<string, RenderJobState>();

export function cleanupOldJobs(): void {
  const now = Date.now();
  const ONE_HOUR = 3600 * 1000;
  for (const [id, job] of jobRegistry.entries()) {
    if (now - job.createdAt > ONE_HOUR) {
      jobRegistry.delete(id);
    }
  }
}

export function createJob(jobId?: string): RenderJobState {
  cleanupOldJobs();
  const id = jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const job: RenderJobState = {
    jobId: id,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobRegistry.set(id, job);
  return job;
}

export function getJob(jobId: string): RenderJobState | undefined {
  cleanupOldJobs();
  return jobRegistry.get(jobId);
}

function escapeFilterArg(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

function sanitizeErrorMessage(stderr: string): string {
  const lines = stderr
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(-8);
  const raw = lines.join("\n");
  return raw
    .replace(/\/home\/[a-zA-Z0-9_\-\.\/]+\/uploads\//g, "[uploads]/")
    .replace(/\/tmp\/[a-zA-Z0-9_\-\.\/]+/g, "[temp]");
}

/**
 * Builds FFmpeg command arguments for 1-pass render with cuts, layout crop, and ASS subtitles
 */
export function buildRenderArgs(options: BuildRenderArgsOptions): string[] {
  const {
    input,
    output,
    cuts = [],
    layout = "portrait",
    cropX = 0.5,
    assPath,
    fontsDir,
    progress = false,
  } = options;

  const clampedCropX = Math.max(0, Math.min(1, typeof cropX === "number" ? cropX : 0.5));
  const validCuts = cuts.filter((c) => c && typeof c.start === "number" && typeof c.end === "number" && c.end > c.start && c.start >= 0);

  // Layout filter: crop and scale
  let layoutFilter = "";
  let targetWidth = 1080;
  let targetHeight = 1920;

  if (layout === "square") {
    targetWidth = 1080;
    targetHeight = 1080;
    layoutFilter = `crop=w=ih:h=ih:x='(iw-ow)*${clampedCropX}':y=0,scale=1080:1080`;
  } else if (layout === "landscape") {
    targetWidth = 1920;
    targetHeight = 1080;
    layoutFilter = `scale=1920:1080`;
  } else {
    // default portrait 9:16
    targetWidth = 1080;
    targetHeight = 1920;
    layoutFilter = `crop=w='ih*9/16':h=ih:x='(iw-ow)*${clampedCropX}':y=0,scale=1080:1920`;
  }

  // Subtitle filter
  let subFilter = "";
  if (assPath && existsSync(assPath)) {
    subFilter = `ass=filename='${escapeFilterArg(assPath)}'`;
    if (fontsDir && existsSync(fontsDir)) {
      subFilter += `:fontsdir='${escapeFilterArg(fontsDir)}'`;
    }
  }

  const args: string[] = ["ffmpeg", "-y"];

  if (progress) {
    args.push("-progress", "pipe:1", "-nostats");
  }

  args.push("-i", input);

  if (validCuts.length > 0) {
    const filterComplexParts: string[] = [];
    for (let i = 0; i < validCuts.length; i++) {
      const c = validCuts[i]!;
      filterComplexParts.push(`[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS[v${i}];`);
      filterComplexParts.push(`[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}];`);
    }

    const concatInputs = validCuts.map((_, i) => `[v${i}][a${i}]`).join("");
    filterComplexParts.push(`${concatInputs}concat=n=${validCuts.length}:v=1:a=1[vcat][acat];`);

    let videoChain = `[vcat]${layoutFilter}`;
    if (subFilter) {
      videoChain += `,${subFilter}`;
    }
    videoChain += `[vout]`;
    filterComplexParts.push(videoChain);

    args.push(
      "-filter_complex",
      filterComplexParts.join(""),
      "-map",
      "[vout]",
      "-map",
      "[acat]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output
    );
  } else {
    let videoFilter = layoutFilter;
    if (subFilter) {
      videoFilter += `,${subFilter}`;
    }

    args.push(
      "-vf",
      videoFilter,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output
    );
  }

  return args;
}

/**
 * Runs FFmpeg render job asynchronously and tracks progress
 */
export async function runRender(jobId: string, params: RenderParams): Promise<void> {
  const job = jobRegistry.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.progress = 5;
  job.updatedAt = Date.now();

  const args = buildRenderArgs({
    input: params.inputPath,
    output: params.outputPath,
    cuts: params.cuts,
    layout: params.layout,
    cropX: params.cropX,
    assPath: params.assPath,
    fontsDir: params.fontsDir,
    progress: true,
  });

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Track progress from stdout in parallel
  const totalUs = Math.max(0.1, params.targetDuration) * 1_000_000;
  const stdoutPromise = (async () => {
    try {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("out_time_us=")) {
            const us = Number(line.slice(12).trim());
            if (!isNaN(us) && totalUs > 0) {
              const pct = Math.min(99, Math.max(5, Math.round((us / totalUs) * 100)));
              job.progress = pct;
              job.updatedAt = Date.now();
            }
          } else if (line.startsWith("progress=end")) {
            job.progress = 100;
            job.updatedAt = Date.now();
          }
        }
      }
    } catch {
      // ignore stdout reader error
    }
  })();

  const exitCode = await proc.exited;
  await stdoutPromise;

  if (exitCode === 0) {
    job.status = "done";
    job.progress = 100;
    job.resultUrl = `/outputs/${path.basename(params.outputPath)}`;
    job.updatedAt = Date.now();
  } else {
    const stderrText = await new Response(proc.stderr).text();
    job.status = "failed";
    job.error = sanitizeErrorMessage(stderrText) || `FFmpeg exited with error code ${exitCode}`;
    job.updatedAt = Date.now();
  }

  // Cleanup temporary ASS file if created
  if (params.tempAssPath && existsSync(params.tempAssPath)) {
    try {
      unlinkSync(params.tempAssPath);
    } catch {
      // ignore
    }
  }
}
