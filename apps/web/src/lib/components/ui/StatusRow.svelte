<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'muted' | 'error' | 'warn' | 'ok';
		role?: 'status' | 'alert';
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { tone = 'muted', role = 'status', class: cls, children, ...rest }: Props = $props();

	const tones = {
		muted: 'text-ink-muted',
		error: 'text-danger',
		warn: 'text-warn',
		ok: 'text-ok'
	} as const;
</script>

<div {...rest} {role} class={cn('flex flex-col gap-2 py-2.5 text-[12px]', tones[tone], cls)}>
	{@render children?.()}
</div>
