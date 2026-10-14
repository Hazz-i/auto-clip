<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	let isDragging = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.type.startsWith('video/')) {
				cliperStore.handleFileSelect(file);
			} else {
				cliperStore.uploadError = 'File harus berformat video (MP4, WebM, dsb.)';
			}
		}
	}

	function onFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			cliperStore.handleFileSelect(target.files[0]);
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
</script>

<aside class="panel panel-left">
	<div class="panel-header">
		<span class="panel-title">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			Upload Video
		</span>
	</div>

	<div class="panel-body">
		<!-- Drag & Drop Zone -->
		<div
			class="dropzone"
			class:dragging={isDragging}
			ondragover={(e) => {
				e.preventDefault();
				isDragging = true;
			}}
			ondragleave={() => (isDragging = false)}
			ondrop={onDrop}
			onclick={() => fileInputRef?.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInputRef?.click()}
			role="button"
			tabindex="0"
		>
			<input
				type="file"
				accept="video/mp4,video/webm,video/quicktime,video/*"
				bind:this={fileInputRef}
				onchange={onFileChange}
				class="hidden-input"
			/>
			<div class="dropzone-icon">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<rect x="2" y="2" width="20" height="20" rx="4" />
					<polygon points="10 8 16 12 10 16 10 8" fill="currentColor" fill-opacity="0.2" />
				</svg>
			</div>
			<div class="dropzone-text">
				<p class="primary-text">Tarik & Lepas Video ke Sini</p>
				<p class="secondary-text">Atau klik untuk telusuri (MP4, WebM)</p>
			</div>
		</div>

		<!-- File Meta & Direct Upload Action -->
		{#if cliperStore.videoFile}
			<div class="file-card">
				<div class="file-header">
					<div class="file-info">
						<span class="file-name" title={cliperStore.videoFile.name}>{cliperStore.videoFile.name}</span>
						<span class="file-size">{formatBytes(cliperStore.videoFile.size)}</span>
					</div>
				</div>

				<div class="upload-actions">
					<button
						class="btn btn-primary w-full"
						disabled={cliperStore.uploadStatus === 'uploading'}
						onclick={() => cliperStore.uploadVideo()}
					>
						{#if cliperStore.uploadStatus === 'uploading'}
							<span class="spinner"></span> Mengupload… ({cliperStore.uploadProgress}%)
						{:else if cliperStore.uploadStatus === 'done'}
							<span>Upload Ulang</span>
						{:else}
							<span>Kirim ke Server</span>
						{/if}
					</button>
				</div>

				{#if cliperStore.uploadStatus === 'uploading'}
					<p class="status-note status-uploading">Mengupload…</p>
				{:else if cliperStore.uploadStatus === 'done' && cliperStore.uploadStatusText}
					<p class="status-note status-done">{cliperStore.uploadStatusText}</p>
				{/if}

				{#if cliperStore.uploadStatus === 'done' && cliperStore.fileKey}
					<div class="transcribe-card">
						<div class="transcribe-card-header">
							<span class="transcribe-tag">Langkah Berikutnya</span>
							<span class="transcribe-sub">Generate teks kata per kata dengan STT</span>
						</div>
						<button
							class="btn btn-primary w-full"
							disabled={cliperStore.uploadStatus !== 'done' || !cliperStore.fileKey || cliperStore.transcribeStatus === 'loading' || !cliperStore.apiUrl}
							onclick={() => cliperStore.transcribeClip()}
						>
							{#if cliperStore.transcribeStatus === 'loading'}
								<span class="spinner"></span> Mentranskrip…
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
									<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
									<line x1="12" y1="19" x2="12" y2="22" />
								</svg>
								<span>Transcribe</span>
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if cliperStore.uploadStatus === 'error' && cliperStore.uploadError}
			<div class="alert alert-error">
				<div class="error-msg">{cliperStore.uploadError}</div>
			</div>
		{/if}

		{#if cliperStore.transcribeStatus === 'error' && cliperStore.transcribeErrorMessage}
			<div class="alert alert-error">
				<div class="error-msg">{cliperStore.transcribeErrorMessage}</div>
				<div class="error-hint">Petunjuk: cek NINEROUTER_API_KEY di apps/api/.env lalu restart backend dari folder apps/api</div>
			</div>
		{/if}

		{#if cliperStore.transcribeSuccessMessage}
			<div class="alert alert-success">
				{cliperStore.transcribeSuccessMessage}
			</div>
		{/if}

		<!-- Source Video Mini Player Preview -->
		<div class="source-preview">
			<div class="section-subhead">
				<span>Preview Asli</span>
				<span class="subhead-meta">
					{cliperStore.videoUrl ? 'Terpilih' : 'Demo Awal'}
				</span>
			</div>

			<div class="preview-box">
				{#if cliperStore.videoUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={cliperStore.videoUrl}
						class="mini-video"
						controls
						playsinline
						muted
						bind:currentTime={cliperStore.currentTime}
						bind:duration={cliperStore.duration}
						onloadedmetadata={(e) => {
							const v = e.currentTarget;
							cliperStore.setVideoMetadata(v.videoWidth, v.videoHeight, v.duration);
						}}
					></video>
				{:else}
					<div class="empty-video">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<polygon points="5 3 19 12 5 21 5 3" />
						</svg>
						<span>Pilih video untuk mulai</span>
					</div>
				{/if}
			</div>

			{#if cliperStore.videoUrl}
				<button
					class="btn btn-secondary btn-sm w-full wizard-trigger-btn"
					onclick={() => cliperStore.openWizard()}
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
					</svg>
					Buka Wizard Pengaturan
				</button>
			{/if}
		</div>

		<!-- Endpoint info -->
		<div class="endpoint-info">
			<span class="info-title">Target Endpoint</span>
			<code>{cliperStore.apiUrl}/api/upload-direct</code>
		</div>
	</div>
</aside>

<style>
	.hidden-input {
		display: none;
	}

	.dropzone {
		border: 2px dashed var(--border-normal);
		border-radius: var(--radius-md);
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 10px;
		background: var(--bg-surface-elevated);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.05);
	}

	.dropzone-icon {
		color: var(--accent-primary);
	}

	.primary-text {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.secondary-text {
		font-size: 11px;
		color: var(--text-secondary);
		margin-top: 2px;
	}

	.file-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.file-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
	}

	.file-name {
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-size {
		font-size: 11px;
		color: var(--text-muted);
	}

	.w-full {
		width: 100%;
	}

	.status-note {
		font-size: 11px;
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
		padding: 6px 8px;
		border-radius: 4px;
	}

	.transcribe-card {
		background: rgba(56, 189, 248, 0.08);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: var(--radius-sm);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.transcribe-card-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.transcribe-tag {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent-primary);
	}

	.transcribe-sub {
		font-size: 11px;
		color: var(--text-secondary);
	}

	.alert-error {
		font-size: 12px;
		color: var(--accent-rose);
		background: rgba(244, 63, 94, 0.1);
		border: 1px solid rgba(244, 63, 94, 0.2);
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.error-msg {
		font-weight: 600;
	}

	.error-hint {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.3;
	}

	.alert-success {
		font-size: 12px;
		color: var(--accent-emerald);
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.section-subhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.subhead-meta {
		font-size: 11px;
		color: var(--text-muted);
	}

	.preview-box {
		width: 100%;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: #000;
		border: 1px solid var(--border-subtle);
		aspect-ratio: 16 / 9;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mini-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.empty-video {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: var(--text-muted);
		font-size: 11px;
	}

	.endpoint-info {
		margin-top: auto;
		background: rgba(255, 255, 255, 0.02);
		padding: 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.info-title {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.endpoint-info code {
		font-size: 11px;
		color: var(--accent-primary);
		word-break: break-all;
	}

	.spinner {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(0, 0, 0, 0.3);
		border-top-color: #000;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
