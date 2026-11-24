// src/lib/telemetry.ts
// Real-time client-side hardware, display, media, GPU & Cloudflare edge telemetry inspector

import { escapeHtml, isSectionOpen, openModalFocus, closeModalFocus } from './ui';

declare global {
	interface Window {
		__pushModalHistory?: (id: string, closeFn: () => void) => void;
		__popModalHistory?: (id: string) => void;
	}
}

const COLO_NAMES: Record<string, string> = {
	MIA: 'Miami, FL',
	TPA: 'Tampa, FL',
	MCO: 'Orlando, FL',
	ATL: 'Atlanta, GA',
	IAD: 'Ashburn, VA',
	DCA: 'Washington, DC',
	CLT: 'Charlotte, NC',
	RDU: 'Raleigh, NC',
	ORD: 'Chicago, IL',
	DFW: 'Dallas, TX',
	IAH: 'Houston, TX',
	DEN: 'Denver, CO',
	PHX: 'Phoenix, AZ',
	LAX: 'Los Angeles, CA',
	SFO: 'San Francisco, CA',
	SJC: 'San Jose, CA',
	SEA: 'Seattle, WA',
	PDX: 'Portland, OR',
	EWR: 'Newark, NJ',
	JFK: 'New York, NY',
	BOS: 'Boston, MA',
	YYZ: 'Toronto, ON',
	YVR: 'Vancouver, BC',
	LHR: 'London, UK',
	FRA: 'Frankfurt, DE',
	AMS: 'Amsterdam, NL',
	CDG: 'Paris, FR',
	MAD: 'Madrid, ES',
	NRT: 'Tokyo, JP',
	HND: 'Tokyo, JP',
	KIX: 'Osaka, JP',
	ICN: 'Seoul, KR',
	HKG: 'Hong Kong',
	SIN: 'Singapore',
	SYD: 'Sydney, AU',
	MEL: 'Melbourne, AU',
	GRU: 'São Paulo, BR',
};

const STANDARD_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
const STANDARD_RATES = [60, 75, 90, 100, 120, 144, 165, 180, 200, 240, 280, 360, 480, 500, 540];

function formatByteSize(bytes: number | undefined): string {
	if (!bytes || !Number.isFinite(bytes)) return '--';
	const gib = 1024 * 1024 * 1024;
	const mib = 1024 * 1024;
	if (bytes >= gib) {
		return `${(bytes / gib).toFixed(1)} GB`;
	}
	return `${Math.round(bytes / mib)} MB`;
}

async function fetchTextWithTimeout(url: string, timeoutMs = 3000): Promise<string> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.text();
	} finally {
		window.clearTimeout(timer);
	}
}

export function detectGPU(): string {
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (!gl || !(gl instanceof WebGLRenderingContext)) {
			return 'Hardware Accelerated (WebGL unavailable)';
		}
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		if (!debugInfo) {
			return 'Hardware Accelerated GPU';
		}
		const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
		if (!renderer) return 'Hardware Accelerated GPU';

		const angleMatch = String(renderer).match(/ANGLE \([^,]+,\s*([^,]+)/);
		const raw = angleMatch && angleMatch[1] ? angleMatch[1] : String(renderer);
		let cleaned = raw
			.replace(/^ANGLE Metal Renderer:\s*/i, '')
			.replace(/\sDirect3D.*$/, '')
			.replace(/\s*\((?:0x)?[0-9a-fA-F]{4,8}\)/g, '')
			.replace(/\s*\((?:TM|tm|R|r)\)/gi, '')
			.replace(/[™®]/g, '')
			.replace(/(?<!^Apple)\s+GPU$/i, '')
			.replace(/,?\s*or similar\b[\s.]*/gi, '')
			.replace(/^Mesa (?:DRI )?/i, '')
			.replace(/\s+/g, ' ')
			.trim();

		if (/^Adreno\b/i.test(cleaned)) {
			cleaned = 'Qualcomm ' + cleaned;
		}
		return cleaned || 'Hardware Accelerated GPU';
	} catch {
		return 'Generic Graphics Accelerator';
	}
}

function buildOSDisplay(osName: string, version: string, arch: string): string {
	const main = version ? `${osName} ${version}` : osName;
	return arch ? `${main} (${arch})` : main;
}

function detectOS(gpu: string): { display: string; tooltip: string } {
	const ua = navigator.userAgent;
	const navData = (navigator as any).userAgentData;
	const platform = navData?.platform || navigator.platform || '';
	const isMobileARM = /(Adreno|Mali|Immortalis|Xclipse|PowerVR)/i.test(gpu);
	const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || 'ontouchstart' in window;

	// 1. Android
	if (/Android (\d+(\.\d+)?)/i.test(ua)) {
		const match = ua.match(/Android (\d+(\.\d+)?)/i);
		const ver = match ? match[1] : '';
		const isTablet = hasTouch && !/Mobile/i.test(ua);
		const modelMatch = ua.match(/\((?:Linux; Android[^;]+;\s*)([a-zA-Z0-9\-_ ]+)\s+Build/i);
		const model = modelMatch ? modelMatch[1].trim() : isTablet ? 'Tablet' : '';
		return {
			display: buildOSDisplay('Android', ver, 'ARM64'),
			tooltip: model
				? `Device model: ${model} (via User-Agent)`
				: isTablet
					? 'Form factor: Android Tablet'
					: 'Form factor: Android Phone',
		};
	}

	// Android Tablet in Desktop Site mode
	if ((/Linux/i.test(ua) || /Linux/i.test(platform)) && (isMobileARM || (hasTouch && !/Macintosh|Windows/i.test(ua)))) {
		return {
			display: buildOSDisplay('Android', '', 'ARM64'),
			tooltip: 'Form factor: Android Tablet',
		};
	}

	// 2. iOS / iPadOS
	if (/iPhone OS (\d+[._]\d+)/.test(ua)) {
		const match = ua.match(/iPhone OS (\d+[._]\d+)/);
		const ver = match ? match[1].replace('_', '.') : '';
		return {
			display: buildOSDisplay('iOS', ver, 'ARM64'),
			tooltip: 'Apple iPhone (iOS WebKit environment)',
		};
	}
	if (/iPad/.test(ua) || (ua.includes('Macintosh') && hasTouch)) {
		return {
			display: buildOSDisplay('iPadOS', '', 'ARM64'),
			tooltip: 'Apple iPad (iPadOS WebKit environment)',
		};
	}

	// 3. macOS
	if (/Macintosh; Intel Mac OS X (\d+[._]\d+)/.test(ua) || /Macintosh/i.test(ua) || platform === 'MacIntel') {
		const match = ua.match(/Macintosh; Intel Mac OS X (\d+[._]\d+)/);
		let ver = match ? match[1].replace(/_/g, '.') : '';
		const isAppleSilicon = /Apple/i.test(gpu);
		if (isAppleSilicon || ver === '10.15') {
			ver = '';
		}
		return {
			display: buildOSDisplay('macOS', ver, isAppleSilicon ? 'ARM64' : 'x86_64'),
			tooltip: isAppleSilicon
				? 'Apple Silicon architecture detected via WebGL Metal GPU renderer.'
				: 'Intel x86_64 Mac architecture.',
		};
	}

	// 4. Windows
	if (/Windows NT 10\.0/.test(ua) || platform === 'Windows') {
		const isLaptop = /Laptop|Mobile/i.test(gpu);
		return {
			display: buildOSDisplay('Windows', '10 / 11', 'x86_64'),
			tooltip: isLaptop
				? 'Laptop chassis inferred from mobile GPU. Detected via User-Agent.'
				: 'Desktop PC architecture detected via User-Agent.',
		};
	}

	// 5. ChromeOS
	if (/CrOS/i.test(ua)) {
		const isArm = /arm|aarch64/i.test(ua);
		return {
			display: buildOSDisplay('ChromeOS', '', isArm ? 'ARM64' : 'x86_64'),
			tooltip: 'Chromebook (ChromeOS Linux kernel).',
		};
	}

	// 6. Desktop GNU/Linux (x86_64 or ARM64 workstation)
	if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
		const isArmLinux = /aarch64|arm64|armv8/i.test(ua) || /aarch64|arm64|armv8/i.test(platform);
		return {
			display: buildOSDisplay('GNU/Linux', '', isArmLinux ? 'ARM64' : 'x86_64'),
			tooltip: isArmLinux
				? 'ARM64 Linux workstation detected via User-Agent.'
				: 'Linux workstation detected via User-Agent.',
		};
	}

	return {
		display: platform || 'Unknown OS',
		tooltip: 'Platform detected via navigator.platform / navigator.userAgent.',
	};
}

let telemetryModuleBound = false;
let heavyProbesStarter: (() => void) | null = null;

export function triggerHeavyTelemetryProbes(): void {
	heavyProbesStarter?.();
}

export function initTelemetry(): void {
	const debugSection = document.getElementById('debug');
	if (!debugSection || debugSection.dataset.bound === '1') return;
	debugSection.dataset.bound = '1';

	const ipv4El = document.getElementById('t-ipv4');
	const ipv6El = document.getElementById('t-ipv6');
	const legacyIpEl = document.getElementById('t-ip');
	const locEl = document.getElementById('t-location');
	const edgeEl = document.getElementById('t-edge');
	const ispEl = document.getElementById('t-isp');
	const openMapBtn = document.getElementById('open-map-btn') as HTMLButtonElement | null;

	const osEl = document.getElementById('t-os');
	const cpuEl = document.getElementById('t-cpu');
	const ramEl = document.getElementById('t-ram');
	const gpuEl = document.getElementById('t-gpu');
	const openWebgpuBtn = document.getElementById('open-webgpu-btn') as HTMLButtonElement | null;

	const displayEl = document.getElementById('t-display');
	const refreshEl = document.getElementById('t-refresh');
	const orientEl = document.getElementById('t-orientation');
	const touchEl = document.getElementById('t-touch');

	const audioEl = document.getElementById('t-audio');
	const codecsEl = document.getElementById('t-codecs');
	const encoderEl = document.getElementById('t-encoder');
	const drmEl = document.getElementById('t-drm');

	// --- Dual-stack IP rendering ---
	let currentIpv4 = '';
	let currentIpv6 = '';

	function renderIpDisplay() {
		if (ipv4El) ipv4El.textContent = currentIpv4 || 'Detecting...';
		if (ipv6El) {
			if (currentIpv6 === 'none') {
				ipv6El.innerHTML = '<span class="ip-disabled">No IPv6 detected</span>';
			} else if (!currentIpv6) {
				ipv6El.textContent = 'Detecting...';
			} else {
				ipv6El.textContent = currentIpv6;
			}
		}
		if (legacyIpEl) {
			legacyIpEl.textContent = currentIpv4 || (currentIpv6 !== 'none' ? currentIpv6 : '') || 'Detected at edge';
		}
	}

	// --- OpenStreetMap Applet ---
	let currentMapTheme: 'dark' | 'light' = 'dark';
	let userOverrodeMapTheme = false;
	let isMapIframeLoaded = false;

	function setMapTheme(theme: 'dark' | 'light', isUserAction = false) {
		currentMapTheme = theme;
		if (isUserAction) userOverrodeMapTheme = true;

		const dialog = document.getElementById('map-applet-dialog');
		const darkBtn = document.getElementById('map-theme-dark-btn');
		const lightBtn = document.getElementById('map-theme-light-btn');
		if (dialog) dialog.setAttribute('data-map-theme', theme);
		if (darkBtn && lightBtn) {
			darkBtn.classList.toggle('active', theme === 'dark');
			darkBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
			lightBtn.classList.toggle('active', theme === 'light');
			lightBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
		}
	}

	document.getElementById('map-theme-dark-btn')?.addEventListener('click', () => setMapTheme('dark', true));
	document.getElementById('map-theme-light-btn')?.addEventListener('click', () => setMapTheme('light', true));

	const mapThemeObserver = new MutationObserver(() => {
		if (!userOverrodeMapTheme) {
			const isSiteDark = document.documentElement.getAttribute('data-theme') === 'dark';
			setMapTheme(isSiteDark ? 'dark' : 'light', false);
		}
	});
	mapThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	function computeMapEmbedUrl(lat: number, lon: number): { embedUrl: string; fullUrl: string } {
		const delta = 0.045;
		const minLon = (lon - delta).toFixed(5);
		const minLat = (lat - delta).toFixed(5);
		const maxLon = (lon + delta).toFixed(5);
		const maxLat = (lat + delta).toFixed(5);
		const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
		const fullUrl = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=13/${lat.toFixed(5)}/${lon.toFixed(5)}`;
		return { embedUrl, fullUrl };
	}

	function prewarmMapDns() {
		if (document.querySelector('link[rel="dns-prefetch"][href*="openstreetmap.org"]')) return;
		['https://www.openstreetmap.org', 'https://tile.openstreetmap.org'].forEach((href) => {
			const link = document.createElement('link');
			link.rel = 'dns-prefetch';
			link.href = href;
			document.head.appendChild(link);
		});
	}

	function openMapApplet(lat: number, lon: number, locName: string) {
		const modal = document.getElementById('map-applet-modal');
		const iframe = document.getElementById('map-applet-iframe') as HTMLIFrameElement | null;
		const loader = document.getElementById('map-applet-loader');
		const coordsEl = document.getElementById('map-coords-badge');
		const footerLocEl = document.getElementById('map-footer-loc');
		const extLink = document.getElementById('map-external-link') as HTMLAnchorElement | null;
		const closeBtn = document.getElementById('map-applet-close-btn') as HTMLElement | null;
		if (!modal || !iframe) return;

		if (!userOverrodeMapTheme) {
			const isSiteDark = document.documentElement.getAttribute('data-theme') === 'dark';
			setMapTheme(isSiteDark ? 'dark' : 'light', false);
		} else {
			setMapTheme(currentMapTheme, false);
		}

		const latDir = lat >= 0 ? 'N' : 'S';
		const lonDir = lon >= 0 ? 'E' : 'W';
		if (coordsEl) {
			coordsEl.textContent = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
		}
		if (footerLocEl) footerLocEl.textContent = locName;

		const { embedUrl, fullUrl } = computeMapEmbedUrl(lat, lon);
		if (extLink) extLink.href = fullUrl;

		if (iframe.src !== embedUrl) {
			if (loader) loader.style.display = 'flex';
			isMapIframeLoaded = false;
			iframe.onload = () => {
				isMapIframeLoaded = true;
				if (loader) loader.style.display = 'none';
			};
			window.setTimeout(() => {
				if (!isMapIframeLoaded && loader) loader.style.display = 'none';
			}, 5000);
			iframe.src = embedUrl;
		} else if (loader) {
			loader.style.display = isMapIframeLoaded ? 'none' : 'flex';
		}

		openModalFocus(modal, closeBtn);
		document.body.style.overflow = 'hidden';
		window.__pushModalHistory?.('map-modal', closeMapApplet);
	}

	function closeMapApplet() {
		const modal = document.getElementById('map-applet-modal');
		if (!modal || modal.classList.contains('hidden')) return;
		closeModalFocus(modal);
		document.body.style.overflow = '';
		window.__popModalHistory?.('map-modal');
	}

	document.getElementById('map-applet-close-btn')?.addEventListener('click', closeMapApplet);
	document.getElementById('map-applet-backdrop')?.addEventListener('click', closeMapApplet);

	// --- 1. GPU & WebGPU Inspector ---
	const gpuString = detectGPU();
	const isFirefox = /Firefox/i.test(navigator.userAgent);
	const isFirefoxSpoofed = isFirefox && /GTX 980/i.test(gpuString);

	if (gpuEl) {
		gpuEl.textContent = gpuString;
		gpuEl.title = isFirefoxSpoofed
			? 'Unmasked GPU: NVIDIA GeForce GTX 980. Note: Firefox Resist Fingerprinting (RFP) masks modern discrete GPUs as a GTX 980 to protect user privacy.'
			: 'Unmasked GPU renderer queried via WebGL WEBGL_debug_renderer_info extension.';
	}

	const webgpuModal = document.getElementById('webgpu-applet-modal');
	const webgpuCloseBtn = document.getElementById('webgpu-applet-close-btn') as HTMLElement | null;
	const webgpuBadge = document.getElementById('webgpu-backend-badge');
	const webgpuSpecsGrid = document.getElementById('webgpu-specs-grid');
	const webgpuFooterVendor = document.getElementById('webgpu-footer-vendor');

	function closeWebgpuModal() {
		if (!webgpuModal || webgpuModal.classList.contains('hidden')) return;
		closeModalFocus(webgpuModal);
		document.body.style.overflow = '';
		window.__popModalHistory?.('webgpu-modal');
	}

	webgpuCloseBtn?.addEventListener('click', closeWebgpuModal);
	document.getElementById('webgpu-applet-backdrop')?.addEventListener('click', closeWebgpuModal);

	interface WebgpuInfoCache {
		vendor: string;
		arch: string;
		description: string;
		backend: string;
		maxWorkgroupInvocations: number;
		maxWorkgroupX: number;
		maxWorkgroupY: number;
		maxWorkgroupZ: number;
		maxBufferSize: string;
		maxStorageBuffer: string;
		maxTexture2D: string;
		features: {
			hasF16: boolean;
			hasBC: boolean;
			hasASTC: boolean;
			hasETC2: boolean;
			hasTimestamp: boolean;
		};
	}

	let webgpuInfoCache: WebgpuInfoCache | null = null;

	function renderWebgpuSpecs() {
		if (webgpuInfoCache) {
			if (webgpuBadge) webgpuBadge.textContent = `${webgpuInfoCache.backend} ▪ WebGPU`;
			if (webgpuFooterVendor) {
				webgpuFooterVendor.textContent = isFirefoxSpoofed
					? `${webgpuInfoCache.description} (Firefox Anti-Fingerprint Profile)`
					: webgpuInfoCache.description;
			}
			if (webgpuSpecsGrid) {
				webgpuSpecsGrid.innerHTML = `
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Backend Pipeline</div>
						<div class="webgpu-tile-val">${escapeHtml(webgpuInfoCache.backend)} <span class="webgpu-tile-sub">(Native WebGPU)</span></div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Compute Architecture</div>
						<div class="webgpu-tile-val">${escapeHtml(webgpuInfoCache.arch)}</div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Max Workgroup Invocations</div>
						<div class="webgpu-tile-val mono">${webgpuInfoCache.maxWorkgroupInvocations} <span class="webgpu-tile-sub">threads</span></div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Max Workgroup Size</div>
						<div class="webgpu-tile-val mono">${webgpuInfoCache.maxWorkgroupX} &times; ${webgpuInfoCache.maxWorkgroupY} &times; ${webgpuInfoCache.maxWorkgroupZ}</div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Max Buffer Size</div>
						<div class="webgpu-tile-val mono">${escapeHtml(webgpuInfoCache.maxBufferSize)}</div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Max Storage Buffer</div>
						<div class="webgpu-tile-val mono">${escapeHtml(webgpuInfoCache.maxStorageBuffer)}</div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">Max 2D Texture Dimension</div>
						<div class="webgpu-tile-val mono">${escapeHtml(webgpuInfoCache.maxTexture2D)}</div>
					</div>
					<div class="webgpu-tile">
						<div class="webgpu-tile-label">FP16 Math &amp; Timestamps</div>
						<div class="webgpu-tile-val">${webgpuInfoCache.features.hasF16 ? 'FP16' : 'FP32'} <span class="webgpu-tile-sub">▪ Timestamp: ${webgpuInfoCache.features.hasTimestamp ? 'Yes' : 'No'}</span></div>
					</div>
					<div class="webgpu-tile" style="grid-column: 1 / -1;">
						<div class="webgpu-tile-label">Texture Compression</div>
						<div class="webgpu-tile-val">${webgpuInfoCache.features.hasBC ? 'BC <span class="webgpu-tile-sub">(DirectX)</span>' : webgpuInfoCache.features.hasASTC ? 'ASTC' : webgpuInfoCache.features.hasETC2 ? 'ETC2' : 'Standard'}</div>
					</div>
				`;
			}
		} else {
			if (webgpuBadge) webgpuBadge.textContent = 'WebGPU ▪ Fallback Status';
			if (webgpuFooterVendor) {
				webgpuFooterVendor.textContent = `${gpuString} (WebGPU Disabled / Unsupported)`;
			}
			if (webgpuSpecsGrid) {
				webgpuSpecsGrid.innerHTML = `
					<div class="webgpu-tile" style="grid-column: 1 / -1; padding: 1.25rem;">
						<div class="webgpu-tile-label" style="color: #f97316; font-size: 0.9em; display: flex; align-items: center; gap: 0.5rem;">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
							Native WebGPU API Unavailable
						</div>
						<div style="font-size: 0.88em; line-height: 1.6; color: rgb(var(--gray-dark)); margin-top: 0.5rem;">
							The modern <code>navigator.gpu</code> interface is unavailable or returned no compatible hardware adapter in this browser.
						</div>
						<div style="margin-top: 0.75rem; font-size: 0.84em; line-height: 1.55; color: rgb(var(--gray-dark));">
							<div>▪ <strong>Supported Browsers:</strong> Chrome 113+, Edge 113+, Safari 18+ (macOS/iOS), and Firefox Nightly (via <code>dom.webgpu.enabled</code>).</div>
							<div>▪ <strong>Active Renderer:</strong> ${escapeHtml(gpuString)}</div>
							<div>▪ <strong>Site Architecture:</strong> Gracefully falling back to 2D Canvas and WebGL pipelines with zero disruption.</div>
						</div>
					</div>
				`;
			}
		}
	}

	function openWebgpuInspector() {
		renderWebgpuSpecs();
		if (webgpuModal) {
			openModalFocus(webgpuModal, webgpuCloseBtn);
		}
		document.body.style.overflow = 'hidden';
		window.__pushModalHistory?.('webgpu-modal', closeWebgpuModal);
	}

	if (openWebgpuBtn) {
		openWebgpuBtn.classList.remove('hidden');
		openWebgpuBtn.disabled = false;
		openWebgpuBtn.classList.add('interactive');
		openWebgpuBtn.title = 'Click to inspect WebGPU compute limits & hardware architecture';
		openWebgpuBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			runHeavyTelemetryProbes();
			openWebgpuInspector();
		});
	}

	const itemGpu = document.getElementById('item-gpu');
	if (itemGpu) {
		itemGpu.classList.add('telemetry-item-clickable');
		itemGpu.title = 'Click to inspect WebGPU compute limits & hardware architecture';
		itemGpu.addEventListener('click', (e) => {
			if ((e.target as HTMLElement)?.closest('button')) return;
			runHeavyTelemetryProbes();
			openWebgpuInspector();
		});
	}

	async function probeWebGPU() {
		const navGpu = (navigator as any).gpu;
		if (!navGpu) return;
		try {
			const adapter = await navGpu.requestAdapter();
			if (!adapter) return;

			let info: any = adapter.info || {};
			if (typeof adapter.requestAdapterInfo === 'function') {
				try {
					const req = await adapter.requestAdapterInfo();
					if (req) info = req;
				} catch {}
			}

			const limits = adapter.limits;
			const features = adapter.features;
			const hasF16 = features.has('shader-f16');
			const hasBC = features.has('texture-compression-bc');
			const hasASTC = features.has('texture-compression-astc');
			const hasETC2 = features.has('texture-compression-etc2');
			const hasTimestamp = features.has('timestamp-query');

			const ua = navigator.userAgent;
			const isAppleOS =
				/Macintosh|Mac OS|iPhone|iPad|iPod/i.test(ua) ||
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
			const isWin = /Windows/i.test(ua);
			const backendName = isAppleOS ? 'Metal' : isWin ? 'Direct3D 12' : 'Vulkan';
			const displayVendor = info.description || info.device || gpuString;

			webgpuInfoCache = {
				vendor: info.vendor || gpuString.split(' ')[0] || 'Hardware Vendor',
				arch: info.architecture || 'Compute ASIC',
				description: displayVendor,
				backend: backendName,
				maxWorkgroupInvocations: limits.maxComputeWorkgroupInvocations || 1024,
				maxWorkgroupX: limits.maxComputeWorkgroupSizeX || 1024,
				maxWorkgroupY: limits.maxComputeWorkgroupSizeY || 1024,
				maxWorkgroupZ: limits.maxComputeWorkgroupSizeZ || 64,
				maxBufferSize: limits.maxBufferSize ? formatByteSize(limits.maxBufferSize) : '2.0 GB',
				maxStorageBuffer: limits.maxStorageBufferBindingSize
					? formatByteSize(limits.maxStorageBufferBindingSize)
					: '128 MB',
				maxTexture2D: limits.maxTextureDimension2D
					? `${limits.maxTextureDimension2D} × ${limits.maxTextureDimension2D}`
					: '16384 × 16384',
				features: { hasF16, hasBC, hasASTC, hasETC2, hasTimestamp },
			};

			if (gpuEl) {
				gpuEl.textContent = gpuString;
				gpuEl.title = isFirefoxSpoofed
					? `Hardware GPU: ${gpuString} (Firefox Fingerprint Protection: modern GPUs are spoofed as a GTX 980). WebGPU backend: ${backendName}. Click to inspect compute limits.`
					: `Hardware GPU: ${gpuString}. WebGPU backend: ${backendName}. Click to inspect compute limits.`;
			}
			// If user already opened WebGPU modal before adapter promise resolved, refresh live content
			if (webgpuModal && !webgpuModal.classList.contains('hidden')) {
				renderWebgpuSpecs();
			}
		} catch {}
	}

	// --- 2. OS Detection ---
	if (osEl) {
		const initialOS = detectOS(gpuString);
		osEl.textContent = initialOS.display;
		osEl.title = initialOS.tooltip;

		const navData = (navigator as any).userAgentData;
		const isMobileARM = /(Adreno|Mali|Immortalis|Xclipse|PowerVR)/i.test(gpuString);
		const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || 'ontouchstart' in window;
		const ua = navigator.userAgent;

		if (navData && navData.getHighEntropyValues) {
			navData
				.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'model'])
				.then((hints: any) => {
					if (hints.platform === 'Windows') {
						const major = parseInt(hints.platformVersion?.split('.')[0] || '0', 10);
						const winVer = major >= 13 ? '11' : major >= 1 ? '10' : '';
						const arch = hints.architecture === 'arm' || hints.architecture === 'arm64' ? 'ARM64' : 'x86_64';
						const isLaptop = /Laptop|Mobile/i.test(gpuString);
						osEl.textContent = buildOSDisplay('Windows', winVer, arch);
						osEl.title = isLaptop
							? 'Laptop chassis inferred from mobile GPU. Detected via User-Agent Client Hints.'
							: 'Desktop PC architecture detected via User-Agent Client Hints.';
					} else if (
						hints.platform === 'Android' ||
						/Android/i.test(ua) ||
						(/Linux/i.test(hints.platform || '') && (isMobileARM || hasTouch))
					) {
						let ver = hints.platformVersion ? hints.platformVersion.split('.')[0] : '';
						if (!ver) {
							const match = ua.match(/Android (\d+(\.\d+)?)/i);
							if (match) ver = match[1];
						}
						const isTablet = (hasTouch && !/Mobile/i.test(ua)) || /Tablet/i.test(ua);
						const model = hints.model || '';
						osEl.textContent = buildOSDisplay('Android', ver, 'ARM64');
						osEl.title = model
							? model.startsWith('SM-')
								? `Samsung Device: ${model} (via User-Agent Client Hints)`
								: `Device model: ${model} (via User-Agent Client Hints)`
							: isTablet
								? 'Form factor: Android Tablet'
								: 'Form factor: Android Phone';
					} else if (hints.platform === 'Linux') {
						const isArmLinux = /arm|aarch64/i.test(hints.architecture || '');
						const arch = isArmLinux
							? 'ARM64'
							: hints.architecture?.includes('64') || hints.bitness === '64'
								? 'x86_64'
								: hints.architecture || 'x86_64';
						osEl.textContent = buildOSDisplay('GNU/Linux', '', arch);
						osEl.title = `${isArmLinux ? 'ARM64' : 'x86_64'} Linux workstation environment detected via User-Agent Client Hints.`;
					} else if (hints.platform === 'macOS') {
						const isAppleSilicon = /Apple/i.test(gpuString) || hints.architecture === 'arm';
						osEl.textContent = buildOSDisplay('macOS', '', isAppleSilicon ? 'ARM64' : 'x86_64');
						osEl.title = isAppleSilicon
							? 'Apple Silicon architecture detected via WebGL Metal GPU renderer.'
							: 'Intel x86_64 Mac detected via User-Agent Client Hints.';
					}
				})
				.catch(() => {});
		}
	}

	// --- 3. CPU & 4. RAM ---
	if (cpuEl) {
		const cores = navigator.hardwareConcurrency;
		cpuEl.textContent = cores ? `${cores} Logical CPU Cores` : 'Multi-core Processor';
		cpuEl.title = 'Logical execution threads reported by navigator.hardwareConcurrency.';
	}

	if (ramEl) {
		const mem = (navigator as any).deviceMemory;
		if (mem) {
			ramEl.textContent = `${mem} GB RAM`;
			ramEl.title = 'Reported by navigator.deviceMemory (Chromium caps at 8 GB to mitigate browser fingerprinting).';
		} else {
			ramEl.textContent = '64-bit Architecture';
			ramEl.title = 'navigator.deviceMemory not supported by browser (omitted for privacy).';
		}
	}

	// --- 5. Display & Scaling ---
	let lastScreenWidth = window.screen.width;
	let lastScreenHeight = window.screen.height;
	let lastDPR = window.devicePixelRatio;
	let retestRefresh: () => void = () => {};

	const updateDisplayMetrics = () => {
		if (!displayEl) return;
		let dprVal: number | null = null;
		if (window.devicePixelRatio) {
			const raw = window.devicePixelRatio;
			const snapped = STANDARD_SCALES.find((s) => Math.abs(raw - s) <= 0.025);
			dprVal = snapped ?? Number(raw.toFixed(2));
		}
		const dpr = dprVal ? ` @ ${dprVal}x scaling` : '';
		const depth = window.screen.colorDepth ? ` (${window.screen.colorDepth}-bit color)` : '';
		displayEl.textContent = `${window.screen.width} × ${window.screen.height}${dpr}${depth}`;
		displayEl.title = 'Logical CSS viewport dimensions (window.screen), devicePixelRatio scaling, and display colorDepth.';

		if (
			window.screen.width !== lastScreenWidth ||
			window.screen.height !== lastScreenHeight ||
			window.devicePixelRatio !== lastDPR
		) {
			lastScreenWidth = window.screen.width;
			lastScreenHeight = window.screen.height;
			lastDPR = window.devicePixelRatio;
			retestRefresh();
		}
	};

	// --- 6. Panel Refresh & Gamut ---
	function getGamutAndHDR() {
		const isP3 = window.matchMedia('(color-gamut: p3)').matches;
		const isRec2020 = window.matchMedia('(color-gamut: rec2020)').matches;
		const isHDR = window.matchMedia('(dynamic-range: high)').matches;
		const isVideoHDR = window.matchMedia('(video-dynamic-range: high)').matches;
		const gamut = isRec2020 ? 'Rec.2020' : isP3 ? 'Display P3' : 'sRGB';
		const hdrTag = isHDR || isVideoHDR ? 'HDR' : 'SDR';
		return { gamut, hdrTag };
	}

	let isDebugIntersecting = false;
	if ('IntersectionObserver' in window) {
		const visObs = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					isDebugIntersecting = entry.isIntersecting;
				}
			},
			{ rootMargin: '200px' }
		);
		visObs.observe(debugSection);
	} else {
		isDebugIntersecting = true;
	}

	if (refreshEl) {
		let baselineHz = 0;
		let peakHz = 0;
		let isAdaptiveVRR = false;
		let isProbing = false;

		function updateDisplay() {
			if (!refreshEl) return;
			const displayHz = peakHz || baselineHz || 60;
			const vrrTag = isAdaptiveVRR ? ' (Adaptive VRR)' : '';
			const { gamut, hdrTag } = getGamutAndHDR();
			refreshEl.textContent = `${displayHz} Hz${vrrTag} ▪ ${gamut} ▪ ${hdrTag}`;
		}

		function processDeltas(deltas: number[]) {
			const valid = deltas.filter((d) => d >= 1.6 && d <= 45);
			if (valid.length < 4) return;

			const bucketCounts: Record<number, number> = {};
			for (const std of STANDARD_RATES) bucketCounts[std] = 0;

			for (const d of valid) {
				const instHz = 1000 / d;
				for (const std of STANDARD_RATES) {
					const nominal = 1000 / std;
					const tol = nominal * 0.12;
					if (Math.abs(d - nominal) <= tol || Math.abs(instHz - std) <= 5) {
						bucketCounts[std]++;
						break;
					}
				}
			}

			const detectedRates: number[] = [];
			for (const std of STANDARD_RATES) {
				if (bucketCounts[std] >= 3) detectedRates.push(std);
			}

			if (detectedRates.length === 0) {
				const sorted = [...valid].sort((a, b) => a - b);
				const median = sorted[Math.floor(sorted.length / 2)];
				let measured = Math.round(1000 / median);
				for (const std of STANDARD_RATES) {
					if (Math.abs(measured - std) <= 4) {
						measured = std;
						break;
					}
				}
				detectedRates.push(measured);
			}

			const maxRate = Math.max(...detectedRates);
			if (!baselineHz) baselineHz = detectedRates[0] || 60;
			if (maxRate > peakHz) peakHz = maxRate;

			if (
				(detectedRates.length > 1 && detectedRates.some((r) => r > 60) && detectedRates.some((r) => r <= 60)) ||
				(peakHz > baselineHz && baselineHz <= 60)
			) {
				isAdaptiveVRR = true;
			}

			updateDisplay();
		}

		function measureRefreshBurst(targetSamples = 40) {
			if (isProbing) return;
			isProbing = true;
			const frameTimes: number[] = [];
			let lastFrame = performance.now();
			let frames = 0;

			let probeCanvas: HTMLCanvasElement | null = null;
			let probeCtx: CanvasRenderingContext2D | null = null;
			try {
				probeCanvas = document.createElement('canvas');
				probeCanvas.width = 2;
				probeCanvas.height = 2;
				probeCanvas.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0.001;pointer-events:none;';
				document.body.appendChild(probeCanvas);
				probeCtx = probeCanvas.getContext('2d');
			} catch {}

			function onFrame(now: number) {
				const delta = now - lastFrame;
				lastFrame = now;
				if (delta >= 1.6 && delta <= 50) frameTimes.push(delta);
				frames++;
				if (probeCtx) {
					probeCtx.fillStyle = frames % 2 === 0 ? '#fff' : '#000';
					probeCtx.fillRect(0, 0, 2, 2);
				}
				if (frames < targetSamples) {
					requestAnimationFrame(onFrame);
				} else {
					isProbing = false;
					try {
						probeCanvas?.remove();
					} catch {}
					const clean = frameTimes.length > 6 ? frameTimes.slice(3) : frameTimes;
					processDeltas(clean);
				}
			}
			requestAnimationFrame(onFrame);
		}

		function probeWorkerRefresh() {
			if (
				typeof Worker === 'undefined' ||
				typeof HTMLCanvasElement === 'undefined' ||
				!HTMLCanvasElement.prototype.transferControlToOffscreen
			) {
				return;
			}
			try {
				const workerCanvas = document.createElement('canvas');
				workerCanvas.width = 2;
				workerCanvas.height = 2;
				workerCanvas.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0.001;pointer-events:none;';
				document.body.appendChild(workerCanvas);
				const offscreen = workerCanvas.transferControlToOffscreen();

				const workerBlob = new Blob(
					[
						`self.onmessage = function(e) {
							const canvas = e.data.canvas;
							const ctx = canvas.getContext('2d');
							let frames = 0;
							let last = performance.now();
							const deltas = [];
							function step(now) {
								const delta = now - last;
								last = now;
								if (delta >= 1.6 && delta <= 50) deltas.push(delta);
								if (ctx) {
									ctx.fillStyle = frames % 2 === 0 ? '#fff' : '#000';
									ctx.fillRect(0, 0, 2, 2);
								}
								if (++frames < 30) requestAnimationFrame(step);
								else self.postMessage(deltas);
							}
							requestAnimationFrame(step);
						};`,
					],
					{ type: 'application/javascript' }
				);

				const workerUrl = URL.createObjectURL(workerBlob);
				const worker = new Worker(workerUrl);

				const cleanup = () => {
					try { worker.terminate(); } catch {}
					try { URL.revokeObjectURL(workerUrl); } catch {}
					try { workerCanvas.remove(); } catch {}
				};

				worker.onmessage = (e) => {
					if (Array.isArray(e.data) && e.data.length >= 8) {
						processDeltas(e.data.slice(2));
					}
					cleanup();
				};
				worker.onerror = cleanup;
				worker.postMessage({ canvas: offscreen }, [offscreen]);
			} catch {}
		}

		let activeSamplingUntil = 0;
		let interactionRafId: number | null = null;
		let lastInteractionTime = performance.now();
		const rollingInteractionDeltas: number[] = [];

		function triggerInteractionBoost(force = false) {
			if (!force && (!isSectionOpen(debugSection) || !isDebugIntersecting || document.visibilityState !== 'visible')) {
				return;
			}
			activeSamplingUntil = performance.now() + 1500;
			if (interactionRafId !== null) return;
			lastInteractionTime = performance.now();

			function interactionLoop(now: number) {
				if (!isSectionOpen(debugSection) || document.visibilityState !== 'visible') {
					interactionRafId = null;
					return;
				}
				const delta = now - lastInteractionTime;
				lastInteractionTime = now;
				if (delta >= 1.6 && delta <= 50) {
					rollingInteractionDeltas.push(delta);
					if (rollingInteractionDeltas.length > 50) rollingInteractionDeltas.shift();
					if (rollingInteractionDeltas.length >= 6 && rollingInteractionDeltas.length % 6 === 0) {
						processDeltas(rollingInteractionDeltas);
					}
				}
				if (performance.now() < activeSamplingUntil) {
					interactionRafId = requestAnimationFrame(interactionLoop);
				} else {
					if (rollingInteractionDeltas.length >= 4) processDeltas(rollingInteractionDeltas);
					interactionRafId = null;
				}
			}
			interactionRafId = requestAnimationFrame(interactionLoop);
		}

		window.addEventListener('touchstart', () => triggerInteractionBoost(false), { passive: true });
		window.addEventListener('touchmove', () => triggerInteractionBoost(false), { passive: true });

		retestRefresh = () => {
			measureRefreshBurst(45);
			probeWorkerRefresh();
			triggerInteractionBoost(true);
		};

		measureRefreshBurst(40);
		probeWorkerRefresh();

		document.addEventListener('fullscreenchange', () => retestRefresh());

		const refreshTip =
			'Refresh rate measured via requestAnimationFrame VSYNC timing; gamut & HDR evaluated via CSS media queries. Note: Safari limits WebKit rAF to 60 Hz on ProMotion displays unless "Prefer Page Rendering Updates near 60fps" is disabled. Click to re-probe.';
		refreshEl.style.cursor = 'pointer';
		refreshEl.classList.add('loc-clickable');
		refreshEl.title = refreshTip;

		const itemRefresh = document.getElementById('item-refresh');
		if (itemRefresh) {
			itemRefresh.classList.add('telemetry-item-clickable');
			itemRefresh.setAttribute('role', 'button');
			itemRefresh.setAttribute('tabindex', '0');
			itemRefresh.title = refreshTip;
			itemRefresh.addEventListener('click', () => retestRefresh());
			itemRefresh.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					retestRefresh();
				}
			});
		}
	}

	updateDisplayMetrics();

	let dprMediaQuery: MediaQueryList | null = null;
	const onDprChange = () => {
		updateDisplayMetrics();
		watchDprChange();
	};
	const watchDprChange = () => {
		if (dprMediaQuery) {
			try { dprMediaQuery.removeEventListener('change', onDprChange); } catch {}
		}
		if (typeof window.matchMedia === 'function') {
			dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			dprMediaQuery?.addEventListener?.('change', onDprChange, { once: true });
		}
	};
	watchDprChange();

	// --- 7. Screen Orientation ---
	const updateOrient = () => {
		if (!orientEl) return;
		if (screen.orientation) {
			const angle = screen.orientation.angle || 0;
			const rawType = screen.orientation.type || '';
			const isPortraitCurrent = rawType.startsWith('portrait') || window.innerHeight > window.innerWidth;
			const currentMode = isPortraitCurrent ? 'Portrait' : 'Landscape';
			let label = '';
			if (angle === 0) label = `${currentMode} (0° Native)`;
			else if (angle === 180) label = `Inverted ${currentMode} (180°)`;
			else label = `${currentMode} (${angle}° Rotated)`;
			orientEl.textContent = label;
			orientEl.title = 'Reported by Screen Orientation API (screen.orientation.type & angle).';
		} else {
			const mode = window.innerWidth >= window.innerHeight ? 'Landscape' : 'Portrait';
			orientEl.textContent = `${mode} (Viewport)`;
			orientEl.title = 'Orientation inferred from viewport aspect ratio (window.innerWidth vs innerHeight).';
		}
	};
	updateOrient();
	screen.orientation?.addEventListener?.('change', () => {
		updateOrient();
		updateDisplayMetrics();
	});

	let resizeDebounceTimer: number | null = null;
	window.addEventListener(
		'resize',
		() => {
			updateOrient();
			if (resizeDebounceTimer !== null) window.clearTimeout(resizeDebounceTimer);
			resizeDebounceTimer = window.setTimeout(() => {
				resizeDebounceTimer = null;
				updateDisplayMetrics();
			}, 250);
		},
		{ passive: true }
	);

	// --- 8. Touch Digitizer ---
	if (touchEl) {
		const points = navigator.maxTouchPoints || 0;
		if (points > 0) {
			touchEl.textContent = `${points}-Point Multitouch`;
			touchEl.title = 'Maximum simultaneous touch contact points reported by navigator.maxTouchPoints.';
		} else {
			touchEl.textContent = 'Precision Mouse (No Touch)';
			touchEl.title = 'No touch contact points reported (navigator.maxTouchPoints = 0).';
		}
	}

	// --- 9. DAC Pipeline ---
	function probeDAC() {
		if (!audioEl) return;
		try {
			const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
			if (!AudioCtx) {
				audioEl.textContent = 'Hardware Audio Output';
				audioEl.title = 'Web Audio API not supported by browser.';
				return;
			}
			const actx = new AudioCtx();
			const baseLatMs = ((actx.baseLatency || 0.005) * 1000).toFixed(1);
			const rateKhz = (actx.sampleRate / 1000).toFixed(0);
			const ch = actx.destination.maxChannelCount || 2;
			const chLabel = ch === 1 ? '1ch Mono' : ch === 2 ? '2ch Stereo' : `${ch}ch Surround`;
			audioEl.textContent = `${baseLatMs} ms buffer ▪ ${rateKhz} kHz ▪ ${chLabel}`;
			audioEl.title = `Hardware DAC output: ${actx.sampleRate} Hz sample rate, ${chLabel} channel configuration, and ${baseLatMs} ms buffer latency via Web Audio API.`;
			actx.close?.().catch(() => {});
		} catch {
			audioEl.textContent = 'Hardware Audio Output';
			audioEl.title = 'AudioContext blocked until user interaction.';
		}
	}

	// --- 10. Hardware Video Decoder ---
	async function probeCodecs() {
		if (!codecsEl) return;
		const candidates = [
			{
				name: 'AV1',
				wcCodecs: ['av01.0.08M.08', 'av01.0.05M.08', 'av01.0.08M.10'],
				configs: [
					{ type: 'file', video: { contentType: 'video/mp4; codecs="av01.0.08M.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'file', video: { contentType: 'video/webm; codecs="av01.0.08M.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'file', video: { contentType: 'video/mp4; codecs="av01.0.08M.10"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'HEVC',
				wcCodecs: ['hvc1.1.6.L120.B0', 'hvc1.1.6.L93.B0'],
				configs: [
					{ type: 'file', video: { contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'file', video: { contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'media-source', video: { contentType: 'video/mp4; codecs="hvc1.1.6.L120.90"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'media-source', video: { contentType: 'video/mp4; codecs="hev1.1.6.L120.90"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'VP9',
				wcCodecs: ['vp09.00.40.08', 'vp09.00.10.08'],
				configs: [
					{ type: 'file', video: { contentType: 'video/webm; codecs="vp09.00.40.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'file', video: { contentType: 'video/webm; codecs="vp09.00.10.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'file', video: { contentType: 'video/mp4; codecs="vp09.00.40.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'H.264',
				wcCodecs: ['avc1.640028'],
				configs: [
					{ type: 'file', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
		];

		const supported: string[] = [];
		for (const c of candidates) {
			let isHw = false;
			let hasExplicitSwOnly = false;

			if (navigator.mediaCapabilities?.decodingInfo) {
				for (const cfg of c.configs) {
					try {
						const res = await navigator.mediaCapabilities.decodingInfo(cfg as any);
						if (res.supported) {
							if (res.powerEfficient || (c.name === 'HEVC' && isFirefox)) {
								isHw = true;
								hasExplicitSwOnly = false;
								break;
							} else {
								hasExplicitSwOnly = true;
							}
						}
					} catch {}
				}
			}

			if (typeof VideoDecoder !== 'undefined' && typeof VideoDecoder.isConfigSupported === 'function') {
				for (const codec of c.wcCodecs) {
					try {
						const wcRes = await VideoDecoder.isConfigSupported({
							codec,
							codedWidth: 1920,
							codedHeight: 1080,
							hardwareAcceleration: 'prefer-hardware',
						});
						if (wcRes?.supported === false) {
							continue;
						}
						if (wcRes?.supported === true && !hasExplicitSwOnly) {
							if (!wcRes.config?.hardwareAcceleration || wcRes.config.hardwareAcceleration === 'prefer-hardware') {
								isHw = true;
								break;
							}
						}
					} catch {}
				}
			}

			if (!isHw && c.name === 'HEVC' && isFirefox) {
				const hasMseHevc =
					typeof MediaSource !== 'undefined' &&
					(MediaSource.isTypeSupported('video/mp4; codecs="hvc1.1.6.L120.90"') ||
						MediaSource.isTypeSupported('video/mp4; codecs="hev1.1.6.L120.90"') ||
						MediaSource.isTypeSupported('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
						MediaSource.isTypeSupported('video/mp4; codecs="hvc1"'));
				const hasHtml5Hevc = (() => {
					try {
						const v = document.createElement('video');
						return !!(
							v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"') ||
							v.canPlayType('video/mp4; codecs="hev1.1.6.L120.90"') ||
							v.canPlayType('video/mp4; codecs="hvc1"')
						);
					} catch {
						return false;
					}
				})();
				if (hasMseHevc || hasHtml5Hevc) {
					isHw = true;
					hasExplicitSwOnly = false;
				}
			}

			if (isHw && !hasExplicitSwOnly) supported.push(c.name);
		}

		if (supported.length > 0) {
			codecsEl.textContent = supported.join(' ▪ ');
			codecsEl.title = 'Probed via MediaCapabilities (powerEfficient: true) and WebCodecs hardware ASIC decoder profiles.';
		} else {
			codecsEl.textContent = 'Software / CPU Decoding';
			codecsEl.title = 'No hardware ASIC decoders detected; media decoded via software/CPU.';
		}
	}

	// --- 11. Hardware Video Encoder ---
	async function probeEncoder() {
		if (!encoderEl) return;
		const encCandidates = [
			{
				name: 'AV1',
				codecs: ['av01.0.08M.08', 'av01.0.05M.08', 'av01.0.08M.10'],
				mcConfigs: [
					{ type: 'record', video: { contentType: 'video/mp4; codecs="av01.0.08M.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'record', video: { contentType: 'video/webm; codecs="av01.0.08M.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'HEVC',
				codecs: ['hvc1.1.6.L93.B0', 'hev1.1.6.L93.B0', 'hvc1.1.6.L120.B0'],
				mcConfigs: [
					{ type: 'record', video: { contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'record', video: { contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'VP9',
				codecs: ['vp09.00.40.08', 'vp09.00.10.08'],
				mcConfigs: [
					{ type: 'record', video: { contentType: 'video/webm; codecs="vp09.00.40.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'record', video: { contentType: 'video/mp4; codecs="vp09.00.40.08"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
			{
				name: 'H.264',
				codecs: ['avc1.42001f', 'avc1.4d002a', 'avc1.64002a', 'avc1.640028'],
				mcConfigs: [
					{ type: 'record', video: { contentType: 'video/mp4; codecs="avc1.42001f"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
					{ type: 'record', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 5000000, framerate: 60 } },
				],
			},
		];

		const supported: string[] = [];
		for (const c of encCandidates) {
			let isHw = false;
			let hasMcSwOnly = false;
			if (navigator.mediaCapabilities?.encodingInfo) {
				for (const cfg of c.mcConfigs) {
					try {
						const res = await navigator.mediaCapabilities.encodingInfo(cfg as any);
						if (res?.supported) {
							if (res.powerEfficient) {
								isHw = true;
								hasMcSwOnly = false;
								break;
							} else {
								hasMcSwOnly = true;
							}
						}
					} catch {}
				}
			}

			if (!isHw && !hasMcSwOnly && typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
				for (const codec of c.codecs) {
					try {
						const res = await VideoEncoder.isConfigSupported({
							codec,
							width: 1920,
							height: 1080,
							bitrate: 5000000,
							framerate: 60,
							hardwareAcceleration: 'prefer-hardware',
						});
						if (res?.supported === true && (!res.config?.hardwareAcceleration || res.config.hardwareAcceleration === 'prefer-hardware')) {
							isHw = true;
							break;
						}
					} catch {}
				}
			}

			if (isHw) supported.push(c.name);
		}

		if (supported.length > 0) {
			encoderEl.textContent = supported.join(' ▪ ');
			encoderEl.title = 'Probed via MediaCapabilities (powerEfficient: true) and WebCodecs hardware ASIC encoder profiles.';
		} else {
			encoderEl.textContent = 'Software / CPU Encoding';
			encoderEl.title = 'No hardware ASIC encoders detected; media encoded via software/CPU.';
		}
	}

	// --- 12. Hardware DRM Key System (EME) ---
	async function probeDRM() {
		if (!drmEl) return;
		if (!navigator.requestMediaKeySystemAccess) {
			drmEl.textContent = 'Not Supported';
			drmEl.title = 'Encrypted Media Extensions (EME) API not supported by browser.';
			return;
		}
		const drmCandidates = [
			{
				id: 'com.widevine.alpha',
				name: 'Widevine',
				config: [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }],
				hwConfig: [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'HW_SECURE_ALL' }] }],
			},
			{
				id: 'com.microsoft.playready.recommendation',
				name: 'PlayReady (Hardware)',
				config: [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }],
			},
			{
				id: 'com.microsoft.playready',
				name: 'PlayReady',
				config: [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }],
			},
			{
				id: 'com.apple.fps',
				name: 'FairPlay',
				config: [{ initDataTypes: ['cenc', 'sinf', 'skd'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }],
			},
			{
				id: 'com.apple.fps.1_0',
				name: 'FairPlay',
				config: [{ initDataTypes: ['cenc', 'sinf', 'skd'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }],
			},
		];

		const found: string[] = [];
		for (const item of drmCandidates) {
			if (item.id === 'com.microsoft.playready' && found.some((f) => f.includes('PlayReady'))) continue;
			if (item.id === 'com.apple.fps.1_0' && found.some((f) => f.includes('FairPlay'))) continue;
			try {
				await navigator.requestMediaKeySystemAccess(item.id, item.config as any);
				if (item.id === 'com.widevine.alpha' && item.hwConfig) {
					try {
						await navigator.requestMediaKeySystemAccess(item.id, item.hwConfig as any);
						found.push('Widevine L1 (Hardware TrustZone)');
					} catch {
						found.push('Widevine L3 (Software CDM)');
					}
				} else {
					found.push(item.name);
				}
			} catch {}
		}

		if (found.length > 0) {
			drmEl.textContent = found.join(' ▪ ');
			drmEl.title = 'Probed via Encrypted Media Extensions (navigator.requestMediaKeySystemAccess) for hardware & software CDM support. Click to re-probe.';
		} else {
			drmEl.textContent = 'Standard / Open Media';
			drmEl.title = 'No Content Decryption Modules (CDM) supported or allowed by browser. Click to re-probe.';
		}
	}

	if (drmEl) {
		drmEl.classList.add('loc-clickable');
		const triggerDrmReprobe = () => {
			drmEl.textContent = 'Probing CDM modules...';
			probeDRM();
		};
		const itemDrm = document.getElementById('item-drm');
		if (itemDrm) {
			itemDrm.classList.add('telemetry-item-clickable');
			itemDrm.setAttribute('role', 'button');
			itemDrm.setAttribute('tabindex', '0');
			itemDrm.title = 'Probed via Encrypted Media Extensions (EME). Click to re-probe.';
			itemDrm.addEventListener('click', triggerDrmReprobe);
			itemDrm.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					triggerDrmReprobe();
				}
			});
		}
	}

	// --- 13. Cloudflare Edge & Dual-Stack IP ---
	async function probeVisitorInfo() {
		try {
			const res = await fetch('/api/visitor-info', { cache: 'no-store' });
			if (!res.ok) throw new Error('Edge endpoint responded with non-200');
			const data = (await res.json()) as Record<string, any>;
			const edgeIp = (data.ip || '').trim();
			if (edgeIp.includes(':')) currentIpv6 = edgeIp;
			else if (edgeIp) currentIpv4 = edgeIp;
			renderIpDisplay();

			if (!currentIpv4 || currentIpv4.includes('Localhost')) {
				fetchTextWithTimeout('https://ipv4.icanhazip.com', 3000)
					.then((t) => {
						const ip = t.trim();
						if (ip && !ip.includes(':')) {
							currentIpv4 = ip;
							renderIpDisplay();
						}
					})
					.catch(() => {
						if (!currentIpv4) {
							currentIpv4 = 'Unavailable';
							renderIpDisplay();
						}
					});
			}

			if (!currentIpv6) {
				fetchTextWithTimeout('https://ipv6.icanhazip.com', 3000)
					.then((t) => {
						const ip = t.trim();
						currentIpv6 = ip && ip.includes(':') ? ip : 'none';
						renderIpDisplay();
					})
					.catch(() => {
						currentIpv6 = 'none';
						renderIpDisplay();
					});
			}

			const locParts = [data.city, data.region, data.country].filter(Boolean);
			const locString = locParts.length > 0 ? locParts.join(', ') : 'Location unavailable';
			if (locEl) {
				locEl.textContent = locString;
				locEl.title = 'Approximate geolocation resolved from Cloudflare edge IP headers (no device GPS accessed).';
			}

			const lat = parseFloat(data.latitude);
			const lon = parseFloat(data.longitude);
			const itemLocation = document.getElementById('item-location');

			if (!Number.isNaN(lat) && !Number.isNaN(lon) && (lat !== 0 || lon !== 0)) {
				prewarmMapDns();
				if (openMapBtn) {
					openMapBtn.disabled = false;
					openMapBtn.classList.add('interactive');
					openMapBtn.title = `View ${locString} on interactive OpenStreetMap`;
					openMapBtn.onclick = (e) => {
						e.stopPropagation();
						openMapApplet(lat, lon, locString);
					};
				}
				if (itemLocation) {
					itemLocation.classList.add('telemetry-item-clickable');
					itemLocation.title = `View ${locString} on interactive OpenStreetMap`;
					itemLocation.onclick = (e) => {
						if ((e.target as HTMLElement)?.closest('button')) return;
						openMapApplet(lat, lon, locString);
					};
				}
			} else {
				if (openMapBtn) {
					openMapBtn.disabled = true;
					openMapBtn.classList.remove('interactive');
					openMapBtn.title = 'Location detected via edge headers';
				}
				if (itemLocation) {
					itemLocation.classList.remove('telemetry-item-clickable');
					itemLocation.onclick = null;
				}
			}

			if (edgeEl) {
				const coloCode = (data.coloCode || (data.colo ? data.colo.split(' ')[0] : '')).toUpperCase();
				const coloCity = coloCode && COLO_NAMES[coloCode];
				if (coloCity) edgeEl.textContent = `${coloCode} (${coloCity})`;
				else if (data.colo) edgeEl.textContent = data.colo;
				else edgeEl.textContent = 'Cloudflare Anycast Edge';
				edgeEl.title = 'Nearest Cloudflare Anycast point of presence (PoP) terminating the TLS connection (IATA airport code).';
			}

			if (ispEl) {
				const asn = data.asn ? `AS${data.asn}` : '';
				const isp = data.isp ? `${data.isp}` : 'Broadband Provider';
				ispEl.textContent = asn ? `${isp} (${asn})` : isp;
				ispEl.title = 'Autonomous System Number (ASN) and network operator resolved from BGP routing metadata.';
			}
		} catch {
			currentIpv4 = '127.0.0.1 (Local Edge)';
			currentIpv6 = 'none';
			renderIpDisplay();
			if (locEl) locEl.textContent = 'Direct Connection';
			if (edgeEl) edgeEl.textContent = 'Localhost (Dev Edge)';
			if (ispEl) ispEl.textContent = 'Cloudflare Protected';
		}
	}

	let heavyProbesStarted = false;
	function runHeavyTelemetryProbes() {
		if (heavyProbesStarted) return;
		heavyProbesStarted = true;
		probeWebGPU();
		probeDAC();
		probeCodecs();
		probeEncoder();
		probeDRM();
		probeVisitorInfo();
	}
	heavyProbesStarter = runHeavyTelemetryProbes;

	if ('IntersectionObserver' in window) {
		const debugObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						debugObserver.disconnect();
						runHeavyTelemetryProbes();
						break;
					}
				}
			},
			{ rootMargin: '400px' }
		);
		debugObserver.observe(debugSection);
	} else {
		runHeavyTelemetryProbes();
	}

	debugSection.addEventListener('section-toggle', (e: any) => {
		if (e?.detail?.open) runHeavyTelemetryProbes();
	});

	if (window.location.hash === '#debug') {
		runHeavyTelemetryProbes();
	}

	if (!telemetryModuleBound) {
		telemetryModuleBound = true;
		window.addEventListener('keydown', (e) => {
			if (e.key !== 'Escape' && e.key !== 'Esc') return;
			const mapModal = document.getElementById('map-applet-modal');
			const wgModal = document.getElementById('webgpu-applet-modal');
			if (mapModal && !mapModal.classList.contains('hidden')) {
				e.preventDefault();
				e.stopPropagation();
				(document.getElementById('map-applet-close-btn') as HTMLElement | null)?.click();
			}
			if (wgModal && !wgModal.classList.contains('hidden')) {
				e.preventDefault();
				e.stopPropagation();
				(document.getElementById('webgpu-applet-close-btn') as HTMLElement | null)?.click();
			}
		});
	}
}
