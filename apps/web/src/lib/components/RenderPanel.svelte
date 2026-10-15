<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import { gsapReveal } from '../utils/motion';
	import { Button, Progress, StatusRow } from './ui';

	const isRendering = $derived(
		cliperStore.render.status === 'queued' || cliperStore.render.status === 'processing'
	);
	let videoDuration = $state<number | null>(null);
	let videoResolution = $state<string | null>(null);

	function handleVideoMetadata(e: Event) {
		const video = e.currentTarget as HTMLVideoElement;
		if (video.duration && !Number.isNaN(video.duration)) videoDuration = video.duration;
		if (video.videoWidth && video.videoHeight) {
			videoResolution = `${video.videoWidth}×${video.videoHeight}`;
		}
	}

	function formatBytes(bytes?: number): string {
		if (!bytes || bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		let val = bytes;
		let i = 0;
		while (val >= 1024 && i < units.length - 1) {
			val /= 1024;
			i++;
		}
		return `${val.toFixed(1)} ${units[i]}`;
	}
</script>

<section class="w-full" aria-live="polite" use:gsapReveal>
	{#if isRendering}
		<div class="py-2.5">
			<div class="mb-2 flex items-center justify-between gap-3 text-[13px]">
				<strong>{cliperStore.render.status === 'queued' ? 'Menunggu antrean…' : 'Mengekspor video…'}</strong>
				<span class="text-[12px] text-ink-secondary">{cliperStore.render.progress}%</span>
			</div>
			<Progress value={cliperStore.render.progress} label="Progres render" />
		</div>
	{:else if cliperStore.render.status === 'failed'}
		<StatusRow tone="error" role="alert">
			<strong>Export gagal</strong>
			<p>{cliperStore.render.error}</p>
		</StatusRow>
	{:else if cliperStore.render.status === 'done' && cliperStore.render.resultUrl}
		<div class="flex flex-col items-center gap-3 py-2.5 text-center">
			<strong>Hasil siap</strong>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				src={cliperStore.render.resultUrl}
				controls
				playsinline
				preload="metadata"
				class="w-[min(100%,640px)] max-h-[60vh] rounded-control bg-black"
				onloadedmetadata={handleVideoMetadata}
			></video>
			<div class="flex flex-wrap justify-center gap-3 text-[12px] text-ink-secondary">
				{#if videoDuration !== null || cliperStore.render.duration}
					<span>Durasi: {(videoDuration ?? cliperStore.render.duration)?.toFixed(1)}s</span>
				{/if}
				{#if videoResolution}<span>{videoResolution}</span>{/if}
				{#if cliperStore.render.size}<span>{formatBytes(cliperStore.render.size)}</span>{/if}
			</div>
			<div class="flex items-center justify-center gap-3 max-sm:flex-col max-sm:items-stretch">
				<Button
					href={cliperStore.render.resultUrl}
					variant="primary"
					download="cliper-render.mp4"
					target="_blank"
					rel="noreferrer"
				>
					Download MP4
				</Button>
				<Button
					href={cliperStore.render.resultUrl}
					target="_blank"
					rel="noreferrer"
				>
					Buka Tab Baru
				</Button>
			</div>
		</div>
	{/if}
</section>
