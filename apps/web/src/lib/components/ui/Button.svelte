<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit';
		disabled?: boolean;
		/** renders an <a> with identical styling */
		href?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let {
		variant = 'secondary',
		size = 'md',
		type = 'button',
		disabled = false,
		href,
		class: cls,
		children,
		...rest
	}: Props = $props();

	const variants = {
		primary: 'border border-transparent bg-accent text-black hover:bg-accent-bright',
		secondary: 'border border-line-normal bg-transparent text-ink hover:border-line-strong',
		danger: 'border border-danger/30 bg-danger/15 text-danger hover:bg-danger/25',
		ghost: 'border border-transparent bg-transparent text-ink hover:bg-surface-3'
	} as const;

	const sizes = {
		sm: 'px-2 py-1 text-[11px]',
		md: 'px-3.5 py-2'
	} as const;

	const classes = $derived(
		cn(
			'inline-flex items-center justify-center gap-2 rounded-control text-[13px] font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed',
			variants[variant],
			sizes[size],
			cls
		)
	);
</script>

{#if href}
	<a {href} {...rest} class={classes}>{@render children?.()}</a>
{:else}
	<button {...rest} {type} {disabled} class={classes}>{@render children?.()}</button>
{/if}
