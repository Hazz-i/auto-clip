<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import type { AspectRatioTarget, CropMode, SubtitlePreset } from '../types';

	function formatTime(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	const totalDuration = $derived(cliperStore.duration || 10.5);
	const avgClipSec = $derived(
		Math.round(totalDuration / (cliperStore.wizard.clipCount || 1))
	);

	const ratioCards: {
		id: AspectRatioTarget;
		title: string;
		dim: string;
		sub: string;
		desc: string;
		badge?: string;
	}[] = [
		{
			id: '9:16',
			title: '9:16 Vertikal',
			dim: '1080 × 1920',
			sub: 'TikTok, Reels, Shorts',
			desc: 'Crop vertikal di tengah/subjek wajah, memotong sisi kiri & kanan.',
			badge: 'Standar Vertikal'
		},
		{
			id: '1:1',
			title: '1:1 Persegi',
			dim: '1080 × 1080',
			sub: 'Instagram Feed, LinkedIn',
			desc: 'Crop kotak seimbang di tengah video asli.'
		},
		{
			id: '16:9',
			title: '16:9 Horizontal',
			dim: '1920 × 1080',
			sub: 'YouTube & Format Asli',
			desc: 'Mempertahankan rasio horizontal asli tanpa crop sisi.'
		}
	];

	const cropModes: { id: CropMode; name: string; desc: string }[] = [
		{
			id: 'auto',
			name: 'Auto Face-Track',
			desc: 'Lacak wajah pembicara otomatis agar selalu di tengah frame.'
		},
		{
			id: 'center',
			name: 'Manual Center',
			desc: 'Crop statis di tengah, posisi horizontal disetel via slider.'
		},
		{
			id: 'split',
			name: 'Split Blur',
			desc: 'Video subjek tajam di atas latar belakang blur atmosferik.'
		}
	];

	const subtitlePresets: { id: SubtitlePreset; name: string; desc: string }[] = [
		{
			id: 'bold-outline',
			name: 'Bold Outline (Student-Kit)',
			desc: 'Box gelap tepi putih solid, teks punchy all-caps, aksen kuning.'
		},
		{
			id: 'dark-box',
			name: 'Box Gelap Solid',
			desc: 'Latar gelap kontras 92% dengan aksen cyan.'
		},
		{
			id: 'minimal',
			name: 'Minimal Bersih',
			desc: 'Teks transparan tanpa box latar, aksen emerald.'
		}
	];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="wizard-backdrop"
	onclick={(e) => {
		if (e.target === e.currentTarget) cliperStore.closeWizard();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') cliperStore.closeWizard();
	}}
	role="dialog"
	aria-modal="true"
	aria-labelledby="wizard-title"
	tabindex="-1"
>
	<div class="wizard-modal">
		<!-- Modal Header & Stepper -->
		<div class="wizard-header">
			<div class="header-top">
				<div>
					<h2 id="wizard-title" class="wizard-title">Wizard Konfigurasi Klip</h2>
					<p class="wizard-subtitle">Atur preferensi awal klip sebelum masuk ke timeline editor.</p>
				</div>
				<button
					class="close-btn"
					onclick={() => cliperStore.closeWizard()}
					title="Batal dan tutup wizard"
				>
					✕
				</button>
			</div>

			<!-- Stepper 4 Langkah -->
			<div class="stepper-bar">
				<button
					class="step-pill"
					class:active={cliperStore.wizard.step === 1}
					class:done={cliperStore.wizard.step > 1}
					onclick={() => cliperStore.setWizardStep(1)}
				>
					<span class="step-num">1</span>
					<span class="step-label">Resolusi</span>
				</button>

				<div class="step-connector" class:filled={cliperStore.wizard.step > 1}></div>

				<button
					class="step-pill"
					class:active={cliperStore.wizard.step === 2}
					class:done={cliperStore.wizard.step > 2}
					onclick={() => cliperStore.setWizardStep(2)}
				>
					<span class="step-num">2</span>
					<span class="step-label">Rekomendasi Cut</span>
				</button>

				<div class="step-connector" class:filled={cliperStore.wizard.step > 2}></div>

				<button
					class="step-pill"
					class:active={cliperStore.wizard.step === 3}
					class:done={cliperStore.wizard.step > 3}
					onclick={() => cliperStore.setWizardStep(3)}
				>
					<span class="step-num">3</span>
					<span class="step-label">Mode & Style</span>
				</button>

				<div class="step-connector" class:filled={cliperStore.wizard.step > 3}></div>

				<button
					class="step-pill"
					class:active={cliperStore.wizard.step === 4}
					class:done={cliperStore.wizard.step === 4}
					onclick={() => cliperStore.setWizardStep(4)}
				>
					<span class="step-num">4</span>
					<span class="step-label">Konfirmasi</span>
				</button>
			</div>
		</div>

		<!-- Modal Body Per Step -->
		<div class="wizard-body">
			<!-- STEP 1: RESOLUSI & METADATA -->
			{#if cliperStore.wizard.step === 1}
				<div class="step-content">
					<!-- Metadata Video Aktual -->
					<div class="meta-strip">
						<div class="meta-item">
							<span class="meta-title">Ukuran Sumber Asli:</span>
							<strong class="meta-val">{cliperStore.videoWidth} × {cliperStore.videoHeight} px</strong>
						</div>
						<div class="meta-item">
							<span class="meta-title">Durasi Total:</span>
							<strong class="meta-val">{formatTime(totalDuration)} ({totalDuration.toFixed(1)}s)</strong>
						</div>
						<div class="meta-item">
							<span class="meta-title">Rasio Asli:</span>
							<strong class="meta-val">
								{cliperStore.videoWidth > cliperStore.videoHeight ? '16:9 Landscape' : '9:16 Vertikal'}
							</strong>
						</div>
					</div>

					<p class="section-hint">Pilih rasio aspek target output untuk klip video:</p>

					<!-- Pilihan Radio Cards Resolusi -->
					<div class="ratio-cards-grid">
						{#each ratioCards as card}
							<button
								class="ratio-card"
								class:selected={cliperStore.wizard.targetRatio === card.id}
								onclick={() => cliperStore.setWizardTargetRatio(card.id)}
							>
								<div class="ratio-header">
									<div class="ratio-title-box">
										<span class="ratio-title">{card.title}</span>
										<span class="ratio-dim font-mono">{card.dim}</span>
									</div>
									{#if card.badge}
										<span class="card-badge">{card.badge}</span>
									{/if}
								</div>

								<span class="ratio-sub">{card.sub}</span>
								<p class="ratio-desc">{card.desc}</p>

								<!-- Visualisasi Bentuk Rasio -->
								<div class="ratio-visual-box">
									<div
										class="ratio-shape"
										class:shape-916={card.id === '9:16'}
										class:shape-11={card.id === '1:1'}
										class:shape-169={card.id === '16:9'}
									></div>
								</div>
							</button>
						{/each}
					</div>
				</div>

			<!-- STEP 2: REKOMENDASI CUT -->
			{:else if cliperStore.wizard.step === 2}
				<div class="step-content">
					<div class="info-alert">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="16" x2="12" y2="12" />
							<line x1="12" y1="8" x2="12.01" y2="8" />
						</svg>
						<span>
							Rekomendasi otomatis menghitung target klip 30–60 detik dari durasi {totalDuration.toFixed(1)}s.
							Ini panduan awal sebelum transkrip kata detail di editor.
						</span>
					</div>

					<!-- Stepper Jumlah Klip & Presets Panjang -->
					<div class="cut-controls-row">
						<div class="stepper-group">
							<span class="ctrl-label">Jumlah Klip Target:</span>
							<div class="stepper-box">
								<button
									class="stepper-btn"
									disabled={cliperStore.wizard.clipCount <= 1}
									onclick={() => cliperStore.setWizardClipCount(cliperStore.wizard.clipCount - 1)}
								>
									−
								</button>
								<span class="stepper-val font-mono">{cliperStore.wizard.clipCount} Klip</span>
								<button
									class="stepper-btn"
									disabled={cliperStore.wizard.clipCount >= 12}
									onclick={() => cliperStore.setWizardClipCount(cliperStore.wizard.clipCount + 1)}
								>
									+
								</button>
							</div>
							<span class="ctrl-sub">~{avgClipSec}s per klip</span>
						</div>

						<div class="presets-group">
							<span class="ctrl-label">Preset Cepat:</span>
							<div class="btn-group">
								<button class="btn btn-secondary btn-sm" onclick={() => cliperStore.setWizardClipLength(30)}>
									30 detik
								</button>
								<button class="btn btn-secondary btn-sm" onclick={() => cliperStore.setWizardClipLength(45)}>
									45 detik
								</button>
								<button class="btn btn-secondary btn-sm" onclick={() => cliperStore.setWizardClipLength(60)}>
									60 detik
								</button>
							</div>
						</div>
					</div>

					<!-- Mini Timeline Bar Visualizer -->
					<div class="mini-timeline-card">
						<div class="timeline-header">
							<span class="tl-title">Preview Timeline Klip</span>
							<span class="tl-time font-mono">00:00 – {formatTime(totalDuration)}</span>
						</div>

						<div class="timeline-bar">
							{#each cliperStore.wizard.clipRanges as range, idx}
								<div
									class="timeline-segment"
									class:seg-alt={idx % 2 === 1}
									style:width="{((range.end - range.start) / totalDuration) * 100}%"
									title="Klip #{range.index}: {formatTime(range.start)} - {formatTime(range.end)}"
								>
									<span class="seg-tag">Klip #{range.index}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Daftar Range Klip -->
					<div class="clip-ranges-list">
						{#each cliperStore.wizard.clipRanges as range}
							<div class="range-card">
								<span class="range-badge">Klip #{range.index}</span>
								<span class="range-time font-mono">{formatTime(range.start)} — {formatTime(range.end)}</span>
								<span class="range-duration font-mono">({(range.end - range.start).toFixed(1)}s)</span>
							</div>
						{/each}
					</div>
				</div>

			<!-- STEP 3: MODE CROP & PRESET SUBTITLE -->
			{:else if cliperStore.wizard.step === 3}
				<div class="step-content">
					<!-- Pilihan Crop Mode -->
					<div class="form-group">
						<span class="ctrl-label">Mode Framing & Crop:</span>
						<div class="option-cards-row">
							{#each cropModes as mode}
								<button
									class="option-card"
									class:selected={cliperStore.wizard.cropMode === mode.id}
									onclick={() => cliperStore.setWizardCropMode(mode.id)}
								>
									<span class="option-name">{mode.name}</span>
									<span class="option-desc">{mode.desc}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Pilihan Preset Subtitle -->
					<div class="form-group">
						<span class="ctrl-label">Preset Gaya Subtitle:</span>
						<div class="option-cards-row">
							{#each subtitlePresets as preset}
								<button
									class="option-card"
									class:selected={cliperStore.wizard.subtitlePreset === preset.id}
									onclick={() => cliperStore.setWizardSubtitlePreset(preset.id)}
								>
									<span class="option-name">{preset.name}</span>
									<span class="option-desc">{preset.desc}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Pilihan Font Default -->
					<div class="form-group">
						<span class="ctrl-label">Font Default:</span>
						<div class="font-choice-row">
							<button
								class="font-choice-btn"
								class:selected={cliperStore.wizard.fontDefault === 'Montserrat'}
								onclick={() => cliperStore.setWizardFontDefault('Montserrat')}
								style:font-family="Montserrat"
							>
								Montserrat ExtraBold (Student-Kit)
							</button>
							<button
								class="font-choice-btn"
								class:selected={cliperStore.wizard.fontDefault === 'Abril Fatface'}
								onclick={() => cliperStore.setWizardFontDefault('Abril Fatface')}
								style:font-family="Abril Fatface"
							>
								Abril Fatface Display
							</button>
						</div>
					</div>

					<!-- Preview Mini Box Subtitle Sesuai Pilihan -->
					<div class="sample-render-wrap">
						<span class="sample-label">Pratinjau Subtitle:</span>
						<div
							class="sample-render-box"
							class:box-bold={cliperStore.wizard.subtitlePreset === 'bold-outline'}
							class:box-dark={cliperStore.wizard.subtitlePreset === 'dark-box'}
							class:box-min={cliperStore.wizard.subtitlePreset === 'minimal'}
							style:font-family={cliperStore.wizard.fontDefault}
						>
							<span>CONTOH</span>
							<span class="word-accent">CAPTION</span>
							<span>KLIP</span>
						</div>
					</div>
				</div>

			<!-- STEP 4: KONFIRMASI -->
			{:else if cliperStore.wizard.step === 4}
				<div class="step-content">
					<div class="summary-card">
						<h3 class="summary-title">Ringkasan Konfigurasi Klip</h3>
						<div class="summary-list">
							<div class="summary-row">
								<span class="sum-name">Rasio Aspek Target:</span>
								<strong class="sum-val">{cliperStore.wizard.targetRatio}</strong>
							</div>
							<div class="summary-row">
								<span class="sum-name">Rekomendasi Klip:</span>
								<strong class="sum-val font-mono">
									{cliperStore.wizard.clipCount} Klip (~{avgClipSec}s/klip, total {totalDuration.toFixed(1)}s)
								</strong>
							</div>
							<div class="summary-row">
								<span class="sum-name">Mode Framing / Crop:</span>
								<strong class="sum-val">
									{cropModes.find((m) => m.id === cliperStore.wizard.cropMode)?.name}
								</strong>
							</div>
							<div class="summary-row">
								<span class="sum-name">Preset Subtitle:</span>
								<strong class="sum-val">
									{subtitlePresets.find((p) => p.id === cliperStore.wizard.subtitlePreset)?.name}
								</strong>
							</div>
							<div class="summary-row">
								<span class="sum-name">Font:</span>
								<strong class="sum-val">{cliperStore.wizard.fontDefault}</strong>
							</div>
						</div>
					</div>

					<div class="note-box">
						<p>
							Semua preferensi ini menjadi nilai awal di workspace editor.
							Anda tetap dapat mengedit kata per kata, memotong bagian di tab Transkrip, atau mengubah framing kapan saja.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Modal Footer Actions -->
		<div class="wizard-footer">
			<div class="footer-left">
				{#if cliperStore.wizard.step > 1}
					<button
						class="btn btn-secondary"
						onclick={() => cliperStore.setWizardStep((cliperStore.wizard.step - 1) as any)}
					>
						← Kembali
					</button>
				{/if}
				<button class="btn btn-secondary" onclick={() => cliperStore.closeWizard()}>
					Batal
				</button>
			</div>

			<div class="footer-right">
				{#if cliperStore.wizard.step < 4}
					<button
						class="btn btn-primary"
						onclick={() => cliperStore.setWizardStep((cliperStore.wizard.step + 1) as any)}
					>
						Lanjut ke {cliperStore.wizard.step === 1 ? 'Rekomendasi' : cliperStore.wizard.step === 2 ? 'Mode & Style' : 'Konfirmasi'} →
					</button>
				{:else}
					<button class="btn btn-secondary" onclick={() => cliperStore.applyWizardSettings()}>
						Ubah Nanti
					</button>
					<button
						class="btn btn-primary"
						disabled={cliperStore.uploadStatus === 'uploading' || cliperStore.transcribeStatus === 'loading' || !cliperStore.videoFile}
						onclick={() => cliperStore.applyWizardAndProcess()}
					>
						{#if cliperStore.uploadStatus === 'uploading'}
							<span class="spinner-sm"></span> Mengupload…
						{:else if cliperStore.transcribeStatus === 'loading'}
							<span class="spinner-sm"></span> Mentranskrip…
						{:else}
							Terapkan & Proses ✓
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.wizard-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.78);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
	}

	.wizard-modal {
		background: var(--bg-surface);
		border: 1px solid var(--border-normal);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 640px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.wizard-header {
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.header-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.wizard-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.wizard-subtitle {
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 2px;
	}

	.close-btn {
		font-size: 16px;
		color: var(--text-muted);
		padding: 4px 8px;
		border-radius: 4px;
	}
	.close-btn:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}

	/* Stepper */
	.stepper-bar {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.step-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		font-size: 11px;
		color: var(--text-muted);
		transition: all 0.15s ease;
	}

	.step-pill.active {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.12);
		color: var(--text-primary);
	}

	.step-pill.done {
		color: var(--accent-emerald);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.step-num {
		font-weight: 800;
		font-size: 10px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.step-pill.active .step-num {
		background: var(--accent-primary);
		color: #000;
	}

	.step-pill.done .step-num {
		background: var(--accent-emerald);
		color: #000;
	}

	.step-connector {
		flex: 1;
		height: 2px;
		background: var(--border-subtle);
	}
	.step-connector.filled {
		background: var(--accent-emerald);
	}

	/* Body */
	.wizard-body {
		padding: 20px 24px;
		overflow-y: auto;
		flex: 1;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.section-hint {
		font-size: 12px;
		color: var(--text-secondary);
	}

	/* Meta Strip */
	.meta-strip {
		display: flex;
		gap: 12px;
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
	}

	.meta-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meta-title {
		font-size: 10px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.meta-val {
		font-size: 12px;
		color: var(--accent-primary);
	}

	/* Ratio Cards Grid */
	.ratio-cards-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	@media (max-width: 600px) {
		.ratio-cards-grid {
			grid-template-columns: 1fr;
		}
	}

	.ratio-card {
		background: var(--bg-surface-elevated);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.ratio-card:hover {
		border-color: var(--border-strong);
	}

	.ratio-card.selected {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.08);
	}

	.ratio-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 4px;
	}

	.ratio-title-box {
		display: flex;
		flex-direction: column;
	}

	.ratio-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.ratio-dim {
		font-size: 11px;
		color: var(--text-muted);
	}

	.card-badge {
		font-size: 9px;
		font-weight: 700;
		color: #000;
		background: var(--accent-primary);
		padding: 1px 5px;
		border-radius: 3px;
	}

	.ratio-sub {
		font-size: 11px;
		color: var(--accent-primary);
		font-weight: 600;
	}

	.ratio-desc {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.35;
	}

	.ratio-visual-box {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		background: #000;
		border-radius: 4px;
		margin-top: 4px;
	}

	.ratio-shape {
		background: var(--accent-primary);
		opacity: 0.8;
		border-radius: 2px;
	}
	.shape-916 {
		width: 20px;
		height: 36px;
	}
	.shape-11 {
		width: 32px;
		height: 32px;
	}
	.shape-169 {
		width: 44px;
		height: 25px;
	}

	/* Step 2 Elements */
	.info-alert {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(56, 189, 248, 0.08);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 12px;
		color: var(--accent-primary);
		line-height: 1.4;
	}

	.cut-controls-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		gap: 16px;
		flex-wrap: wrap;
	}

	.ctrl-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		display: block;
		margin-bottom: 6px;
	}

	.stepper-box {
		display: flex;
		align-items: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-normal);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.stepper-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.04);
	}
	.stepper-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}
	.stepper-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.stepper-val {
		padding: 0 12px;
		font-size: 12px;
		font-weight: 700;
		color: var(--accent-primary);
	}

	.ctrl-sub {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 4px;
		display: block;
	}

	.btn-group {
		display: flex;
		gap: 6px;
	}

	.mini-timeline-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
	}

	.tl-title {
		font-weight: 700;
		color: var(--text-secondary);
	}
	.tl-time {
		color: var(--text-muted);
	}

	.timeline-bar {
		display: flex;
		height: 28px;
		background: #000;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
	}

	.timeline-segment {
		height: 100%;
		background: #0284c7;
		border-right: 1px solid rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		transition: width 0.2s ease;
	}
	.timeline-segment.seg-alt {
		background: #0369a1;
	}

	.seg-tag {
		font-size: 9px;
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
		padding: 0 4px;
	}

	.clip-ranges-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		max-height: 120px;
		overflow-y: auto;
	}

	.range-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 6px 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.range-badge {
		font-weight: 700;
		color: var(--accent-primary);
	}
	.range-time {
		color: var(--text-primary);
	}
	.range-duration {
		color: var(--text-muted);
	}

	/* Step 3 Elements */
	.option-cards-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	@media (max-width: 600px) {
		.option-cards-row {
			grid-template-columns: 1fr;
		}
	}

	.option-card {
		background: var(--bg-surface-elevated);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.option-card:hover {
		border-color: var(--border-strong);
	}

	.option-card.selected {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.08);
	}

	.option-name {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.option-desc {
		font-size: 10px;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.font-choice-row {
		display: flex;
		gap: 8px;
	}

	.font-choice-btn {
		flex: 1;
		padding: 10px;
		background: var(--bg-surface-elevated);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.font-choice-btn.selected {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.1);
		color: var(--accent-primary);
	}

	.sample-render-wrap {
		background: #000;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.sample-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.sample-render-box {
		padding: 8px 16px;
		border-radius: 10px;
		display: flex;
		gap: 8px;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.sample-render-box.box-bold {
		background: rgba(12, 16, 26, 0.88);
		border: 2px solid #ffffff;
		color: #ffffff;
	}
	.sample-render-box.box-bold .word-accent {
		color: #facc15;
	}

	.sample-render-box.box-dark {
		background: rgba(0, 0, 0, 0.92);
		border: 1.5px solid rgba(255, 255, 255, 0.22);
		color: #f8fafc;
	}
	.sample-render-box.box-dark .word-accent {
		color: #38bdf8;
	}

	.sample-render-box.box-min {
		background: transparent;
		color: #ffffff;
	}
	.sample-render-box.box-min .word-accent {
		color: #10b981;
	}

	/* Step 4 Elements */
	.summary-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.summary-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent-primary);
	}

	.summary-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 6px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.sum-name {
		color: var(--text-secondary);
	}
	.sum-val {
		color: var(--text-primary);
	}

	.note-box {
		background: rgba(250, 204, 21, 0.08);
		border: 1px solid rgba(250, 204, 21, 0.25);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Footer */
	.wizard-footer {
		padding: 16px 24px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface-elevated);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.footer-left,
	.footer-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.font-mono {
		font-family: monospace;
	}

	.spinner-sm {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(0, 0, 0, 0.3);
		border-top-color: #000;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
