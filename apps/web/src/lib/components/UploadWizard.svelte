<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import type { AspectRatioTarget } from '../types';
	import { Badge, Button, Modal, Progress, StatusRow, SectionTitle } from '#lib/components/ui';

	function formatTime(sec: number): string {
		const centiseconds = Math.round(sec * 100);
		const minutes = Math.floor(centiseconds / 6000);
		const seconds = Math.floor((centiseconds % 6000) / 100);
		const fraction = centiseconds % 100;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
	}

	const totalDuration = $derived(cliperStore.duration || 10.5);
	let confirmClose = $state(false);
	const ratioCards: { id: AspectRatioTarget }[] = [{ id: '9:16' }, { id: '1:1' }, { id: '16:9' }];
	const fallbackSceneCount = $derived(Math.max(1, Math.min(12, Math.round(totalDuration / 45))));
	const recommendedSceneCount = $derived(
		Math.max(1, Math.min(12, cliperStore.suggestedClips.length || fallbackSceneCount))
	);
	const hasAiRecommendation = $derived(
		cliperStore.suggestedClips.length > 0 && cliperStore.suggestStatus !== 'error'
	);
	const sceneCountOptions = $derived.by(() => {
		const counts = new Set<number>();
		for (const count of [recommendedSceneCount - 4, recommendedSceneCount - 2, recommendedSceneCount, recommendedSceneCount + 2]) {
			counts.add(Math.max(1, Math.min(12, count)));
		}
		for (let distance = 1; counts.size < 4 && distance <= 12; distance++) {
			if (counts.size < 4 && recommendedSceneCount - distance >= 1) counts.add(recommendedSceneCount - distance);
			if (counts.size < 4 && recommendedSceneCount + distance <= 12) counts.add(recommendedSceneCount + distance);
		}
		return [...counts].sort((a, b) => a - b);
	});

	function formatSceneLength(seconds: number): string {
		const wholeSeconds = Math.floor(seconds);
		return `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
	}

	function requestDismiss() {
		confirmClose = true;
	}

	function enterStep(step: 1 | 2 | 3) {
		cliperStore.setWizardStep(step);
		if (step === 2 && cliperStore.uploadStatus === 'done' && cliperStore.fileKey) {
			const hasExistingRecommendation = cliperStore.suggestedClips.length > 0;
			void cliperStore.suggestClips().then(() => {
				if (!hasExistingRecommendation && cliperStore.suggestedClips.length > 0) {
					cliperStore.setWizardClipCount(recommendedSceneCount);
				}
			});
		}
	}

	function applySettingsAndClose() {
		if (cliperStore.uploadStatus !== 'done' || !cliperStore.fileKey) return;
		cliperStore.setupComplete = true;
		cliperStore.applyWizardSettings();
	}
</script>

<Modal
	open={cliperStore.wizard.isOpen && !confirmClose}
	title="Pengaturan Klip"
	size="lg"
	dismissible={false}
	onDismissAttempt={requestDismiss}
	onClose={() => cliperStore.closeWizard()}
	aria-modal="true"
>
	{#snippet header({ close, titleId })}
		<div class="flex flex-col gap-3 border-b border-line-subtle pb-3">
			<div class="flex items-center justify-between gap-3">
				<h2 id={titleId} class="text-[18px] font-bold">Pengaturan Klip</h2>
				<Button variant="ghost" size="sm" title="Batal dan tutup wizard" aria-label="Tutup" onclick={requestDismiss}>✕</Button>
			</div>

			<!-- Stepper 3 Langkah -->
			<div class="flex items-center gap-1.5">
				<button
					class={`flex flex-1 items-center justify-center rounded-control border px-2 py-[5px] text-[11px] transition-colors gap-1.5 max-sm:gap-1 max-sm:px-[5px] max-sm:py-1 max-sm:text-[10px] ${cliperStore.wizard.step > 1 ? 'border-ok/30 text-ok' : cliperStore.wizard.step === 1 ? 'border-accent text-ink' : 'border-line-subtle text-ink-muted'}`}
					onclick={() => enterStep(1)}
				>
					<span class={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong font-extrabold text-[10px] max-sm:h-3.5 max-sm:w-3.5 ${cliperStore.wizard.step > 1 ? 'border-ok text-ok' : cliperStore.wizard.step === 1 ? 'border-accent text-accent' : ''}`}>1</span>
					<span class="max-sm:whitespace-nowrap">Format</span>
				</button>

				<div class={`h-0.5 w-4 shrink-0 max-sm:w-2 ${cliperStore.wizard.step > 1 ? 'bg-ok' : 'bg-line-subtle'}`}></div>

				<button
					class={`flex flex-1 items-center justify-center rounded-control border px-2 py-[5px] text-[11px] transition-colors gap-1.5 max-sm:gap-1 max-sm:px-[5px] max-sm:py-1 max-sm:text-[10px] ${cliperStore.wizard.step === 3 ? 'border-ok/30 text-ok' : cliperStore.wizard.step === 2 ? 'border-accent text-ink' : 'border-line-subtle text-ink-muted'}`}
					onclick={() => enterStep(2)}
				>
					<span class={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong font-extrabold text-[10px] max-sm:h-3.5 max-sm:w-3.5 ${cliperStore.wizard.step === 3 ? 'border-ok text-ok' : cliperStore.wizard.step === 2 ? 'border-accent text-accent' : ''}`}>2</span>
					<span class="max-sm:whitespace-nowrap">Potongan</span>
				</button>

				<div class={`h-0.5 w-4 shrink-0 max-sm:w-2 ${cliperStore.wizard.step > 2 ? 'bg-ok' : 'bg-line-subtle'}`}></div>

				<button
					class={`flex flex-1 items-center justify-center rounded-control border px-2 py-[5px] text-[11px] transition-colors gap-1.5 max-sm:gap-1 max-sm:px-[5px] max-sm:py-1 max-sm:text-[10px] ${cliperStore.wizard.step > 2 ? 'border-ok/30 text-ok' : 'border-line-subtle text-ink-muted'}`}
					onclick={() => {
						if (cliperStore.wizard.step === 1) enterStep(2);
						enterStep(3);
					}}
				>
					<span class={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-line-strong font-extrabold text-[10px] max-sm:h-3.5 max-sm:w-3.5 ${cliperStore.wizard.step > 2 ? 'border-ok text-ok' : ''}`}>3</span>
					<span class="max-sm:whitespace-nowrap">Ringkas</span>
				</button>
			</div>
		</div>
	{/snippet}

	<div class="flex flex-col gap-3">
		{#if cliperStore.wizard.step === 1}
			<div class="flex flex-col gap-3">
				<div class="flex gap-3 border-b border-line-subtle pb-2 max-sm:flex-wrap">
					<div class="flex flex-1 flex-col gap-[2px] max-sm:min-w-[calc(50%-8px)]">
						<span class="text-[10px] tracking-[0.04em] text-ink-muted uppercase">Durasi</span>
						<strong class="text-[12px] text-accent">{formatTime(totalDuration)} ({totalDuration.toFixed(1)}s)</strong>
					</div>
					<div class="flex flex-1 flex-col gap-[2px] max-sm:min-w-[calc(50%-8px)]">
						<span class="text-[10px] tracking-[0.04em] text-ink-muted uppercase">Rasio asli</span>
						<strong class="text-[12px] text-accent">{cliperStore.videoWidth > cliperStore.videoHeight ? '16:9' : '9:16'}</strong>
					</div>
				</div>

				<div class="flex flex-col gap-[2px]">
					<SectionTitle size="sm">Format output</SectionTitle>
					<div class="mt-0 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
						{#each ratioCards as card}
							<button
								class={`flex cursor-pointer flex-col items-center gap-1.5 rounded-control border-[1.5px] p-3 text-center transition-colors ${cliperStore.wizard.targetRatio === card.id ? 'border-accent bg-accent/10' : 'border-line-subtle hover:border-line-strong'}`}
								onclick={() => cliperStore.setWizardTargetRatio(card.id)}
								aria-pressed={cliperStore.wizard.targetRatio === card.id}
							>
								<span class="w-full text-[13px] font-bold text-ink">{card.id}</span>
								<div class="mt-1 flex h-12 items-center justify-center border border-line-subtle">
									<div
										class={`rounded-[2px] bg-accent/80 ${card.id === '9:16' ? 'h-9 w-5' : card.id === '1:1' ? 'h-8 w-8' : 'h-[25px] w-11'}`}
									></div>
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else if cliperStore.wizard.step === 2}
			<div class="flex flex-col gap-3">
				{#if cliperStore.suggestStatus === 'loading'}
					<div class="flex flex-col gap-3 rounded-control border border-accent/30 bg-accent/5 p-4" role="status">
						<div class="flex items-center gap-2 text-[13px] font-semibold text-ink">
							<span class="h-2 w-2 rounded-full bg-accent animate-pulse" aria-hidden="true"></span>
							<span>AI sedang menganalisis…</span>
						</div>
						<div class="flex flex-col gap-2" aria-hidden="true">
							<div class="h-3 w-2/3 rounded-full bg-accent/15 animate-pulse"></div>
							<div class="h-3 w-full rounded-full bg-accent/10 animate-pulse"></div>
						</div>
						<Progress class="w-full" label="AI sedang menganalisis scene" />
					</div>
				{:else}
					{#if cliperStore.suggestStatus === 'error' && cliperStore.suggestErrorMessage}
						<StatusRow tone="error" role="alert">Scene tidak dapat dimuat: {cliperStore.suggestErrorMessage}</StatusRow>
					{:else if cliperStore.suggestedClips.length === 0}
						<StatusRow class="items-center text-center"><p>Tidak ada scene untuk video ini. Pilih jumlah potongan secara manual.</p></StatusRow>
					{/if}
					<div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
						{#each sceneCountOptions as count (count)}
							<button
								class={`flex min-h-24 flex-col items-start justify-between gap-3 rounded-control border p-3 text-left transition-colors ${cliperStore.wizard.clipCount === count ? 'border-accent bg-accent/10' : 'border-line-subtle hover:border-line-strong'}`}
								aria-pressed={cliperStore.wizard.clipCount === count}
								aria-label="{count} scene, rata-rata {formatSceneLength(totalDuration / count)} per scene"
								onclick={() => cliperStore.setWizardClipCount(count)}
							>
								<span class="flex w-full items-center justify-between gap-2">
									<strong class="text-[14px] text-ink">{count} scene</strong>
									{#if hasAiRecommendation && count === recommendedSceneCount}
										<Badge tone="ok">Rekomendasi AI</Badge>
									{/if}
								</span>
								<span class="text-[11px] text-ink-muted">Rata-rata {formatSceneLength(totalDuration / count)} per scene</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				<h3 class="text-[13px] font-bold tracking-[0.05em] text-accent uppercase">Ringkasan</h3>
				<div class="flex flex-col gap-2 text-[12px]">
					<div class="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
						<span class="text-ink-secondary">Format</span><strong class="text-ink">{cliperStore.wizard.targetRatio}</strong>
					</div>
					<div class="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
						<span class="text-ink-secondary">Potongan</span><strong class="text-ink">{cliperStore.wizard.clipCount} klip</strong>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class="flex w-full items-center justify-between gap-3 border-t border-line-subtle pt-3 max-sm:flex-wrap">
			<div class="flex items-center gap-2 max-sm:flex-wrap">
				<Button
					variant="secondary"
					onclick={() => cliperStore.wizard.step === 1
					? requestDismiss()
						: enterStep((cliperStore.wizard.step - 1) as 1 | 2 | 3)}
				>
					Kembali
				</Button>
			</div>

			<div class="flex items-center gap-2 max-sm:flex-wrap">
				{#if cliperStore.wizard.step < 3}
					<Button
						variant="primary"
						onclick={() => enterStep((cliperStore.wizard.step + 1) as 1 | 2 | 3)}
					>
						Lanjut ke {cliperStore.wizard.step === 1 ? 'Potongan' : 'Ringkas'}
					</Button>
				{:else}
					<Button
						variant="primary"
						disabled={cliperStore.uploadStatus !== 'done' || !cliperStore.fileKey}
						onclick={applySettingsAndClose}
					>
						Terapkan pengaturan
					</Button>
				{/if}
			</div>
		</div>
	{/snippet}
	</Modal>

<Modal
	open={confirmClose}
	title="Tutup pengaturan klip?"
	size="md"
	dismissible={false}
	onDismissAttempt={() => {}}
	aria-modal="true"
>
	{#snippet header({ titleId })}
		<div class="border-b border-line-subtle pb-3">
			<h2 id={titleId} class="text-[18px] font-bold">Tutup pengaturan klip?</h2>
		</div>
	{/snippet}

	<p class="text-[13px] leading-relaxed text-ink-secondary">
		Jika wizard ditutup, video yang sudah diunggah akan dihapus dari server.
	</p>

	{#snippet footer()}
		<div class="flex w-full justify-end gap-2 max-sm:flex-wrap">
			<Button variant="primary" onclick={() => confirmClose = false}>Lanjutkan pengaturan</Button>
			<Button
				variant="danger"
				onclick={async () => {
					await cliperStore.discardUpload();
					confirmClose = false;
				}}
			>
				Tutup &amp; hapus video
			</Button>
		</div>
	{/snippet}
</Modal>
