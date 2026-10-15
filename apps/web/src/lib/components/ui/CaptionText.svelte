<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import type { CaptionStyle, Word } from '#lib/types';

	interface Props {
		captionStyle: CaptionStyle;
		words: Word[];
		activeWordId?: string;
		fontScale?: number;
		class?: string;
		onEditCaption?: () => void;
	}

	let {
		captionStyle,
		words,
		activeWordId,
		fontScale = 0.32,
		class: cls,
		onEditCaption
	}: Props = $props();

	const wordBase =
		'inline-block max-h-full max-w-[90%] px-1.5 py-0.5 overflow-hidden rounded-[6px] font-extrabold tracking-[-0.01em] break-words [word-break:break-word] transition-[transform,color,background-color,box-shadow,opacity] duration-100 [transition-timing-function:cubic-bezier(0.2,0,0,1)]';

	function wordClass(isActive: boolean, isAccent: boolean): string {
		const state = isActive
			? 'scale-[1.12] bg-[color-mix(in_srgb,var(--active-accent,var(--color-warn))_22%,transparent)] shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--active-accent,var(--color-warn))_50%,transparent)] [text-shadow:0_0_16px_var(--active-accent,var(--color-warn))]'
			: isAccent
				? 'opacity-95 [filter:drop-shadow(0_2px_6px_currentColor)]'
				: 'opacity-80';
		return `${wordBase} ${state}${isActive ? ' is-active' : ''}${isAccent ? ' is-accent' : ''}`;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={cn('p-2 px-4 flex max-h-[180px] max-w-[90%] flex-wrap cursor-text items-center justify-center gap-1.5 overflow-hidden text-center break-words [word-break:break-word] [overflow-wrap:break-word] shadow-none backdrop-blur-md', cls)}
	role={onEditCaption ? 'button' : undefined}
	tabindex={onEditCaption ? 0 : undefined}
	aria-label={onEditCaption ? 'Edit gaya teks caption' : undefined}
	title={onEditCaption ? 'Klik dua kali untuk mengatur gaya caption' : undefined}
	ondblclick={onEditCaption}
	onkeydown={(event) => event.key === 'Enter' && onEditCaption?.()}
	style:background={captionStyle.boxEnabled ? captionStyle.boxBg : undefined}
	style:border={captionStyle.boxEnabled ? `1.5px solid ${captionStyle.boxBorder}` : undefined}
	style:border-radius={captionStyle.boxEnabled ? `${captionStyle.boxRadius}px` : undefined}
	style:font-family={captionStyle.fontFamily}
	style:text-transform={captionStyle.allCaps ? 'uppercase' : 'none'}
	style:--active-accent={captionStyle.accentColor}
>
	{#each words as word (word.id)}
		{#if !word.cut}
			{@const isActive = activeWordId === word.id}
			<span
				class={wordClass(isActive, !!word.accent)}
				style:color={isActive || word.accent ? captionStyle.accentColor : captionStyle.primaryColor}
				style:font-size="{Math.round(captionStyle.fontSize * fontScale)}px"
			>
				{word.text}
			</span>
		{/if}
	{/each}
</div>
