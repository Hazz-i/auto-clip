<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import type { AspectRatioTarget } from '../types';
	import { gsapReveal } from '../utils/motion';
	import CaptionText from './ui/CaptionText.svelte';
	import { Dropdown } from './ui';

	let { onEditCaption, showFontSample = false }: { onEditCaption: () => void; showFontSample?: boolean } = $props();
	let previewRatio = $state<'9:16' | '1:1' | '4:3' | '16:9'>(cliperStore.wizard.targetRatio);
	let storedRatio = $state(cliperStore.wizard.targetRatio);
	const previewAspect = $derived(previewRatio.replace(':', ' / '));
	const showUploadedVideo = $derived(
		cliperStore.uploadStatus === 'done' && !!cliperStore.fileKey && !!cliperStore.videoUrl
	);
	const sampleWords = [
		{ id: 'sample-style-word-1', text: 'GAYA', start: 0, end: 1, cut: false },
		{ id: 'sample-style-word-2', text: 'CAPTION', start: 1, end: 2, cut: false, accent: true },
		{ id: 'sample-style-word-3', text: 'ANDA', start: 2, end: 3, cut: false }
	];

	// ratio → max-width utilities, replacing the old .ratio-* scoped classes (desktop + max-sm)
	const ratioWidths = {
		'9:16': 'max-w-[min(100%,34vh)] max-sm:max-w-[min(100%,28vh)]',
		'1:1': 'max-w-[min(100%,58vh)] max-sm:max-w-[min(100%,50vh)]',
		'4:3': 'max-w-[min(100%,78vh)] max-sm:max-w-[min(100%,66vh)]',
		'16:9': 'max-w-[min(100%,104vh)] max-sm:max-w-[min(100%,88vh)]'
	} as const;
	const previewRatioClass = $derived(ratioWidths[previewRatio]);

	const ratioOptions: { value: string; label: string }[] = [
		{ value: '9:16', label: '9:16' },
		{ value: '1:1', label: '1:1' },
		{ value: '4:3', label: '4:3' },
		{ value: '16:9', label: '16:9' }
	];

	$effect(() => {
		const nextRatio = cliperStore.wizard.targetRatio;
		if (nextRatio !== storedRatio) {
			storedRatio = nextRatio;
			previewRatio = nextRatio;
		}
	});

	function changePreviewRatio(value: string) {
		previewRatio = value as typeof previewRatio;
		if (previewRatio !== '4:3') {
			cliperStore.wizard.targetRatio = previewRatio as AspectRatioTarget;
			storedRatio = previewRatio as AspectRatioTarget;
		}
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

<section
	class="h-[min(66vh,640px)] min-h-[260px] flex min-w-0 flex-col overflow-hidden max-sm:h-[min(56vh,440px)] max-sm:min-h-[220px]"
	aria-label="Preview video"
	use:gsapReveal
>
	<div class="mb-1.5 flex w-full flex-none flex-wrap items-center justify-between gap-3 px-4 pt-4 max-sm:px-3 max-sm:pt-3">
		<div class="flex flex-1 flex-wrap items-center justify-between gap-2 text-[12px] text-ink-secondary max-sm:justify-between">
			<span>Format preview</span>
			<Dropdown
				ariaLabel="Format preview"
				options={ratioOptions}
				value={previewRatio}
				onchange={changePreviewRatio}
				size="md"
				class="min-w-[88px] max-sm:flex-1"
			/>
		</div>
	</div>
	{#if previewRatio === '4:3'}
		<p class="-mt-2 mb-3 px-4 text-[11px] text-ink-muted max-sm:px-3">4:3 hanya untuk preview; format Export tetap mengikuti opsi yang didukung.</p>
	{/if}

	<div class="mx-4 mb-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-panel border border-line-subtle bg-surface max-sm:mx-3 max-sm:mb-3">
		<div class={`relative h-auto w-full max-h-full overflow-hidden bg-transparent ${previewRatioClass}`} style:aspect-ratio={previewAspect}>
			<!-- Layer Video Background (Split atau Fill) -->
			{#if cliperStore.render.layout === 'split'}
				<!-- Mode Split: Background blur atmosferik + video fokus di atas/tengah -->
				<div class="absolute inset-0 z-[1] overflow-hidden blur-[28px] brightness-[0.65]">
					{#if showUploadedVideo}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							src={cliperStore.videoUrl}
							class="h-full w-full scale-[1.2] object-cover"
							currentTime={cliperStore.currentTime}
							muted
							playsinline
						></video>
					{:else}
						<div class="h-full w-full bg-transparent"></div>
					{/if}
				</div>
			{/if}

			<!-- Video Utama (Fill atau FG Split) -->
			<div
				class="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden"
				class:layout-split={cliperStore.render.layout === 'split'}
				style:top={cliperStore.render.layout === 'split' ? '10%' : undefined}
				style:height={cliperStore.render.layout === 'split' ? '52%' : undefined}
			>
				{#if showUploadedVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={cliperStore.videoUrl}
						class="absolute left-1/2 top-0 h-full min-w-full object-cover transition-[transform] duration-[50ms] ease-linear"
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
					></video>
				{:else}
					<!-- Visual mockup jika belum ada file video yang diunggah -->
					<div class="absolute inset-0 flex items-center justify-center bg-transparent p-6">
						<p class="text-center text-[12px] text-ink-muted">
							{cliperStore.videoFile
								? 'Video terpilih. Kirim ke server untuk melihat pratinjau di sini.'
								: 'Pilih video untuk melihat pratinjau'}
						</p>
					</div>
				{/if}

				<!-- Overlay Caption Box: Box Gelap Tepi Terang ala HyperFrames Student-Kit -->
				{#if showFontSample && !(cliperStore.hasRealTranscript && cliperStore.activeChunk)}
					<div
						class="pointer-events-none absolute left-1/2 z-10 flex w-[88%] -translate-x-1/2 -translate-y-1/2 justify-center"
						style:top="{cliperStore.captionStyle.positionY}%"
						role="img"
						aria-label="Contoh caption"
					>
						<CaptionText
							captionStyle={cliperStore.captionStyle}
							words={sampleWords}
							activeWordId="sample-style-word-3"
						/>
					</div>
				{/if}
				{#if cliperStore.hasRealTranscript && cliperStore.activeChunk}
					<div
						class="pointer-events-auto absolute left-1/2 z-10 flex w-[88%] -translate-x-1/2 -translate-y-1/2 justify-center"
						style:top="{cliperStore.captionStyle.positionY}%"
					>
						<CaptionText
							captionStyle={cliperStore.captionStyle}
							words={cliperStore.activeChunk.words}
							activeWordId={cliperStore.activeWord?.id}
							onEditCaption={onEditCaption}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
