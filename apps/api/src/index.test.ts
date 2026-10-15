process.env.NODE_ENV = "test";
import path from "path";
import { unlinkSync } from "fs";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { app, sanitizeFileKey, findUploadedFile } from "./index.ts";
import {
  transcribe,
  normalizeTranscription,
} from "./services/ninerouter.ts";
import {
  transcribeElevenLabs,
  normalizeElevenLabsResponse,
} from "./services/elevenlabs.ts";
import {
  buildRenderCommand,
  convertToMp3,
  parseSilencesFromStderr,
  silencesToSpeechSegments,
} from "./services/ffmpeg.ts";
import type { SpeechSegment } from "./types.ts";
import { config } from "./config.ts";

describe("Cliper API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("GET /health returns health info", async () => {
    const res = await app.handle(new Request("http://localhost:3000/health"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.baseUrlConfigured).toBe(true);
    expect(typeof data.uploadsDir).toBe("string");
    expect(data.uploadsDir.startsWith("/")).toBe(true);
    expect(data.models).toBeDefined();
    expect(data.models.stt).toBe("el/scribe_v2");
  });

  it("GET /api/ai/config returns masked config", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/ai/config"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.baseUrl).toBeDefined();
    expect(data.chatModel).toBeDefined();
    expect(data.apiKeyMasked !== undefined).toBe(true);
  });

  it("PUT /api/ai/config updates config", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "http://localhost:11434/v1",
          chatModel: "llama3:latest",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.config.chatModel).toBe("llama3:latest");
  });

  it("POST /api/clips/upload-url generates presigned structure", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/clips/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "test-video.mp4",
          contentType: "video/mp4",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.uploadUrl).toBeDefined();
    expect(data.fileKey).toContain("test-video.mp4");
  });

  it("POST /api/upload-direct saves video file and verifies persistence", async () => {
    const formData = new FormData();
    const fakeVideo = new Blob(["fake video content for direct upload"], { type: "video/mp4" });
    formData.append("file", fakeVideo, "sample-persist.mp4");

    const res = await app.handle(
      new Request("http://localhost:3000/api/upload-direct", {
        method: "POST",
        body: formData,
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.fileKey).toBe("sample-persist.mp4");
    expect(data.savedPath).toBeDefined();
    expect(data.size).toBe(fakeVideo.size);

    // Verify it is immediately listed in GET /api/clips/files
    const listRes = await app.handle(new Request("http://localhost:3000/api/clips/files"));
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    const found = listData.files.find((f: any) => f.fileKey === "sample-persist.mp4");
    expect(found).toBeDefined();
    expect(found.size).toBe(fakeVideo.size);
  });

  it("POST /api/clips/render queues an async render job", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/clips/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: "sample.mp4",
          cuts: [{ start: 2.5, end: 10.0 }],
          layout: "portrait",
          cropX: 0.5,
        }),
      })
    );
    expect(res.status).toBe(202);
    const data = (await res.json()) as any;
    expect(data.status).toBe("queued");
    expect(typeof data.jobId).toBe("string");
    expect(data.jobId.length).toBeGreaterThan(0);
    expect(String(data.resultUrl)).toContain("/outputs/");
  });

  it("normalizeTranscription normalizes whisper verbose_json, Scribe, and fallbacks", () => {
    // 1. Whisper verbose_json format
    const whisperData = {
      text: "hello world",
      words: [
        { word: "hello", start: 0.0, end: 0.5 },
        { word: "world", start: 0.6, end: 1.0 },
      ],
    };
    const norm1 = normalizeTranscription(whisperData);
    expect(norm1.text).toBe("hello world");
    expect(norm1.words.length).toBe(2);
    expect(norm1.words[0]?.word).toBe("hello");

    // 2. ElevenLabs Scribe format ({text, start, end} instead of {word})
    const scribeData = {
      text: "halo kawan cliper",
      words: [
        { text: "halo", start: 0.1, end: 0.4 },
        { text: "kawan", start: 0.5, end: 0.8 },
        { text: "cliper", start: 0.9, end: 1.3 },
      ],
    };
    const normScribe = normalizeTranscription(scribeData);
    expect(normScribe.text).toBe("halo kawan cliper");
    expect(normScribe.words.length).toBe(3);
    expect(normScribe.words[0]?.word).toBe("halo");
    expect(normScribe.words[2]?.word).toBe("cliper");
    expect(normScribe.noTimestamps).toBe(false);

    // 3. Fallback when text exists but words is empty
    const textOnlyData = { text: "hanya teks tanpa timestamp" };
    const normFallback = normalizeTranscription(textOnlyData);
    expect(normFallback.text).toBe("hanya teks tanpa timestamp");
    expect(normFallback.words.length).toBe(4);
    expect(normFallback.words[0]?.word).toBe("hanya");
    expect(normFallback.words[0]?.start).toBe(0);
    expect(normFallback.words[0]?.end).toBe(0.4);
    expect(normFallback.chunks?.length).toBeGreaterThan(0);
    expect(normFallback.noTimestamps).toBe(true);

    // 4. Empty data does not crash
    const emptyNorm = normalizeTranscription({});
    expect(emptyNorm.words).toEqual([]);
    expect(emptyNorm.chunks).toEqual([]);
    expect(emptyNorm.noTimestamps).toBe(true);
  });

  it("normalizeTranscription fallback: 2 sentences without words + duration 10", () => {
    const rawData = {
      text: "Halo kawan semua. Hari ini kita bahas cliper.",
    };
    const res = normalizeTranscription(rawData, { duration: 10 });

    expect(res.text).toBe("Halo kawan semua. Hari ini kita bahas cliper.");
    // words > 1
    expect(res.words.length).toBeGreaterThan(1);
    expect(res.words.length).toBe(8);

    // tiap word tanpa spasi
    for (const w of res.words) {
      expect(/\s/.test(w.word)).toBe(false);
      expect(w.word.length).toBeGreaterThan(0);
    }

    // start/end naik monoton dalam [0,10]
    expect(res.words[0]?.start).toBe(0);
    expect(res.words[res.words.length - 1]?.end).toBe(10);

    for (let i = 0; i < res.words.length; i++) {
      const cur = res.words[i]!;
      expect(cur.start).toBeGreaterThanOrEqual(0);
      expect(cur.end).toBeLessThanOrEqual(10);
      expect(cur.end).toBeGreaterThanOrEqual(cur.start);
      if (i > 0) {
        const prev = res.words[i - 1]!;
        expect(cur.start).toBeGreaterThanOrEqual(prev.start);
        expect(cur.end).toBeGreaterThanOrEqual(prev.end);
      }
    }

    // chunks terbentuk
    expect(res.chunks).toBeDefined();
    expect(res.chunks!.length).toBeGreaterThan(0);

    // noTimestamps true
    expect(res.noTimestamps).toBe(true);
  });

  it("normalizeTranscription handles observed probe response with text only and duration", () => {
    // Exact response structure observed from probe (a) el/scribe_v2 on proxy
    const observedProbeResponse = {
      text: "Oke di sini gua pengen jelasin ke temen-temen ya dasar ilmu ekonomi.",
    };
    const res = normalizeTranscription(observedProbeResponse, { duration: 5.0 });

    expect(res.text).toBe(observedProbeResponse.text);
    expect(res.noTimestamps).toBe(true);
    expect(res.words.length).toBe(12);
    expect(res.words[0]?.word).toBe("Oke");
    expect(res.words[0]?.start).toBe(0);
    expect(res.words[res.words.length - 1]?.end).toBe(5.0);
    expect(res.chunks?.length).toBeGreaterThan(1);
  });

  it("normalizeTranscription normalizes millisecond timestamps to float seconds", () => {
    const dataWithMs = {
      text: "halo kawan",
      words: [
        { word: "halo", start_ms: 100, end_ms: 600 },
        { word: "kawan", start_ms: 700, end_ms: 1200 },
      ],
    };
    const res = normalizeTranscription(dataWithMs);
    expect(res.noTimestamps).toBe(false);
    expect(res.words[0]?.start).toBe(0.1);
    expect(res.words[0]?.end).toBe(0.6);
    expect(res.words[1]?.start).toBe(0.7);
    expect(res.words[1]?.end).toBe(1.2);
  });

  it("buildRenderCommand constructs single-pass filter correctly", () => {
    const cmd = buildRenderCommand({
      inputPath: "/tmp/in.mp4",
      outputPath: "/tmp/out.mp4",
      layout: "portrait",
      cropX: 0.5,
    });
    expect(cmd).toContain("crop=ih*9/16:ih:(iw-ih*9/16)*0.5:0,scale=1080:1920");
  });

  it("transcribe with el/* model builds form with response_format=json and no granularity", async () => {
    let capturedBody: any = null;
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          text: "suara elevenlabs",
          words: [
            { text: "suara", start: 0.1, end: 0.6 },
            { text: "elevenlabs", start: 0.7, end: 1.4 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    const res = await transcribe(new Uint8Array([0, 1, 2]), {
      model: "el/scribe_v2",
    });

    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get("model")).toBe("el/scribe_v2");
    expect(capturedBody.get("response_format")).toBe("json");
    expect(capturedBody.get("timestamp_granularities[]")).toBeNull();
    expect(res.text).toBe("suara elevenlabs");
    expect(res.words.length).toBe(2);
    expect(res.words[0]?.word).toBe("suara");
    expect(res.words[0]?.start).toBe(0.1);
    expect(res.words[1]?.word).toBe("elevenlabs");
  });

  it("transcribe with whisper model maintains verbose_json and timestamp_granularities", async () => {
    let capturedBody: any = null;
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          text: "audio whisper",
          words: [{ word: "audio", start: 0.0, end: 0.5 }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    const res = await transcribe(new Uint8Array([0, 1, 2]), {
      model: "whisper-1",
    });

    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get("model")).toBe("whisper-1");
    expect(capturedBody.get("response_format")).toBe("verbose_json");
    expect(capturedBody.get("timestamp_granularities[]")).toBe("word");
    expect(res.words[0]?.word).toBe("audio");
  });

  it("GET /api/clips/files returns list of uploaded files", async () => {
    const res = await app.handle(new Request("http://localhost:3000/api/clips/files"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.files)).toBe(true);
  });

  it("POST /api/clips/suggest returns 404 with clear message on missing file", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/clips/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: "definitely-missing-hook.mp4" }),
      })
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toContain("definitely-missing-hook.mp4");
    expect(data.error).toContain(config.uploadsDir);
  });

  it("POST /api/clips/suggest returns 4xx when file is not a video", async () => {
    const notVideoPath = path.resolve(config.uploadsDir, "not-a-video-hook.txt");
    await Bun.write(notVideoPath, "ini bukan video sama sekali");
    try {
      const res = await app.handle(
        new Request("http://localhost:3000/api/clips/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey: "not-a-video-hook.txt" }),
        })
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const data = (await res.json()) as any;
      expect(typeof data.error).toBe("string");
    } finally {
      try {
        unlinkSync(notVideoPath);
      } catch {}
    }
  });

  it("POST /api/clips/transcribe returns 404 with clear path on missing file", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/clips/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: "non-existent-video.mp4",
        }),
      })
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toContain("non-existent-video.mp4");
    expect(data.error).toContain(config.uploadsDir);
  });

  it("sanitizeFileKey strips path traversal and invalid characters", () => {
    expect(sanitizeFileKey("../../malicious.mp4")).toBe("malicious.mp4");
    expect(sanitizeFileKey("/etc/passwd")).toBe("passwd");
    expect(sanitizeFileKey("video (1) [final].mp4")).toBe("video__1___final_.mp4");
    expect(sanitizeFileKey("1791964694485-cotohcepat.mp4")).toBe("1791964694485-cotohcepat.mp4");
  });

  it("convertToMp3 throws descriptive error on invalid input", async () => {
    try {
      await convertToMp3("/invalid/path/video.mp4", "/tmp/fail.mp3");
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain("FFmpeg convertToMp3 failed");
    }
  });

  it("parses silencedetect output into merged and filtered speech segments", () => {
    const stderrFixture = `
[silencedetect @ 0x55e] silence_start: 1.5
[silencedetect @ 0x55e] silence_end: 3.5 | silence_duration: 2.0
[silencedetect @ 0x55e] silence_start: 6.0
[silencedetect @ 0x55e] silence_end: 6.2 | silence_duration: 0.2
[silencedetect @ 0x55e] silence_start: 9.85
[silencedetect @ 0x55e] silence_end: 10.0 | silence_duration: 0.15
`;
    const silences = parseSilencesFromStderr(stderrFixture, 10.0);
    expect(silences.length).toBe(3);
    expect(silences[0]).toEqual({ start: 1.5, end: 3.5 });

    const speech = silencesToSpeechSegments(silences, 10.0);
    expect(speech.length).toBe(2);
    expect(speech[0]).toEqual({ start: 0, end: 1.5 });
    expect(speech[1]).toEqual({ start: 3.5, end: 9.85 });
  });

  it("normalizeTranscription allocates words proportionally inside speech segments", () => {
    const rawData = {
      text: "Halo kawan semua selamat datang di Cliper.",
    };
    const segments: SpeechSegment[] = [
      { start: 1.0, end: 3.0 },
      { start: 5.0, end: 8.0 },
    ];
    const res = normalizeTranscription(rawData, { speechSegments: segments });

    expect(res.text).toBe(rawData.text);
    expect(res.noTimestamps).toBe(true);
    expect(res.speechSegments).toEqual(segments);
    expect(res.words.length).toBe(7);

    // Tiap word tanpa spasi
    for (const w of res.words) {
      expect(/\s/.test(w.word)).toBe(false);
      expect(w.word.length).toBeGreaterThan(0);
    }

    // Monoton naik
    for (let i = 0; i < res.words.length; i++) {
      const cur = res.words[i]!;
      expect(cur.end).toBeGreaterThanOrEqual(cur.start);
      if (i > 0) {
        const prev = res.words[i - 1]!;
        expect(cur.start).toBeGreaterThanOrEqual(prev.end);
      }
    }

    // Kata HANYA di dalam batas segmen (tidak jatuh di jeda hening [3.0, 5.0] atau sebelum 1.0 atau setelah 8.0)
    for (const w of res.words) {
      const insideSomeSegment = segments.some(
        (seg) => w.start >= seg.start - 0.01 && w.end <= seg.end + 0.01
      );
      expect(insideSomeSegment).toBe(true);
    }

    // Chunks terbentuk
    expect(res.chunks).toBeDefined();
    expect(res.chunks!.length).toBeGreaterThan(0);
  });

  it("transcribeElevenLabs sends xi-api-key, parses Scribe words, and produces valid chunks", async () => {
    let capturedHeaders: any = null;
    let capturedBody: any = null;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedHeaders = init?.headers;
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          text: "Halo kawan selamat datang",
          words: [
            { text: "Halo", start: 0.12, end: 0.45 },
            { text: "kawan", start: 0.48, end: 0.85 },
            { text: "selamat", start: 0.9, end: 1.35 },
            { text: "datang", start: 1.38, end: 1.8 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    const res = await transcribeElevenLabs(new Uint8Array([0, 1, 2]), {
      apiKey: "test-eleven-key",
      language: "id",
      filename: "speech.mp3",
    });

    expect(capturedHeaders["xi-api-key"]).toBe("test-eleven-key");
    expect(capturedHeaders["Authorization"]).toBeUndefined();
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get("model_id")).toBe("scribe_v2");
    expect(capturedBody.get("language_code")).toBe("id");

    expect(res.text).toBe("Halo kawan selamat datang");
    expect(res.noTimestamps).toBe(false);
    expect(res.words.length).toBe(4);
    expect(res.words[0]).toEqual({ word: "Halo", start: 0.12, end: 0.45 });
    expect(res.words[3]).toEqual({ word: "datang", start: 1.38, end: 1.8 });
    expect(res.chunks).toBeDefined();
    expect(res.chunks!.length).toBeGreaterThan(0);
  });

  it("normalizeElevenLabsResponse filters type spacing, splits on pause > 0.6s and chars > 40 without double spaces", () => {
    const fixture = {
      text: "Halo kawan. Hari ini kita bahas Cliper dengan sangat mendalam.",
      words: [
        { text: "Halo.", start: 0.0, end: 0.4, type: "word" },
        { text: " ", start: 0.4, end: 0.5, type: "spacing" }, // token spacing dibuang
        { text: "Hari", start: 1.2, end: 1.5, type: "word" }, // pause = 1.2 - 0.4 = 0.8s (> 0.6s) -> cue split
        { text: "ini", start: 1.55, end: 1.8, type: "word" },
        { text: "kita", start: 1.85, end: 2.1, type: "word" },
        { text: "bahas", start: 2.15, end: 2.5, type: "word" },
        { text: "Cliper", start: 2.55, end: 3.0, type: "word" },
        { text: "dengan", start: 3.05, end: 3.4, type: "word" },
        { text: "sangat", start: 3.45, end: 3.8, type: "word" },
        { text: "mendalam.", start: 3.85, end: 4.3, type: "word" }, // chars > 40 -> cue split
      ],
    };

    const res = normalizeElevenLabsResponse(fixture);

    // 1. Token spacing dibuang, word count tepat (9 words)
    expect(res.words.length).toBe(9);
    for (const w of res.words) {
      expect(w.word.trim().length).toBeGreaterThan(0);
      expect(w.word).not.toBe(" ");
    }

    // 2. noTimestamps false
    expect(res.noTimestamps).toBe(false);

    // 3. Tidak ada double-space di semua chunks
    for (const chunk of res.chunks!) {
      expect(/\s{2,}/.test(chunk.text)).toBe(false);
    }

    // 4. Cue terpotong sesuai aturan:
    // Cue 1: ["Halo."] karena pause berikutnya 1.2 - 0.4 = 0.8s > 0.6s
    expect(res.chunks![0]!.text).toBe("Halo.");
    expect(res.chunks![0]!.start).toBe(0.0);
    expect(res.chunks![0]!.end).toBe(0.4);

    // Cue 2 & 3: pemecahan saat chars > 40
    expect(res.chunks!.length).toBeGreaterThan(1);
    const combinedTexts = res.chunks!.map((c) => c.text).join(" ");
    expect(combinedTexts).toContain("Halo. Hari ini kita bahas");
  });

  it("POST /api/clips/transcribe returns 400 when provider is elevenlabs but apiKey is missing", async () => {
    const prevProvider = config.sttProvider;
    const prevKey = config.elevenlabsApiKey;

    const testAudioPath = path.resolve(config.uploadsDir, "test-audio.mp3");
    await Bun.write(testAudioPath, new Uint8Array([0, 1, 2]));

    config.sttProvider = "elevenlabs";
    config.elevenlabsApiKey = "";

    try {
      const res = await app.handle(
        new Request("http://localhost:3000/api/clips/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey: "test-audio.mp3",
          }),
        })
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe("set ELEVENLABS_API_KEY di apps/api/.env lalu restart");
    } finally {
      config.sttProvider = prevProvider;
      config.elevenlabsApiKey = prevKey;
      try {
        unlinkSync(testAudioPath);
      } catch {}
    }
  });

  it("POST /api/clips/transcribe uses elevenlabs when configured with key", async () => {
    const prevProvider = config.sttProvider;
    const prevKey = config.elevenlabsApiKey;

    const testAudioPath = path.resolve(config.uploadsDir, "test-audio.mp3");
    await Bun.write(testAudioPath, new Uint8Array([0, 1, 2]));

    config.sttProvider = "elevenlabs";
    config.elevenlabsApiKey = "dummy-test-key";

    let usedElevenLabs = false;
    globalThis.fetch = (async (url: any, _init: any) => {
      if (String(url).includes("elevenlabs.io")) {
        usedElevenLabs = true;
        return new Response(
          JSON.stringify({
            text: "test elevenlabs",
            words: [{ text: "test", start: 0.1, end: 0.5 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    }) as any;

    try {
      const res = await app.handle(
        new Request("http://localhost:3000/api/clips/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey: "test-audio.mp3",
          }),
        })
      );
      expect(res.status).toBe(200);
      expect(usedElevenLabs).toBe(true);
    } finally {
      config.sttProvider = prevProvider;
      config.elevenlabsApiKey = prevKey;
      try {
        unlinkSync(testAudioPath);
      } catch {}
    }
  });
});
