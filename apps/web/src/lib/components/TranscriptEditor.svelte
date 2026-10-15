<script lang="ts">
	import { cliperStore } from '../stores/cliper.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Progress from '#lib/components/ui/Progress.svelte';
	import StatusRow from '#lib/components/ui/StatusRow.svelte';

	const anySceneTranscribing = $derived(
		Object.values(cliperStore.sceneTranscribeStatus).some((status) => status === 'loading')
	);
	let editingWordId = $state<string | null>(null);
	let editText = $state('');

	function startEdit(wordId: string, text: string) {
		editingWordId = wordId;
		editText = text;
	}

	function saveEdit(chunkId: string, wordId: string) {
		if (editText.trim()) cliperStore.updateWordText(chunkId, wordId, editText.trim());
		editingWordId = null;
	}

	function handleKeydown(event: KeyboardEvent, chunkId: string, wordId: string) {
		if (event.key === 'Enter') saveEdit(chunkId, wordId);
		else if (event.key === 'Escape') editingWordId = null;
	}
</script>

<div class="flex min-h-[calc(100dvh-190px)] flex-1 flex-col">
	{#if cliperStore.transcribeStatus === 'loading'}
		<StatusRow aria-live="polite" class="flex-1 items-center justify-center text-center">
			<p>Membuat transkrip…</p>
			<Progress label="Membuat transkrip" />
		</StatusRow>
	{:else if !cliperStore.hasRealTranscript || cliperStore.chunks.length === 0}
		<StatusRow aria-live="polite" class="flex-1 items-center justify-center text-center">
			{#if cliperStore.uploadStatus === 'done' && cliperStore.fileKey}
				<Button
					variant="primary"
					size="sm"
					disabled={anySceneTranscribing}
					onclick={() => void cliperStore.transcribeAll()}
				>
					Generate Semua Transkrip
				</Button>
			{:else}
				<p>Transkrip belum tersedia.</p>
			{/if}
			{#if cliperStore.transcribeErrorMessage}
				<p role="alert" class="text-danger">{cliperStore.transcribeErrorMessage}</p>
			{/if}
		</StatusRow>
	{:else}
		{#if cliperStore.transcribeErrorMessage}
			<StatusRow tone="error" role="alert" class="mt-2 items-center py-0! text-center">{cliperStore.transcribeErrorMessage}</StatusRow>
		{/if}
		<div class="min-h-0 max-h-[calc(100dvh-190px)] overflow-y-auto pr-1.5">
			{#each cliperStore.chunks as chunk (chunk.id)}
				<div class="border-b border-line-subtle py-2">
					<div class="flex flex-wrap gap-x-2 gap-y-1">
						{#each chunk.words as word (word.id)}
							<div
								class="word-pill inline-flex min-h-[30px] items-center border-b {cliperStore.activeWord?.id === word.id ? 'border-accent' : 'border-transparent'} {word.cut ? 'text-ink-muted line-through' : ''}"
								class:is-active={cliperStore.activeWord?.id === word.id}
								class:is-cut={word.cut}
								class:is-accent={word.accent}
							>
								{#if editingWordId === word.id}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="w-24 border-b border-accent bg-transparent py-[3px] text-[13px] text-ink outline-none"
										bind:value={editText}
										autofocus
										onblur={() => saveEdit(chunk.id, word.id)}
										onkeydown={(event) => handleKeydown(event, chunk.id, word.id)}
									/>
								{:else}
									<button
										class="py-[3px] text-[13px] font-semibold {word.accent ? 'text-warn' : ''}"
										title="Klik untuk mengedit teks"
										onclick={() => startEdit(word.id, word.text)}
									>
										{word.text}
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
