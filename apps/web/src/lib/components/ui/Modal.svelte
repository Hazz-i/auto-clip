<script lang="ts">
	import { cn } from '#lib/utils/cn';
	import Button from './Button.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		size?: 'md' | 'lg';
		onClose?: () => void;
		dismissible?: boolean;
		onDismissAttempt?: () => void;
		header?: Snippet<[{ close: () => void; titleId: string }]>;
		children?: Snippet;
		footer?: Snippet;
		[key: string]: unknown;
	}

	let {
		open = $bindable(false),
		title,
		size = 'md',
		onClose,
		dismissible = true,
		onDismissAttempt,
		header,
		children,
		footer,
		...rest
	}: Props = $props();

	const titleId = $props.id();
	let dialog = $state<HTMLDialogElement | null>(null);

	function close() {
		// the dialog's `close` event funnels back through handleClose below
		dialog?.close();
	}

	function handleClose() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	function handleCancel(event: Event) {
		if (dismissible) return;
		event.preventDefault();
		onDismissAttempt?.();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target !== event.currentTarget) return;
		if (dismissible) close();
		else onDismissAttempt?.();
	}

	$effect(() => {
		const dlg = dialog;
		if (!dlg) return;
		if (open && !dlg.open) dlg.showModal();
		else if (!open && dlg.open) dlg.close();
	});

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
	{...rest}
	bind:this={dialog}
	aria-labelledby={titleId}
	oncancel={handleCancel}
	onclose={handleClose}
	onclick={handleBackdropClick}
	class="m-auto max-h-none max-w-none border-0 bg-transparent p-0 text-ink transition-[opacity,scale,display,overlay] transition-discrete duration-200 ease-out opacity-0 scale-95 open:opacity-100 open:scale-100 starting:opacity-0 starting:scale-95 backdrop:bg-black/78 backdrop:backdrop-blur-[6px]"
>
	<div
		class={cn(
			'flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-[520px] flex-col gap-4 overflow-hidden rounded-panel border border-line-normal bg-surface-2 p-5 text-ink shadow-box',
			size === 'lg' && 'max-w-[720px]'
		)}
	>
		{#if header}
			{@render header({ close, titleId })}
		{:else}
			<div class="flex shrink-0 items-center justify-between gap-3">
				<h2 id={titleId} class="text-[16px] font-bold">{title}</h2>
				<Button variant="ghost" size="sm" onclick={close} aria-label="Tutup">✕</Button>
			</div>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render children?.()}
		</div>

		{#if footer}
			<div class="flex shrink-0 justify-end gap-3">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>
