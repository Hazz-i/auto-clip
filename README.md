# Cliper

AI video clipping and highlight generator monorepo.

## Arsitektur

```text
cliper/
├── apps/
│   ├── api/          # Elysia / Bun backend service (Cloudflare Workers ready)
│   └── web/          # SvelteKit dashboard & video player
├── packages/
│   └── core/         # Core business logic & pipeline engine
│       ├── types.ts     # Domain contracts (Word, Chunk, EDLCut, RenderPlan)
│       ├── chunker.ts   # Subtitle chunking engine (port caption.py)
│       ├── srt.ts       # SRT generator & Whisper words_json parser
│       ├── ffmpeg.ts    # Bun.spawn helpers (extractAudio, probe, buildCropFilter)
│       ├── facetrack.ts # 1fps frame face detection + EMA smoothing (9:16 crop)
│       ├── storage.ts   # StorageDriver abstraction (LocalDriver & R2Driver)
│       └── ai-config.ts # NineRouter AI Gateway configuration
├── schema.sql        # Cloudflare D1 database schema
├── wrangler.toml     # Cloudflare deployment stub
└── .dev.vars.example # Environment variable template
```

## Pipeline Pemrosesan

1. **Ingest**: Video diunggah via `StorageDriver` (lokal `./uploads/` atau Cloudflare R2).
2. **Audio Extraction**: `ffmpeg.extractAudio` mengekstrak audio MP3 16kHz mono.
3. **Transcription**: Whisper via NineRouter STT menghasilkan `words_json` dengan timestamp kata.
4. **Chunking & Subtitles**: `chunkWords` mengelompokkan kata (maks 5 kata, maks 2.5s, jeda maks 0.8s, split tanda baca) dan menghasilkan file `.srt`.
5. **AI Highlights / Cuts**: NineRouter LLM memilih segmen viral menjadi `EDLCut[]`.
6. **Face Tracking**: Ekstraksi frame 1fps via ffmpeg, estimasi titik wajah, dan smoothing EMA ($\alpha = 0.15$) untuk target crop vertikal 9:16 (`crop=ih*9/16`).
7. **Render**: FFmpeg memotong, menyusun tata letak (`fill` atau `split`), dan membakar takarir.

## Perintah

```bash
# Install seluruh workspace
bun install

# Run unit tests
bun test

# Typecheck seluruh package
bun run typecheck
```
