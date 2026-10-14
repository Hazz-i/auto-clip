import type {
	Word,
	Chunk,
	CutRange,
	CaptionStyle,
	CustomFont,
	RenderConfig,
	WizardConfig,
	AspectRatioTarget,
	CropMode,
	SubtitlePreset,
	ClipRange
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STORAGE_CUSTOM_FONTS_KEY = 'cliper_custom_fonts';

// Contoh data transkrip awal ala student-kit (1-3 kata/chunk, word-level sync)
const INITIAL_CHUNKS: Chunk[] = [
	{
		id: 'c1',
		start: 0.15,
		end: 1.1,
		words: [
			{ id: 'w1', text: 'HALO', start: 0.15, end: 0.55, cut: false, accent: false },
			{ id: 'w2', text: 'SEMUA', start: 0.56, end: 1.1, cut: false, accent: true }
		]
	},
	{
		id: 'c2',
		start: 1.15,
		end: 2.3,
		words: [
			{ id: 'w3', text: 'HARI', start: 1.15, end: 1.45, cut: false, accent: false },
			{ id: 'w4', text: 'INI', start: 1.46, end: 1.75, cut: false, accent: false },
			{ id: 'w5', text: 'KITA', start: 1.76, end: 2.3, cut: false, accent: false }
		]
	},
	{
		id: 'c3',
		start: 2.35,
		end: 3.4,
		words: [
			{ id: 'w6', text: 'BAHAS', start: 2.35, end: 2.8, cut: false, accent: false },
			{ id: 'w7', text: 'CLIPER', start: 2.81, end: 3.4, cut: false, accent: true }
		]
	},
	{
		id: 'c4',
		start: 3.45,
		end: 4.8,
		words: [
			{ id: 'w8', text: 'STUDIO', start: 3.45, end: 3.9, cut: false, accent: false },
			{ id: 'w9', text: 'VIDEO', start: 3.91, end: 4.35, cut: false, accent: false },
			{ id: 'w10', text: 'VERTIKAL', start: 4.36, end: 4.8, cut: false, accent: true }
		]
	},
	{
		id: 'c5',
		start: 4.85,
		end: 6.1,
		words: [
			{ id: 'w11', text: 'DENGAN', start: 4.85, end: 5.2, cut: false, accent: false },
			{ id: 'w12', text: 'POLA', start: 5.21, end: 5.6, cut: false, accent: false },
			{ id: 'w13', text: 'EDL', start: 5.61, end: 6.1, cut: false, accent: false }
		]
	},
	{
		id: 'c6',
		start: 6.15,
		end: 7.3,
		words: [
			{ id: 'w14', text: 'KOREKSI', start: 6.15, end: 6.6, cut: false, accent: false },
			{ id: 'w15', text: 'KATA', start: 6.61, end: 6.95, cut: false, accent: false },
			{ id: 'w16', text: 'CEPAT', start: 6.96, end: 7.3, cut: false, accent: true }
		]
	},
	{
		id: 'c7',
		start: 7.35,
		end: 8.7,
		words: [
			{ id: 'w17', text: 'POTONG', start: 7.35, end: 7.8, cut: false, accent: false },
			{ id: 'w18', text: 'BAGIAN', start: 7.81, end: 8.2, cut: false, accent: false },
			{ id: 'w19', text: 'SALAH', start: 8.21, end: 8.7, cut: false, accent: false }
		]
	},
	{
		id: 'c8',
		start: 8.75,
		end: 10.2,
		words: [
			{ id: 'w20', text: 'RENDER', start: 8.75, end: 9.3, cut: false, accent: false },
			{ id: 'w21', text: 'LANGSUNG', start: 9.31, end: 9.75, cut: false, accent: false },
			{ id: 'w22', text: 'SELESAI', start: 9.76, end: 10.2, cut: false, accent: true }
		]
	}
];

// Helper guard: pecah kata anomali ber-spasi atau > 40 karakter jadi kata mandiri
function splitAnomalousWord(
	rawText: string,
	rawStart: number,
	rawEnd: number,
	baseId: string
): Word[] {
	const trimmed = String(rawText || '').trim();
	if (!trimmed) return [];

	const hasWhitespace = /\s/.test(trimmed);
	const isTooLong = trimmed.length > 40;

	if (!hasWhitespace && !isTooLong) {
		return [
			{
				id: baseId,
				text: trimmed,
				start: rawStart,
				end: rawEnd > rawStart ? rawEnd : rawStart + 0.4,
				cut: false,
				accent: false
			}
		];
	}

	const parts = hasWhitespace
		? trimmed.split(/\s+/).filter(Boolean)
		: trimmed.match(/.{1,40}/g) || [trimmed];

	if (parts.length === 0) return [];

	const duration = rawEnd > rawStart ? rawEnd - rawStart : 0;
	const isZeroDur = duration <= 0;
	const segDur = isZeroDur ? 0.4 : duration / parts.length;

	return parts.map((part, idx) => {
		const start = isZeroDur
			? Math.round((rawStart + idx * 0.4) * 100) / 100
			: Math.round((rawStart + idx * segDur) * 100) / 100;
		const end = isZeroDur
			? Math.round((start + 0.4) * 100) / 100
			: Math.round((rawStart + (idx + 1) * segDur) * 100) / 100;

		return {
			id: `${baseId}-${idx}`,
			text: part,
			start,
			end,
			cut: false,
			accent: false
		};
	});
}

export class CliperStore {
	// Video state
	videoFile = $state<File | null>(null);
	videoUrl = $state<string>('');
	videoWidth = $state<number>(1920);
	videoHeight = $state<number>(1080);
	currentTime = $state<number>(0);
	duration = $state<number>(10.5);
	isPlaying = $state<boolean>(false);
	videoElement = $state<HTMLVideoElement | null>(null);
	uploadStatus = $state<'idle' | 'uploading' | 'done' | 'error'>('idle');
	uploading = $state<boolean>(false);
	uploadProgress = $state<number>(0);
	uploadStatusText = $state<string>('');
	uploadError = $state<string | null>(null);
	uploadSuccess = $state<boolean>(false);

	// Wizard state (terpisah dari editor utama)
	wizard = $state<WizardConfig>({
		isOpen: false,
		step: 1,
		targetRatio: '9:16',
		clipCount: 1,
		clipRanges: [],
		cropMode: 'auto',
		subtitlePreset: 'bold-outline',
		fontDefault: 'Montserrat'
	});

	// Transcript & EDL state
	chunks = $state<Chunk[]>(INITIAL_CHUNKS);
	fileKey = $state<string>('');
	transcribeStatus = $state<'idle' | 'loading' | 'error'>('idle');
	transcribeErrorMessage = $state<string | null>(null);
	transcribeSuccessMessage = $state<string | null>(null);
	hasRealTranscript = $state<boolean>(false);

	// Caption style (Abril Fatface default ala student-kit)
	captionStyle = $state<CaptionStyle>({
		fontFamily: 'Abril Fatface',
		fontSize: 64,
		allCaps: true,
		primaryColor: '#FFFFFF',
		accentColor: '#FACC15',
		boxBg: 'rgba(12, 16, 26, 0.88)',
		boxBorder: 'rgba(255, 255, 255, 0.22)',
		positionY: 72 // 72% dari atas: seam/dada (bukan dagu)
	});

	// Custom fonts
	customFonts = $state<CustomFont[]>([]);

	// Face track framing
	cropX = $state<number>(0); // -100 s/d 100
	faceBox = $state<{ x: number; y: number; width: number; height: number }>({
		x: 50,
		y: 28,
		width: 32,
		height: 28
	});

	// API URL backend
	apiUrl = $state<string>(API_URL);

	// Render config
	render = $state<RenderConfig>({
		layout: 'fill',
		cropX: 0,
		status: 'idle',
		progress: 0,
		ffmpegPreview: ''
	});

	private renderPollTimeout: ReturnType<typeof setTimeout> | null = null;

	// Active tab on right panel
	activeTab = $state<'transcript' | 'font' | 'render'>('transcript');

	constructor() {
		if (typeof window !== 'undefined') {
			this.loadStorage();
		}
	}

	loadStorage() {
		try {
			const savedFonts = localStorage.getItem(STORAGE_CUSTOM_FONTS_KEY);
			if (savedFonts) {
				this.customFonts = JSON.parse(savedFonts);
				for (const font of this.customFonts) {
					this.injectFontFace(font);
				}
			}
		} catch (err) {
			console.error('Gagal baca localStorage:', err);
		}
	}

	// Derived: all words flat list
	get allWords(): Word[] {
		return this.chunks.flatMap((c) => c.words);
	}

	// Derived: EDL cuts list
	get cuts(): CutRange[] {
		const result: CutRange[] = [];
		for (const chunk of this.chunks) {
			for (const word of chunk.words) {
				if (word.cut) {
					result.push({
						id: `cut-${word.id}`,
						wordId: word.id,
						start: word.start,
						end: word.end,
						text: word.text
					});
				}
			}
		}
		return result;
	}

	// Derived: active chunk based on currentTime
	get activeChunk(): Chunk | null {
		const t = this.currentTime;
		const found = this.chunks.find((c) => t >= c.start && t <= c.end + 0.15);
		return found || null;
	}

	// Derived: active word based on currentTime
	get activeWord(): Word | null {
		const t = this.currentTime;
		if (!this.activeChunk) return null;
		const words = this.activeChunk.words.filter((w) => !w.cut);
		if (words.length === 0) return null;

		// 1. Sedang tepat di dalam rentang waktu kata
		const current = words.find((w) => t >= w.start && t <= w.end);
		if (current) return current;

		// 2. Toleransi trailing jeda mikro antar kata (80ms)
		const near = words.find((w) => t >= w.start && t <= w.end + 0.08);
		if (near) return near;

		// 3. Jika sudah melewati kata terakhir di chunk tapi chunk masih tampil
		const lastWord = words[words.length - 1];
		if (t > lastWord.end) {
			return lastWord;
		}

		return null;
	}

	// Video playback helpers
	seekTo(seconds: number) {
		const target = Math.max(0, Math.min(seconds, this.duration));
		this.currentTime = target;
		if (this.videoElement) {
			this.videoElement.currentTime = target;
		}
	}

	togglePlay() {
		if (this.videoElement) {
			if (this.videoElement.paused) {
				this.videoElement.play().catch((err) => console.warn('Play error:', err));
				this.isPlaying = true;
			} else {
				this.videoElement.pause();
				this.isPlaying = false;
			}
			return;
		}

		// Fallback simulasi hanya bila belum ada video terunggah (state kosong)
		if (!this.videoUrl) {
			this.isPlaying = !this.isPlaying;
		}
	}

	handleFileSelect(file: File) {
		this.videoFile = file;
		this.fileKey = '';
		this.uploadStatus = 'idle';
		this.uploadProgress = 0;
		this.uploadStatusText = '';
		this.uploadError = null;
		this.uploadSuccess = false;
		this.isPlaying = false;
		this.currentTime = 0;
		if (this.videoUrl && this.videoUrl.startsWith('blob:')) {
			URL.revokeObjectURL(this.videoUrl);
		}
		this.videoUrl = URL.createObjectURL(file);
	}

	setVideoMetadata(width: number, height: number, duration?: number) {
		if (width > 0) this.videoWidth = width;
		if (height > 0) this.videoHeight = height;
		if (duration && duration > 0) {
			this.duration = duration;
		}
	}

	openWizard() {
		const dur = Math.max(1, this.duration || 10.5);
		const autoCount = Math.max(1, Math.min(12, Math.round(dur / 45)));
		this.wizard.clipCount = autoCount;
		this.recalculateWizardRanges(dur, autoCount);
		this.wizard.step = 1;
		this.wizard.isOpen = true;
	}

	closeWizard() {
		this.wizard.isOpen = false;
	}

	setWizardStep(step: 1 | 2 | 3 | 4) {
		this.wizard.step = step;
	}

	setWizardTargetRatio(ratio: AspectRatioTarget) {
		this.wizard.targetRatio = ratio;
	}

	setWizardCropMode(mode: CropMode) {
		this.wizard.cropMode = mode;
	}

	setWizardSubtitlePreset(preset: SubtitlePreset) {
		this.wizard.subtitlePreset = preset;
	}

	setWizardFontDefault(font: string) {
		this.wizard.fontDefault = font;
	}

	setWizardClipCount(count: number) {
		const clamped = Math.max(1, Math.min(12, count));
		this.wizard.clipCount = clamped;
		this.recalculateWizardRanges(this.duration || 10.5, clamped);
	}

	setWizardClipLength(lengthSec: number) {
		const dur = this.duration || 10.5;
		const safeLength = Math.max(10, lengthSec);
		const count = Math.max(1, Math.min(12, Math.round(dur / safeLength)));
		this.wizard.clipCount = count;
		this.recalculateWizardRanges(dur, count);
	}

	recalculateWizardRanges(duration: number, count: number) {
		const ranges: ClipRange[] = [];
		const segLen = duration / count;
		for (let i = 0; i < count; i++) {
			ranges.push({
				index: i + 1,
				start: Math.round(i * segLen * 10) / 10,
				end: Math.round(Math.min((i + 1) * segLen, duration) * 10) / 10
			});
		}
		this.wizard.clipRanges = ranges;
	}

	applyWizardSettings() {
		// 1. Crop Mode & Layout
		if (this.wizard.cropMode === 'split') {
			this.render.layout = 'split';
		} else {
			this.render.layout = 'fill';
			if (this.wizard.cropMode === 'center') {
				this.cropX = 0;
			}
		}

		// 2. Preset Subtitle
		const font = this.wizard.fontDefault || 'Montserrat';
		if (this.wizard.subtitlePreset === 'bold-outline') {
			this.captionStyle = {
				...this.captionStyle,
				fontFamily: font,
				fontSize: 64,
				allCaps: true,
				primaryColor: '#FFFFFF',
				accentColor: '#FACC15',
				boxBg: 'rgba(12, 16, 26, 0.88)',
				boxBorder: '#FFFFFF',
				positionY: 72
			};
		} else if (this.wizard.subtitlePreset === 'dark-box') {
			this.captionStyle = {
				...this.captionStyle,
				fontFamily: font,
				fontSize: 64,
				allCaps: true,
				primaryColor: '#F8FAFC',
				accentColor: '#38BDF8',
				boxBg: 'rgba(0, 0, 0, 0.92)',
				boxBorder: 'rgba(255, 255, 255, 0.22)',
				positionY: 72
			};
		} else if (this.wizard.subtitlePreset === 'minimal') {
			this.captionStyle = {
				...this.captionStyle,
				fontFamily: font,
				fontSize: 58,
				allCaps: false,
				primaryColor: '#FFFFFF',
				accentColor: '#10B981',
				boxBg: 'transparent',
				boxBorder: 'transparent',
				positionY: 75
			};
		}

		this.wizard.isOpen = false;
	}

	async applyWizardAndProcess() {
		this.applyWizardSettings();
		if (this.fileKey && this.uploadStatus === 'done') {
			await this.transcribeClip();
		} else if (this.videoFile && this.uploadStatus !== 'uploading') {
			const key = await this.uploadVideo();
			if (key) {
				await this.transcribeClip();
			}
		}
	}

	async uploadVideo(): Promise<string | null> {
		if (!this.videoFile) {
			this.uploadStatus = 'error';
			this.uploadError = 'Pilih file video terlebih dahulu';
			return null;
		}

		this.uploadStatus = 'uploading';
		this.uploading = true;
		this.uploadProgress = 15;
		this.uploadStatusText = 'Mengupload…';
		this.uploadError = null;

		const targetUrl = `${this.apiUrl.replace(/\/$/, '')}/api/upload-direct`;

		try {
			const formData = new FormData();
			formData.append('file', this.videoFile);

			this.uploadProgress = 40;

			const res = await fetch(targetUrl, {
				method: 'POST',
				body: formData
			});

			this.uploadProgress = 85;

			if (!res.ok) {
				const errJson = await res.json().catch(() => ({}));
				throw new Error(errJson.error || `Server respon: ${res.status} ${res.statusText}`);
			}

			const json = await res.json().catch(() => ({}));
			const serverKey = json.fileKey || json.key;
			if (!serverKey) {
				throw new Error('Respon backend tidak mengandung fileKey');
			}

			this.fileKey = serverKey;
			this.uploadStatus = 'done';
			this.uploadProgress = 100;
			this.uploadSuccess = true;

			const sizeMb = (this.videoFile.size / (1024 * 1024)).toFixed(1);
			this.uploadStatusText = `Terupload: ${this.videoFile.name} (${sizeMb} MB)`;

			if (json.videoUrl) {
				this.videoUrl = json.videoUrl;
			}

			if (!this.wizard.isOpen) {
				this.openWizard();
			}

			return serverKey;
		} catch (err: any) {
			this.uploadStatus = 'error';
			this.uploadError = err.message || 'Gagal mengunggah video ke server';
			this.uploadStatusText = '';
			this.fileKey = '';
			this.uploadSuccess = false;
			return null;
		} finally {
			this.uploading = false;
		}
	}

	// Transcript actions
	async transcribeClip(language = 'id') {
		if (this.uploadStatus !== 'done' || !this.fileKey || !this.apiUrl || this.transcribeStatus === 'loading') {
			return;
		}

		this.transcribeStatus = 'loading';
		this.transcribeErrorMessage = null;
		this.transcribeSuccessMessage = null;

		try {
			const res = await fetch(`${this.apiUrl.replace(/\/$/, '')}/api/clips/transcribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileKey: this.fileKey,
					language
				})
			});

			if (!res.ok) {
				const errJson = await res.json().catch(() => ({}));
				throw new Error(errJson.error || `Server merespon ${res.status}: ${res.statusText}`);
			}

			const data = await res.json().catch(() => ({}));
			const transcript = data.transcript;
			if (!transcript) {
				throw new Error('Respon backend tidak memiliki objek transcript');
			}

			const isEstimated = Boolean(transcript.noTimestamps);
			let newChunks: Chunk[] = [];

			if (Array.isArray(transcript.chunks) && transcript.chunks.length > 0) {
				for (let cIdx = 0; cIdx < transcript.chunks.length; cIdx++) {
					const ch = transcript.chunks[cIdx];
					const rawWords = Array.isArray(ch.words) ? ch.words : [];
					const words: Word[] = rawWords.flatMap((w: any, wIdx: number) =>
						splitAnomalousWord(
							w.word || w.text || '',
							Number(w.start) || 0,
							Number(w.end) || 0,
							`w-stt-${cIdx}-${wIdx}`
						)
					);

					if (words.length > 0) {
						if (words.length > 3) {
							for (let i = 0; i < words.length; i += 3) {
								const slice = words.slice(i, i + 3);
								newChunks.push({
									id: `c-stt-${cIdx}-${i}`,
									start: slice[0].start,
									end: slice[slice.length - 1].end,
									text: slice.map((w) => w.text).join(' '),
									words: slice,
									estimated: isEstimated
								});
							}
						} else {
							newChunks.push({
								id: `c-stt-${cIdx}`,
								start: Number(ch.start) || words[0].start,
								end: Number(ch.end) || words[words.length - 1].end,
								text: ch.text || words.map((w) => w.text).join(' '),
								words,
								estimated: isEstimated
							});
						}
					}
				}
			}

			if (newChunks.length === 0 && Array.isArray(transcript.words) && transcript.words.length > 0) {
				const mappedWords: Word[] = transcript.words.flatMap((w: any, idx: number) =>
					splitAnomalousWord(
						w.word || w.text || '',
						Number(w.start) || 0,
						Number(w.end) || 0,
						`w-stt-${idx}`
					)
				);

				// Kelompokkan 3 kata per chunk (format student-kit)
				for (let i = 0; i < mappedWords.length; i += 3) {
					const slice = mappedWords.slice(i, i + 3);
					newChunks.push({
						id: `c-stt-${i}`,
						start: slice[0].start,
						end: slice[slice.length - 1].end,
						text: slice.map((w) => w.text).join(' '),
						words: slice,
						estimated: isEstimated
					});
				}
			}

			if (newChunks.length > 0) {
				this.chunks = newChunks;
				this.hasRealTranscript = true;
				this.transcribeStatus = 'idle';
				const totalWords = newChunks.reduce((acc, c) => acc + c.words.length, 0);
				this.transcribeSuccessMessage = `Transkrip masuk: ${totalWords} kata`;
				this.activeTab = 'transcript';
			} else {
				throw new Error('Hasil transkrip kosong / tidak ada kata terdeteksi');
			}
		} catch (err: any) {
			this.transcribeStatus = 'error';
			this.transcribeErrorMessage = err.message || 'Gagal memanggil endpoint STT transkripsi';
		}
	}

	updateWordText(chunkId: string, wordId: string, newText: string) {
		const chunk = this.chunks.find((c) => c.id === chunkId);
		if (!chunk) return;
		const word = chunk.words.find((w) => w.id === wordId);
		if (word) {
			word.text = newText;
		}
	}

	toggleWordCut(chunkId: string, wordId: string) {
		const chunk = this.chunks.find((c) => c.id === chunkId);
		if (!chunk) return;
		const word = chunk.words.find((w) => w.id === wordId);
		if (word) {
			word.cut = !word.cut;
		}
	}

	toggleWordAccent(chunkId: string, wordId: string) {
		const chunk = this.chunks.find((c) => c.id === chunkId);
		if (!chunk) return;
		const word = chunk.words.find((w) => w.id === wordId);
		if (!word) return;

		// Hitung kuota aksen: max 20% kata dalam chunk (atau minimal 1 kata jika chunk kecil)
		const currentAccented = chunk.words.filter((w) => w.accent && w.id !== wordId).length;
		const maxAllowed = Math.max(1, Math.ceil(chunk.words.length * 0.2));

		if (!word.accent && currentAccented >= maxAllowed) {
			// Matikan aksen kata lain dulu agar patuh aturan max 20%
			for (const other of chunk.words) {
				if (other.accent) other.accent = false;
			}
		}
		word.accent = !word.accent;
	}

	rechunk(maxWords = 3) {
		// Mengumpulkan seluruh kata lalu susun ulang menjadi chunks 1-3 kata (atau hingga maxWords)
		const words = this.allWords;
		if (words.length === 0) return;

		const targetSize = Math.max(1, Math.min(maxWords, 5));
		const newChunks: Chunk[] = [];

		for (let i = 0; i < words.length; i += targetSize) {
			const slice = words.slice(i, i + targetSize);
			newChunks.push({
				id: `c-rechunk-${i}`,
				start: slice[0].start,
				end: slice[slice.length - 1].end,
				words: slice
			});
		}

		this.chunks = newChunks;
	}

	nudgeChunk(chunkId: string, deltaSeconds: number) {
		const chunk = this.chunks.find((c) => c.id === chunkId);
		if (!chunk || chunk.words.length === 0) return;

		const minStart = Math.min(...chunk.words.map((w) => w.start));
		let actualDelta = deltaSeconds;
		if (minStart + actualDelta < 0) {
			actualDelta = -minStart;
		}

		for (const w of chunk.words) {
			const dur = Math.max(0.05, Math.round((w.end - w.start) * 100) / 100);
			const newStart = Math.max(0, Math.round((w.start + actualDelta) * 100) / 100);
			const newEnd = Math.round((newStart + dur) * 100) / 100;
			w.start = newStart;
			w.end = Math.max(newStart + 0.05, newEnd);
		}

		chunk.start = chunk.words[0].start;
		chunk.end = chunk.words[chunk.words.length - 1].end;

		this.seekTo(chunk.start);
	}

	// Font actions
	importFont(file: File) {
		const reader = new FileReader();
		const fontName = file.name.replace(/\.[^/.]+$/, '').trim();
		const format = file.name.endsWith('.woff2')
			? 'woff2'
			: file.name.endsWith('.woff')
				? 'woff'
				: 'truetype';

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			const newFont: CustomFont = { name: fontName, dataUrl, format };

			this.injectFontFace(newFont);
			this.customFonts = [...this.customFonts.filter((f) => f.name !== fontName), newFont];
			this.captionStyle.fontFamily = fontName;

			try {
				localStorage.setItem(STORAGE_CUSTOM_FONTS_KEY, JSON.stringify(this.customFonts));
			} catch (err) {
				console.warn('Gagal simpan font ke localStorage:', err);
			}
		};
		reader.readAsDataURL(file);
	}

	injectFontFace(font: CustomFont) {
		if (typeof document === 'undefined') return;
		const fontFaceId = `font-face-${font.name.replace(/\s+/g, '-')}`;
		let styleEl = document.getElementById(fontFaceId) as HTMLStyleElement | null;
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = fontFaceId;
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = `
			@font-face {
				font-family: '${font.name}';
				src: url('${font.dataUrl}') format('${font.format}');
				font-display: swap;
			}
		`;
	}

	// Render actions
	generateFfmpegCommand(): string {
		const cuts = this.cuts;
		const cropOffset = Math.round((this.cropX / 100) * 240);
		const cropParam = `crop=ih*9/16:ih:(iw-ih*9/16)/2+${cropOffset}:0`;
		const filterChain =
			this.render.layout === 'split'
				? `[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,boxblur=20:5[bg_blur];[fg]scale=1080:-1[fg_scaled];[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2`
				: `[0:v]${cropParam},scale=1080:1920`;

		const cutCount = cuts.length;
		const cutsComment = cutCount > 0 ? `# Memotong ${cutCount} kata dari daftar EDL\n` : '';

		return `${cutsComment}ffmpeg -i input.mp4 \\
  -filter_complex "${filterChain}" \\
  -c:v libx264 -preset fast -crf 20 \\
  -c:a aac -b:a 192k \\
  -y output_916_${this.render.layout}.mp4`;
	}

	resolveResultUrl(pathOrUrl: string): string {
		if (!pathOrUrl) return '';
		if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('blob:')) {
			return pathOrUrl;
		}
		const base = this.apiUrl.replace(/\/$/, '');
		const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
		return `${base}${cleanPath}`;
	}

	clearRenderPoll() {
		if (this.renderPollTimeout) {
			clearTimeout(this.renderPollTimeout);
			this.renderPollTimeout = null;
		}
	}

	startRenderPolling(jobId: string) {
		this.clearRenderPoll();

		const startTime = Date.now();
		const TIMEOUT_MS = 5 * 60 * 1000; // batas aman 5 menit
		const POLL_INTERVAL_MS = 1200; // polling GET tiap ~1.2 detik

		const poll = async () => {
			if (Date.now() - startTime > TIMEOUT_MS) {
				this.render.status = 'failed';
				this.render.error = 'Render timeout: proses melebihi batas waktu aman (5 menit)';
				this.clearRenderPoll();
				return;
			}

			try {
				const statusUrl = `${this.apiUrl.replace(/\/$/, '')}/api/clips/render/${encodeURIComponent(jobId)}`;
				const res = await fetch(statusUrl);

				if (!res.ok) {
					let errMsg = `Gagal memeriksa status render (${res.status} ${res.statusText})`;
					try {
						const errData = await res.json();
						if (errData?.error) errMsg = errData.error;
						else if (errData?.message) errMsg = errData.message;
					} catch {
						// ignore parse error
					}
					throw new Error(errMsg);
				}

				const data: {
					jobId?: string;
					status?: 'queued' | 'processing' | 'done' | 'failed';
					progress?: number;
					resultUrl?: string;
					error?: string;
					duration?: number;
					size?: number;
				} = await res.json();

				if (data.status) {
					this.render.status = data.status;
				}
				if (typeof data.progress === 'number') {
					this.render.progress = Math.max(0, Math.min(100, Math.round(data.progress)));
				}

				if (data.status === 'done') {
					this.render.status = 'done';
					this.render.progress = 100;
					if (data.resultUrl) {
						this.render.resultUrl = this.resolveResultUrl(data.resultUrl);
					}
					if (typeof data.duration === 'number') this.render.duration = data.duration;
					if (typeof data.size === 'number') this.render.size = data.size;
					this.clearRenderPoll();
					return;
				}

				if (data.status === 'failed') {
					this.render.status = 'failed';
					this.render.error = data.error || 'Proses render gagal di server';
					this.clearRenderPoll();
					return;
				}

				// Lanjut polling jika masih queued atau processing
				this.renderPollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
			} catch (err: any) {
				this.render.status = 'failed';
				this.render.error = err?.message || 'Koneksi ke server render terputus';
				this.clearRenderPoll();
			}
		};

		this.renderPollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
	}

	async sendRenderJob() {
		if (this.render.status === 'queued' || this.render.status === 'processing') {
			return;
		}

		this.clearRenderPoll();
		this.render.status = 'queued';
		this.render.progress = 0;
		this.render.error = undefined;
		this.render.resultUrl = undefined;
		this.render.jobId = undefined;
		this.render.duration = undefined;
		this.render.size = undefined;
		this.render.ffmpegPreview = this.generateFfmpegCommand();

		let layout: 'portrait' | 'landscape' | 'square' = 'portrait';
		if (this.wizard.targetRatio === '1:1') {
			layout = 'square';
		} else if (this.wizard.targetRatio === '16:9') {
			layout = 'landscape';
		} else {
			layout = 'portrait';
		}

		const normalizedCropX = Math.max(
			0,
			Math.min(1, Number(((this.cropX + 100) / 200).toFixed(4)))
		);

		const payload = {
			clipId: this.fileKey || 'source.mp4',
			layout,
			cropX: normalizedCropX,
			cuts: this.cuts.map((c) => ({
				start: Number(c.start.toFixed(3)),
				end: Number(c.end.toFixed(3))
			})),
			chunks: this.chunks.map((c) => ({
				id: c.id,
				start: Number(c.start.toFixed(3)),
				end: Number(c.end.toFixed(3)),
				words: c.words.map((w) => ({
					id: w.id,
					text: w.text,
					start: Number(w.start.toFixed(3)),
					end: Number(w.end.toFixed(3)),
					cut: !!w.cut,
					accent: !!w.accent
				}))
			})),
			captionStyle: {
				fontFamily: this.captionStyle.fontFamily,
				fontSize: this.captionStyle.fontSize,
				allCaps: this.captionStyle.allCaps,
				color: this.captionStyle.primaryColor,
				accentColor: this.captionStyle.accentColor
			}
		};

		try {
			const renderUrl = `${this.apiUrl.replace(/\/$/, '')}/api/clips/render`;
			const res = await fetch(renderUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				let errMsg = `Server respon: ${res.status} ${res.statusText}`;
				try {
					const errJson = await res.json();
					if (errJson?.error) errMsg = errJson.error;
					else if (errJson?.message) errMsg = errJson.message;
				} catch {
					// ignore json error
				}
				throw new Error(errMsg);
			}

			const data = await res.json();
			if (!data?.jobId) {
				throw new Error('Respon backend tidak mengandung jobId');
			}

			this.render.jobId = data.jobId;
			this.render.status = data.status || 'queued';
			this.render.progress = typeof data.progress === 'number' ? data.progress : 5;
			if (data.ffmpegPreview) {
				this.render.ffmpegPreview = data.ffmpegPreview;
			}

			this.startRenderPolling(data.jobId);
		} catch (err: any) {
			this.render.status = 'failed';
			this.render.error = err?.message || 'Gagal mengirim job render ke server';
		}
	}
}

export const cliperStore = new CliperStore();
