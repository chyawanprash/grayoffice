/**
 * Minimal shim — this project does not use the View Transitions API, so the
 * "is a route transition in progress" signal the ai-lights / ripple-grid cards
 * expect is always false. Returns an unsubscribe.
 */
export function onTransitionChange(_cb: (active: boolean) => void): () => void {
	return () => {};
}
