import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import path from "path";
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from "fs";
import { readdir, stat } from "fs/promises";
import { config, getMaskedAiConfig, updateAiConfig, validateConfig } from "./config.ts";
import { transcribe } from "./services/ninerouter.ts";
import { transcribeElevenLabs } from "./services/elevenlabs.ts";
import { buildRenderCommand, convertToMp3, cutAudio, detectSpeechSegments } from "./services/ffmpeg.ts";
import { createJob, getJob, runRender } from "./services/render.ts";
import { suggestHooks } from "./services/hook.ts";
import type { SpeechSegment, TranscriptResult, VideoLayout } from "./types.ts";
import {
  chunksToSrt,
  probe,
  buildAss,
  type Word,
  type Chunk,
  type EDLCut,
  type RenderPlan,
  type AssChunkInput,
  type AssCaptionStyle,
} from "@cliper/core";

export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

// Ensure uploads dir exists & log on boot
mkdirSync(config.uploadsDir, { recursive: true });
console.log(`[Config] Uploads directory (absolute): ${config.uploadsDir}`);

/**
 * Uniform filename sanitization helper across upload-url, upload-direct, and transcribe
 */
export function sanitizeFileKey(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const base = path.basename(raw.trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Resolve uploaded file across primary uploadsDir and candidate locations
 */
export function findUploadedFile(filename: string): string | null {
  const primaryPath = path.resolve(config.uploadsDir, filename);
  if (existsSync(primaryPath)) return primaryPath;

  const candidates = [
    path.resolve(import.meta.dir, "../../../uploads", filename),
    path.resolve(import.meta.dir, "../../uploads", filename),
    path.resolve(process.cwd(), "uploads", filename),
  ];
  for (const cand of candidates) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Geser seluruh timestamp hasil STT (words, chunks, speechSegments) dari waktu slice
 * ke waktu video absolut (range mode transkripsi parsial)
 */
export function offsetTranscript(transcript: TranscriptResult, offset: number): TranscriptResult {
  const offsetWord = (w: Word) => ({ ...w, start: (w.start || 0) + offset, end: (w.end || 0) + offset });
  return {
    ...transcript,
    words: (transcript.words || []).map(offsetWord),
    chunks: transcript.chunks?.map((ch) => ({
      ...ch,
      start: (ch.start || 0) + offset,
      end: (ch.end || 0) + offset,
      words: (ch.words || []).map(offsetWord),
    })),
    speechSegments: transcript.speechSegments?.map((s) => ({
      start: s.start + offset,
      end: s.end + offset,
    })),
  };
}

// Fast CLI health check support for verification
if (process.argv.includes("--health")) {
  validateConfig();
  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrlConfigured: !!config.baseUrl,
        uploadsDir: config.uploadsDir,
        maxUploadBytes: MAX_UPLOAD_SIZE,
        sttProvider: config.sttProvider,
        models: {
          chat: config.chatModel,
          stt: config.sttModel,
          elevenlabsStt: config.elevenlabsSttModel,
        },
        port: config.port,
      },
      null,
      2
    )
  );
  process.exit(0);
}

export const app = new Elysia({
  serve: {
    maxRequestBodySize: MAX_UPLOAD_SIZE,
  },
})
  .use(cors())
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      const msg = error.message || "";
      const isFileSize = msg.includes("maxSize") || (error as any).validator?.schema?.maxSize;
      if (isFileSize) {
        set.status = 413;
        return { ok: false, error: "File size exceeds maximum allowed limit (500MB)" };
      }
      set.status = 400;
      return { ok: false, error: `Validation error: ${msg}` };
    }
    if (code === "PARSE") {
      set.status = 400;
      return { ok: false, error: `Failed to parse upload request: ${error.message}` };
    }
  })
  .onRequest(({ request }) => {
    console.log(`[HTTP] ${request.method} ${new URL(request.url).pathname}`);
  })
  .get("/health", () => {
    return {
      ok: true,
      baseUrlConfigured: !!config.baseUrl,
      uploadsDir: config.uploadsDir,
      maxUploadBytes: MAX_UPLOAD_SIZE,
      sttProvider: config.sttProvider,
      models: {
        chat: config.chatModel,
        stt: config.sttModel,
        elevenlabsStt: config.elevenlabsSttModel,
      },
    };
  })
  .get("/api/ai/config", () => {
    return getMaskedAiConfig();
  })
  .put(
    "/api/ai/config",
    ({ body }) => {
      const updated = updateAiConfig(body);
      // Safe log: do not print apiKey
      console.log(`[AI Config] Updated: baseUrl=${config.baseUrl}, chatModel=${config.chatModel}, sttProvider=${config.sttProvider}`);
      return { ok: true, config: updated };
    },
    {
      body: t.Object({
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        chatModel: t.Optional(t.String()),
        sttModel: t.Optional(t.String()),
        sttProvider: t.Optional(t.Union([t.Literal("elevenlabs"), t.Literal("proxy")])),
        elevenlabsApiKey: t.Optional(t.String()),
        elevenlabsSttModel: t.Optional(t.String()),
      }),
    }
  )
  .get("/api/clips/files", async () => {
    mkdirSync(config.uploadsDir, { recursive: true });
    const seen = new Set<string>();
    const fileList: Array<{ fileKey: string; size: number }> = [];

    const dirsToScan = [config.uploadsDir];
    const rootUploads = path.resolve(import.meta.dir, "../../../uploads");
    if (rootUploads !== config.uploadsDir && existsSync(rootUploads)) {
      dirsToScan.push(rootUploads);
    }

    for (const dir of dirsToScan) {
      if (!existsSync(dir)) continue;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        if (e.isFile() && !e.name.startsWith(".") && !seen.has(e.name)) {
          seen.add(e.name);
          const st = await stat(path.join(dir, e.name)).catch(() => null);
          fileList.push({
            fileKey: e.name,
            size: st?.size ?? 0,
          });
        }
      }
    }

    return { files: fileList };
  })
  .post(
    "/api/clips/upload-url",
    ({ body }) => {
      const ext = path.extname(body.filename) || ".mp4";
      const baseRaw = path.basename(body.filename, ext);
      const safeBase = sanitizeFileKey(baseRaw) || "clip";
      const fileKey = `${Date.now()}-${safeBase}${ext}`;
      const localFilePath = path.resolve(config.uploadsDir, fileKey);

      // ponytail: Local filesystem uploads. Ceiling: single instance. Upgrade path: Cloudflare R2 presigned upload URL.
      return {
        fileKey,
        uploadUrl: `http://localhost:${config.port}/api/upload-direct?fileKey=${fileKey}`,
        localPath: `file://${localFilePath}`,
        storage: config.storage,
      };
    },
    {
      body: t.Object({
        filename: t.String(),
        contentType: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/api/upload-direct",
    async ({ body, query, set }) => {
      const file = body.file;
      if (!file) {
        set.status = 400;
        return { ok: false, error: "No file provided" };
      }

      const rawKey = query.fileKey || file.name || `clip-${Date.now()}.mp4`;
      let cleanKey = sanitizeFileKey(rawKey) || `clip-${Date.now()}.mp4`;
      if (!path.extname(cleanKey)) {
        cleanKey = `${cleanKey}.mp4`;
      }
      const destPath = path.resolve(config.uploadsDir, cleanKey);

      mkdirSync(config.uploadsDir, { recursive: true });
      await Bun.write(destPath, file);

      // Verify file genuinely persists to disk and size > 0
      if (!existsSync(destPath)) {
        set.status = 500;
        return {
          ok: false,
          error: `Upload verification failed: file ${cleanKey} not found on disk after write`,
        };
      }

      const st = statSync(destPath);
      if (st.size === 0) {
        set.status = 500;
        return {
          ok: false,
          error: `Upload verification failed: file ${cleanKey} is 0 bytes on disk after write`,
        };
      }

      console.log(`[Upload] Saved: ${cleanKey} (${st.size} bytes) -> ${destPath}`);

      return {
        ok: true,
        fileKey: cleanKey,
        size: st.size,
        savedPath: destPath,
        path: destPath,
      };
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: MAX_UPLOAD_SIZE,
          error: "File size exceeds maximum allowed limit (500MB)",
        }),
      }),
      query: t.Optional(
        t.Object({
          fileKey: t.Optional(t.String()),
        })
      ),
    }
  )
  .post(
    "/api/clips/transcribe",
    async ({ body, set }) => {
      const { fileKey, language } = body;
      const cleanKey = sanitizeFileKey(fileKey);
      if (!cleanKey) {
        set.status = 400;
        return { error: "Invalid fileKey" };
      }

      const videoPath = findUploadedFile(cleanKey);
      if (!videoPath) {
        set.status = 404;
        return { error: `File not found: ${cleanKey} in ${config.uploadsDir}` };
      }

      mkdirSync(config.uploadsDir, { recursive: true });

      // Clean up orphaned legacy .16k.wav if exists
      const orphanedWavPath = path.resolve(config.uploadsDir, `${cleanKey}.16k.wav`);
      if (existsSync(orphanedWavPath)) {
        try {
          unlinkSync(orphanedWavPath);
        } catch {
          // ignore cleanup failure
        }
      }

      // Convert video to mp3 (or reuse existing mp3 if newer than video)
      const isAlreadyMp3 = cleanKey.toLowerCase().endsWith(".mp3");
      const mp3FileName = isAlreadyMp3 ? cleanKey : `${cleanKey}.mp3`;
      const mp3Path = isAlreadyMp3
        ? videoPath
        : path.resolve(config.uploadsDir, mp3FileName);

      if (!isAlreadyMp3) {
        let shouldConvert = true;
        if (existsSync(mp3Path)) {
          try {
            const videoStat = statSync(videoPath);
            const mp3Stat = statSync(mp3Path);
            if (mp3Stat.mtimeMs >= videoStat.mtimeMs && mp3Stat.size > 0) {
              shouldConvert = false;
              console.log(`[Transcribe] Reusing cached MP3: ${mp3Path}`);
            }
          } catch {
            shouldConvert = true;
          }
        }

        if (shouldConvert) {
          console.log(`[Transcribe] Converting video to MP3: ${cleanKey} -> ${mp3FileName}`);
          await convertToMp3(videoPath, mp3Path);
        }
      }

      // Probe media duration via ffprobe
      let duration: number | undefined;
      try {
        const probed = await probe(videoPath);
        if (probed && probed.duration > 0) {
          duration = probed.duration;
        }
      } catch (err) {
        console.warn(`[Transcribe] ffprobe duration probe failed for ${cleanKey}, proceeding without duration:`, err);
      }

      // Range transkripsi parsial: potong slice mp3 lalu STT pada slice,
      // timestamp respons digeser kembali ke waktu video absolut
      const hasRange = body.start !== undefined || body.end !== undefined;
      let sliceDuration: number | undefined; // durasi audio yang di-STT
      let timeOffset = 0; // offset waktu slice -> waktu video absolut
      let sttAudioPath = mp3Path;
      let sttAudioName = mp3FileName;
      let slicePath: string | null = null;

      if (hasRange) {
        if (body.start === undefined || body.end === undefined) {
          set.status = 400;
          return { error: "Range tidak valid: kirim start DAN end (detik, absolut video)" };
        }
        if (
          !Number.isFinite(body.start) ||
          !Number.isFinite(body.end) ||
          body.start < 0 ||
          body.end <= body.start
        ) {
          set.status = 400;
          return { error: "Range tidak valid: start/end harus angka >= 0 dengan end > start" };
        }
        if (!duration || duration <= 0) {
          set.status = 422;
          return { error: "Gagal menentukan durasi video: range transkripsi parsial tidak bisa dipakai" };
        }

        // Clamp range ke [0, duration]
        const clampedStart = Math.min(Math.max(body.start, 0), duration);
        const clampedEnd = Math.min(Math.max(body.end, 0), duration);
        if (clampedEnd - clampedStart <= 0) {
          set.status = 400;
          return { error: "Range di luar durasi video" };
        }

        sliceDuration = clampedEnd - clampedStart;
        timeOffset = clampedStart;
        slicePath = path.resolve(
          config.uploadsDir,
          `${cleanKey}.${clampedStart.toFixed(2)}-${clampedEnd.toFixed(2)}.mp3`
        );
        sttAudioPath = slicePath;
        sttAudioName = path.basename(slicePath);

        console.log(`[Transcribe] Range mode: ${clampedStart.toFixed(2)}-${clampedEnd.toFixed(2)}s -> ${sttAudioName}`);
        await cutAudio(mp3Path, slicePath, clampedStart, clampedEnd);
      }

      try {
        // Detect speech segments via VAD (silencedetect) — relatif terhadap audio yang di-STT
        let speechSegments: SpeechSegment[] | undefined;
        try {
          const detected = await detectSpeechSegments(sttAudioPath, sliceDuration ?? duration);
          if (detected && detected.length > 0) {
            speechSegments = detected;
            console.log(`[Transcribe] Detected ${speechSegments.length} speech segments for ${cleanKey}`);
          }
        } catch (err) {
          console.warn(`[Transcribe] detectSpeechSegments failed for ${cleanKey}, proceeding without segments:`, err);
        }

        // Transcribe via selected provider
        let transcript: TranscriptResult;
        const audioBuffer = await Bun.file(sttAudioPath).arrayBuffer();
        const audioBytes = new Uint8Array(audioBuffer);

        if (config.sttProvider === "elevenlabs") {
          if (!config.elevenlabsApiKey || !config.elevenlabsApiKey.trim()) {
            set.status = 400;
            return { error: "set ELEVENLABS_API_KEY di apps/api/.env lalu restart" };
          }
          console.log(`[Transcribe] Using direct ElevenLabs STT provider (model: ${config.elevenlabsSttModel})`);
          transcript = await transcribeElevenLabs(audioBytes, {
            language,
            filename: sttAudioName,
            duration: sliceDuration ?? duration,
            speechSegments,
            apiKey: config.elevenlabsApiKey,
            model: config.elevenlabsSttModel,
          });
        } else {
          console.log(`[Transcribe] Using proxy STT provider (model: ${config.sttModel})`);
          transcript = await transcribe(audioBytes, {
            language,
            filename: sttAudioName,
            duration: sliceDuration ?? duration,
            speechSegments,
          });
        }

        // Geser timestamp hasil STT dari waktu slice ke waktu video absolut (hanya range mode)
        if (timeOffset > 0) {
          transcript = offsetTranscript(transcript, timeOffset);
        }

        // Save transcript to local JSON
        // ponytail: Storing transcript to local json. Ceiling: local dev. Upgrade path: Cloudflare D1.
        const wordsPath = path.resolve(config.uploadsDir, `${cleanKey}.words.json`);
        writeFileSync(wordsPath, JSON.stringify(transcript, null, 2));

        return {
          clipId: cleanKey,
          transcript,
        };
      } finally {
        // Hapus slice sementara agar tidak menumpuk di uploadsDir
        if (slicePath) {
          try {
            unlinkSync(slicePath);
          } catch {
            // abaikan kegagalan hapus slice
          }
        }
      }
    },
    {
      body: t.Object({
        fileKey: t.String(),
        language: t.Optional(t.String()),
        start: t.Optional(t.Number()),
        end: t.Optional(t.Number()),
      }),
    }
  )
  .post(
    "/api/clips/delete",
    async ({ body, set }) => {
      const cleanKey = sanitizeFileKey(body.fileKey);
      if (!cleanKey) {
        set.status = 400;
        return { ok: false, error: "Invalid fileKey" };
      }

      const deleted: string[] = [];

      // Hapus file video asli (bila ada) via resolver yang aman dari path traversal
      const videoPath = findUploadedFile(cleanKey);
      if (videoPath) {
        try {
          unlinkSync(videoPath);
          deleted.push(cleanKey);
        } catch (err) {
          console.warn(`[Delete] Gagal hapus video ${videoPath}:`, err);
        }
      }

      // Hapus artifact transkripsi di uploadsDir (bila ada). Rendered output
      // ({key}.rendered.*.mp4) sengaja TIDAK ikut dihapus karena itu hasil render.
      for (const suffix of [".mp3", ".words.json"]) {
        const artPath = path.resolve(config.uploadsDir, `${cleanKey}${suffix}`);
        if (existsSync(artPath)) {
          try {
            unlinkSync(artPath);
            deleted.push(`${cleanKey}${suffix}`);
          } catch (err) {
            console.warn(`[Delete] Gagal hapus artifact ${artPath}:`, err);
          }
        }
      }

      console.log(`[Delete] ${cleanKey}: ${deleted.length} file dihapus`);
      return { ok: true, deleted };
    },
    {
      body: t.Object({
        fileKey: t.String(),
      }),
    }
  )
  .post(
    "/api/clips/suggest",
    async ({ body, set }) => {
      const cleanKey = sanitizeFileKey(body.fileKey);
      if (!cleanKey) {
        set.status = 400;
        return { error: "Invalid fileKey" };
      }

      const videoPath = findUploadedFile(cleanKey);
      if (!videoPath) {
        set.status = 404;
        return { error: `File not found: ${cleanKey} in ${config.uploadsDir}` };
      }

      // Validasi: file harus video (punya stream video & durasi)
      let probed: Awaited<ReturnType<typeof probe>> | null = null;
      try {
        probed = await probe(videoPath);
      } catch {
        set.status = 422;
        return { error: `Not a readable video: ${cleanKey}` };
      }
      if (!probed || probed.width <= 0 || probed.height <= 0) {
        set.status = 422;
        return { error: `Not a video file (no video stream): ${cleanKey}` };
      }
      if (!probed.duration || probed.duration <= 0) {
        set.status = 422;
        return { error: `Could not determine video duration: ${cleanKey}` };
      }

      try {
        const result = await suggestHooks(videoPath);
        console.log(`[Suggest] ${cleanKey}: ${result.clips.length} hook(s) dari ${result.duration}s`);
        return result;
      } catch (err) {
        console.error(`[Suggest] failed for ${cleanKey}:`, err);
        set.status = 500;
        return { error: `Hook analysis failed: ${(err as Error).message}` };
      }
    },
    {
      body: t.Object({
        fileKey: t.String(),
      }),
    }
  )
  .post(
    "/api/clips/render",
    async ({ body, set }) => {
      const { clipId, cuts, layout = "portrait", cropX = 0.5, chunks, captionStyle } = body;
      const cleanClipId = sanitizeFileKey(clipId);
      if (!cleanClipId) {
        set.status = 400;
        return { error: "Invalid clipId" };
      }

      const inputPath = findUploadedFile(cleanClipId);
      if (!inputPath) {
        set.status = 404;
        return { error: `File not found: ${cleanClipId} in ${config.uploadsDir}` };
      }

      const clampedCropX = Math.max(0, Math.min(1, typeof cropX === "number" ? cropX : 0.5));

      // Probe duration
      let probedDuration = 0;
      try {
        const p = await probe(inputPath);
        if (p && p.duration > 0) probedDuration = p.duration;
      } catch {
        // ignore probe error
      }

      const rawCuts = cuts || [];
      const validCuts = rawCuts.filter((c) => c && typeof c.start === "number" && typeof c.end === "number" && c.end > c.start && c.start >= 0);
      const targetDuration =
        validCuts.length > 0
          ? validCuts.reduce((acc, c) => acc + (c.end - c.start), 0)
          : probedDuration || 10;

      // Handle subtitle ASS generation if chunks are provided
      let assPath: string | undefined;
      if (chunks && chunks.length > 0) {
        const width = layout === "landscape" ? 1920 : 1080;
        const height = layout === "landscape" ? 1080 : (layout === "square" ? 1080 : 1920);
        const assContent = buildAss({
          chunks: chunks as AssChunkInput[],
          style: captionStyle as AssCaptionStyle,
          width,
          height,
        });

        assPath = path.resolve(config.uploadsDir, `${cleanClipId}.${Date.now()}.ass`);
        writeFileSync(assPath, assContent, "utf-8");
      }

      const fontsDir = path.resolve(import.meta.dir, "../fonts");
      const timestamp = Date.now();
      const outputFileName = `${cleanClipId}.rendered.${timestamp}.mp4`;
      const outputPath = path.resolve(config.uploadsDir, outputFileName);
      const resultUrl = `/outputs/${outputFileName}`;

      const job = createJob();
      job.resultUrl = resultUrl;

      // Launch real render in background
      runRender(job.jobId, {
        inputPath,
        outputPath,
        cuts: validCuts,
        layout,
        cropX: clampedCropX,
        assPath,
        fontsDir,
        targetDuration,
        tempAssPath: assPath,
      });

      set.status = 202;
      return {
        jobId: job.jobId,
        status: "queued",
        resultUrl,
      };
    },
    {
      body: t.Object({
        clipId: t.String(),
        layout: t.Optional(
          t.Union([
            t.Literal("portrait"),
            t.Literal("landscape"),
            t.Literal("square"),
          ])
        ),
        cropX: t.Optional(t.Number()),
        cuts: t.Optional(
          t.Array(
            t.Object({
              start: t.Number(),
              end: t.Number(),
            })
          )
        ),
        chunks: t.Optional(
          t.Array(
            t.Object({
              id: t.Optional(t.String()),
              start: t.Number(),
              end: t.Number(),
              text: t.Optional(t.String()),
              words: t.Array(
                t.Object({
                  id: t.Optional(t.String()),
                  text: t.Optional(t.String()),
                  word: t.Optional(t.String()),
                  start: t.Number(),
                  end: t.Number(),
                  cut: t.Optional(t.Boolean()),
                  accent: t.Optional(t.Boolean()),
                })
              ),
            })
          )
        ),
        captionStyle: t.Optional(
          t.Object({
            fontFamily: t.Optional(t.String()),
            fontSize: t.Optional(t.Number()),
            allCaps: t.Optional(t.Boolean()),
            color: t.Optional(t.String()),
            primaryColor: t.Optional(t.String()),
            accentColor: t.Optional(t.String()),
            boxBg: t.Optional(t.String()),
            boxAlpha: t.Optional(t.Number()),
          })
        ),
      }),
    }
  )
  .get("/api/clips/render/:jobId", ({ params, set }) => {
    const job = getJob(params.jobId);
    if (!job) {
      set.status = 404;
      return { error: `Render job not found: ${params.jobId}` };
    }
    return {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      resultUrl: job.resultUrl,
      error: job.error,
    };
  })
  .get("/outputs/:filename", ({ params, set }) => {
    const clean = sanitizeFileKey(params.filename);
    const filePath = path.resolve(config.uploadsDir, clean);
    if (!existsSync(filePath)) {
      set.status = 404;
      return { error: `File not found: ${clean}` };
    }
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      },
    });
  });

if (import.meta.main) {
  validateConfig();
  app.listen(
    {
      port: config.port,
      maxRequestBodySize: MAX_UPLOAD_SIZE,
    },
    () => {
      console.log(`[API] Cliper server listening on http://localhost:${config.port} (max upload: 500MB)`);
    }
  );
}

export default app;
