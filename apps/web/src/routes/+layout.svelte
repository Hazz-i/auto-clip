<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { cliperStore } from '#lib/stores/cliper.svelte';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => cliperStore.loadCaptionStyle());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
