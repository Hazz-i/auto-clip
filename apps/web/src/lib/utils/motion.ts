function prefersReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)');
}

export function gsapReveal(node: HTMLElement) {
	if (typeof window === 'undefined') return;

	const preference = prefersReducedMotion();
	let active = true;
	let tween: { kill: () => void } | undefined;

	if (!preference.matches) {
		void import('gsap').then(({ gsap }) => {
			if (!active || preference.matches) return;
			tween = gsap.fromTo(
				node,
				{ autoAlpha: 0, y: 10 },
				{ autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' }
			);
		});
	}

	const onPreferenceChange = () => {
		if (preference.matches) {
			tween?.kill();
			node.style.removeProperty('opacity');
			node.style.removeProperty('visibility');
			node.style.removeProperty('transform');
		}
	};
	preference.addEventListener('change', onPreferenceChange);

	return {
		destroy() {
			active = false;
			tween?.kill();
			preference.removeEventListener('change', onPreferenceChange);
		}
	};
}
