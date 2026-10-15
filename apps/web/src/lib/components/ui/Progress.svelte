<script lang="ts">
	import { cn } from '#lib/utils/cn';

	interface Props {
		value?: number;
		label?: string;
		size?: 'sm' | 'md';
		class?: string;
		[key: string]: unknown;
	}

	let { value, label, size = 'md', class: cls, ...rest }: Props = $props();

	// no `value` ⇒ indeterminate bar
	const determinate = $derived(value !== undefined);
	const clamped = $derived(value === undefined ? undefined : Math.min(100, Math.max(0, value)));
	const trackHeight = $derived(size === 'sm' ? 'h-1' : determinate ? 'h-[6px]' : 'h-[5px]');
</script>

<div
	{...rest}
	role="progressbar"
	aria-label={label}
	aria-valuemin={determinate ? 0 : undefined}
	aria-valuemax={determinate ? 100 : undefined}
	aria-valuenow={determinate ? clamped : undefined}
	class={cn('relative w-full overflow-hidden rounded-full bg-line-subtle', trackHeight, cls)}
>
	{#if determinate}
		<div class="h-full rounded-full bg-accent transition-[width] duration-200" style:width="{clamped}%"></div>
	{:else}
		<span class="absolute inset-y-0 left-0 w-[35%] animate-indeterminate rounded-full bg-accent"></span>
	{/if}
</div>
