<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		for?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { label, for: htmlFor, class: cls, children, ...rest }: Props = $props();
</script>

<div {...rest} class={cn('flex flex-col gap-1.5', cls)}>
	{#if label}
		<label for={htmlFor} class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">{label}</label>
	{/if}
	{@render children?.()}
</div>
