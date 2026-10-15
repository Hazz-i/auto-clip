<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import { gsapReveal } from '../utils/motion';
	import Button from '#lib/components/ui/Button.svelte';

	let { onOpenUpload }: { onOpenUpload: () => void } = $props();
	const isRendering = $derived(
		cliperStore.render.status === 'queued' || cliperStore.render.status === 'processing'
	);
</script>

<header
	class="flex h-14 shrink-0 items-center border-b border-line-subtle px-[clamp(16px,3vw,40px)]"
	use:gsapReveal
>
	<span class="text-[17px] font-bold tracking-[-0.02em] text-ink">Cliper</span>
	<div class="ml-auto flex items-center gap-2">
		<Button variant="secondary" onclick={onOpenUpload}>Upload</Button>
		<Button
			variant="primary"
			disabled={!cliperStore.fileKey || isRendering}
			title={!cliperStore.fileKey ? 'Upload video terlebih dahulu' : 'Export video'}
			onclick={() => cliperStore.sendRenderJob()}
		>
			Export
		</Button>
	</div>
</header>
