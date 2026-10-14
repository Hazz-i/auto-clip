<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	const cuts = $derived(cliperStore.cuts);
	const totalCutDuration = $derived(
		cuts.reduce((acc, cut) => acc + (cut.end - cut.start), 0)
	);

	const ffmpegCommand = $derived(cliperStore.generateFfmpegCommand());

	function removeCut(wordId: string) {
		for (const chunk of cliperStore.chunks) {
			const word = chunk.words.find((w) => w.id === wordId);
			if (word) {
				word.cut = false;
				break;
			}
		}
	}
</script>

<div class="render-panel">
	<!-- Pilihan Layout Split | Fill -->
	<div class="form-group">
		<span class="form-label">
			<span>Pilihan Layout Render</span>
			<span class="label-badge">Output 9:16</span>
		</span>
		<div class="layout-selector-grid">
			<button
				class="layout-option-card"
				class:selected={cliperStore.render.layout === 'fill'}
				onclick={() => (cliperStore.render.layout = 'fill')}
			>
				<div class="layout-icon fill-icon">
					<div class="fill-box"></div>
				</div>
				<span class="layout-name">Fill (Penuh)</span>
				<span class="layout-desc">Crop vertikal 9:16 penuh terfokus subjek</span>
			</button>

			<button
				class="layout-option-card"
				class:selected={cliperStore.render.layout === 'split'}
				onclick={() => (cliperStore.render.layout = 'split')}
			>
				<div class="layout-icon split-icon">
					<div class="split-top"></div>
					<div class="split-bot"></div>
				</div>
				<span class="layout-name">Split (Atmosferik)</span>
				<span class="layout-desc">Video subjek tajam + latar belakang blur</span>
			</button>
		</div>
	</div>

	<!-- Daftar Cuts dari EDL -->
	<div class="edl-cuts-section">
		<div class="edl-header">
			<span class="section-title">
				Daftar Cut EDL
				<span class="cut-count-pill">{cuts.length} kata</span>
			</span>
			{#if totalCutDuration > 0}
				<span class="time-saved">Hemat -{totalCutDuration.toFixed(2)} detik</span>
			{/if}
		</div>

		{#if cuts.length === 0}
			<div class="empty-cuts-notice">
				<p>Belum ada kata yang di-cut.</p>
				<p class="empty-sub">Klik tanda ✕ pada kata di tab Transkrip untuk memotong jeda/kata salah.</p>
			</div>
		{:else}
			<div class="cuts-table-wrapper">
				<table class="cuts-table">
					<thead>
						<tr>
							<th>Waktu</th>
							<th>Teks Kata</th>
							<th>Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each cuts as cut (cut.id)}
							<tr>
								<td class="font-mono">{cut.start.toFixed(2)}s – {cut.end.toFixed(2)}s</td>
								<td class="cut-text">"{cut.text}"</td>
								<td>
									<button
										class="restore-btn"
										title="Pulihkan kata ke video"
										onclick={() => removeCut(cut.wordId)}
									>
										Pulihkan
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Tombol Eksekusi Render -->
	<div class="render-action-card">
		<button
			class="btn btn-primary w-full btn-lg"
			disabled={cliperStore.render.status === 'rendering'}
			onclick={() => cliperStore.sendRenderJob()}
		>
			{#if cliperStore.render.status === 'rendering'}
				<span class="spinner-sm"></span> Merender Klip ({cliperStore.render.progress}%)
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
				</svg>
				<span>Kirim Render (POST /api/clips/render)</span>
			{/if}
		</button>

		{#if cliperStore.render.status === 'rendering'}
			<div class="progress-bar-container">
				<div class="progress-bar-fill" style:width="{cliperStore.render.progress}%"></div>
			</div>
		{/if}

		{#if cliperStore.render.status === 'completed'}
			<div class="success-banner">
				<span>Render berhasil diselesaikan!</span>
				{#if cliperStore.render.resultUrl}
					<a href={cliperStore.render.resultUrl} target="_blank" class="download-link">
						Buka File Output
					</a>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Tampilan Preview Perintah FFmpeg -->
	<div class="ffmpeg-preview-card">
		<div class="ffmpeg-header">
			<span class="card-subtitle">FFmpeg Command Preview</span>
			<span class="badge-filter">9:16 Filter Graph</span>
		</div>
		<pre class="ffmpeg-code"><code>{ffmpegCommand}</code></pre>
	</div>
</div>

<style>
	.render-panel {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.label-badge {
		font-size: 10px;
		color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.12);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.layout-selector-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.layout-option-card {
		background: var(--bg-surface-elevated);
		border: 1.5px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.layout-option-card:hover {
		border-color: var(--border-strong);
	}

	.layout-option-card.selected {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.08);
	}

	.layout-icon {
		width: 32px;
		height: 48px;
		background: #000;
		border: 1px solid var(--border-normal);
		border-radius: 4px;
		padding: 3px;
		display: flex;
		flex-direction: column;
	}

	.fill-box {
		width: 100%;
		height: 100%;
		background: var(--accent-primary);
		border-radius: 2px;
		opacity: 0.8;
	}

	.split-top {
		width: 100%;
		height: 55%;
		background: var(--accent-primary);
		border-radius: 2px;
		margin-bottom: 2px;
	}

	.split-bot {
		width: 100%;
		height: 40%;
		background: #334155;
		border-radius: 2px;
		opacity: 0.6;
	}

	.layout-name {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.layout-desc {
		font-size: 10px;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.edl-cuts-section {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.edl-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-title {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.cut-count-pill {
		font-size: 10px;
		background: rgba(244, 63, 94, 0.15);
		color: var(--accent-rose);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.time-saved {
		font-size: 11px;
		font-weight: 700;
		color: var(--accent-emerald);
	}

	.empty-cuts-notice {
		padding: 16px;
		text-align: center;
		font-size: 11px;
		color: var(--text-muted);
	}
	.empty-sub {
		margin-top: 4px;
		font-size: 10px;
		color: var(--text-muted);
	}

	.cuts-table-wrapper {
		max-height: 120px;
		overflow-y: auto;
	}

	.cuts-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11px;
	}

	.cuts-table th {
		text-align: left;
		color: var(--text-muted);
		padding: 4px 6px;
		border-bottom: 1px solid var(--border-subtle);
		font-weight: 600;
	}

	.cuts-table td {
		padding: 4px 6px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.font-mono {
		font-family: monospace;
		color: var(--text-secondary);
	}

	.cut-text {
		color: var(--accent-rose);
		font-weight: 600;
	}

	.restore-btn {
		font-size: 10px;
		color: var(--accent-primary);
		text-decoration: underline;
		cursor: pointer;
	}

	.render-action-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.w-full {
		width: 100%;
	}

	.btn-lg {
		padding: 12px 16px;
		font-size: 13px;
	}

	.progress-bar-container {
		width: 100%;
		height: 6px;
		background: var(--bg-surface-elevated);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-emerald) 100%);
		transition: width 0.3s ease;
	}

	.success-banner {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: var(--accent-emerald);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.download-link {
		color: #fff;
		background: var(--accent-emerald);
		padding: 2px 8px;
		border-radius: 3px;
		text-decoration: none;
		font-weight: 700;
		font-size: 11px;
	}

	.ffmpeg-preview-card {
		background: #000;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ffmpeg-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-subtitle {
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge-filter {
		font-size: 9px;
		color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.1);
		padding: 1px 5px;
		border-radius: 3px;
		font-family: monospace;
	}

	.ffmpeg-code {
		font-family: 'JetBrains Mono', monospace, Consolas;
		font-size: 11px;
		color: #93c5fd;
		line-height: 1.45;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
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
