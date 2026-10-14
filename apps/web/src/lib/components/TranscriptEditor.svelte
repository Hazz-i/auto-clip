<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	let editingWordId = $state<string | null>(null);
	let editText = $state('');
	let rechunkTarget = $state(3);

	function startEdit(chunkId: string, wordId: string, currentText: string) {
		editingWordId = wordId;
		editText = currentText;
	}

	function saveEdit(chunkId: string, wordId: string) {
		if (editText.trim()) {
			cliperStore.updateWordText(chunkId, wordId, editText.trim());
		}
		editingWordId = null;
	}

	function handleKeydown(e: KeyboardEvent, chunkId: string, wordId: string) {
		if (e.key === 'Enter') {
			saveEdit(chunkId, wordId);
		} else if (e.key === 'Escape') {
			editingWordId = null;
		}
	}
</script>

<div class="transcript-editor">
	<!-- Header Transkrip Utama & Tombol Transcribe -->
	<div class="transcript-header">
		<div class="transcript-header-title">
			<span class="header-name">Transkrip STT</span>
			{#if !cliperStore.hasRealTranscript}
				<span class="badge-demo-tag">Contoh</span>
			{/if}
		</div>

		<button
			class="btn btn-primary btn-sm btn-transcribe"
			disabled={cliperStore.uploadStatus !== 'done' || !cliperStore.fileKey || cliperStore.transcribeStatus === 'loading' || !cliperStore.apiUrl}
			onclick={() => cliperStore.transcribeClip()}
			title={cliperStore.uploadStatus !== 'done' || !cliperStore.fileKey ? 'Unggah video ke server terlebih dahulu' : 'Transkripsikan audio video dengan STT'}
		>
			{#if cliperStore.transcribeStatus === 'loading'}
				<span class="spinner-sm"></span> Mentranskrip…
			{:else}
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
					<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
					<line x1="12" y1="19" x2="12" y2="22" />
				</svg>
				<span>Transcribe</span>
			{/if}
		</button>
	</div>

	<!-- Alert Error & Alert Sukses -->
	{#if cliperStore.transcribeStatus === 'error' && cliperStore.transcribeErrorMessage}
		<div class="transcribe-alert error">
			<div class="alert-body">
				<div class="alert-msg">{cliperStore.transcribeErrorMessage}</div>
				<div class="alert-hint">Petunjuk: cek NINEROUTER_API_KEY di apps/api/.env lalu restart backend dari folder apps/api</div>
			</div>
			<button
				class="alert-close-btn"
				onclick={() => (cliperStore.transcribeErrorMessage = null)}
				title="Tutup"
			>
				✕
			</button>
		</div>
	{/if}

	{#if cliperStore.transcribeSuccessMessage}
		<div class="transcribe-alert success">
			<div class="alert-body">
				<span>{cliperStore.transcribeSuccessMessage}</span>
			</div>
			<button
				class="alert-close-btn"
				onclick={() => (cliperStore.transcribeSuccessMessage = null)}
				title="Tutup"
			>
				✕
			</button>
		</div>
	{/if}

	<!-- Empty state notice sebelum transkrip asli -->
	{#if !cliperStore.hasRealTranscript}
		<div class="empty-state-notice">
			<span class="badge-demo-tag">Contoh</span>
			<span class="notice-desc">Belum ada transkrip — upload video lalu tekan Transcribe</span>
		</div>
	{/if}

	<!-- Bar Aksi Atas -->
	<div class="transcript-toolbar">
		<div class="rechunk-control">
			<span class="control-label">Re-chunk:</span>
			<select class="select-input select-sm" bind:value={rechunkTarget}>
				<option value={1}>1 kata (Ultra punchy)</option>
				<option value={2}>2 kata</option>
				<option value={3}>3 kata (Standar Kit)</option>
				<option value={4}>4 kata</option>
				<option value={5}>5 kata (Maksimal)</option>
			</select>
			<button class="btn btn-secondary btn-sm" onclick={() => cliperStore.rechunk(rechunkTarget)}>
				Bagi Ulang
			</button>
		</div>

		<div class="edl-stats">
			<span class="stats-badge">
				{cliperStore.cuts.length} Kata Di-cut
			</span>
		</div>
	</div>

	<!-- Daftar Chunk & Kata -->
	<div class="chunks-scroll-list">
		{#if cliperStore.chunks.length === 0}
			<div class="empty-state">
				<p>Belum ada transkrip — upload video lalu tekan Transcribe</p>
			</div>
		{:else}
			{#each cliperStore.chunks as chunk, chunkIndex (chunk.id)}
				<div
					class="chunk-card"
					class:is-active-chunk={cliperStore.activeChunk?.id === chunk.id}
				>
					<div class="chunk-header">
						<div class="chunk-index-group">
							<span class="chunk-index">Chunk #{chunkIndex + 1}</span>
							{#if !cliperStore.hasRealTranscript}
								<span class="chunk-demo-label">Contoh</span>
							{/if}
							{#if chunk.estimated}
								<span class="chunk-estimated-badge" title="Waktu estimasi, geser bila meleset">
									estimasi
								</span>
							{:else if cliperStore.hasRealTranscript}
								<span class="chunk-precision-badge" title="Timestamp presisi kata per kata dari AI STT">
									presisi
								</span>
							{/if}
						</div>
						<div class="chunk-header-right">
							<span class="chunk-timing">
								{chunk.start.toFixed(2)}s – {chunk.end.toFixed(2)}s
							</span>
							<button
								class="seek-chunk-btn"
								title="Lompat ke awal chunk"
								onclick={() => cliperStore.seekTo(chunk.start)}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
									<polygon points="5 3 19 12 5 21 5 3" />
								</svg>
							</button>
						</div>
					</div>

					<!-- Kontrol Nudge Timing Per Chunk -->
					<div class="chunk-nudge-row">
						<span class="nudge-label">Nudge:</span>
						<div class="nudge-btns">
							<button
								class="nudge-btn"
								title="Mundurkan timing 0.5s"
								onclick={() => cliperStore.nudgeChunk(chunk.id, -0.5)}
							>
								−0.5s
							</button>
							<button
								class="nudge-btn"
								title="Mundurkan timing 0.2s"
								onclick={() => cliperStore.nudgeChunk(chunk.id, -0.2)}
							>
								−0.2s
							</button>
							<button
								class="nudge-btn"
								title="Majukan timing 0.2s"
								onclick={() => cliperStore.nudgeChunk(chunk.id, 0.2)}
							>
								+0.2s
							</button>
							<button
								class="nudge-btn"
								title="Majukan timing 0.5s"
								onclick={() => cliperStore.nudgeChunk(chunk.id, 0.5)}
							>
								+0.5s
							</button>
						</div>
					</div>

					<div class="words-container">
						{#each chunk.words as word (word.id)}
							<div
								class="word-pill"
								class:is-active={cliperStore.activeWord?.id === word.id}
								class:is-cut={word.cut}
								class:is-accent={word.accent}
							>
								{#if editingWordId === word.id}
									<!-- Mode Edit Teks Manual (Koreksi STT) -->
									<!-- svelte-ignore a11y_autofocus -->
									<input
										type="text"
										class="inline-word-input"
										bind:value={editText}
										onblur={() => saveEdit(chunk.id, word.id)}
										onkeydown={(e) => handleKeydown(e, chunk.id, word.id)}
										autofocus
									/>
								{:else}
									<!-- Klik kata = seek video -->
									<button
										class="word-text-btn"
										title="Klik untuk seek ({word.start.toFixed(2)}s). Dobel klik untuk edit."
										onclick={() => cliperStore.seekTo(word.start)}
										ondblclick={() => startEdit(chunk.id, word.id, word.text)}
									>
										{word.text}
									</button>
								{/if}

								<!-- Aksi Kata: Edit, Aksen Warna, Tandai Cut EDL -->
								<div class="word-actions">
									{#if editingWordId !== word.id}
										<button
											class="word-action-btn edit-btn"
											title="Koreksi STT teks kata ini"
											onclick={() => startEdit(chunk.id, word.id, word.text)}
										>
											✎
										</button>
									{/if}

									<button
										class="word-action-btn accent-btn"
										class:active={word.accent}
										title="Tandai warna aksen (maks 20% chunk)"
										onclick={() => cliperStore.toggleWordAccent(chunk.id, word.id)}
									>
										★
									</button>

									<button
										class="word-action-btn cut-btn"
										class:cut={word.cut}
										title={word.cut ? 'Batalkan cut di EDL' : 'Hapus kata / tandai cut di EDL'}
										onclick={() => cliperStore.toggleWordCut(chunk.id, word.id)}
									>
										✕
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.transcript-editor {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 10px;
	}

	.transcript-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border-subtle);
		gap: 8px;
	}

	.transcript-header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-name {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-primary);
	}

	.btn-transcribe {
		font-size: 12px;
		font-weight: 700;
		padding: 5px 12px;
		gap: 6px;
	}

	.btn-transcribe:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.badge-demo-tag {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(250, 204, 21, 0.15);
		color: var(--accent-yellow);
		border: 1px solid rgba(250, 204, 21, 0.3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.empty-state-notice {
		background: rgba(250, 204, 21, 0.06);
		border: 1px dashed rgba(250, 204, 21, 0.3);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.notice-desc {
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.chunk-index-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.chunk-demo-label {
		font-size: 9px;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(250, 204, 21, 0.15);
		color: var(--accent-yellow);
		border: 1px solid rgba(250, 204, 21, 0.3);
		text-transform: uppercase;
	}

	.transcribe-alert {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		font-size: 11px;
		gap: 8px;
	}

	.transcribe-alert.error {
		background: rgba(244, 63, 94, 0.1);
		border: 1px solid rgba(244, 63, 94, 0.3);
		color: var(--accent-rose);
	}

	.transcribe-alert.success {
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: var(--accent-emerald);
	}

	.alert-body {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.alert-msg {
		font-weight: 600;
	}

	.alert-hint {
		font-size: 10px;
		color: var(--text-secondary);
		line-height: 1.3;
	}

	.alert-close-btn {
		color: var(--text-muted);
		font-size: 12px;
		padding: 0 4px;
		cursor: pointer;
	}
	.alert-close-btn:hover {
		color: #fff;
	}

	.spinner-sm {
		width: 11px;
		height: 11px;
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

	.transcript-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-subtle);
		gap: 8px;
	}

	.rechunk-control {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.control-label {
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 600;
	}

	.select-sm {
		padding: 4px 6px;
		font-size: 11px;
		width: auto;
	}

	.stats-badge {
		font-size: 11px;
		color: var(--accent-rose);
		background: rgba(244, 63, 94, 0.12);
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid rgba(244, 63, 94, 0.25);
		font-weight: 600;
	}

	.chunks-scroll-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow-y: auto;
		flex: 1;
		padding-right: 4px;
	}

	.empty-state {
		text-align: center;
		padding: 32px 16px;
		color: var(--text-muted);
		font-size: 12px;
	}

	.chunk-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px;
		transition: all 0.15s ease;
	}

	.chunk-card.is-active-chunk {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.04);
		box-shadow: 0 0 12px rgba(56, 189, 248, 0.1);
	}

	.chunk-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
		font-size: 11px;
	}

	.chunk-header-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.chunk-estimated-badge {
		font-size: 9px;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: help;
	}

	.chunk-precision-badge {
		font-size: 9px;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: help;
	}

	.chunk-nudge-row {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-bottom: 8px;
		padding-bottom: 6px;
		border-bottom: 1px dashed var(--border-subtle);
	}

	.nudge-label {
		font-size: 10px;
		color: var(--text-muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.nudge-btns {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.nudge-btn {
		font-size: 10px;
		font-weight: 700;
		font-family: monospace;
		padding: 2px 5px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
		transition: all 0.1s ease;
	}

	.nudge-btn:hover {
		background: rgba(56, 189, 248, 0.15);
		color: var(--accent-primary);
		border-color: rgba(56, 189, 248, 0.3);
	}

	.chunk-index {
		font-weight: 700;
		color: var(--text-secondary);
	}

	.chunk-timing {
		font-family: monospace;
		color: var(--text-muted);
	}

	.seek-chunk-btn {
		color: var(--accent-primary);
		display: flex;
		align-items: center;
		padding: 2px 4px;
		border-radius: 3px;
	}
	.seek-chunk-btn:hover {
		background: rgba(56, 189, 248, 0.15);
	}

	.words-container {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.word-pill {
		display: inline-flex;
		align-items: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-normal);
		border-radius: 6px;
		padding: 2px 4px 2px 8px;
		gap: 4px;
		transition: all 0.12s ease;
	}

	.word-pill.is-active {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.15);
	}

	.word-pill.is-accent {
		border-color: var(--accent-yellow);
		background: rgba(250, 204, 21, 0.12);
	}

	.word-pill.is-cut {
		opacity: 0.45;
		text-decoration: line-through;
		border-color: var(--accent-rose);
		background: rgba(244, 63, 94, 0.1);
	}

	.word-text-btn {
		font-weight: 700;
		font-size: 13px;
		color: var(--text-primary);
		padding: 2px 0;
	}

	.word-pill.is-accent .word-text-btn {
		color: var(--accent-yellow);
	}

	.inline-word-input {
		background: #000;
		border: 1px solid var(--accent-primary);
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		padding: 2px 4px;
		border-radius: 4px;
		width: 70px;
		outline: none;
	}

	.word-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.word-action-btn {
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		font-size: 10px;
		color: var(--text-muted);
		transition: all 0.1s ease;
	}

	.word-action-btn:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}

	.accent-btn.active {
		color: var(--accent-yellow);
	}

	.cut-btn {
		color: var(--text-muted);
	}
	.cut-btn.cut {
		color: var(--accent-rose);
		background: rgba(244, 63, 94, 0.25);
	}
	.cut-btn:hover {
		color: var(--accent-rose);
	}
</style>
