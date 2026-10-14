<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import UploadPanel from '#lib/components/UploadPanel.svelte';
	import Preview916 from '#lib/components/Preview916.svelte';
	import TranscriptEditor from '#lib/components/TranscriptEditor.svelte';
	import FontEditor from '#lib/components/FontEditor.svelte';
	import RenderPanel from '#lib/components/RenderPanel.svelte';
	import UploadWizard from '#lib/components/UploadWizard.svelte';
	import { cliperStore } from '#lib/stores/cliper.svelte';
</script>

<svelte:head>
	<title>Cliper — Studio Klip Vertikal 9:16</title>
</svelte:head>

<div class="app-shell">
	<!-- Top Bar / Header -->
	<Header />

	<!-- Modal Wizard Upload (Multi-step) -->
	{#if cliperStore.wizard.isOpen}
		<UploadWizard />
	{/if}

	<!-- 3 Columns Layout -->
	<main class="workspace-grid">
		<!-- Panel Kiri: Upload & Video Source Preview -->
		<UploadPanel />

		<!-- Panel Tengah: Preview 9:16 (1080x1920 Scaled), Caption Box Gelap Tepi Terang, CropX -->
		<Preview916 />

		<!-- Panel Kanan: Editor Tabbed (Transkrip, Font, Render) -->
		<aside class="panel panel-right">
			<div class="panel-header">
				<span class="panel-title">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
					</svg>
					Studio Editor
				</span>

				<div class="tabs-nav">
					<button
						class="tab-btn"
						class:active={cliperStore.activeTab === 'transcript'}
						onclick={() => (cliperStore.activeTab = 'transcript')}
					>
						Transkrip
						{#if cliperStore.cuts.length > 0}
							<span class="tab-badge">{cliperStore.cuts.length}</span>
						{/if}
					</button>

					<button
						class="tab-btn"
						class:active={cliperStore.activeTab === 'font'}
						onclick={() => (cliperStore.activeTab = 'font')}
					>
						Font & Box
					</button>

					<button
						class="tab-btn"
						class:active={cliperStore.activeTab === 'render'}
						onclick={() => (cliperStore.activeTab = 'render')}
					>
						Render
					</button>
				</div>
			</div>

			<div class="panel-body">
				{#if cliperStore.activeTab === 'transcript'}
					<TranscriptEditor />
				{:else if cliperStore.activeTab === 'font'}
					<FontEditor />
				{:else if cliperStore.activeTab === 'render'}
					<RenderPanel />
				{/if}
			</div>
		</aside>
	</main>
</div>

<style>
	.tab-badge {
		font-size: 9px;
		background: var(--accent-rose);
		color: #fff;
		padding: 1px 4px;
		border-radius: 8px;
		margin-left: 2px;
	}
</style>
