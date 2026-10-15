<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import UploadPanel from '#lib/components/UploadPanel.svelte';
	import Preview916 from '#lib/components/Preview916.svelte';
	import TranscriptEditor from '#lib/components/TranscriptEditor.svelte';
	import FontEditor from '#lib/components/FontEditor.svelte';
	import RenderPanel from '#lib/components/RenderPanel.svelte';
	import TimelineEditor from '#lib/components/TimelineEditor.svelte';
	import UploadWizard from '#lib/components/UploadWizard.svelte';
	import { cliperStore } from '#lib/stores/cliper.svelte';
	import { gsapReveal } from '#lib/utils/motion';

	let isUploadOpen = $state(false);
	let isFontEditorOpen = $state(false);

	$effect(() => {
		if (cliperStore.transcribeStatus === 'loading') isFontEditorOpen = false;
	});
</script>

<svelte:head>
	<title>Cliper — Studio Klip Vertikal 9:16</title>
</svelte:head>

<div class="app-shell">
	<!-- Top Bar / Header -->
	<Header onOpenUpload={() => (isUploadOpen = true)} />

	{#if isUploadOpen}
		<UploadPanel onClose={() => (isUploadOpen = false)} />
	{/if}

	{#if cliperStore.wizard.isOpen}
		<UploadWizard />
	{/if}

	<main class="app-main">
		<div class="studio-grid" use:gsapReveal>
			<section class="preview-column">
				<Preview916 onEditCaption={() => (isFontEditorOpen = true)} showFontSample={isFontEditorOpen} />
				<TimelineEditor />
			</section>

			<aside class="panel panel-right rounded-panel border border-line-subtle bg-surface" use:gsapReveal>
				<div class="flex gap-1 border-b border-line-subtle px-[18px] max-sm:px-3.5" role="tablist" aria-label="Editor">
					<button
						class={`rounded-t-control border-b-2 px-3 pt-3 pb-2.5 text-[12px] font-semibold transition-colors ${!isFontEditorOpen ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
						role="tab"
						aria-selected={!isFontEditorOpen}
						onclick={() => (isFontEditorOpen = false)}
					>
						Transkrip
					</button>
					<button
						class={`rounded-t-control border-b-2 px-3 pt-3 pb-2.5 text-[12px] font-semibold transition-colors ${isFontEditorOpen ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
						role="tab"
						aria-selected={isFontEditorOpen}
						onclick={() => (isFontEditorOpen = true)}
					>
						Caption
					</button>
				</div>

				<div class="panel-body bg-surface">
					{#key isFontEditorOpen}
					<div class="panel-view" use:gsapReveal>
				{#if isFontEditorOpen}
					<FontEditor />
				{:else}
					<TranscriptEditor />
				{/if}
					</div>
					{/key}
				</div>
			</aside>
		</div>
		{#if cliperStore.render.status !== 'idle'}
			<RenderPanel />
		{/if}
	</main>
</div>
