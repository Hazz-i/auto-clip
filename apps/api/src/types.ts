import type {
  Word,
  Chunk,
  EDLCut,
  RenderPlan,
  NinerouterConfig,
  SpeechSegment,
} from "@cliper/core";

// Re-exports from @cliper/core
export type { Word, Chunk, EDLCut, RenderPlan, NinerouterConfig, SpeechSegment };

// Backward compatibility aliases for apps/api
export type WordTiming = Word;
export type CutSegment = EDLCut;
export type AiConfig = NinerouterConfig;

export interface TranscriptResult {
  text: string;
  words: WordTiming[];
  chunks?: Chunk[];
  noTimestamps?: boolean;
  speechSegments?: SpeechSegment[];
}

export type VideoLayout = "portrait" | "landscape" | "square";

export interface RenderRequest {
  clipId: string;
  cuts?: CutSegment[];
  layout?: VideoLayout;
  cropX?: number; // 0 to 1 horizontal anchor
}
