<script lang="ts">
	import { cn } from '#lib/utils/cn';

	type Option = { value: string; label: string };
	type OptionGroup = { label: string; options: Option[] };

	interface Props {
		options?: Option[];
		groups?: OptionGroup[];
		value?: string;
		id?: string;
		label?: string;
		ariaLabel?: string;
		size?: 'sm' | 'md';
		disabled?: boolean;
		class?: string;
		onchange?: (value: string) => void;
		[key: string]: unknown;
	}

	let {
		options = [],
		groups = [],
		value = $bindable(''),
		id,
		label,
		ariaLabel,
		size = 'md',
		disabled = false,
		class: cls,
		onchange,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const triggerId = $derived(id ?? `${uid}-trigger`);
	const listboxId = `${uid}-listbox`;

	let open = $state(false);
	let activeIndex = $state(0);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);

	const triggerClasses = {
		sm: 'px-2 py-1 text-[11px]',
		md: 'px-3 py-2 text-[13px]'
	} as const;

	const optionClasses = {
		sm: 'px-2 py-1 text-[11px]',
		md: 'px-3 py-1.5 text-[13px]'
	} as const;

	const allOptions = $derived(groups.length ? groups.flatMap((group) => group.options) : options);
	const indexedGroups = $derived(
		groups.map((group) => ({
			...group,
			options: group.options.map((option) => ({ ...option, index: allOptions.indexOf(option) }))
		}))
	);
	const selected = $derived(allOptions.find((o) => o.value === value) ?? null);

	function openListbox() {
		if (allOptions.length === 0) return;
		activeIndex = Math.max(0, allOptions.findIndex((o) => o.value === value));
		open = true;
	}

	function close(refocus = true) {
		open = false;
		if (refocus) trigger?.focus();
	}

	function select(option: Option | undefined) {
		if (!option) return;
		value = option.value;
		onchange?.(option.value);
		close();
	}

	function move(step: number) {
		activeIndex = Math.min(allOptions.length - 1, Math.max(0, activeIndex + step));
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (disabled) return;
		if (!open) {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				openListbox();
			}
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				move(-1);
				break;
			case 'Home':
				e.preventDefault();
				activeIndex = 0;
				break;
			case 'End':
				e.preventDefault();
				activeIndex = allOptions.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				select(allOptions[activeIndex]);
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'Tab':
				close(false);
				break;
		}
	}

	// click-outside closes and returns focus to the trigger
	$effect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) close(true);
		};
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});
</script>

<div bind:this={root} {...rest} class={cn('relative', cls)}>
	{#if label}
		<label for={triggerId} class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">{label}</label>
	{/if}
	<button
		id={triggerId}
		bind:this={trigger}
		type="button"
		{disabled}
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? listboxId : undefined}
		aria-activedescendant={open ? `${listboxId}-opt-${activeIndex}` : undefined}
		aria-label={ariaLabel}
		class={cn(
			'flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-line-normal bg-transparent text-ink outline-none transition-colors focus:border-accent disabled:opacity-55 disabled:cursor-not-allowed',
			triggerClasses[size]
		)}
		onclick={() => (open ? close() : openListbox())}
		onkeydown={onTriggerKeydown}
	>
		<span class="truncate">{selected?.label ?? (value || '—')}</span>
		<span class={cn('text-[10px] text-ink-muted transition-transform', open && 'rotate-180')}>▾</span>
	</button>

	{#if open}
		<div
			id={listboxId}
			role="listbox"
			class="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-control border border-line-normal bg-surface-2 py-1 shadow-box"
		>
			{#if groups.length}
				{#each indexedGroups as group (group.label)}
					<div role="group" aria-label={group.label}>
						<div aria-hidden="true" class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-ink-muted">{group.label}</div>
						{#each group.options as option (option.value)}
							<button
								type="button"
								tabindex="-1"
								id={`${listboxId}-opt-${option.index}`}
								role="option"
								aria-selected={option.value === value}
								class={cn(
									'flex w-full cursor-pointer items-center border-0 bg-transparent text-left',
									optionClasses[size],
									option.index === activeIndex && 'bg-surface-3',
									option.value === value && 'text-accent font-semibold'
								)}
								onclick={() => select(option)}
								onmousemove={() => (activeIndex = option.index)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				{/each}
			{:else}
				{#each options as option, i (option.value)}
				<button
					type="button"
					tabindex="-1"
					id={`${listboxId}-opt-${i}`}
					role="option"
					aria-selected={option.value === value}
					class={cn(
						'flex w-full cursor-pointer items-center border-0 bg-transparent text-left',
						optionClasses[size],
						i === activeIndex && 'bg-surface-3',
						option.value === value && 'text-accent font-semibold'
					)}
					onclick={() => select(option)}
					onmousemove={() => (activeIndex = i)}
				>
					{option.label}
				</button>
			{/each}
			{/if}
		</div>
	{/if}
</div>
