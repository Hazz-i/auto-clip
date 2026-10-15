<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import { Badge, Button, Dropdown, Field, SectionTitle } from './ui';

	let fontFileInputRef = $state<HTMLInputElement | null>(null);
	let captionSaved = $state(false);
	let captionSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	const standardFonts = [
		{ label: 'Abril Fatface', value: 'Abril Fatface' },
		{ label: 'Montserrat ExtraBold', value: 'Montserrat' },
		{ label: 'Bebas Neue', value: 'Bebas Neue' },
		{ label: 'Poppins Bold', value: 'Poppins' },
		{ label: 'Space Grotesk', value: 'Space Grotesk' },
		{ label: 'Impact', value: 'Impact, sans-serif' },
		{ label: 'Arial Black', value: 'Arial Black, sans-serif' },
		{ label: 'Monospace', value: 'Courier New, monospace' }
	];

	function handleCustomFontUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			cliperStore.importFont(target.files[0]);
		}
	}

	function boxColorHex(value: string): string {
		if (/^#[\da-f]{6}$/i.test(value)) return value;
		const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
		return rgb ? `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}` : '#0C101A';
	}

	function updateBoxColor(color: string) {
		const alpha = /rgba\(.*[,/]\s*([\d.]+)\s*\)$/i.exec(cliperStore.captionStyle.boxBg)?.[1];
		const [red, green, blue] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
		cliperStore.captionStyle.boxBg = alpha && Number(alpha) < 1
			? `rgba(${red}, ${green}, ${blue}, ${alpha})`
			: color;
	}

	function saveCaptionStyle() {
		if (!cliperStore.saveCaptionStyle()) return;
		captionSaved = true;
		if (captionSaveTimeout) clearTimeout(captionSaveTimeout);
		captionSaveTimeout = setTimeout(() => (captionSaved = false), 1800);
	}

</script>

<div class="flex flex-col gap-3.5">
	<!-- Pilihan Font Family -->
	<Field label="Font Family" for="font-family-select">
		<Dropdown
			id="font-family-select"
			ariaLabel="Font Family"
			groups={[
				{ label: 'Standar & Google Fonts', options: standardFonts },
				...(cliperStore.customFonts.length
					? [{ label: 'Font Kustom Diimpor', options: cliperStore.customFonts.map((cf) => ({ value: cf.name, label: `${cf.name} (Lokal)` })) }]
					: [])
			]}
			bind:value={cliperStore.captionStyle.fontFamily}
		/>
	</Field>

	<!-- Ukuran Font (62 - 64px) & All Caps -->
	<div class="grid grid-cols-2 gap-3">
		<Field>
			<label for="font-size-range" class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">
				<span>Ukuran (1080p)</span>
				<span class="font-mono text-[11px] text-accent">{cliperStore.captionStyle.fontSize}px</span>
			</label>
			<!-- A4: range/checkbox/color/file mempertahankan markup sendiri -->
			<input
				id="font-size-range"
				type="range"
				min="48"
				max="80"
				step="2"
				bind:value={cliperStore.captionStyle.fontSize}
				class="w-full cursor-pointer accent-accent"
			/>
		</Field>

		<Field label="Huruf Kapital">
			<label class="flex h-[38px] cursor-pointer items-center gap-2 rounded-control border border-line-normal px-3 py-2">
				<input
					type="checkbox"
					bind:checked={cliperStore.captionStyle.allCaps}
					class="size-4 accent-accent"
				/>
				<span class="text-[12px] font-bold tracking-[0.05em]">ALL-CAPS</span>
			</label>
		</Field>
	</div>

		<!-- Warna Teks -->
	<div class="grid grid-cols-2 gap-3">
		<Field label="Warna Utama" for="primary-color-input">
			<div class="flex items-center gap-2 rounded-control border border-line-normal px-2 py-1">
				<input
					id="primary-color-input"
					type="color"
					bind:value={cliperStore.captionStyle.primaryColor}
					class="h-7 w-7 cursor-pointer rounded-[4px] border-0 bg-transparent"
				/>
				<span class="font-mono text-[12px] text-ink">{cliperStore.captionStyle.primaryColor}</span>
			</div>
		</Field>

		<Field for="accent-color-input">
			<label for="accent-color-input" class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">
				<span>Sorotan Kata Aktif</span>
				<Badge tone="warn">Maks 20%</Badge>
			</label>
			<div class="flex items-center gap-2 rounded-control border border-line-normal px-2 py-1">
				<input
					id="accent-color-input"
					type="color"
					bind:value={cliperStore.captionStyle.accentColor}
					class="h-7 w-7 cursor-pointer rounded-[4px] border-0 bg-transparent"
				/>
				<span class="font-mono text-[12px] text-ink">{cliperStore.captionStyle.accentColor}</span>
			</div>
			<p class="mt-1 text-[10px] leading-tight text-ink-muted">Untuk kata yang sedang diucapkan.</p>
		</Field>
	</div>

	<!-- Latar caption dan sudut pratinjau -->
	<div class="grid grid-cols-2 gap-3">
		<Field label="Latar Caption">
			<label class="flex h-[38px] cursor-pointer items-center gap-2 rounded-control border border-line-normal px-3 py-2">
				<input
					type="checkbox"
					bind:checked={cliperStore.captionStyle.boxEnabled}
					class="size-4 accent-accent"
				/>
				<span class="text-[12px] font-bold tracking-[0.05em]">Ada latar</span>
			</label>
		</Field>

		{#if cliperStore.captionStyle.boxEnabled}
			<Field label="Warna Latar" for="caption-box-color-input">
				<div class="flex items-center gap-2 rounded-control border border-line-normal px-2 py-1">
					<input
						id="caption-box-color-input"
						type="color"
						value={boxColorHex(cliperStore.captionStyle.boxBg)}
						oninput={(event) => updateBoxColor(event.currentTarget.value)}
						class="h-7 w-7 cursor-pointer rounded-[4px] border-0 bg-transparent"
					/>
					<span class="font-mono text-[12px] text-ink">{boxColorHex(cliperStore.captionStyle.boxBg)}</span>
				</div>
			</Field>
		{/if}
	</div>

	{#if cliperStore.captionStyle.boxEnabled}
		<Field>
			<label for="caption-box-radius-range" class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">
				<span>Sudut latar (pratinjau saja, 0–24 px)</span>
				<span class="font-mono text-[11px] text-accent">{cliperStore.captionStyle.boxRadius}px</span>
			</label>
			<input
				id="caption-box-radius-range"
				type="range"
				min="0"
				max="24"
				step="1"
				bind:value={cliperStore.captionStyle.boxRadius}
				class="w-full cursor-pointer accent-accent"
			/>
		</Field>
	{/if}

	<!-- Posisi Vertikal Teks (Seam/Dada - jangan di dagu) -->
	<Field>
		<label for="pos-y-range" class="flex items-center justify-between text-[12px] font-semibold text-ink-secondary">
			<span>Posisi Vertikal Caption</span>
			<span class="font-mono text-[11px] text-accent">{cliperStore.captionStyle.positionY}%</span>
		</label>
		<input
			id="pos-y-range"
			type="range"
			min="5"
			max="95"
			step="1"
			bind:value={cliperStore.captionStyle.positionY}
			class="w-full cursor-pointer accent-accent"
		/>
	</Field>

	<!-- Impor Custom Font (.ttf / .woff / .woff2) -->
	<div class="flex flex-col gap-2">
		<SectionTitle size="sm">Impor Font (.ttf / .woff)</SectionTitle>

		<input
			type="file"
			accept=".ttf,.woff,.woff2,.otf"
			class="sr-only"
			bind:this={fontFileInputRef}
			onchange={handleCustomFontUpload}
		/>

		<Button class="w-full" onclick={() => fontFileInputRef?.click()}>
			Pilih File Font (.ttf / .woff)
		</Button>

	</div>

	<div class="flex flex-col items-center gap-2">
		<Button variant="primary" class="w-full" onclick={saveCaptionStyle}>Simpan Pengaturan</Button>
		{#if captionSaved}
			<span role="status" aria-live="polite" class="text-[11px] text-ok">Tersimpan</span>
		{/if}
	</div>

</div>
