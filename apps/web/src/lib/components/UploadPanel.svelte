<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import { Button, Modal, Progress, StatusRow } from '#lib/components/ui';

	let { onClose }: { onClose: () => void } = $props();
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

	async function upload() {
		if (await cliperStore.uploadVideo()) onClose();
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
</script>

<Modal open={true} title="Upload Video" size="md" {onClose} aria-modal="true">
	{#snippet header({ close, titleId })}
		<div class="flex items-center justify-between gap-3">
			<h2 id={titleId} class="text-[16px] font-bold">Upload Video</h2>
			{#if cliperStore.uploadStatus === 'done' && cliperStore.fileKey}
				<button
					class="ml-auto text-accent text-[12px]"
					onclick={() => cliperStore.openWizard()}
				>
					Wizard Pengaturan
				</button>
			{/if}
			<Button variant="ghost" size="sm" aria-label="Tutup" onclick={close}>✕</Button>
		</div>
	{/snippet}

	{#snippet footer()}
		<Button
			variant="primary"
			disabled={!cliperStore.videoFile || cliperStore.uploadStatus === 'uploading'}
			onclick={upload}
		>
			{#if cliperStore.uploadStatus === 'uploading'}
				Mengupload…
			{:else if cliperStore.uploadStatus === 'done'}
				Upload Ulang
			{:else}
				Kirim ke Server
			{/if}
		</Button>
	{/snippet}

	<div>
		<div
			class="cursor-pointer border border-dashed px-4 py-7 text-center transition-colors {isDragging
				? 'border-accent'
				: 'border-line-normal hover:border-accent'}"
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
				class="hidden"
			/>
			{#if cliperStore.videoFile}
				<div class="flex flex-col gap-[3px]">
					<strong class="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap" title={cliperStore.videoFile.name}>{cliperStore.videoFile.name}</strong>
					<span class="text-[12px] text-ink-muted">{formatBytes(cliperStore.videoFile.size)}</span>
					<span class="text-[12px] text-ink-muted">Klik untuk mengganti video</span>
				</div>
			{:else}
				<p class="text-[14px] font-semibold">Tarik & Lepas Video ke Sini</p>
				<p class="text-[12px] text-ink-muted">Atau klik untuk telusuri (MP4, WebM)</p>
			{/if}
		</div>

		{#if cliperStore.uploadStatus === 'error' && cliperStore.uploadError}
			<StatusRow tone="error" role="alert" class="mt-3">{cliperStore.uploadError}</StatusRow>
		{/if}
		{#if cliperStore.uploadStatus === 'uploading'}
			<div class="mt-3" role="status">
				<div class="mb-1.5 flex justify-between text-[12px] text-ink-secondary">
					<span>Mengupload video</span><span>{cliperStore.uploadProgress}%</span>
				</div>
				<Progress value={cliperStore.uploadProgress} label="Progress upload" />
			</div>
		{/if}
	</div>
</Modal>
