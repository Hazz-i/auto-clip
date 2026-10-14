<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';

	const cutsCount = $derived(cliperStore.cuts.length);
	const rawActiveWord = $derived(cliperStore.activeWord?.text || '—');
	const activeWordText = $derived(
		rawActiveWord.length > 24 ? rawActiveWord.slice(0, 24) + '…' : rawActiveWord
	);
</script>

<header class="app-header">
	<div class="header-brand">
		<div class="logo-badge">C</div>
		<div class="app-title">
			Cliper
			<span class="app-tag">Studio 9:16</span>
		</div>
	</div>

	<div class="header-meta">
		<div class="live-info">
			<span class="info-label">Kata Aktif:</span>
			<span class="info-val">{activeWordText}</span>
			{#if cutsCount > 0}
				<span class="badge badge-cut">{cutsCount} Cut EDL</span>
			{/if}
		</div>

		<div class="server-status" title="Status Server Backend">
			<span class="status-dot online"></span>
			<span>Backend Siap</span>
		</div>
	</div>
</header>

<style>
	.live-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		background: var(--bg-surface-elevated);
		padding: 4px 12px;
		border-radius: 20px;
		border: 1px solid var(--border-subtle);
	}
	.info-label {
		color: var(--text-muted);
	}
	.info-val {
		color: var(--accent-primary);
		font-weight: 700;
		font-family: monospace;
		max-width: 220px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: inline-block;
		vertical-align: middle;
	}
</style>
