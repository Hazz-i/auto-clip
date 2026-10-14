<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	let fontFileInputRef = $state<HTMLInputElement | null>(null);

	const standardFonts = [
		{ label: 'Abril Fatface (Default Student-Kit)', value: 'Abril Fatface' },
		{ label: 'Montserrat ExtraBold', value: 'Montserrat' },
		{ label: 'Bebas Neue (Punchy All-Caps)', value: 'Bebas Neue' },
		{ label: 'Poppins Bold', value: 'Poppins' },
		{ label: 'Space Grotesk', value: 'Space Grotesk' },
		{ label: 'Impact (System)', value: 'Impact, sans-serif' },
		{ label: 'Arial Black (System)', value: 'Arial Black, sans-serif' },
		{ label: 'Monospace (Terminal)', value: 'Courier New, monospace' }
	];

	function handleCustomFontUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			cliperStore.importFont(target.files[0]);
		}
	}
</script>

<div class="font-editor">
	<!-- Pilihan Font Family -->
	<div class="form-group">
		<label class="form-label" for="font-family-select">
			<span>Font Family</span>
			<span class="label-badge">Student-Kit Decoupled</span>
		</label>
		<select
			id="font-family-select"
			class="select-input"
			bind:value={cliperStore.captionStyle.fontFamily}
		>
			<optgroup label="Standar & Google Fonts">
				{#each standardFonts as font}
					<option value={font.value}>{font.label}</option>
				{/each}
			</optgroup>

			{#if cliperStore.customFonts.length > 0}
				<optgroup label="Font Kustom Diimpor">
					{#each cliperStore.customFonts as cf}
						<option value={cf.name}>{cf.name} (Lokal)</option>
					{/each}
				</optgroup>
			{/if}
		</select>
	</div>

	<!-- Ukuran Font (62 - 64px) & All Caps -->
	<div class="two-col-grid">
		<div class="form-group">
			<label class="form-label" for="font-size-range">
				<span>Ukuran (1080p)</span>
				<span class="value-chip">{cliperStore.captionStyle.fontSize}px</span>
			</label>
			<input
				id="font-size-range"
				type="range"
				min="48"
				max="80"
				step="2"
				bind:value={cliperStore.captionStyle.fontSize}
				class="range-slider"
			/>
			<div class="range-ticks">
				<span>54px</span>
				<span class="tick-active">62-64px</span>
				<span>76px</span>
			</div>
		</div>

		<div class="form-group">
			<span class="form-label">Huruf Kapital</span>
			<label class="toggle-card">
				<input
					type="checkbox"
					bind:checked={cliperStore.captionStyle.allCaps}
					class="toggle-checkbox"
				/>
				<span class="toggle-text">ALL-CAPS</span>
			</label>
		</div>
	</div>

	<!-- Palet Warna Dasar & Aksen (Max 20% chunk) -->
	<div class="two-col-grid">
		<div class="form-group">
			<label class="form-label" for="primary-color-input">Warna Utama</label>
			<div class="color-picker-row">
				<input
					id="primary-color-input"
					type="color"
					bind:value={cliperStore.captionStyle.primaryColor}
					class="color-input"
				/>
				<span class="color-hex">{cliperStore.captionStyle.primaryColor}</span>
			</div>
		</div>

		<div class="form-group">
			<label class="form-label" for="accent-color-input">
				<span>Warna Aksen</span>
				<span class="label-badge badge-yellow">Maks 20%</span>
			</label>
			<div class="color-picker-row">
				<input
					id="accent-color-input"
					type="color"
					bind:value={cliperStore.captionStyle.accentColor}
					class="color-input"
				/>
				<span class="color-hex">{cliperStore.captionStyle.accentColor}</span>
			</div>
		</div>
	</div>

	<!-- Posisi Vertikal Teks (Seam/Dada - jangan di dagu) -->
	<div class="form-group">
		<label class="form-label" for="pos-y-range">
			<span>Posisi Vertikal Caption</span>
			<span class="value-chip">{cliperStore.captionStyle.positionY}% (Dada / Seam)</span>
		</label>
		<input
			id="pos-y-range"
			type="range"
			min="55"
			max="85"
			step="1"
			bind:value={cliperStore.captionStyle.positionY}
			class="range-slider"
		/>
		<div class="range-ticks">
			<span>55% (Tinggi)</span>
			<span class="tick-active">70-75% (Aman Dada)</span>
			<span>85% (Bawah)</span>
		</div>
	</div>

	<!-- Box Style (Gelap Tepi Terang ala HyperFrames) -->
	<div class="box-style-card">
		<span class="card-subtitle">Token Box Gelap Tepi Terang</span>
		<div class="token-list">
			<div class="token-row">
				<span class="token-name">Latar Belakang:</span>
				<code class="token-val">{cliperStore.captionStyle.boxBg}</code>
			</div>
			<div class="token-row">
				<span class="token-name">Garis Tepi:</span>
				<code class="token-val">{cliperStore.captionStyle.boxBorder}</code>
			</div>
		</div>
	</div>

	<!-- Impor Custom Font (.ttf / .woff / .woff2) -->
	<div class="custom-font-card">
		<div class="custom-font-header">
			<span class="card-subtitle">Impor Font (.ttf / .woff)</span>
			<span class="label-badge">Simpan LocalStorage</span>
		</div>

		<input
			type="file"
			accept=".ttf,.woff,.woff2,.otf"
			bind:this={fontFileInputRef}
			onchange={handleCustomFontUpload}
			style="display: none;"
		/>

		<button class="btn btn-secondary w-full" onclick={() => fontFileInputRef?.click()}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			Pilih File Font (.ttf / .woff)
		</button>

		{#if cliperStore.customFonts.length > 0}
			<div class="custom-fonts-list">
				{#each cliperStore.customFonts as cf}
					<div class="custom-font-item">
						<span class="cf-name" style:font-family={cf.name}>{cf.name}</span>
						<button
							class="btn-xs-apply"
							onclick={() => (cliperStore.captionStyle.fontFamily = cf.name)}
						>
							Terapkan
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pratinjau Cepat Caption -->
	<div class="preview-mini-card">
		<span class="card-subtitle">Pratinjau Token Caption:</span>
		<div
			class="sample-caption-render"
			style:background={cliperStore.captionStyle.boxBg}
			style:border="1.5px solid {cliperStore.captionStyle.boxBorder}"
			style:font-family={cliperStore.captionStyle.fontFamily}
			style:text-transform={cliperStore.captionStyle.allCaps ? 'uppercase' : 'none'}
		>
			<span style:color={cliperStore.captionStyle.primaryColor}>VIDEO</span>
			<span style:color={cliperStore.captionStyle.accentColor}>OTOMATIS</span>
			<span style:color={cliperStore.captionStyle.primaryColor}>CEPAT</span>
		</div>
	</div>
</div>

<style>
	.font-editor {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.label-badge {
		font-size: 10px;
		font-weight: 700;
		color: var(--accent-primary);
		background: rgba(56, 189, 248, 0.12);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.badge-yellow {
		color: var(--accent-yellow);
		background: rgba(250, 204, 21, 0.12);
	}

	.two-col-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.value-chip {
		font-family: monospace;
		font-size: 11px;
		color: var(--accent-primary);
	}

	.range-slider {
		width: 100%;
		accent-color: var(--accent-primary);
		cursor: pointer;
	}

	.range-ticks {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.tick-active {
		color: var(--accent-primary);
		font-weight: 700;
	}

	.toggle-card {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-normal);
		border-radius: var(--radius-sm);
		padding: 8px 12px;
		cursor: pointer;
		height: 38px;
	}

	.toggle-checkbox {
		accent-color: var(--accent-primary);
		width: 16px;
		height: 16px;
	}

	.toggle-text {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.color-picker-row {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-normal);
		border-radius: var(--radius-sm);
		padding: 4px 8px;
	}

	.color-input {
		border: none;
		width: 28px;
		height: 28px;
		background: transparent;
		cursor: pointer;
		border-radius: 4px;
	}

	.color-hex {
		font-family: monospace;
		font-size: 12px;
		color: var(--text-primary);
	}

	.box-style-card,
	.custom-font-card,
	.preview-mini-card {
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-subtitle {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.token-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 11px;
	}

	.token-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.token-name {
		color: var(--text-muted);
	}

	.token-val {
		font-family: monospace;
		color: var(--accent-primary);
		background: rgba(0, 0, 0, 0.4);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.custom-font-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.w-full {
		width: 100%;
	}

	.custom-fonts-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.custom-font-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-surface);
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--border-subtle);
	}

	.cf-name {
		font-size: 12px;
		font-weight: 700;
	}

	.btn-xs-apply {
		font-size: 10px;
		background: var(--accent-primary);
		color: #000;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.sample-caption-render {
		padding: 10px 16px;
		border-radius: 10px;
		display: flex;
		gap: 8px;
		justify-content: center;
		font-size: 18px;
		font-weight: 800;
		text-align: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}
</style>
