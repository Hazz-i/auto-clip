<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import { gsapReveal } from '../utils/motion';
	import type { ClipRecommendation } from '../clip-recommendations';
	import Button from '#lib/components/ui/Button.svelte';
	import Progress from '#lib/components/ui/Progress.svelte';
	import StatusRow from '#lib/components/ui/StatusRow.svelte';

	const rulerMarks = [0, 0.25, 0.5, 0.75, 1];
	const duration = $derived(Math.max(0.1, cliperStore.duration));
	let selectedSceneId = $state<string | null>(null);
	let editingSceneId = $state<string | null>(null);
	let editingLabel = $state('');
	let dragging = $state<{
		id: string;
		mode: 'move' | 'start' | 'end';
		pointerX: number;
		start: number;
		end: number;
	} | null>(null);

	$effect(() => {
		const scenes = cliperStore.suggestedClips;
		if (!scenes.length) selectedSceneId = null;
		else if (!selectedSceneId || !scenes.some((scene) => scene.id === selectedSceneId)) {
			selectedSceneId = scenes[0].id;
		}
	});

	function toPercent(seconds: number) {
		return `${Math.max(0, Math.min(100, (seconds / duration) * 100))}%`;
	}

	function formatTime(seconds: number) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}

	function seekFromInput(event: Event) {
		cliperStore.seekTo(Number((event.currentTarget as HTMLInputElement).value));
	}

	function seekRelative(seconds: number) {
		cliperStore.seekTo(cliperStore.currentTime + seconds);
	}

	function updateScene(id: string, changes: Partial<ClipRecommendation>) {
		cliperStore.suggestedClips = cliperStore.suggestedClips.map((scene) =>
			scene.id === id ? { ...scene, ...changes } : scene
		);
	}

	function selectScene(scene: ClipRecommendation) {
		selectedSceneId = scene.id;
		cliperStore.seekTo(scene.start);
	}

	function beginRename(scene: ClipRecommendation) {
		selectedSceneId = scene.id;
		editingSceneId = scene.id;
		editingLabel = scene.label;
	}

	function saveSceneLabel(scene: ClipRecommendation) {
		if (editingSceneId !== scene.id) return;
		const label = editingLabel.trim();
		if (label) updateScene(scene.id, { label });
		editingSceneId = null;
	}

	function beginSceneDrag(event: PointerEvent, scene: ClipRecommendation, mode: 'move' | 'start' | 'end') {
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		selectedSceneId = scene.id;
		if (mode === 'move') cliperStore.seekTo(scene.start);
		dragging = { id: scene.id, mode, pointerX: event.clientX, start: scene.start, end: scene.end };
	}

	function moveSceneDrag(event: PointerEvent) {
		if (!dragging) return;
		const track = (event.currentTarget as HTMLElement).closest('.scene-track');
		if (!track) return;
		const bounds = track.getBoundingClientRect();
		const delta = ((event.clientX - dragging.pointerX) / bounds.width) * duration;
		const minLength = Math.min(0.1, duration);
		let start = dragging.start;
		let end = dragging.end;

		if (dragging.mode === 'move') {
			start = Math.max(0, Math.min(duration - (dragging.end - dragging.start), dragging.start + delta));
			end = start + dragging.end - dragging.start;
		} else if (dragging.mode === 'start') {
			start = Math.max(0, Math.min(dragging.end - minLength, dragging.start + delta));
		} else {
			end = Math.min(duration, Math.max(dragging.start + minLength, dragging.end + delta));
		}

		updateScene(dragging.id, { start, end });
	}

	function finishSceneDrag() {
		dragging = null;
	}

	function handleSceneNameKey(event: KeyboardEvent, scene: ClipRecommendation) {
		if (event.key === 'Enter') {
			event.preventDefault();
			beginRename(scene);
		}
	}

	function handleLabelInputKey(event: KeyboardEvent) {
		if (event.key === 'Escape') editingSceneId = null;
	}
</script>

<section class="flex min-w-0 flex-col" aria-label="Timeline editing" use:gsapReveal>
	<div class="mb-1.5 flex shrink-0 justify-center">
		<div class="flex items-center gap-2">
			<Button variant="ghost" class="h-[30px] w-[30px] p-0!" disabled={!cliperStore.suggestedClips.length || cliperStore.suggestStatus === 'loading'} aria-label="Mundur 15 detik" title="Mundur 15 detik" onclick={() => seekRelative(-15)}>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="h-[17px] w-[17px] stroke-current stroke-2 fill-none stroke-linecap-round stroke-linejoin-round"><path d="m11 5-7 7 7 7M20 5l-7 7 7 7" /></svg>
			</Button>
			<Button variant="ghost" class="h-[30px] w-[30px] p-0!" disabled={!cliperStore.suggestedClips.length || cliperStore.suggestStatus === 'loading'} aria-label={cliperStore.isPlaying ? 'Pause' : 'Play'} title={cliperStore.isPlaying ? 'Pause' : 'Play'} onclick={() => cliperStore.togglePlay()}>
				{#if cliperStore.isPlaying}
					<svg viewBox="0 0 24 24" aria-hidden="true" class="h-[17px] w-[17px] stroke-current stroke-2 fill-none stroke-linecap-round stroke-linejoin-round"><path d="M8 5v14M16 5v14" /></svg>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true" class="h-[17px] w-[17px] stroke-current stroke-2 fill-none stroke-linecap-round stroke-linejoin-round"><path d="m7 4 13 8-13 8V4Z" /></svg>
				{/if}
			</Button>
			<Button variant="ghost" class="h-[30px] w-[30px] p-0!" disabled={!cliperStore.suggestedClips.length || cliperStore.suggestStatus === 'loading'} aria-label="Maju 15 detik" title="Maju 15 detik" onclick={() => seekRelative(15)}>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="h-[17px] w-[17px] stroke-current stroke-2 fill-none stroke-linecap-round stroke-linejoin-round"><path d="m13 5 7 7-7 7M4 5l7 7-7 7" /></svg>
			</Button>
		</div>
	</div>

	{#if cliperStore.setupComplete}
		<div class="grid h-6 grid-cols-[88px_minmax(0,1fr)] items-center gap-2 max-sm:grid-cols-[70px_minmax(0,1fr)]">
			<span aria-hidden="true"></span>
			<div class="relative h-full border-b border-line-subtle">
				{#each rulerMarks as mark}
					<span
						class="absolute bottom-[3px] {mark === 1 ? '-translate-x-full' : '-translate-x-1/2'} before:absolute before:-bottom-[7px] before:left-1/2 before:h-1 before:w-px before:bg-line-strong before:content-[''] whitespace-nowrap font-mono text-[10px] tabular-nums text-ink-muted"
						style:left="{mark * 100}%"
					>{formatTime(duration * mark)}</span>
				{/each}
			</div>
		</div>

	{#if cliperStore.suggestErrorMessage}
		<StatusRow tone="error" role="alert" class="text-[11px]!">Scene tidak dapat dimuat: {cliperStore.suggestErrorMessage}</StatusRow>
	{:else if cliperStore.suggestedClips.length === 0}
		<StatusRow class="items-center text-center text-[11px]!">Scene belum tersedia.</StatusRow>
	{:else if cliperStore.suggestStatus === 'loading'}
		<StatusRow role="status" class="items-center text-center text-[11px]!">
			<span>Mendeteksi scene…</span>
			<Progress size="sm" />
		</StatusRow>
	{:else}
		<div class="min-h-[40px] max-h-[min(36vh,280px)] overflow-y-auto" aria-label="Scene dari analisis video">
			<div class="relative grid gap-1">
				{#each cliperStore.suggestedClips as scene, sceneIndex (scene.id)}
					<div class="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 max-sm:grid-cols-[70px_minmax(0,1fr)]">
						<div class="flex min-w-0 flex-col items-start overflow-hidden">
							{#if editingSceneId === scene.id}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									class="w-full overflow-hidden border-b border-accent bg-transparent px-1.5 py-1 text-left text-[11px] text-ink-secondary text-ellipsis whitespace-nowrap outline-none"
									aria-label="Nama scene"
									bind:value={editingLabel}
									onblur={() => saveSceneLabel(scene)}
									onkeydown={handleLabelInputKey}
									autofocus
								/>
							{:else}
								<div class="flex w-full min-w-0 items-center">
									<button
										class="min-w-0 max-w-[calc(100%-20px)] overflow-hidden px-1.5 py-1 text-left text-[11px] text-ellipsis whitespace-nowrap {selectedSceneId === scene.id ? 'text-accent' : 'text-ink-secondary'}"
										class:selected={selectedSceneId === scene.id}
										title="Klik dua kali untuk mengganti nama"
										onclick={() => selectScene(scene)}
										ondblclick={(event) => { event.stopPropagation(); beginRename(scene); }}
										onkeydown={(event) => handleSceneNameKey(event, scene)}
									>
										{scene.label}
									</button>
									<Button
										variant="ghost"
										class="h-5 w-5 shrink-0 p-0! text-accent"
										disabled={cliperStore.sceneTranscribeStatus[scene.id] === 'loading'}
										aria-label="Buat transkrip untuk {scene.label}"
										title="Buat transkrip untuk {scene.label}"
										onclick={(event: MouseEvent) => { event.stopPropagation(); void cliperStore.transcribeScene(scene.id); }}
									>
										{#if cliperStore.sceneTranscribeStatus[scene.id] === 'loading'}
											<Progress size="sm" label="Membuat transkrip scene {scene.label}" class="w-3" />
											<span class="sr-only">Memproses…</span>
										{:else}
											<svg viewBox="0 0 24 24" aria-hidden="true" class="h-[14px] w-[14px] stroke-current stroke-2 fill-none stroke-linecap-round stroke-linejoin-round"><path d="M12 2.5 14.25 9.75 21.5 12 14.25 14.25 12 21.5 9.75 14.25 2.5 12 9.75 9.75 12 2.5Z" /></svg>
										{/if}
									</Button>
								</div>
							{/if}
							{#if cliperStore.sceneTranscribeError[scene.id]}
								<StatusRow tone="error" role="alert" class="py-0.5 text-[10px]!">
									{cliperStore.sceneTranscribeError[scene.id]}
								</StatusRow>
							{/if}
						</div>
						<div class="scene-track relative h-8 min-w-0 touch-none border-b border-line-subtle">
							<div class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(25%-1px),var(--color-line-subtle)_calc(25%-1px)_25%)]"></div>
							<div
								class="absolute inset-y-1 min-w-[8px] rounded-[3px] border {selectedSceneId === scene.id ? 'border-accent bg-accent/20' : 'border-accent/65 bg-accent/12'}"
								class:selected={selectedSceneId === scene.id}
								style:left={toPercent(scene.start)}
								style:width="{Math.max(0.8, ((scene.end - scene.start) / duration) * 100)}%"
							>
								<button
									class="relative z-[2] h-full w-full cursor-grab touch-none active:cursor-grabbing"
									aria-label="Pilih dan geser {scene.label}"
									title="Klik untuk memilih dan seek"
									onclick={() => selectScene(scene)}
									onpointerdown={(event) => beginSceneDrag(event, scene, 'move')}
									onpointermove={moveSceneDrag}
									onpointerup={finishSceneDrag}
									onpointercancel={finishSceneDrag}
								></button>
								<button
									class="absolute -inset-y-0.5 left-[-3px] z-[3] w-[6px] cursor-ew-resize touch-none rounded-[2px] bg-accent"
									aria-label="Trim awal {scene.label}"
									title="Trim awal"
									onpointerdown={(event) => beginSceneDrag(event, scene, 'start')}
									onpointermove={moveSceneDrag}
									onpointerup={finishSceneDrag}
									onpointercancel={finishSceneDrag}
								></button>
								<button
									class="absolute -inset-y-0.5 right-[-3px] z-[3] w-[6px] cursor-ew-resize touch-none rounded-[2px] bg-accent"
									aria-label="Trim akhir {scene.label}"
									title="Trim akhir"
									onpointerdown={(event) => beginSceneDrag(event, scene, 'end')}
									onpointermove={moveSceneDrag}
									onpointerup={finishSceneDrag}
									onpointercancel={finishSceneDrag}
								></button>
							</div>
						</div>
					</div>
				{/each}
			<div
				class="pointer-events-none absolute inset-y-0 z-[4] w-px bg-danger left-[calc(96px+(100%-96px)*var(--playhead-position,0))] max-sm:left-[calc(78px+(100%-78px)*var(--playhead-position,0))]"
				style:--playhead-position={cliperStore.currentTime / duration}
			></div>
				<input
					class="absolute inset-y-0 left-[96px] z-[1] h-full w-[calc(100%-96px)] cursor-crosshair opacity-0 max-sm:left-[78px] max-sm:w-[calc(100%-78px)]"
					type="range" min="0" max={duration} step="0.05" value={cliperStore.currentTime}
					aria-label="Seek timeline" oninput={seekFromInput}
				/>
			</div>
		</div>
	{/if}
	{/if}
</section>
