<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		size?: 'sm' | 'md';
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { size = 'md', class: cls, children, ...rest }: Props = $props();

	// md replaces .panel-title, sm replaces .meta-title / .ctrl-label / .card-subtitle / .scene-track-heading
	const sizes = {
		sm: 'text-[11px] tracking-[0.04em]',
		md: 'text-[13px] tracking-[0.06em]'
	} as const;
</script>

<div
	{...rest}
	class={cn('flex items-center gap-2 font-bold uppercase text-ink-secondary', sizes[size], cls)}
>
	{@render children?.()}
</div>
