<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'danger' | 'warn' | 'ok';
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { tone = 'neutral', class: cls, children, ...rest }: Props = $props();

	const tones = {
		neutral: 'border-line-normal bg-line-subtle text-ink-secondary',
		danger: 'border-danger/35 bg-danger/20 text-danger',
		warn: 'border-warn/35 bg-warn/20 text-warn',
		ok: 'border-ok/35 bg-ok/20 text-ok'
	} as const;
</script>

<span
	{...rest}
	class={cn(
		'inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-bold uppercase',
		tones[tone],
		cls
	)}
>
	{@render children?.()}
</span>
