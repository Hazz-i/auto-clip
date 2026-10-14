export interface Word {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface Chunk {
  words: Word[];
  text: string;
  start: number;
  end: number;
}

export interface EDLCut {
  start: number;
  end: number;
  label?: string;
}

export interface SpeechSegment {
  start: number;
  end: number;
}

export interface RenderPlan {
  clipId: string;
  cuts: EDLCut[];
  layout: 'split' | 'fill';
  cropX?: number;
  captions: Chunk[];
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  confidence?: number;
}

export interface FaceTrackPoint {
  t: number;
  cropXCentre: number;
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
}

export interface NinerouterConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  sttModel: string;
}

export interface StorageDriver {
  getUploadUrl(key: string, contentType?: string): Promise<string>;
  put(key: string, data: Blob | Buffer | Uint8Array | string, contentType?: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  getUrl(key: string): Promise<string>;
}
