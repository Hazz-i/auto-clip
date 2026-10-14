<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	// Mengonversi waktu ke format MM:SS.ms
	function formatTime(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		const ms = Math.floor((sec % 1) * 10);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
	}

	function handleTimelineSeek(e: Event) {
		const target = e.target as HTMLInputElement;
		cliperStore.seekTo(parseFloat(target.value));
	}

	// Skala offset horizontal dari slider cropX (-100 ke 100)
	const cropTransform = $derived(`translateX(calc(-50% + ${cliperStore.cropX * 1.5}px))`);

	// Sinkronisasi playhead satu-satunya sumber waktu:
	// - Bila video nyata ada: update currentTime mentah via rAF saat playing + timeupdate
	// - Fallback simulasi HANYA bila belum ada video terunggah (state kosong)
	let animFrameId: number | null = null;
	let lastMockTimestamp = 0;

	$effect(() => {
		if (cliperStore.isPlaying) {
			if (cliperStore.videoUrl && cliperStore.videoElement) {
				const syncRealVideo = () => {
					if (cliperStore.videoElement && !cliperStore.videoElement.paused) {
						cliperStore.currentTime = cliperStore.videoElement.currentTime;
						animFrameId = requestAnimationFrame(syncRealVideo);
					}
				};
				animFrameId = requestAnimationFrame(syncRealVideo);
			} else if (!cliperStore.videoUrl) {
				lastMockTimestamp = 0;
				const stepMock = (timestamp: number) => {
					if (!lastMockTimestamp) lastMockTimestamp = timestamp;
					const delta = (timestamp - lastMockTimestamp) / 1000;
					lastMockTimestamp = timestamp;

					if (cliperStore.currentTime + delta >= cliperStore.duration) {
						cliperStore.currentTime = 0;
					} else {
						cliperStore.currentTime += delta;
					}

					if (cliperStore.isPlaying && !cliperStore.videoUrl) {
						animFrameId = requestAnimationFrame(stepMock);
					}
				};
				animFrameId = requestAnimationFrame(stepMock);
			}
		} else {
			lastMockTimestamp = 0;
			if (animFrameId) {
				cancelAnimationFrame(animFrameId);
				animFrameId = null;
			}
		}

		return () => {
			if (animFrameId) {
				cancelAnimationFrame(animFrameId);
				animFrameId = null;
			}
		};
	});
</script>

<div class="panel panel-center">
	<div class="preview-toolbar">
		<div class="toolbar-left">
			<span class="preview-badge">Format 9:16 (1080×1920)</span>
			<span class="layout-indicator">Mode: <strong>{cliperStore.render.layout.toUpperCase()}</strong></span>
		</div>
		<div class="toolbar-right">
			<button class="btn btn-secondary btn-sm" onclick={() => (cliperStore.cropX = 0)}>
				Reset Crop
			</button>
		</div>
	</div>

	<!-- Kontainer Frame 9:16 (Dimensi Skala Representasi 1080x1920) -->
	<div class="canvas-916-wrapper">
		<div class="canvas-916">
			<!-- Layer Video Background (Split atau Fill) -->
			{#if cliperStore.render.layout === 'split'}
				<!-- Mode Split: Background blur atmosferik + video fokus di atas/tengah -->
				<div class="split-bg-blur">
					{#if cliperStore.videoUrl}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							src={cliperStore.videoUrl}
							class="video-blur"
							currentTime={cliperStore.currentTime}
							muted
							playsinline
						></video>
					{:else}
						<div class="mock-bg-gradient"></div>
					{/if}
				</div>
			{/if}

			<!-- Video Utama (Fill atau FG Split) -->
			<div
				class="video-viewport"
				class:layout-split={cliperStore.render.layout === 'split'}
				class:layout-fill={cliperStore.render.layout === 'fill'}
			>
				{#if cliperStore.videoUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={cliperStore.videoUrl}
						class="main-916-video"
						style:transform={cropTransform}
						playsinline
						bind:this={cliperStore.videoElement}
						ontimeupdate={() => {
							if (cliperStore.videoElement) {
								cliperStore.currentTime = cliperStore.videoElement.currentTime;
							}
						}}
						onseeking={() => {
							if (cliperStore.videoElement) {
								cliperStore.currentTime = cliperStore.videoElement.currentTime;
							}
						}}
						onseeked={() => {
							if (cliperStore.videoElement) {
								cliperStore.currentTime = cliperStore.videoElement.currentTime;
							}
						}}
						onplay={() => {
							cliperStore.isPlaying = true;
						}}
						onpause={() => {
							cliperStore.isPlaying = false;
						}}
						onended={() => {
							cliperStore.isPlaying = false;
						}}
						onloadedmetadata={(e) => {
							const v = e.currentTarget;
							cliperStore.setVideoMetadata(v.videoWidth, v.videoHeight, v.duration);
						}}
						onclick={() => cliperStore.togglePlay()}
					></video>
				{:else}
					<!-- Visual mockup jika belum ada file video yang diunggah -->
					<div class="mock-actor-scene" onclick={() => cliperStore.togglePlay()} role="button" tabindex="0" onkeydown={(e) => e.key === ' ' && cliperStore.togglePlay()}>
						<div class="mock-person-silhouette">
							<div class="person-head"></div>
							<div class="person-torso"></div>
						</div>
						<div class="mock-play-overlay">
							<span class="mock-icon">{cliperStore.isPlaying ? '❚❚' : '▶'}</span>
							<p class="mock-hint">Klik untuk putar preview demo</p>
						</div>
					</div>
				{/if}

				<!-- Overlay Face-Track Guideline Box (Visualisasi deteksi wajah) -->
				<div
					class="face-track-overlay"
					style:left="calc({cliperStore.faceBox.x}% + {cliperStore.cropX * 0.4}px)"
					style:top="{cliperStore.faceBox.y}%"
					style:width="{cliperStore.faceBox.width}%"
					style:height="{cliperStore.faceBox.height}%"
				>
					<span class="track-tag">FACE TRACK [AUTO]</span>
					<div class="track-crosshair"></div>
					<div class="track-chin-safe">CHIN SAFE LINE</div>
				</div>

				<!-- Overlay Garis Panduan Dada/Seam (Safe Zone Penempatan Teks) -->
				<div class="seam-line" style:top="{cliperStore.captionStyle.positionY}%">
					<span class="seam-label">SEAM / DADA</span>
				</div>

				<!-- Overlay Caption Box: Box Gelap Tepi Terang ala HyperFrames Student-Kit -->
				{#if cliperStore.activeChunk}
					<div
						class="caption-box-container"
						style:top="{cliperStore.captionStyle.positionY}%"
					>
						<div
							class="caption-box"
							style:background={cliperStore.captionStyle.boxBg}
							style:border="1.5px solid {cliperStore.captionStyle.boxBorder}"
							style:font-family={cliperStore.captionStyle.fontFamily}
							style:text-transform={cliperStore.captionStyle.allCaps ? 'uppercase' : 'none'}
							style:--active-accent={cliperStore.captionStyle.accentColor}
						>
							{#each cliperStore.activeChunk.words as word (word.id)}
								{#if !word.cut}
									<span
										class="caption-word"
										class:is-active={cliperStore.activeWord?.id === word.id}
										class:is-accent={word.accent}
										style:color={cliperStore.activeWord?.id === word.id
											? cliperStore.captionStyle.accentColor
											: word.accent
												? cliperStore.captionStyle.accentColor
												: cliperStore.captionStyle.primaryColor}
										style:font-size="{Math.round(cliperStore.captionStyle.fontSize * 0.32)}px"
									>
										{word.text}
									</span>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Visual Rule-of-Thirds Grid Subtil -->
			<div class="grid-guides">
				<div class="guide-h" style:top="33.33%"></div>
				<div class="guide-h" style:top="66.66%"></div>
				<div class="guide-v" style:left="33.33%"></div>
				<div class="guide-v" style:left="66.66%"></div>
			</div>
		</div>
	</div>

	<!-- Kontrol Playback & Slider Manual CropX -->
	<div class="preview-controls-bar">
		<div class="playback-actions">
			<button class="btn btn-secondary btn-sm play-btn" onclick={() => cliperStore.togglePlay()}>
				{cliperStore.isPlaying ? 'Jeda' : 'Putar'}
			</button>
			<span class="time-display">
				{formatTime(cliperStore.currentTime)} / {formatTime(cliperStore.duration)}
			</span>
		</div>

		<!-- Scrubber Timeline -->
		<div class="timeline-slider-row">
			<input
				type="range"
				min="0"
				max={cliperStore.duration || 10}
				step="0.05"
				value={cliperStore.currentTime}
				oninput={handleTimelineSeek}
				class="timeline-slider"
			/>
		</div>

		<!-- Slider Manual CropX (-100 s/d 100) -->
		<div class="crop-slider-card">
			<div class="crop-header">
				<span class="crop-label">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M6 2v14a2 2 0 0 0 2 2h14" />
						<path d="M18 22V8a2 2 0 0 0-2-2H2" />
					</svg>
					Framing Horizontal (CropX Face-Track)
				</span>
				<span class="crop-value">{cliperStore.cropX > 0 ? `+${cliperStore.cropX}` : cliperStore.cropX}</span>
			</div>
			<div class="slider-wrapper">
				<span class="axis-mark">-100 L</span>
				<input
					type="range"
					min="-100"
					max="100"
					step="1"
					bind:value={cliperStore.cropX}
					class="crop-range-slider"
				/>
				<span class="axis-mark">+100 R</span>
			</div>
		</div>
	</div>
</div>

<style>
	.preview-toolbar {
		width: 100%;
		max-width: 360px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.preview-badge {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-primary);
		background: var(--bg-surface-elevated);
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid var(--border-subtle);
		display: inline-block;
		margin-right: 6px;
	}

	.layout-indicator {
		font-size: 11px;
		color: var(--text-muted);
	}
	.layout-indicator strong {
		color: var(--accent-primary);
	}

	/* Kontainer 9:16 Responsif */
	.canvas-916-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
		max-width: 360px;
	}

	.canvas-916 {
		position: relative;
		width: 340px;
		height: 604px; /* 340 * 16/9 = 604.4px */
		background: #000;
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 16px 48px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12);
		display: flex;
		flex-direction: column;
	}

	/* Mode Split Background Blur */
	.split-bg-blur {
		position: absolute;
		inset: 0;
		z-index: 1;
		filter: blur(28px) brightness(0.65);
		overflow: hidden;
	}

	.video-blur {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.2);
	}

	.mock-bg-gradient {
		width: 100%;
		height: 100%;
		background: radial-gradient(circle at 50% 30%, #1e293b 0%, #090d16 100%);
	}

	/* Viewport Utama */
	.video-viewport {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.video-viewport.layout-split {
		top: 10%;
		height: 52%;
		border-radius: 8px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
	}

	.main-916-video {
		position: absolute;
		height: 100%;
		min-width: 100%;
		left: 50%;
		top: 0;
		object-fit: cover;
		cursor: pointer;
		transition: transform 0.05s linear;
	}

	/* Mock Scene jika video belum diunggah */
	.mock-actor-scene {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(180deg, #111827 0%, #030712 100%);
		cursor: pointer;
	}

	.mock-person-silhouette {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		opacity: 0.35;
	}

	.person-head {
		width: 90px;
		height: 110px;
		border-radius: 50%;
		background: #64748b;
		margin-bottom: 8px;
	}

	.person-torso {
		width: 180px;
		height: 220px;
		border-radius: 50px 50px 0 0;
		background: #475569;
	}

	.mock-play-overlay {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: #fff;
	}

	.mock-icon {
		font-size: 28px;
		background: rgba(0, 0, 0, 0.6);
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--border-strong);
	}

	.mock-hint {
		font-size: 11px;
		color: var(--text-secondary);
	}

	/* Overlay Face Track Guideline Box */
	.face-track-overlay {
		position: absolute;
		transform: translate(-50%, 0);
		border: 1.5px dashed var(--accent-primary);
		border-radius: 6px;
		pointer-events: none;
		z-index: 5;
		background: rgba(56, 189, 248, 0.04);
	}

	.track-tag {
		position: absolute;
		top: -18px;
		left: 0;
		font-size: 9px;
		font-weight: 700;
		color: #000;
		background: var(--accent-primary);
		padding: 1px 4px;
		border-radius: 2px;
		letter-spacing: 0.04em;
	}

	.track-crosshair {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 12px;
		height: 12px;
		transform: translate(-50%, -50%);
		border: 1px solid rgba(56, 189, 248, 0.5);
		border-radius: 50%;
	}

	.track-chin-safe {
		position: absolute;
		bottom: -14px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 8px;
		font-weight: 700;
		color: var(--accent-rose);
		background: rgba(0, 0, 0, 0.7);
		padding: 0 4px;
		border-radius: 2px;
		white-space: nowrap;
	}

	/* Garis Seam/Dada (Safe line penempatan teks caption) */
	.seam-line {
		position: absolute;
		left: 0;
		right: 0;
		border-bottom: 1px dashed rgba(250, 204, 21, 0.4);
		pointer-events: none;
		z-index: 4;
	}

	.seam-label {
		position: absolute;
		right: 8px;
		top: -14px;
		font-size: 8px;
		font-weight: 700;
		color: var(--accent-yellow);
		background: rgba(0, 0, 0, 0.6);
		padding: 1px 4px;
		border-radius: 2px;
	}

	/* Caption Box Gelap Tepi Terang ala HyperFrames Student-Kit */
	.caption-box-container {
		position: absolute;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 88%;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 10;
	}

	.caption-box {
		padding: 8px 16px;
		border-radius: 12px;
		backdrop-filter: blur(12px);
		box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		justify-content: center;
		text-align: center;
		max-width: 90%;
		max-height: 180px;
		overflow: hidden;
		word-break: break-word;
		overflow-wrap: break-word;
	}

	.caption-word {
		display: inline-block;
		font-weight: 800;
		letter-spacing: -0.01em;
		padding: 2px 6px;
		border-radius: 6px;
		transition: transform 0.1s cubic-bezier(0.2, 0, 0, 1),
			color 0.1s ease,
			background-color 0.1s ease,
			box-shadow 0.1s ease,
			opacity 0.1s ease;
		max-width: 90%;
		max-height: 100%;
		overflow: hidden;
		word-break: break-word;
		overflow-wrap: break-word;
		opacity: 0.8;
	}

	.caption-word.is-active {
		opacity: 1;
		transform: scale(1.12);
		background: color-mix(in srgb, var(--active-accent, #facc15) 22%, transparent);
		box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--active-accent, #facc15) 50%, transparent);
		text-shadow: 0 0 16px var(--active-accent, #facc15);
	}

	.caption-word.is-accent:not(.is-active) {
		opacity: 0.95;
		filter: drop-shadow(0 2px 6px currentColor);
	}

	/* Visual Grid 3x3 */
	.grid-guides {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.15;
		z-index: 3;
	}
	.guide-h {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: #fff;
	}
	.guide-v {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: #fff;
	}

	/* Kontrol Bar di Bawah Preview */
	.preview-controls-bar {
		width: 100%;
		max-width: 360px;
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.playback-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.play-btn {
		min-width: 60px;
	}

	.time-display {
		font-family: monospace;
		font-size: 12px;
		color: var(--text-secondary);
		background: var(--bg-surface-elevated);
		padding: 3px 8px;
		border-radius: 4px;
	}

	.timeline-slider-row {
		display: flex;
		width: 100%;
	}

	.timeline-slider {
		width: 100%;
		accent-color: var(--accent-primary);
		cursor: pointer;
		height: 6px;
	}

	/* CropX Slider Card */
	.crop-slider-card {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.crop-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.crop-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.crop-value {
		font-family: monospace;
		font-weight: 700;
		font-size: 12px;
		color: var(--accent-primary);
	}

	.slider-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.axis-mark {
		font-size: 10px;
		color: var(--text-muted);
		font-family: monospace;
		white-space: nowrap;
	}

	.crop-range-slider {
		flex: 1;
		accent-color: var(--accent-primary);
		cursor: pointer;
		height: 5px;
	}
</style>
