// src/lib/modalHistory.ts
// Unified Android hardware/gesture Back button & modal history navigation manager

export interface ModalHistoryEntry {
	id: string;
	close: () => void;
}

const modalStack: ModalHistoryEntry[] = [];
let isPoppingFromBrowser = false;

export function pushModalHistory(id: string, closeFn: () => void) {
	if (typeof window === 'undefined') return;
	const existingIdx = modalStack.findIndex((m) => m.id === id);
	if (existingIdx !== -1) {
		modalStack.splice(existingIdx, 1);
	}
	modalStack.push({ id, close: closeFn });
	try {
		window.history.pushState({ appletModalId: id, stackDepth: modalStack.length }, '');
	} catch (_) {}
}

export function popModalHistory(id: string) {
	if (typeof window === 'undefined') return;
	const idx = modalStack.findIndex((m) => m.id === id);
	if (idx !== -1) {
		modalStack.splice(idx, 1);
		// If closed via UI (close button, backdrop, Escape) and not from browser Back button popstate
		if (!isPoppingFromBrowser && window.history.state && window.history.state.appletModalId) {
			try {
				window.history.back();
			} catch (_) {}
		}
	}
}

// Global popstate listener for Android Back button, swipe gesture, and browser navigation
if (typeof window !== 'undefined') {
	window.addEventListener('popstate', () => {
		if (modalStack.length > 0) {
			isPoppingFromBrowser = true;
			try {
				const topModal = modalStack.pop();
				if (topModal && typeof topModal.close === 'function') {
					topModal.close();
				}
			} finally {
				setTimeout(() => {
					isPoppingFromBrowser = false;
				}, 50);
			}
		}
	});

	(window as any).__pushModalHistory = pushModalHistory;
	(window as any).__popModalHistory = popModalHistory;
}
