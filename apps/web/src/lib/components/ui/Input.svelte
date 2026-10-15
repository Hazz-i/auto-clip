<script lang="ts">
	import { cn } from '#lib/utils/cn';

	interface Props {
		value?: string;
		type?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let { value = $bindable(''), type = 'text', placeholder, disabled = false, class: cls, ...rest }: Props = $props();
</script>

<input
	{...rest}
	bind:value
	{type}
	{placeholder}
	{disabled}
	class={cn(
		'w-full rounded-control border border-line-normal bg-transparent px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent disabled:opacity-55 disabled:cursor-not-allowed',
		cls
	)}
/>
