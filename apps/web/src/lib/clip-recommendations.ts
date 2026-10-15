export interface ClipRecommendation {
	id: string;
	start: number;
	end: number;
	score?: number;
	label: string;
}

interface SuggestResponse {
	clips?: Array<{ id?: unknown; start?: unknown; end?: unknown; score?: unknown }>;
}

export function mapSuggestedClips(raw: unknown, duration: number): ClipRecommendation[] {
	const response = raw as SuggestResponse | null;
	if (!Array.isArray(response?.clips)) return [];

	const max = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
	const clips: ClipRecommendation[] = [];
	for (const item of response.clips) {
		const start = Number(item?.start);
		const end = Number(item?.end);
		if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
		const clippedStart = Math.max(0, Math.min(start, max));
		const clippedEnd = Math.max(0, Math.min(end, max));
		if (clippedEnd <= clippedStart) continue;
		clips.push({
			id: typeof item.id === 'string' && item.id ? item.id : `scene-${clips.length + 1}`,
			start: clippedStart,
			end: clippedEnd,
			score: typeof item.score === 'number' ? Number(item.score.toFixed(2)) : undefined,
			label: `Scene ${clips.length + 1}`
		});
	}
	return clips;
}
