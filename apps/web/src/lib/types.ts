import type {
	Word as CoreWord,
	Chunk as CoreChunk,
	EDLCut as CoreCut,
	RenderPlan
} from '@cliper/core';

// Re-export core types for workspace consumers
export type { CoreWord, CoreChunk, CoreCut, RenderPlan };

export interface Word extends Partial<Pick<CoreWord, 'word' | 'score'>> {
	id: string;
	text: string;
	start: number; // detik
	end: number; // detik
	cut: boolean; // ditandai cut di EDL
	accent?: boolean; // warna aksen khusus
}

export interface Chunk extends Omit<CoreChunk, 'words' | 'text'> {
	id: string;
	words: Word[];
	text?: string;
	start: number;
	end: number;
	estimated?: boolean;
}

export interface CutRange extends CoreCut {
	id: string;
	wordId: string;
	text: string;
}

export interface CaptionStyle {
	fontFamily: string;
	fontSize: number; // basis 1080x1920: 62-64px
	allCaps: boolean;
	primaryColor: string;
	accentColor: string;
	boxBg: string;
	boxBorder: string;
	positionY: number; // persen vertikal, default 70% (posisi dada/seam)
}

export interface CustomFont {
	name: string;
	dataUrl: string;
	format: string;
}

export interface RenderConfig {
	layout: 'split' | 'fill';
	cropX: number; // -100 s/d 100
	status: 'idle' | 'rendering' | 'completed' | 'error';
	progress: number;
	ffmpegPreview?: string;
	error?: string;
	resultUrl?: string;
}

export type AspectRatioTarget = '9:16' | '1:1' | '16:9';
export type CropMode = 'auto' | 'center' | 'split';
export type SubtitlePreset = 'bold-outline' | 'dark-box' | 'minimal';

export interface ClipRange {
	index: number;
	start: number;
	end: number;
}

export interface WizardConfig {
	isOpen: boolean;
	step: 1 | 2 | 3 | 4;
	targetRatio: AspectRatioTarget;
	clipCount: number;
	clipRanges: ClipRange[];
	cropMode: CropMode;
	subtitlePreset: SubtitlePreset;
	fontDefault: string;
}
