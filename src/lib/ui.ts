// src/lib/ui.ts
// Shared UI helpers for accessible accordions, modal focus trapping, and safe HTML escaping.

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openerStack: Array<{ modal: HTMLElement; opener: HTMLElement | null }> = [];
const hiddenClassModals = new WeakSet<HTMLElement>();
let focusTrapBound = false;

export function escapeHtml(value: unknown): string {
	const str = value == null ? '' : String(value);
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function isSectionOpen(el: Element | null): boolean {
	if (!el) return false;
	if (el instanceof HTMLDetailsElement) return el.open;
	return el.getAttribute('data-open') === 'true';
}

export function setSectionOpen(el: Element | null, open: boolean): void {
	if (!el) return;
	if (el instanceof HTMLDetailsElement) {
		el.open = open;
		return;
	}
	const prev = el.getAttribute('data-open') === 'true';
	el.setAttribute('data-open', open ? 'true' : 'false');
	const toggleBtn = el.querySelector(':scope > .card-header-summary > .card-summary-toggle');
	if (toggleBtn) {
		toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
	}
	const content = el.querySelector(':scope > .section-content') as HTMLElement | null;
	if (content) {
		content.hidden = !open;
	}
	if (prev !== open) {
		el.dispatchEvent(new CustomEvent('section-toggle', { detail: { open } }));
	}
}

export function openSection(el: Element | null): void {
	setSectionOpen(el, true);
}

export function initSectionAccordions(): void {
	document.querySelectorAll('section.card.section-accordion').forEach((section) => {
		if ((section as HTMLElement).dataset.accordionBound === '1') return;
		(section as HTMLElement).dataset.accordionBound = '1';

		const isOpen = section.getAttribute('data-open') === 'true';
		const content = section.querySelector(':scope > .section-content') as HTMLElement | null;
		const toggleBtn = section.querySelector(':scope > .card-header-summary > .card-summary-toggle') as HTMLButtonElement | null;

		if (content) content.hidden = !isOpen;
		if (toggleBtn) {
			toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			toggleBtn.addEventListener('click', () => {
				setSectionOpen(section, !isSectionOpen(section));
			});
		}

		// Allow clicking anywhere on a collapsed card body/header bar (outside interactive controls) to expand
		section.addEventListener('click', (e) => {
			if (isSectionOpen(section)) return;
			const target = e.target as HTMLElement | null;
			if (!target) return;
			if (target.closest('button, a, input, select, label')) return;
			setSectionOpen(section, true);
		});
	});
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.hasAttribute('inert') && el.offsetParent !== null
	);
}

function ensureFocusTrapListener() {
	if (focusTrapBound || typeof document === 'undefined') return;
	focusTrapBound = true;
	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Tab' || openerStack.length === 0) return;
		const top = openerStack[openerStack.length - 1];
		const modal = top.modal;
		if (!modal || modal.classList.contains('hidden') || modal.hasAttribute('inert')) return;

		const focusables = getFocusableElements(modal);
		if (focusables.length === 0) {
			e.preventDefault();
			modal.focus({ preventScroll: true });
			return;
		}
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement as HTMLElement | null;

		if (e.shiftKey) {
			if (!active || active === first || !modal.contains(active)) {
				e.preventDefault();
				last.focus({ preventScroll: true });
			}
		} else {
			if (!active || active === last || !modal.contains(active)) {
				e.preventDefault();
				first.focus({ preventScroll: true });
			}
		}
	});
}

export function openModalFocus(modalEl: HTMLElement | null, initialFocus?: HTMLElement | null): void {
	if (!modalEl) return;
	ensureFocusTrapListener();
	const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const existingIdx = openerStack.findIndex((item) => item.modal === modalEl);
	if (existingIdx !== -1) {
		openerStack.splice(existingIdx, 1);
	}
	openerStack.push({ modal: modalEl, opener: active && !modalEl.contains(active) ? active : null });

	if (modalEl.classList.contains('hidden')) {
		hiddenClassModals.add(modalEl);
		modalEl.classList.remove('hidden');
	}
	modalEl.removeAttribute('inert');
	modalEl.setAttribute('aria-hidden', 'false');
	if (!modalEl.hasAttribute('tabindex')) {
		modalEl.setAttribute('tabindex', '-1');
	}

	requestAnimationFrame(() => {
		const target =
			initialFocus && !initialFocus.hasAttribute('disabled') && initialFocus.offsetParent !== null
				? initialFocus
				: getFocusableElements(modalEl)[0] || modalEl;
		try {
			target.focus({ preventScroll: true });
		} catch (_) {}
	});
}

export function closeModalFocus(modalEl: HTMLElement | null): void {
	if (!modalEl) return;
	if (hiddenClassModals.has(modalEl)) {
		modalEl.classList.add('hidden');
	}
	modalEl.setAttribute('aria-hidden', 'true');
	modalEl.setAttribute('inert', '');

	const idx = openerStack.findIndex((item) => item.modal === modalEl);
	let opener: HTMLElement | null = null;
	if (idx !== -1) {
		opener = openerStack[idx].opener;
		openerStack.splice(idx, 1);
	}
	if (opener && opener.isConnected) {
		requestAnimationFrame(() => {
			try {
				opener?.focus({ preventScroll: true });
			} catch (_) {}
		});
	}
}

if (typeof window !== 'undefined') {
	(window as any).__openSection = openSection;
	(window as any).__isSectionOpen = isSectionOpen;
	(window as any).__openModalFocus = openModalFocus;
	(window as any).__closeModalFocus = closeModalFocus;
	(window as any).__escapeHtml = escapeHtml;
}
