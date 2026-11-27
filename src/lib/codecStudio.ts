// src/lib/codecStudio.ts
// WebCodecs Hardware & Software Transcoding Studio (Decode / Encode / Loopback + Pixel Loupe + Diff/Heatmap)

import { escapeHtml, openModalFocus, closeModalFocus } from './ui';

export interface CodecStudioOptions {
	onBeforeOpen?: () => void;
}

interface FrameQuality {
	psnr: number;
	ssim: number;
}

interface CodecCap {
	encHw: boolean;
	encSw: boolean;
	decHw: boolean;
	decSw: boolean;
}

const TOTAL_CLIP_FRAMES = 60;
const TEST_WINDOW_FRAMES = 24;
const MAX_START_FRAME = TOTAL_CLIP_FRAMES - TEST_WINDOW_FRAMES;

function isMobileOrTabletDevice(): boolean {
	if (typeof window === 'undefined') return false;
	if (window.innerWidth <= 768) return true;
	const ua = navigator.userAgent || '';
	const isIpadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
	const isTouchUa = navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod|Macintosh/i.test(ua);
	return isIpadDesktopUA || isTouchUa;
}

function turboColormap(t: number): [number, number, number] {
	if (t <= 0) return [15, 23, 42];
	if (t < 0.25) {
		const f = t / 0.25;
		return [Math.round(15 + f * (6 - 15)), Math.round(23 + f * (182 - 23)), Math.round(42 + f * (212 - 42))];
	}
	if (t < 0.5) {
		const f = (t - 0.25) / 0.25;
		return [Math.round(6 + f * (34 - 6)), Math.round(182 + f * (197 - 182)), Math.round(212 + f * (94 - 212))];
	}
	if (t < 0.75) {
		const f = (t - 0.5) / 0.25;
		return [Math.round(34 + f * (234 - 34)), Math.round(197 + f * (179 - 197)), Math.round(94 + f * (8 - 94))];
	}
	const f = Math.min(1, (t - 0.75) / 0.25);
	return [Math.round(234 + f * (239 - 234)), Math.round(179 + f * (68 - 179)), Math.round(8 + f * (68 - 8))];
}

function formatQualityTooltip(psnr: number, ssim: number, frameLabel?: string): string {
	const rmse = (255 * 10 ** (-psnr / 20)).toFixed(2);
	let grade = 'Visually Lossless';
	if (psnr < 30) grade = 'Heavy Compression Artifacts';
	else if (psnr < 38) grade = 'Standard Web Streaming';
	else if (psnr < 45) grade = 'High-Fidelity Broadcast';

	const prefix = frameLabel ? `${frameLabel}: ` : 'Average Quality: ';
	return `${prefix}${psnr.toFixed(1)} dB PSNR · ${ssim.toFixed(3)} SSIM (${grade})\n• Avg Pixel Deviation (RMSE): ±${rmse} / 255 levels\n• Decibel Scale: +3 dB cuts noise energy by 50% (2× cleaner); +6 dB cuts linear pixel error in half\n• Industry Standards: >45 dB Archive/Lossless | 38–45 dB High Fidelity | 30–37 dB Standard | <30 dB Artifacts`;
}

function computePsnrAndSsim(srcImgData: ImageData, decImgData: ImageData): FrameQuality {
	const sData = srcImgData.data;
	const dData = decImgData.data;
	const w = srcImgData.width;
	const h = srcImgData.height;

	let sumSqDiff = 0;
	let totalPixels = 0;

	const blockSize = 8;
	const c1 = (0.01 * 255) ** 2;
	const c2 = (0.03 * 255) ** 2;
	let sumSsim = 0;
	let numBlocks = 0;

	for (let by = 0; by < h; by += blockSize) {
		const blockH = Math.min(blockSize, h - by);
		for (let bx = 0; bx < w; bx += blockSize) {
			const blockW = Math.min(blockSize, w - bx);
			const blockCount = blockW * blockH;

			let sumX = 0;
			let sumY = 0;
			let sumSqX = 0;
			let sumSqY = 0;
			let sumXY = 0;

			for (let dy = 0; dy < blockH; dy++) {
				const rowOffset = ((by + dy) * w + bx) * 4;
				for (let dx = 0; dx < blockW; dx++) {
					const p = rowOffset + dx * 4;
					const sr = sData[p];
					const sg = sData[p + 1];
					const sb = sData[p + 2];
					const dr = dData[p];
					const dg = dData[p + 1];
					const db = dData[p + 2];

					const diffR = sr - dr;
					const diffG = sg - dg;
					const diffB = sb - db;
					sumSqDiff += diffR * diffR + diffG * diffG + diffB * diffB;
					totalPixels++;

					const xLum = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
					const yLum = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;

					sumX += xLum;
					sumY += yLum;
					sumSqX += xLum * xLum;
					sumSqY += yLum * yLum;
					sumXY += xLum * yLum;
				}
			}

			const muX = sumX / blockCount;
			const muY = sumY / blockCount;
			const varX = sumSqX / blockCount - muX * muX;
			const varY = sumSqY / blockCount - muY * muY;
			const covXY = sumXY / blockCount - muX * muY;

			const num = (2 * muX * muY + c1) * (2 * covXY + c2);
			const den = (muX * muX + muY * muY + c1) * (varX + varY + c2);
			sumSsim += den === 0 ? 1.0 : num / den;
			numBlocks++;
		}
	}

	const mse = totalPixels > 0 ? sumSqDiff / (totalPixels * 3) : 0;
	const psnr = mse === 0 ? 99.9 : Math.min(99.9, Math.round(10 * Math.log10((255 * 255) / mse) * 10) / 10);
	let ssim = numBlocks > 0 ? sumSsim / numBlocks : 1.0;
	ssim = Math.max(0, Math.min(1.0, Math.round(ssim * 1000) / 1000));
	return { psnr, ssim };
}

function drawSmpteScene(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	w: number,
	h: number,
	frameIdx: number,
	totalFrames: number
) {
	const topColors = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
	const numTop = topColors.length;
	const barWidth = w / numTop;
	const barHeight = Math.round(h * 0.65);
	const shiftLeft = (frameIdx / totalFrames) * (w * 0.35);
	for (let i = -numTop; i < numTop * 2; i++) {
		const bx = i * barWidth - (shiftLeft % w);
		if (bx + barWidth > 0 && bx < w) {
			const cIndex = ((i % numTop) + numTop) % numTop;
			ctx.fillStyle = topColors[cIndex];
			ctx.fillRect(Math.floor(bx), 0, Math.ceil(barWidth) + 1, barHeight);
		}
	}

	const castColors = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
	const castY = barHeight;
	const castHeight = Math.round(h * 0.1);
	for (let i = 0; i < castColors.length; i++) {
		ctx.fillStyle = castColors[i];
		ctx.fillRect(i * barWidth, castY, Math.ceil(barWidth), castHeight);
	}

	const sweepProgress = frameIdx / Math.max(1, totalFrames - 1);
	const sweepX = sweepProgress * (w - 20);
	ctx.fillStyle = '#f97316';
	ctx.fillRect(sweepX, castY, 18, castHeight);

	const botColors = ['#00214c', '#ffffff', '#32006a', '#05070d', '#141824', '#00a3c4', '#f97316', '#dc2626'];
	const numBot = botColors.length;
	const botW = w / numBot;
	const botY = castY + castHeight;
	const botHeight = h - botY;
	const shiftRight = (frameIdx / totalFrames) * (w * 0.35);
	for (let i = -numBot; i < numBot * 2; i++) {
		const bx = i * botW + (shiftRight % w);
		if (bx + botW > 0 && bx < w) {
			const cIndex = ((i % numBot) + numBot) % numBot;
			ctx.fillStyle = botColors[cIndex];
			ctx.fillRect(Math.floor(bx), botY, Math.ceil(botW) + 1, botHeight);
		}
	}
}

let codecGlobalListenersBound = false;

export function initCodecStudio(options: CodecStudioOptions = {}): void {
	const codecModal = document.getElementById('codec-applet-modal');
	if (!codecModal || codecModal.dataset.bound === '1') return;
	codecModal.dataset.bound = '1';

	const codecCloseBtn = document.getElementById('codec-applet-close-btn') as HTMLElement | null;
	const codecBackdrop = document.getElementById('codec-applet-backdrop');
	const openDecoderBtn = document.getElementById('open-decoder-btn');
	const openEncoderBtn = document.getElementById('open-encoder-btn');
	const itemDecoder = document.getElementById('item-decoder');
	const itemEncoder = document.getElementById('item-encoder');

	const runBtn = document.getElementById('codec-run-btn') as HTMLButtonElement | null;
	const statusText = document.getElementById('codec-status-text');
	const srcVideo = document.getElementById('codec-video-source') as HTMLVideoElement | null;
	const srcCanvas = document.getElementById('codec-canvas-source') as HTMLCanvasElement | null;
	const decCanvas = document.getElementById('codec-canvas-decoded') as HTMLCanvasElement | null;
	const decPlaceholder = document.getElementById('codec-canvas-placeholder');

	const metricEncFps = document.getElementById('codec-metric-enc-fps');
	const metricDecFps = document.getElementById('codec-metric-dec-fps');
	const metricQuality = document.getElementById('codec-metric-quality');
	const metricRatio = document.getElementById('codec-metric-ratio');

	const viewModeBtns = document.querySelectorAll<HTMLButtonElement>('.codec-view-btn');
	let currentViewMode: 'normal' | 'diff' | 'heatmap' = 'normal';

	const sparklineCanvas = document.getElementById('codec-sparkline-canvas') as HTMLCanvasElement | null;
	const sparklineTooltip = document.getElementById('codec-sparkline-tooltip');
	let sparklineChunks: Array<{ type: 'key' | 'delta'; size: number; timestamp: number }> = [];

	const customFileInput = document.getElementById('codec-custom-file-input') as HTMLInputElement | null;
	let customVideoUrl: string | null = null;
	let customFileName = '';

	let frameQualityMetrics: FrameQuality[] = [];
	let avgPsnr = 0;
	let avgSsim = 0;

	const codecCapabilities: Record<string, CodecCap> = {
		avc: { encHw: false, encSw: false, decHw: false, decSw: false },
		vp9: { encHw: false, encSw: false, decHw: false, decSw: false },
		hevc: { encHw: false, encSw: false, decHw: false, decSw: false },
		av1: { encHw: false, encSw: false, decHw: false, decSw: false },
	};
	let capabilityProbed = false;

	const playBtn = document.getElementById('codec-play-btn');
	const prevFrameBtn = document.getElementById('codec-prev-frame-btn');
	const nextFrameBtn = document.getElementById('codec-next-frame-btn');
	const frameReadout = document.getElementById('codec-frame-readout');
	const iconPlay = document.getElementById('codec-icon-play');
	const iconPause = document.getElementById('codec-icon-pause');
	const rangeBadgeText = document.getElementById('codec-range-badge-text');
	const trackBar = document.getElementById('codec-track-bar');
	const rangeWindow = document.getElementById('codec-range-window');
	const playhead = document.getElementById('codec-playhead');

	let rangeStartFrame = 0;
	let currentFrameIdx = 0;
	let isPlaying = false;
	let playbackRaf: number | null = null;
	let sourceBitmaps: ImageBitmap[] = [];
	let decodedBitmaps: ImageBitmap[] = [];
	let sourceSceneLoaded = '';
	let sourceStartFrameLoaded = -1;
	let decodedSceneLoaded = '';
	let decodedStartFrameLoaded = -1;
	let processedStartFrameLoaded = -1;
	let activeRunId = 0;

	const pipelineSegBtns = document.querySelectorAll<HTMLButtonElement>('#pipeline-selector .codec-seg-btn');
	const codecSegBtns = document.querySelectorAll<HTMLButtonElement>('#codec-selector .codec-seg-btn');
	const engineSegBtns = document.querySelectorAll<HTMLButtonElement>('#engine-selector .codec-seg-btn');
	const qualitySegBtns = document.querySelectorAll<HTMLButtonElement>('#quality-selector .codec-seg-btn');
	const sceneSegBtns = document.querySelectorAll<HTMLButtonElement>('#scene-selector .codec-seg-btn');

	let selectedPipeline: 'loopback' | 'encode' | 'decode' = 'loopback';
	let selectedCodec: 'avc' | 'vp9' | 'av1' | 'hevc' = 'avc';
	let selectedMode: 'prefer-hardware' | 'prefer-software' = 'prefer-hardware';
	let selectedQuality: 'high' | 'med' | 'low' = 'med';
	let selectedScene: '4k' | '1080p' | 'smpte' | 'custom' = '1080p';
	let isRunning = false;

	const videoBlobCache: Record<string, string> = {};

	function clearVideoBlobCache() {
		for (const key of Object.keys(videoBlobCache)) {
			try { URL.revokeObjectURL(videoBlobCache[key]); } catch {}
			delete videoBlobCache[key];
		}
	}

	async function getBlobUrlForScene(scene: '4k' | '1080p'): Promise<string> {
		if (videoBlobCache[scene]) return videoBlobCache[scene];
		const target = scene === '4k' ? '/media/dog_4k.mp4' : '/media/charge_1080p.mp4';
		try {
			const res = await fetch(target);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			videoBlobCache[scene] = url;
			return url;
		} catch {
			return target;
		}
	}

	async function loadVideoForScene(scene: '4k' | '1080p', preferBlob = false) {
		if (!srcVideo) return;
		const targetWebm = scene === '4k' ? '/media/dog_4k.webm' : '/media/charge_1080p.webm';
		const targetMp4 = scene === '4k' ? '/media/dog_4k.mp4' : '/media/charge_1080p.mp4';

		if (preferBlob) {
			const blobUrl = await getBlobUrlForScene(scene);
			if (srcVideo.src !== blobUrl) {
				srcVideo.src = blobUrl;
				srcVideo.load();
			}
			return;
		}

		if (videoBlobCache[scene]) {
			if (srcVideo.src !== videoBlobCache[scene]) {
				srcVideo.src = videoBlobCache[scene];
				srcVideo.load();
			}
			return;
		}

		const activeSrc = srcVideo.querySelector('source')?.getAttribute('src') || srcVideo.currentSrc || srcVideo.src || '';
		const matches = scene === '4k' ? activeSrc.includes('dog_4k') : activeSrc.includes('charge_1080p');
		if (!matches || srcVideo.src.startsWith('blob:')) {
			srcVideo.removeAttribute('src');
			srcVideo.innerHTML = `<source src="${targetMp4}" type="video/mp4"><source src="${targetWebm}" type="video/webm">`;
			srcVideo.load();
		} else if (srcVideo.readyState === 0) {
			srcVideo.load();
		}
	}

	async function ensureVideoReady() {
		if (!srcVideo || srcVideo.readyState >= 3) return;
		await new Promise<void>((resolve) => {
			if (!srcVideo || srcVideo.readyState >= 3) {
				resolve();
				return;
			}
			let timer = 0;
			const onReady = () => {
				if (srcVideo.readyState < 3) return;
				window.clearTimeout(timer);
				srcVideo.removeEventListener('canplay', onReady);
				srcVideo.removeEventListener('canplaythrough', onReady);
				resolve();
			};
			srcVideo.addEventListener('canplay', onReady);
			srcVideo.addEventListener('canplaythrough', onReady);
			timer = window.setTimeout(() => {
				srcVideo.removeEventListener('canplay', onReady);
				srcVideo.removeEventListener('canplaythrough', onReady);
				resolve();
			}, 5000);
		});
	}

	async function ensureSourceFrames(is4k: boolean, width: number, height: number): Promise<ImageBitmap[]> {
		if (selectedScene === 'smpte') {
			sourceSceneLoaded = 'smpte';
			sourceStartFrameLoaded = rangeStartFrame;
			return [];
		}

		if (
			sourceBitmaps.length === TEST_WINDOW_FRAMES &&
			sourceBitmaps.every((b) => !!b) &&
			sourceSceneLoaded === selectedScene &&
			sourceStartFrameLoaded === rangeStartFrame
		) {
			return sourceBitmaps;
		}

		sourceBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		sourceBitmaps = new Array(TEST_WINDOW_FRAMES);
		if (!srcVideo) return [];

		srcVideo.classList.remove('hidden');
		if (srcCanvas) srcCanvas.classList.add('hidden');

		if (statusText) {
			const sceneLabel =
				selectedScene === 'custom'
					? customFileName || 'Custom clip'
					: selectedScene === '4k'
						? '4K UHD'
						: '1080p';
			statusText.textContent = `Buffering ${sceneLabel} master...`;
			statusText.style.color = '';
		}

		if (selectedScene !== 'custom') {
			await loadVideoForScene(selectedScene === '4k' ? '4k' : '1080p', true);
		}
		await ensureVideoReady();
		srcVideo.pause();

		const extractCanvas =
			typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
		extractCanvas.width = width;
		extractCanvas.height = height;
		const extractCtx = extractCanvas.getContext('2d')!;

		for (let i = 0; i < TEST_WINDOW_FRAMES; i++) {
			if (!isRunning) break;
			if (statusText && (i % 6 === 0 || i === TEST_WINDOW_FRAMES - 1)) {
				statusText.textContent = `Extracting ${selectedScene.toUpperCase()} frames (${i + 1}/${TEST_WINDOW_FRAMES})...`;
			}
			const globalFrame = rangeStartFrame + i;
			const targetTime = (globalFrame + 0.5) / 24;

			await new Promise<void>((resolve) => {
				let resolved = false;
				let fallbackTimer = 0;
				const finish = () => {
					if (resolved) return;
					resolved = true;
					window.clearTimeout(fallbackTimer);
					srcVideo.removeEventListener('seeked', onSeeked);
					resolve();
				};
				const onSeeked = () => {
					requestAnimationFrame(() => requestAnimationFrame(finish));
				};
				if (Math.abs(srcVideo.currentTime - targetTime) < 0.005) {
					requestAnimationFrame(() => requestAnimationFrame(finish));
					return;
				}
				srcVideo.addEventListener('seeked', onSeeked, { once: true });
				srcVideo.currentTime = targetTime;
				fallbackTimer = window.setTimeout(finish, is4k ? 400 : 250);
			});

			extractCtx.drawImage(srcVideo, 0, 0, width, height);
			sourceBitmaps[i] = await createImageBitmap(extractCanvas);
		}

		sourceSceneLoaded = selectedScene;
		sourceStartFrameLoaded = rangeStartFrame;
		return sourceBitmaps;
	}

	function getInputFileSize(): string {
		if (selectedScene === 'smpte') return 'Procedural';
		if (selectedScene === 'custom') {
			if (customFileInput?.files?.[0]) {
				const mb = (customFileInput.files[0].size / (1024 * 1024)).toFixed(1);
				return `${mb} MB (Local)`;
			}
			return 'Custom (Local)';
		}
		const is4k = selectedScene === '4k';
		const src = srcVideo?.currentSrc || srcVideo?.src || '';
		const isWebm = src.includes('.webm');
		if (is4k) return isWebm ? '17.5 MB' : '17.2 MB';
		return isWebm ? '4.5 MB' : '2.8 MB';
	}

	// --- Maximize / Fullscreen ---
	let isMaximized = false;
	const minBtn = document.getElementById('codec-applet-min-btn');
	const maxBtn = document.getElementById('codec-applet-maximize-btn');
	const iconMax = document.getElementById('codec-icon-maximize');
	const iconRestore = document.getElementById('codec-icon-restore');

	function updateMaximizeUi(maximized: boolean) {
		isMaximized = maximized;
		codecModal?.classList.toggle('is-maximized', maximized);
		iconMax?.classList.toggle('hidden', maximized);
		iconRestore?.classList.toggle('hidden', !maximized);
		if (maxBtn) {
			maxBtn.title = maximized ? 'Restore window size' : 'Maximize to Fullscreen (Recommended)';
			maxBtn.setAttribute('aria-label', maxBtn.title);
		}
	}

	function toggleMaximize() {
		if (!codecModal) return;
		const currentlyMaximized = !!document.fullscreenElement || codecModal.classList.contains('is-maximized');
		const target = !currentlyMaximized;
		if (target) {
			if (codecModal.requestFullscreen) {
				codecModal.requestFullscreen().catch(() => updateMaximizeUi(true));
			} else if ((codecModal as any).webkitRequestFullscreen) {
				(codecModal as any).webkitRequestFullscreen();
				updateMaximizeUi(true);
			} else {
				updateMaximizeUi(true);
			}
		} else {
			if (document.fullscreenElement) {
				if (document.exitFullscreen) document.exitFullscreen().catch(() => updateMaximizeUi(false));
				else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
			}
			updateMaximizeUi(false);
		}
	}

	maxBtn?.addEventListener('click', toggleMaximize);
	minBtn?.addEventListener('click', closeCodecModal);
	codecCloseBtn?.addEventListener('click', closeCodecModal);

	// --- Synchronized Pixel Loupe ---
	const loupeSrc = document.getElementById('codec-loupe-src');
	const loupeDec = document.getElementById('codec-loupe-dec');
	const loupeCanvasSrc = document.getElementById('codec-loupe-canvas-src') as HTMLCanvasElement | null;
	const loupeCanvasDec = document.getElementById('codec-loupe-canvas-dec') as HTMLCanvasElement | null;
	const wrapSrc = document.getElementById('codec-wrap-src');
	const wrapDec = document.getElementById('codec-wrap-dec');
	const previewGrid = document.querySelector('.codec-preview-grid') as HTMLElement | null;
	const zoomBtns = document.querySelectorAll<HTMLButtonElement>('.codec-zoom-btn');
	const pinBtn = document.getElementById('codec-pin-btn');
	const pillSrc = document.getElementById('codec-pill-src');
	const pillDec = document.getElementById('codec-pill-dec');

	let currentZoom = 2;
	const ZOOM_LEVELS = [1, 2, 4, 8];
	let isLoupePinned = false;
	let pinnedNormX = 0.5;
	let pinnedNormY = 0.5;
	let lastNormX: number | null = null;
	let lastNormY: number | null = null;
	let isPointerOver = false;

	function updateLoupePills() {
		const label = `${currentZoom}×`;
		if (pillSrc) pillSrc.textContent = `${label} RAW`;
		if (pillDec) {
			const pipeStr = selectedMode === 'prefer-hardware' ? 'ASIC' : 'CPU';
			const viewStr = currentViewMode === 'normal' ? pipeStr : currentViewMode === 'diff' ? 'Diff' : 'Heatmap';
			pillDec.textContent = `${label} ${viewStr}`;
		}
	}

	function setLoupeZoom(targetZoom: number) {
		if (!ZOOM_LEVELS.includes(targetZoom)) return;
		currentZoom = targetZoom;
		zoomBtns.forEach((b) => {
			const z = parseInt(b.getAttribute('data-zoom') || '2', 10);
			b.classList.toggle('active', z === currentZoom);
		});
		updateLoupePills();
		if (isLoupePinned || isPointerOver) {
			updateLoupe(isLoupePinned ? pinnedNormX : (lastNormX ?? 0.5), isLoupePinned ? pinnedNormY : (lastNormY ?? 0.5));
		}
	}

	function stepLoupeZoom(direction: 'in' | 'out') {
		const curIdx = ZOOM_LEVELS.indexOf(currentZoom);
		if (curIdx === -1) return;
		if (direction === 'in' && curIdx < ZOOM_LEVELS.length - 1) setLoupeZoom(ZOOM_LEVELS[curIdx + 1]);
		else if (direction === 'out' && curIdx > 0) setLoupeZoom(ZOOM_LEVELS[curIdx - 1]);
	}

	zoomBtns.forEach((btn) => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			setLoupeZoom(parseInt(btn.getAttribute('data-zoom') || '2', 10));
		});
	});

	let wheelAccumulator = 0;
	let wheelDecayTimer: number | null = null;

	function handleLoupeWheel(e: WheelEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (wheelDecayTimer !== null) window.clearTimeout(wheelDecayTimer);
		wheelDecayTimer = window.setTimeout(() => {
			wheelAccumulator = 0;
			wheelDecayTimer = null;
		}, 200);

		let delta = e.deltaY;
		if (e.deltaMode === 1) delta *= 30;
		else if (e.deltaMode === 2) delta *= 300;
		if ((wheelAccumulator > 0 && delta < 0) || (wheelAccumulator < 0 && delta > 0)) wheelAccumulator = 0;
		wheelAccumulator += delta;

		if (wheelAccumulator <= -35) {
			stepLoupeZoom('in');
			wheelAccumulator = 0;
		} else if (wheelAccumulator >= 35) {
			stepLoupeZoom('out');
			wheelAccumulator = 0;
		}

		const targetWrap = (e.target as HTMLElement)?.closest?.('.codec-canvas-wrap') as HTMLElement | null;
		if (targetWrap && !isLoupePinned) {
			const wrapRect = targetWrap.getBoundingClientRect();
			const normX = Math.max(0, Math.min(1, (e.clientX - wrapRect.left) / wrapRect.width));
			const normY = Math.max(0, Math.min(1, (e.clientY - wrapRect.top) / wrapRect.height));
			lastNormX = normX;
			lastNormY = normY;
			isPointerOver = true;
			showLoupe();
			updateLoupe(normX, normY);
		}
	}

	function setLoupePinned(pinned: boolean, normX?: number, normY?: number) {
		isLoupePinned = pinned;
		if (pinned && normX !== undefined && normY !== undefined) {
			pinnedNormX = normX;
			pinnedNormY = normY;
			lastNormX = normX;
			lastNormY = normY;
		}
		if (pinBtn) {
			pinBtn.classList.toggle('active', pinned);
			pinBtn.title = pinned ? 'Unpin magnifier (P)' : 'Pin magnifier (P) at cursor location';
		}
		if (pinned) {
			showLoupe();
			updateLoupe(pinnedNormX, pinnedNormY);
		} else if (!isPointerOver) {
			hideLoupe();
		}
	}

	pinBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		if (isLoupePinned) setLoupePinned(false);
		else setLoupePinned(true, lastNormX ?? 0.5, lastNormY ?? 0.5);
	});

	function showLoupe() {
		loupeSrc?.classList.remove('hidden');
		loupeDec?.classList.remove('hidden');
	}

	function hideLoupe() {
		if (isLoupePinned) return;
		loupeSrc?.classList.add('hidden');
		loupeDec?.classList.add('hidden');
		lastNormX = null;
		lastNormY = null;
	}

	function forceHideLoupe() {
		setLoupePinned(false);
		isPointerOver = false;
		loupeSrc?.classList.add('hidden');
		loupeDec?.classList.add('hidden');
		lastNormX = null;
		lastNormY = null;
	}

	function positionLoupe(loupe: HTMLElement, clientX: number, clientY: number, wrap: HTMLElement) {
		const wrapRect = wrap.getBoundingClientRect();
		const loupeW = loupe.offsetWidth || 140;
		const loupeH = loupe.offsetHeight || 140;
		const margin = 12;

		let left = clientX - wrapRect.left - loupeW / 2;
		let top = clientY - wrapRect.top - loupeH - 18;
		if (top < margin) top = clientY - wrapRect.top + 22;
		if (top + loupeH > wrapRect.height - margin) top = wrapRect.height - margin - loupeH;
		if (left < margin) left = margin;
		else if (left + loupeW > wrapRect.width - margin) left = wrapRect.width - margin - loupeW;

		loupe.style.left = `${Math.round(left)}px`;
		loupe.style.top = `${Math.round(top)}px`;
	}

	function updateLoupe(normX: number, normY: number) {
		if (!wrapSrc || !wrapDec || !loupeCanvasSrc || !loupeCanvasDec) return;
		const ctxSrc = loupeCanvasSrc.getContext('2d');
		const ctxDec = loupeCanvasDec.getContext('2d');
		if (!ctxSrc || !ctxDec) return;

		ctxSrc.imageSmoothingEnabled = false;
		ctxDec.imageSmoothingEnabled = false;

		const isSrcCanvasActive =
			selectedScene === 'smpte' ||
			(sourceBitmaps.length === TEST_WINDOW_FRAMES && !!sourceBitmaps[0] && !!srcCanvas && !srcCanvas.classList.contains('hidden'));
		const activeSrcEl: HTMLCanvasElement | HTMLVideoElement = isSrcCanvasActive ? srcCanvas! : srcVideo || srcCanvas!;
		const srcW =
			activeSrcEl instanceof HTMLVideoElement
				? activeSrcEl.videoWidth || (selectedScene === '4k' ? 3840 : 1920)
				: activeSrcEl.width;
		const srcH =
			activeSrcEl instanceof HTMLVideoElement
				? activeSrcEl.videoHeight || (selectedScene === '4k' ? 2160 : 1080)
				: activeSrcEl.height;

		const baseCropW = Math.round(160 / currentZoom);
		const baseCropH = Math.round(160 / currentZoom);
		const sx = Math.max(0, Math.min(srcW - baseCropW, Math.round(normX * srcW) - Math.floor(baseCropW / 2)));
		const sy = Math.max(0, Math.min(srcH - baseCropH, Math.round(normY * srcH) - Math.floor(baseCropH / 2)));

		try {
			ctxSrc.clearRect(0, 0, 160, 160);
			ctxSrc.drawImage(activeSrcEl, sx, sy, baseCropW, baseCropH, 0, 0, 160, 160);
		} catch {}

		if (decCanvas) {
			const decW = decCanvas.width;
			const decH = decCanvas.height;
			// Scale crop proportionally when source master & decoded raster dimensions differ (e.g., 4K video vs 1080p mobile decode)
			const decCropW = Math.max(1, Math.round(baseCropW * (decW / Math.max(1, srcW))));
			const decCropH = Math.max(1, Math.round(baseCropH * (decH / Math.max(1, srcH))));
			const decSx = Math.max(0, Math.min(decW - decCropW, Math.round(normX * decW) - Math.floor(decCropW / 2)));
			const decSy = Math.max(0, Math.min(decH - decCropH, Math.round(normY * decH) - Math.floor(decCropH / 2)));
			try {
				ctxDec.clearRect(0, 0, 160, 160);
				ctxDec.drawImage(decCanvas, decSx, decSy, decCropW, decCropH, 0, 0, 160, 160);
			} catch {}
		}

		const srcRect = wrapSrc.getBoundingClientRect();
		if (loupeSrc) positionLoupe(loupeSrc, srcRect.left + normX * srcRect.width, srcRect.top + normY * srcRect.height, wrapSrc);
		const decRect = wrapDec.getBoundingClientRect();
		if (loupeDec) positionLoupe(loupeDec, decRect.left + normX * decRect.width, decRect.top + normY * decRect.height, wrapDec);
	}

	function handleFramePointer(e: PointerEvent, wrap: HTMLElement) {
		if (isLoupePinned) return;
		const wrapRect = wrap.getBoundingClientRect();
		const normX = Math.max(0, Math.min(1, (e.clientX - wrapRect.left) / wrapRect.width));
		const normY = Math.max(0, Math.min(1, (e.clientY - wrapRect.top) / wrapRect.height));
		lastNormX = normX;
		lastNormY = normY;
		isPointerOver = true;
		showLoupe();
		updateLoupe(normX, normY);
	}

	function handleFrameClick(e: MouseEvent, wrap: HTMLElement) {
		if (isLoupePinned) {
			setLoupePinned(false);
			return;
		}
		const wrapRect = wrap.getBoundingClientRect();
		const normX = Math.max(0, Math.min(1, (e.clientX - wrapRect.left) / wrapRect.width));
		const normY = Math.max(0, Math.min(1, (e.clientY - wrapRect.top) / wrapRect.height));
		setLoupePinned(true, normX, normY);
	}

	function attachLoupeEvents(wrap: HTMLElement) {
		wrap.addEventListener('pointerenter', (e) => {
			if (e.pointerType === 'touch') return;
			isPointerOver = true;
			handleFramePointer(e, wrap);
		});
		wrap.addEventListener('pointermove', (e) => handleFramePointer(e, wrap));
		wrap.addEventListener('pointerdown', (e) => {
			if (e.pointerType === 'touch') {
				try { wrap.setPointerCapture(e.pointerId); } catch {}
				handleFramePointer(e, wrap);
			}
		});
		wrap.addEventListener('pointerup', (e) => {
			if (e.pointerType === 'touch') {
				try { wrap.releasePointerCapture(e.pointerId); } catch {}
				if (!isLoupePinned) hideLoupe();
			}
		});
		wrap.addEventListener('pointerleave', (e) => {
			isPointerOver = false;
			if (e.pointerType !== 'touch' && !isLoupePinned) hideLoupe();
		});
		wrap.addEventListener('click', (e) => handleFrameClick(e, wrap));
	}

	if (wrapSrc) {
		attachLoupeEvents(wrapSrc);
		wrapSrc.addEventListener('wheel', handleLoupeWheel, { passive: false });
	}
	if (wrapDec) {
		attachLoupeEvents(wrapDec);
		wrapDec.addEventListener('wheel', handleLoupeWheel, { passive: false });
	}
	previewGrid?.addEventListener('wheel', handleLoupeWheel, { passive: false });

	// --- Codec Capabilities Probe ---
	async function probeCodecCapabilities() {
		if (
			capabilityProbed ||
			typeof VideoEncoder === 'undefined' ||
			typeof VideoDecoder === 'undefined' ||
			typeof VideoEncoder.isConfigSupported !== 'function' ||
			typeof VideoDecoder.isConfigSupported !== 'function'
		) {
			return;
		}

		const probeList: Record<string, { codecs: string[]; mime: string }> = {
			avc: { codecs: ['avc1.640028', 'avc1.4d0028', 'avc1.420028'], mime: 'video/mp4' },
			vp9: { codecs: ['vp09.00.40.08', 'vp09.00.41.08'], mime: 'video/webm' },
			hevc: { codecs: ['hvc1.1.6.L120.B0', 'hev1.1.6.L120.B0'], mime: 'video/mp4' },
			av1: { codecs: ['av01.0.08M.08', 'av01.0.05M.08'], mime: 'video/mp4' },
		};

		for (const [codecKey, entry] of Object.entries(probeList)) {
			// Check MediaCapabilities powerEfficient first so SW fallback isn't labeled HW
			let mcEncPowerEfficient: boolean | null = null;
			let mcDecPowerEfficient: boolean | null = null;
			if (navigator.mediaCapabilities?.encodingInfo) {
				try {
					const mcEnc = await navigator.mediaCapabilities.encodingInfo({
						type: 'record',
						video: { contentType: `${entry.mime}; codecs="${entry.codecs[0]}"`, width: 1920, height: 1080, bitrate: 6_000_000, framerate: 24 },
					} as any);
					if (mcEnc?.supported) mcEncPowerEfficient = !!mcEnc.powerEfficient;
				} catch {}
			}
			if (navigator.mediaCapabilities?.decodingInfo) {
				try {
					const mcDec = await navigator.mediaCapabilities.decodingInfo({
						type: 'file',
						video: { contentType: `${entry.mime}; codecs="${entry.codecs[0]}"`, width: 1920, height: 1080, bitrate: 6_000_000, framerate: 24 },
					} as any);
					if (mcDec?.supported) mcDecPowerEfficient = !!mcDec.powerEfficient;
				} catch {}
			}

			for (const c of entry.codecs) {
				try {
					const res = await VideoEncoder.isConfigSupported({
						codec: c,
						width: 1920,
						height: 1080,
						bitrate: 6_000_000,
						framerate: 24,
						hardwareAcceleration: 'prefer-hardware',
					});
					if (res?.supported && mcEncPowerEfficient !== false) {
						codecCapabilities[codecKey].encHw = true;
						break;
					}
				} catch {}
			}
			for (const c of entry.codecs) {
				try {
					const res = await VideoEncoder.isConfigSupported({
						codec: c,
						width: 1920,
						height: 1080,
						bitrate: 6_000_000,
						framerate: 24,
						hardwareAcceleration: 'prefer-software',
					});
					if (res?.supported) {
						codecCapabilities[codecKey].encSw = true;
						break;
					}
				} catch {}
			}
			for (const c of entry.codecs) {
				try {
					const res = await VideoDecoder.isConfigSupported({
						codec: c,
						codedWidth: 1920,
						codedHeight: 1080,
						hardwareAcceleration: 'prefer-hardware',
					});
					if (res?.supported && mcDecPowerEfficient !== false) {
						codecCapabilities[codecKey].decHw = true;
						break;
					}
				} catch {}
			}
			for (const c of entry.codecs) {
				try {
					const res = await VideoDecoder.isConfigSupported({
						codec: c,
						codedWidth: 1920,
						codedHeight: 1080,
						hardwareAcceleration: 'prefer-software',
					});
					if (res?.supported) {
						codecCapabilities[codecKey].decSw = true;
						break;
					}
				} catch {}
			}
		}

		capabilityProbed = true;
		renderCapabilityBadges();
		updateStatusHint();
	}

	function renderCapabilityBadges() {
		codecSegBtns.forEach((btn) => {
			const cKey = btn.getAttribute('data-codec');
			if (!cKey || !codecCapabilities[cKey]) return;
			const cap = codecCapabilities[cKey];
			btn.querySelector('.codec-badge-dot')?.remove();

			const baseTitle = btn.getAttribute('data-base-title') ?? btn.getAttribute('title') ?? '';
			if (!btn.hasAttribute('data-base-title') && baseTitle) {
				btn.setAttribute('data-base-title', baseTitle);
			}

			const dot = document.createElement('span');
			dot.className = 'codec-badge-dot';
			let statusDesc = '';
			if (cap.encHw && cap.decHw) {
				dot.classList.add('hw');
				statusDesc = 'Full HW: Hardware ASIC Encode + Decode supported';
			} else if (cap.decHw) {
				dot.classList.add('hw-dec');
				statusDesc = 'Decode-only HW: Hardware Decode (NVDEC/VDU); Encode via CPU/SW';
			} else if (cap.encSw || cap.decSw) {
				dot.classList.add('sw');
				statusDesc = 'Software Only: CPU/WASM fallback (No hardware ASIC detected)';
			} else {
				dot.classList.add('na');
				statusDesc = 'Unsupported in this browser';
				btn.classList.add('unsupported');
			}
			dot.title = statusDesc;
			btn.setAttribute('title', baseTitle ? `${baseTitle} — ${statusDesc}` : statusDesc);
			btn.appendChild(dot);
		});
	}

	// --- Diff / Heatmap Renderer (downsampled working buffer for fluid 24fps playback) ---
	const diffSrcCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(960, 540) : document.createElement('canvas');
	const diffDecCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(960, 540) : document.createElement('canvas');
	const diffOutCanvas = document.createElement('canvas');

	function renderDiffFrame(
		targetCanvas: HTMLCanvasElement,
		srcSource: ImageBitmap | HTMLCanvasElement | HTMLVideoElement,
		decBitmap: ImageBitmap,
		width: number,
		height: number,
		mode: 'diff' | 'heatmap'
	) {
		// Work at up to 960px wide so CPU loop finishes in <6ms even for 4K masters
		const workW = Math.min(width, 960);
		const workH = Math.max(2, Math.round((workW * height) / Math.max(1, width)));

		if (diffSrcCanvas.width !== workW || diffSrcCanvas.height !== workH) {
			diffSrcCanvas.width = workW;
			diffSrcCanvas.height = workH;
			diffDecCanvas.width = workW;
			diffDecCanvas.height = workH;
			diffOutCanvas.width = workW;
			diffOutCanvas.height = workH;
		}

		const sCtx = diffSrcCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		const dCtx = diffDecCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		const oCtx = diffOutCanvas.getContext('2d');
		const tCtx = targetCanvas.getContext('2d');
		if (!sCtx || !dCtx || !oCtx || !tCtx) return;

		sCtx.drawImage(srcSource as any, 0, 0, workW, workH);
		dCtx.drawImage(decBitmap, 0, 0, workW, workH);

		const sData = sCtx.getImageData(0, 0, workW, workH);
		const dData = dCtx.getImageData(0, 0, workW, workH);
		const outImg = oCtx.createImageData(workW, workH);
		const sPix = sData.data;
		const dPix = dData.data;
		const outPix = outImg.data;
		const len = sPix.length;

		if (mode === 'diff') {
			for (let i = 0; i < len; i += 4) {
				outPix[i] = Math.min(255, Math.abs(sPix[i] - dPix[i]) * 8);
				outPix[i + 1] = Math.min(255, Math.abs(sPix[i + 1] - dPix[i + 1]) * 8);
				outPix[i + 2] = Math.min(255, Math.abs(sPix[i + 2] - dPix[i + 2]) * 8);
				outPix[i + 3] = 255;
			}
		} else {
			for (let i = 0; i < len; i += 4) {
				const dr = sPix[i] - dPix[i];
				const dg = sPix[i + 1] - dPix[i + 1];
				const db = sPix[i + 2] - dPix[i + 2];
				const err = Math.sqrt((dr * dr + dg * dg + db * db) / 3);
				const t = Math.min(1.0, (err * 8) / 255);
				const [cr, cg, cb] = turboColormap(t);
				outPix[i] = cr;
				outPix[i + 1] = cg;
				outPix[i + 2] = cb;
				outPix[i + 3] = 255;
			}
		}
		oCtx.putImageData(outImg, 0, 0);
		tCtx.drawImage(diffOutCanvas, 0, 0, width, height);
	}

	function drawGopSparkline() {
		if (!sparklineCanvas) return;
		const ctx = sparklineCanvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = sparklineCanvas.getBoundingClientRect();
		const w = rect.width || 480;
		const h = rect.height || 16;

		if (sparklineCanvas.width !== Math.round(w * dpr) || sparklineCanvas.height !== Math.round(h * dpr)) {
			sparklineCanvas.width = Math.round(w * dpr);
			sparklineCanvas.height = Math.round(h * dpr);
		}
		ctx.resetTransform();
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		if (sparklineChunks.length === 0 || processedStartFrameLoaded < 0) {
			ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
			ctx.fillRect(0, h - 1, w, 1);
			ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
			ctx.font = '9px ui-monospace, monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('Compressed Bitstream (Click "Start" to transcode)', w / 2, h / 2);
			return;
		}

		ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
		ctx.fillRect(0, h - 1, w, 1);

		const startX = (processedStartFrameLoaded / TOTAL_CLIP_FRAMES) * w;
		const spanWidth = (TEST_WINDOW_FRAMES / TOTAL_CLIP_FRAMES) * w;
		const isWindowAligned = rangeStartFrame === processedStartFrameLoaded;
		ctx.fillStyle = isWindowAligned ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.25)';
		ctx.fillRect(startX, h - 1, spanWidth, 1);

		const n = sparklineChunks.length;
		const maxSize = Math.max(...sparklineChunks.map((c) => c.size), 1);
		const gap = 1.5;
		const barW = Math.max(2, (spanWidth - (n - 1) * gap) / n);
		const sliderGlobalFrame = rangeStartFrame + currentFrameIdx;

		for (let i = 0; i < n; i++) {
			const chunk = sparklineChunks[i];
			const barH = Math.max(3, (chunk.size / maxSize) * (h - 4));
			const bx = startX + i * (barW + gap);
			const by = h - barH - 1;

			const barGlobalFrame = processedStartFrameLoaded + i;
			const isUnderSlider = barGlobalFrame === sliderGlobalFrame;
			const isInsideActiveWindow = barGlobalFrame >= rangeStartFrame && barGlobalFrame < rangeStartFrame + TEST_WINDOW_FRAMES;
			const isKey = chunk.type === 'key';

			if (isKey) {
				ctx.fillStyle = isUnderSlider ? '#ea580c' : isInsideActiveWindow ? '#f97316' : 'rgba(249, 115, 22, 0.45)';
			} else {
				ctx.fillStyle = isUnderSlider ? '#ffffff' : isInsideActiveWindow ? 'rgba(148, 163, 184, 0.65)' : 'rgba(148, 163, 184, 0.35)';
			}
			ctx.fillRect(bx, by, barW, barH);

			if (isUnderSlider) {
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 1.5;
				ctx.strokeRect(bx - 0.5, by - 0.5, barW + 1, barH + 1);
			}
			if (isKey) {
				ctx.fillStyle = isInsideActiveWindow ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)';
				ctx.fillRect(bx, by - 1.5, barW, 1.5);
			}
		}
	}

	async function computeAllQualityMetrics(totalFrames: number, width: number, height: number, runId: number) {
		frameQualityMetrics = [];
		let sumPsnr = 0;
		let sumSsim = 0;
		let validFrames = 0;

		const sampleW = Math.min(width, 640);
		const sampleH = Math.max(8, Math.round((sampleW * height) / Math.max(1, width)));
		const sCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(sampleW, sampleH) : document.createElement('canvas');
		sCanvas.width = sampleW;
		sCanvas.height = sampleH;
		const sCtx = sCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

		const dCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(sampleW, sampleH) : document.createElement('canvas');
		dCanvas.width = sampleW;
		dCanvas.height = sampleH;
		const dCtx = dCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		if (!sCtx || !dCtx) return;

		for (let i = 0; i < totalFrames; i++) {
			if (runId !== activeRunId || codecModal?.classList.contains('hidden')) return;
			if (!decodedBitmaps[i]) continue;

			if (selectedScene === 'smpte') {
				drawSmpteScene(sCtx, sampleW, sampleH, rangeStartFrame + i, 60);
			} else if (sourceBitmaps[i]) {
				sCtx.drawImage(sourceBitmaps[i], 0, 0, sampleW, sampleH);
			} else {
				continue;
			}

			dCtx.drawImage(decodedBitmaps[i], 0, 0, sampleW, sampleH);
			const sData = sCtx.getImageData(0, 0, sampleW, sampleH);
			const dData = dCtx.getImageData(0, 0, sampleW, sampleH);

			const metric = computePsnrAndSsim(sData, dData);
			frameQualityMetrics[i] = metric;
			sumPsnr += metric.psnr;
			sumSsim += metric.ssim;
			validFrames++;

			// Yield periodically to keep timeline & playback responsive
			if (i % 4 === 3) {
				await new Promise((r) => window.setTimeout(r, 0));
			}
		}

		if (runId !== activeRunId) return;
		if (validFrames > 0) {
			avgPsnr = Math.round((sumPsnr / validFrames) * 10) / 10;
			avgSsim = Math.round((sumSsim / validFrames) * 1000) / 1000;
			if (metricQuality) {
				metricQuality.innerHTML = `${avgPsnr.toFixed(1)} <span class="webgpu-tile-sub">dB (${avgSsim.toFixed(3)} SSIM)</span>`;
				metricQuality.title = formatQualityTooltip(avgPsnr, avgSsim, `Average across ${validFrames} frames`);
			}
			syncTimelineUI(currentFrameIdx);
		}
	}

	function handleCustomClipFile(file: File) {
		if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
			if (statusText) {
				statusText.textContent = 'Unsupported file format. Please drop an MP4, WebM, or MOV video file.';
				statusText.style.color = '#f97316';
			}
			return;
		}

		if (customVideoUrl) {
			try { URL.revokeObjectURL(customVideoUrl); } catch {}
		}

		customVideoUrl = URL.createObjectURL(file);
		customFileName = file.name;
		selectedScene = 'custom';
		updateFooterSourceInfo();
		sceneSegBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-scene') === 'custom'));

		sourceBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		sourceBitmaps = [];
		sourceSceneLoaded = '';
		sourceStartFrameLoaded = -1;
		decodedBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		decodedBitmaps = [];
		decodedSceneLoaded = '';
		decodedStartFrameLoaded = -1;
		processedStartFrameLoaded = -1;
		sparklineChunks = [];
		frameQualityMetrics = [];
		avgPsnr = 0;
		avgSsim = 0;
		drawGopSparkline();

		if (srcVideo) {
			srcVideo.classList.remove('hidden');
			srcVideo.src = customVideoUrl;
			srcVideo.load();
		}
		srcCanvas?.classList.add('hidden');
		if (decCanvas) {
			decCanvas.removeAttribute('data-has-frame');
			const dCtx = decCanvas.getContext('2d');
			dCtx?.clearRect(0, 0, decCanvas.width, decCanvas.height);
		}
		if (decPlaceholder) {
			decPlaceholder.style.display = 'flex';
			const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
			decPlaceholder.innerHTML = `<span>Loaded local clip: <strong>${escapeHtml(customFileName)}</strong> (${sizeMb} MB). Click &ldquo;Start&rdquo; to test.</span>`;
		}
		if (statusText) {
			statusText.textContent = `Custom clip loaded: ${customFileName} (Zero egress in memory). Click "Start" to test.`;
			statusText.style.color = '#22c55e';
		}
		syncTimelineUI(0);
	}

	function attachDropzone(wrap: HTMLElement) {
		wrap.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			wrap.classList.add('drag-over');
		});
		wrap.addEventListener('dragleave', (e) => {
			e.preventDefault();
			e.stopPropagation();
			wrap.classList.remove('drag-over');
		});
		wrap.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			wrap.classList.remove('drag-over');
			if (e.dataTransfer?.files?.[0]) handleCustomClipFile(e.dataTransfer.files[0]);
		});
	}
	if (wrapSrc) attachDropzone(wrapSrc);
	if (wrapDec) attachDropzone(wrapDec);

	customFileInput?.addEventListener('change', () => {
		if (customFileInput.files?.[0]) {
			handleCustomClipFile(customFileInput.files[0]);
		}
	});

	viewModeBtns.forEach((btn) => {
		btn.onclick = () => {
			const mode = (btn.getAttribute('data-view') as 'normal' | 'diff' | 'heatmap') || 'normal';
			currentViewMode = mode;
			viewModeBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === mode));
			updateLoupePills();
			syncTimelineUI(currentFrameIdx);
		};
	});

	if (sparklineCanvas) {
		sparklineCanvas.addEventListener('mousemove', (e) => {
			if (sparklineChunks.length === 0 || processedStartFrameLoaded < 0) return;
			const rect = sparklineCanvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const w = rect.width;
			const startX = (processedStartFrameLoaded / TOTAL_CLIP_FRAMES) * w;
			const spanWidth = (TEST_WINDOW_FRAMES / TOTAL_CLIP_FRAMES) * w;

			if (mx < startX || mx > startX + spanWidth) {
				sparklineTooltip?.classList.add('hidden');
				return;
			}
			const n = sparklineChunks.length;
			const gap = 1.5;
			const barW = Math.max(2, (spanWidth - (n - 1) * gap) / n);
			const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - startX) / (barW + gap))));
			const chunk = sparklineChunks[idx];
			if (sparklineTooltip && chunk) {
				sparklineTooltip.classList.remove('hidden');
				const kb = (chunk.size / 1024).toFixed(1);
				const qStr = frameQualityMetrics[idx] ? ` · ${frameQualityMetrics[idx].psnr.toFixed(1)} dB` : '';
				sparklineTooltip.textContent = `Frame ${processedStartFrameLoaded + idx + 1}: ${kb} KB (${chunk.type === 'key' ? 'I-Frame Key' : 'P-Frame'})${qStr}`;
				sparklineTooltip.style.left = `${Math.max(40, Math.min(rect.width - 40, mx))}px`;
			}
		});
		sparklineCanvas.addEventListener('mouseleave', () => sparklineTooltip?.classList.add('hidden'));
		sparklineCanvas.addEventListener('click', (e) => {
			if (sparklineChunks.length === 0 || processedStartFrameLoaded < 0) return;
			const rect = sparklineCanvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const w = rect.width;
			const startX = (processedStartFrameLoaded / TOTAL_CLIP_FRAMES) * w;
			const spanWidth = (TEST_WINDOW_FRAMES / TOTAL_CLIP_FRAMES) * w;
			if (mx >= startX && mx <= startX + spanWidth) {
				const n = sparklineChunks.length;
				const gap = 1.5;
				const barW = Math.max(2, (spanWidth - (n - 1) * gap) / n);
				const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - startX) / (barW + gap))));
				if (rangeStartFrame !== processedStartFrameLoaded) setRangeStartFrame(processedStartFrameLoaded, idx);
				else seekToFrame(idx);
			}
		});
	}

	function closeCodecModal() {
		if (!codecModal || codecModal.classList.contains('hidden')) return;
		activeRunId++;
		stopPlayback();
		if (wheelDecayTimer !== null) {
			window.clearTimeout(wheelDecayTimer);
			wheelDecayTimer = null;
		}
		wheelAccumulator = 0;
		isScrubbingPlayhead = false;
		isDraggingRange = false;
		playhead?.classList.remove('is-dragging');
		rangeWindow?.classList.remove('is-dragging');
		trackBar?.classList.remove('is-dragging');
		srcVideo?.pause();

		sourceBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		sourceBitmaps = [];
		sourceSceneLoaded = '';
		sourceStartFrameLoaded = -1;
		decodedBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		decodedBitmaps = [];
		decodedSceneLoaded = '';
		decodedStartFrameLoaded = -1;
		processedStartFrameLoaded = -1;

		if (customVideoUrl) {
			try { URL.revokeObjectURL(customVideoUrl); } catch {}
			customVideoUrl = null;
			customFileName = '';
			if (selectedScene === 'custom') {
				selectedScene = '1080p';
				sceneSegBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-scene') === '1080p'));
			}
		}
		clearVideoBlobCache();
		if (srcVideo && srcVideo.src.startsWith('blob:')) {
			srcVideo.removeAttribute('src');
			loadVideoForScene(selectedScene === '4k' ? '4k' : '1080p', false);
		}

		sparklineChunks = [];
		frameQualityMetrics = [];
		avgPsnr = 0;
		avgSsim = 0;
		sparklineTooltip?.classList.add('hidden');
		if (document.fullscreenElement) {
			try {
				if (document.exitFullscreen) document.exitFullscreen();
				else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
			} catch {}
		}

		codecModal.classList.remove('is-maximized');
		closeModalFocus(codecModal);
		codecModal.classList.add('hidden');
		updateMaximizeUi(false);
		document.documentElement.style.overflow = '';
		forceHideLoupe();
		window.__popModalHistory?.('codec-modal');
	}

	function setRangeStartFrame(newStart: number, targetRelFrame?: number) {
		stopPlayback();
		rangeStartFrame = Math.max(0, Math.min(MAX_START_FRAME, newStart));
		if (rangeWindow) {
			rangeWindow.style.left = `${(rangeStartFrame / TOTAL_CLIP_FRAMES) * 100}%`;
		}
		const sFrame = rangeStartFrame + 1;
		const eFrame = rangeStartFrame + TEST_WINDOW_FRAMES;
		if (rangeBadgeText) rangeBadgeText.textContent = `Frames ${sFrame}\u2013${eFrame}`;

		const nextRel = targetRelFrame !== undefined ? targetRelFrame : currentFrameIdx;
		const targetFrame = Number.isNaN(nextRel) ? 0 : Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, nextRel));
		syncTimelineUI(targetFrame);

		if (statusText) {
			if (decodedStartFrameLoaded >= 0 && (rangeStartFrame !== decodedStartFrameLoaded || selectedScene !== decodedSceneLoaded)) {
				statusText.textContent = `Selected Frames ${sFrame} \u2013 ${eFrame} (24 frames). Click "Start" to transcode new range.`;
			} else if (decodedStartFrameLoaded < 0) {
				statusText.textContent = `Selected Frames ${sFrame} \u2013 ${eFrame} (24 frames). Click "Start" to test.`;
			}
			statusText.style.color = '';
		}
	}

	function syncTimelineUI(relFrameIdx: number) {
		currentFrameIdx = Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, relFrameIdx));
		const globalFrame = rangeStartFrame + currentFrameIdx;

		const cachedDecIdx =
			selectedScene === decodedSceneLoaded && decodedStartFrameLoaded >= 0
				? globalFrame - decodedStartFrameLoaded
				: -1;
		const hasCachedDecoded = cachedDecIdx >= 0 && cachedDecIdx < TEST_WINDOW_FRAMES && !!decodedBitmaps[cachedDecIdx];
		const curQ = hasCachedDecoded ? frameQualityMetrics[cachedDecIdx] : null;
		const isPendingRange = decodedStartFrameLoaded >= 0 && !hasCachedDecoded;

		if (frameReadout) {
			frameReadout.textContent = `Frame ${currentFrameIdx + 1} / ${TEST_WINDOW_FRAMES}`;
			frameReadout.title = curQ
				? `Frame ${currentFrameIdx + 1}: ${curQ.psnr.toFixed(1)} dB PSNR · ${curQ.ssim.toFixed(3)} SSIM`
				: '';
		}

		if (isPendingRange) {
			if (metricEncFps) metricEncFps.innerHTML = '-- <span class="webgpu-tile-sub">FPS (Pending)</span>';
			if (metricDecFps) metricDecFps.innerHTML = '-- <span class="webgpu-tile-sub">FPS (Pending)</span>';
		}

		if (metricQuality) {
			if (curQ && avgPsnr > 0) {
				metricQuality.innerHTML = `${avgPsnr.toFixed(1)} <span class="webgpu-tile-sub">dB (F${currentFrameIdx + 1}: ${curQ.psnr.toFixed(1)} dB)</span>`;
				metricQuality.title = formatQualityTooltip(curQ.psnr, curQ.ssim, `Frame ${currentFrameIdx + 1} (${globalFrame + 1})`);
			} else if (isPendingRange) {
				metricQuality.innerHTML = '-- <span class="webgpu-tile-sub">(Pending transcode)</span>';
				metricQuality.title = 'Selected range has not been transcoded yet. Click "Start" to test.';
			}
		}

		if (playhead) playhead.style.left = `${(globalFrame / TOTAL_CLIP_FRAMES) * 100}%`;
		drawGopSparkline();

		const cachedSrcIdx =
			selectedScene === sourceSceneLoaded && sourceStartFrameLoaded >= 0
				? globalFrame - sourceStartFrameLoaded
				: -1;
		const hasCachedSource = cachedSrcIdx >= 0 && cachedSrcIdx < TEST_WINDOW_FRAMES && !!sourceBitmaps[cachedSrcIdx];

		if (selectedScene === 'smpte') {
			srcVideo?.classList.add('hidden');
			if (srcCanvas) {
				srcCanvas.classList.remove('hidden');
				const ctx = srcCanvas.getContext('2d');
				if (ctx) drawSmpteScene(ctx, srcCanvas.width, srcCanvas.height, globalFrame, 60);
			}
		} else if (hasCachedSource && srcCanvas) {
			if (srcVideo && !srcVideo.classList.contains('hidden')) srcVideo.classList.add('hidden');
			srcCanvas.classList.remove('hidden');
			const ctx = srcCanvas.getContext('2d');
			ctx?.drawImage(sourceBitmaps[cachedSrcIdx], 0, 0, srcCanvas.width, srcCanvas.height);
		} else if (srcVideo) {
			if (srcCanvas && !srcCanvas.classList.contains('hidden')) srcCanvas.classList.add('hidden');
			srcVideo.classList.remove('hidden');
			srcVideo.currentTime = (globalFrame + 0.5) / 24;
		}

		if (hasCachedDecoded && decCanvas) {
			const ctx = decCanvas.getContext('2d');
			if (ctx) {
				if (currentViewMode === 'normal') {
					ctx.drawImage(decodedBitmaps[cachedDecIdx], 0, 0, decCanvas.width, decCanvas.height);
				} else {
					const srcImg =
						selectedScene === 'smpte'
							? srcCanvas!
							: hasCachedSource
								? sourceBitmaps[cachedSrcIdx]
								: srcCanvas || srcVideo!;
					renderDiffFrame(decCanvas, srcImg, decodedBitmaps[cachedDecIdx], decCanvas.width, decCanvas.height, currentViewMode);
				}
				decCanvas.setAttribute('data-has-frame', 'true');
				if (decPlaceholder) decPlaceholder.style.display = 'none';
			}
		} else if (decCanvas) {
			decCanvas.removeAttribute('data-has-frame');
			const ctx = decCanvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = '#000000';
				ctx.fillRect(0, 0, decCanvas.width, decCanvas.height);
			}
			if (decPlaceholder) {
				decPlaceholder.style.display = 'flex';
				if (decodedBitmaps.length > 0 && decodedStartFrameLoaded >= 0) {
					decPlaceholder.innerHTML = `<span>Frame ${globalFrame + 1} outside transcode range (Frames ${decodedStartFrameLoaded + 1}&ndash;${decodedStartFrameLoaded + TEST_WINDOW_FRAMES}). Click &ldquo;Start&rdquo; to test.</span>`;
				} else {
					decPlaceholder.innerHTML = '<span>Awaiting verification run... Click &ldquo;Start&rdquo; to test.</span>';
				}
			}
		}

		if (lastNormX !== null && lastNormY !== null && (isLoupePinned || isPointerOver)) {
			updateLoupe(isLoupePinned ? pinnedNormX : lastNormX, isLoupePinned ? pinnedNormY : lastNormY);
		}
	}

	function seekToFrame(relFrameIdx: number) {
		currentFrameIdx = Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, relFrameIdx));
		syncTimelineUI(currentFrameIdx);
	}

	function startPlayback(loopPlayback = false) {
		if (isPlaying) return;
		if (currentFrameIdx >= TEST_WINDOW_FRAMES - 1) {
			currentFrameIdx = 0;
			syncTimelineUI(0);
		}
		isPlaying = true;
		iconPlay?.classList.add('hidden');
		iconPause?.classList.remove('hidden');

		const isCanvasReady =
			selectedScene === 'smpte' ||
			(!!srcCanvas && !srcCanvas.classList.contains('hidden') && sourceBitmaps.length === TEST_WINDOW_FRAMES);

		if (isCanvasReady) {
			let lastTime = 0;
			const loop = (now: number) => {
				if (!isPlaying) return;
				if (!lastTime) {
					lastTime = now;
				} else if (now - lastTime >= 41.667) {
					lastTime = now - ((now - lastTime) % 41.667);
					if (currentFrameIdx >= TEST_WINDOW_FRAMES - 1) {
						if (loopPlayback) {
							currentFrameIdx = 0;
							syncTimelineUI(0);
						} else {
							currentFrameIdx = TEST_WINDOW_FRAMES - 1;
							syncTimelineUI(TEST_WINDOW_FRAMES - 1);
							stopPlayback();
							return;
						}
					} else {
						currentFrameIdx++;
						syncTimelineUI(currentFrameIdx);
					}
				}
				playbackRaf = requestAnimationFrame(loop);
			};
			playbackRaf = requestAnimationFrame(loop);
		} else if (srcVideo) {
			const startTime = rangeStartFrame / 24;
			const endTime = (rangeStartFrame + TEST_WINDOW_FRAMES) / 24;
			if (srcVideo.currentTime >= endTime - 0.05 || srcVideo.currentTime < startTime - 0.05) {
				srcVideo.currentTime = startTime;
			}
			const onVideoFrame = () => {
				if (!isPlaying || !srcVideo || srcVideo.paused) return;
				const curTime = srcVideo.currentTime;
				const relIdx = Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, Math.round((curTime - startTime) * 24)));
				syncTimelineUI(relIdx);
				if (curTime >= endTime - 0.04) {
					if (loopPlayback) {
						srcVideo.currentTime = startTime;
						syncTimelineUI(0);
					} else {
						syncTimelineUI(TEST_WINDOW_FRAMES - 1);
						stopPlayback();
						return;
					}
				}
				if ('requestVideoFrameCallback' in srcVideo) {
					(srcVideo as any).requestVideoFrameCallback(onVideoFrame);
				} else {
					playbackRaf = requestAnimationFrame(onVideoFrame);
				}
			};
			if ('requestVideoFrameCallback' in srcVideo) {
				(srcVideo as any).requestVideoFrameCallback(onVideoFrame);
			} else {
				playbackRaf = requestAnimationFrame(onVideoFrame);
			}
			srcVideo.play().catch(() => stopPlayback());
		}
	}

	function stopPlayback() {
		isPlaying = false;
		isRunning = false;
		if (playbackRaf !== null) {
			cancelAnimationFrame(playbackRaf);
			playbackRaf = null;
		}
		if (srcVideo && !srcVideo.paused) srcVideo.pause();
		iconPlay?.classList.remove('hidden');
		iconPause?.classList.add('hidden');
	}

	function togglePlayback() {
		if (isPlaying) stopPlayback();
		else startPlayback(false);
	}

	playBtn?.addEventListener('click', togglePlayback);
	prevFrameBtn?.addEventListener('click', () => {
		stopPlayback();
		seekToFrame(currentFrameIdx - 1);
	});
	nextFrameBtn?.addEventListener('click', () => {
		stopPlayback();
		seekToFrame(currentFrameIdx + 1);
	});

	let isScrubbingPlayhead = false;
	let isDraggingRange = false;
	let dragStartX = 0;
	let dragStartFrame = 0;
	let activeDragTarget: HTMLElement | null = null;

	function getFrameFromClientX(clientX: number): { relFrame: number; frameInMaster: number } {
		if (!trackBar) return { relFrame: 0, frameInMaster: 0 };
		const rect = trackBar.getBoundingClientRect();
		if (!rect.width) return { relFrame: 0, frameInMaster: 0 };
		const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const frameInMaster = norm * TOTAL_CLIP_FRAMES;
		const relFrame = Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, Math.round(frameInMaster - rangeStartFrame)));
		return { relFrame, frameInMaster };
	}

	if (playhead && trackBar) {
		playhead.addEventListener('pointerdown', (e: PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			isScrubbingPlayhead = true;
			isDraggingRange = false;
			stopPlayback();
			playhead.classList.add('is-dragging');
			activeDragTarget = playhead;
			try { playhead.setPointerCapture(e.pointerId); } catch {}
			seekToFrame(getFrameFromClientX(e.clientX).relFrame);
		});
	}

	if (rangeWindow && trackBar) {
		rangeWindow.addEventListener('pointerdown', (e) => {
			if ((e.target as HTMLElement).closest('#codec-playhead')) return;
			e.stopPropagation();
			e.preventDefault();
			isDraggingRange = true;
			isScrubbingPlayhead = false;
			stopPlayback();
			dragStartX = e.clientX;
			dragStartFrame = rangeStartFrame;
			rangeWindow.classList.add('is-dragging');
			activeDragTarget = rangeWindow;
			try { rangeWindow.setPointerCapture(e.pointerId); } catch {}
		});

		trackBar.addEventListener('pointerdown', (e) => {
			if ((e.target as HTMLElement).closest('#codec-playhead, #codec-range-window')) return;
			e.preventDefault();
			const rect = trackBar.getBoundingClientRect();
			if (!rect.width) return;
			const clickFrame = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * TOTAL_CLIP_FRAMES;
			const newStart = Math.max(0, Math.min(MAX_START_FRAME, Math.round(clickFrame - TEST_WINDOW_FRAMES / 2)));
			const relFrame = Math.max(0, Math.min(TEST_WINDOW_FRAMES - 1, Math.round(clickFrame - newStart)));
			setRangeStartFrame(newStart, relFrame);

			isDraggingRange = true;
			isScrubbingPlayhead = false;
			dragStartX = e.clientX;
			dragStartFrame = newStart;
			trackBar.classList.add('is-dragging');
			activeDragTarget = trackBar;
			try { trackBar.setPointerCapture(e.pointerId); } catch {}
		});
	}

	window.addEventListener('pointermove', (e) => {
		if (isScrubbingPlayhead) {
			seekToFrame(getFrameFromClientX(e.clientX).relFrame);
		} else if (isDraggingRange && trackBar) {
			const rect = trackBar.getBoundingClientRect();
			if (!rect.width) return;
			const dFrames = ((e.clientX - dragStartX) / rect.width) * TOTAL_CLIP_FRAMES;
			const newStart = Math.max(0, Math.min(MAX_START_FRAME, Math.round(dragStartFrame + dFrames)));
			if (newStart !== rangeStartFrame) setRangeStartFrame(newStart);
		}
	});

	const endAllDrags = (e: PointerEvent) => {
		if (isScrubbingPlayhead) {
			isScrubbingPlayhead = false;
			playhead?.classList.remove('is-dragging');
		}
		if (isDraggingRange) {
			isDraggingRange = false;
			rangeWindow?.classList.remove('is-dragging');
			trackBar?.classList.remove('is-dragging');
		}
		if (activeDragTarget) {
			try { activeDragTarget.releasePointerCapture(e.pointerId); } catch {}
			activeDragTarget = null;
		}
	};
	window.addEventListener('pointerup', endAllDrags);
	window.addEventListener('pointercancel', endAllDrags);

	function updateStatusHint() {
		if (isRunning || !statusText) return;
		statusText.style.color = '';

		const ua = navigator.userAgent;
		const isFirefox = /firefox/i.test(ua);
		const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
		const isMobileDevice = isMobileOrTabletDevice();

		if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
			if (isFirefox) {
				statusText.innerHTML = '⚠️ <strong>WebCodecs API</strong> is disabled by default in Firefox. Use Chrome or Edge.';
			} else if (isSafari) {
				statusText.innerHTML = '⚠️ <strong>WebCodecs API</strong> is limited in Safari. Recommended: Chrome or Edge for full ASIC testing.';
			} else {
				statusText.innerHTML = '⚠️ <strong>WebCodecs API</strong> not available in this browser. Use Chrome or Edge.';
			}
			statusText.style.color = '#f97316';
			if (runBtn) runBtn.disabled = true;
			return;
		}

		if (isSafari && (selectedCodec === 'vp9' || selectedCodec === 'av1')) {
			statusText.innerHTML = `⚠️ <strong>${selectedCodec.toUpperCase()}</strong> is not supported by Safari's WebCodecs. Select <strong>H.264</strong> or <strong>HEVC</strong>.`;
			statusText.style.color = '#f97316';
			if (runBtn) runBtn.disabled = true;
			return;
		}

		if (selectedCodec === 'hevc' && selectedMode === 'prefer-software') {
			statusText.innerHTML = '⚠️ <strong>HEVC Software CPU</strong> is unsupported in browser; select <strong>Hardware ASIC</strong>.';
			statusText.style.color = '#f97316';
			if (runBtn) runBtn.disabled = true;
			return;
		}

		if (runBtn) runBtn.disabled = false;

		const pipeName = selectedPipeline === 'loopback' ? 'Both' : selectedPipeline === 'encode' ? 'Encoder' : 'Decoder';
		const engineName = selectedMode === 'prefer-hardware' ? 'Hardware' : 'Software';
		const codecName = selectedCodec === 'avc' ? 'H.264' : selectedCodec.toUpperCase();
		const qualityName = selectedQuality === 'high' ? 'High' : selectedQuality === 'low' ? 'Low' : 'Med';
		const mobileTag = isMobileDevice && selectedScene === '4k' ? ' (4K Mobile Profile)' : '';
		const sceneTag = selectedScene === 'custom' ? ` ▪ Custom (${customFileName || 'Local'})` : '';

		statusText.textContent = `Ready: ${pipeName} ▪ ${codecName} ▪ ${engineName} ▪ ${qualityName} Quality${mobileTag}${sceneTag}. Click "Start" to test.`;

		if (capabilityProbed) {
			const cap = codecCapabilities[selectedCodec];
			if (cap) {
				if (selectedPipeline !== 'decode' && selectedMode === 'prefer-hardware' && !cap.encHw) {
					statusText.innerHTML = `⚠️ <strong>${codecName} HW Encode</strong> not detected on this GPU. Switch to <strong>Decode</strong> or <strong>Software</strong>.`;
					statusText.style.color = '#f97316';
				} else if (selectedPipeline !== 'encode' && selectedMode === 'prefer-hardware' && !cap.decHw) {
					statusText.innerHTML = `⚠️ <strong>${codecName} HW Decode</strong> not detected on this GPU. Switch Engine to <strong>Software</strong>.`;
					statusText.style.color = '#f97316';
				}
			}
		}
	}

	function setPipeline(mode: 'loopback' | 'encode' | 'decode') {
		stopPlayback();
		selectedPipeline = mode;
		pipelineSegBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-pipeline') === mode));
		if (decPlaceholder && !decCanvas?.getAttribute('data-has-frame')) {
			decPlaceholder.style.display = 'flex';
			decPlaceholder.innerHTML = '<span>Awaiting verification run... Click &ldquo;Start&rdquo; to test.</span>';
		}
		updateStatusHint();
	}

	function updateFooterSourceInfo() {
		const labelEl = document.getElementById('codec-footer-source-label');
		const detailEl = document.getElementById('codec-footer-source-detail');
		if (!labelEl || !detailEl) return;

		if (selectedScene === '1080p') {
			labelEl.textContent = 'Charge (2022)';
			detailEl.innerHTML = '1080p excerpt by Blender Studio (<a href="https://studio.blender.org/films/charge/" target="_blank" rel="noopener noreferrer">Source</a> &middot; <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>)';
		} else if (selectedScene === '4k') {
			labelEl.textContent = 'Chief Morale Officer';
			detailEl.textContent = '3840\u00d72160 UHD Master';
		} else if (selectedScene === 'smpte') {
			labelEl.textContent = 'SMPTE BT.709';
			detailEl.textContent = '1920\u00d71080 Procedural Calibration Pattern';
		} else {
			labelEl.textContent = customFileName || 'Custom Clip';
			detailEl.textContent = 'Local file (100% client-side)';
		}
	}

	function setScene(scene: '4k' | '1080p' | 'smpte' | 'custom') {
		stopPlayback();
		selectedScene = scene;
		updateFooterSourceInfo();
		sceneSegBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-scene') === scene));

		sourceBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		sourceBitmaps = [];
		sourceSceneLoaded = '';
		sourceStartFrameLoaded = -1;
		decodedBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		decodedBitmaps = [];
		decodedSceneLoaded = '';
		decodedStartFrameLoaded = -1;
		processedStartFrameLoaded = -1;
		sparklineChunks = [];
		frameQualityMetrics = [];
		avgPsnr = 0;
		avgSsim = 0;
		drawGopSparkline();
		if (metricQuality) metricQuality.innerHTML = '-- <span class="webgpu-tile-sub">dB</span>';

		if (decCanvas) {
			decCanvas.removeAttribute('data-has-frame');
			decCanvas.getContext('2d')?.clearRect(0, 0, decCanvas.width, decCanvas.height);
		}
		if (decPlaceholder) {
			decPlaceholder.style.display = 'flex';
			decPlaceholder.innerHTML = '<span>Awaiting verification run... Click &ldquo;Start&rdquo; to test.</span>';
		}

		if (metricEncFps) metricEncFps.innerHTML = '-- <span class="webgpu-tile-sub">FPS</span>';
		if (metricDecFps) metricDecFps.innerHTML = '-- <span class="webgpu-tile-sub">FPS</span>';
		if (metricRatio) {
			metricRatio.innerHTML = '-- &rarr; --';
			metricRatio.title = '';
		}

		const isMobileDevice = isMobileOrTabletDevice();
		const targetW = isMobileDevice && scene === '4k' ? 1920 : scene === '4k' ? 3840 : 1920;
		const targetH = isMobileDevice && scene === '4k' ? 1080 : scene === '4k' ? 2160 : 1080;
		if (decCanvas) {
			decCanvas.width = targetW;
			decCanvas.height = targetH;
		}
		if (srcCanvas) {
			srcCanvas.width = targetW;
			srcCanvas.height = targetH;
		}
		currentFrameIdx = 0;

		if (scene === 'smpte') {
			if (srcVideo) {
				srcVideo.pause();
				srcVideo.classList.add('hidden');
			}
			if (srcCanvas) {
				srcCanvas.classList.remove('hidden');
				const ctx = srcCanvas.getContext('2d');
				if (ctx) drawSmpteScene(ctx, srcCanvas.width, srcCanvas.height, rangeStartFrame, 60);
			}
			syncTimelineUI(0);
		} else if (scene === 'custom') {
			srcCanvas?.classList.add('hidden');
			if (srcVideo && customVideoUrl) {
				srcVideo.classList.remove('hidden');
				srcVideo.src = customVideoUrl;
				srcVideo.load();
				if (srcVideo.readyState >= 1) srcVideo.currentTime = (rangeStartFrame + 0.5) / 24;
			}
			syncTimelineUI(0);
		} else {
			srcCanvas?.classList.add('hidden');
			if (srcVideo) {
				srcVideo.classList.remove('hidden');
				loadVideoForScene(scene);
				if (srcVideo.readyState >= 1) srcVideo.currentTime = (rangeStartFrame + 0.5) / 24;
			}
			syncTimelineUI(0);
		}
		updateStatusHint();
	}

	function openCodecModal(defaultPipeline?: 'loopback' | 'encode' | 'decode') {
		if (srcVideo) {
			srcVideo.preload = 'auto';
			if (srcVideo.readyState === 0) srcVideo.load();
		}
		if (defaultPipeline) setPipeline(defaultPipeline);
		codecModal?.classList.remove('hidden');
		openModalFocus(codecModal, runBtn || codecCloseBtn);
		document.documentElement.style.overflow = 'hidden';
		setScene(selectedScene);
		probeCodecCapabilities();
		updateStatusHint();
		updateLoupePills();
		window.__pushModalHistory?.('codec-modal', closeCodecModal);
	}

	codecCloseBtn?.addEventListener('click', closeCodecModal);
	codecBackdrop?.addEventListener('click', closeCodecModal);

	openDecoderBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		options.onBeforeOpen?.();
		openCodecModal('decode');
	});
	itemDecoder?.addEventListener('click', (e) => {
		if ((e.target as HTMLElement)?.closest('button')) return;
		options.onBeforeOpen?.();
		openCodecModal('decode');
	});

	openEncoderBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		options.onBeforeOpen?.();
		openCodecModal('encode');
	});
	itemEncoder?.addEventListener('click', (e) => {
		if ((e.target as HTMLElement)?.closest('button')) return;
		options.onBeforeOpen?.();
		openCodecModal('encode');
	});

	pipelineSegBtns.forEach((btn) => {
		btn.onclick = () => {
			if (isRunning) return;
			setPipeline((btn.getAttribute('data-pipeline') as 'loopback' | 'encode' | 'decode') || 'loopback');
		};
	});

	codecSegBtns.forEach((btn) => {
		btn.onclick = () => {
			if (isRunning) return;
			codecSegBtns.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');
			selectedCodec = (btn.getAttribute('data-codec') as 'avc' | 'vp9' | 'av1' | 'hevc') || 'avc';
			updateStatusHint();
		};
	});

	engineSegBtns.forEach((btn) => {
		btn.onclick = () => {
			if (isRunning) return;
			engineSegBtns.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');
			selectedMode = (btn.getAttribute('data-mode') as 'prefer-hardware' | 'prefer-software') || 'prefer-hardware';
			updateStatusHint();
			updateLoupePills();
		};
	});

	qualitySegBtns.forEach((btn) => {
		btn.onclick = () => {
			if (isRunning) return;
			qualitySegBtns.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');
			selectedQuality = (btn.getAttribute('data-quality') as 'high' | 'med' | 'low') || 'med';
			updateStatusHint();
		};
	});

	sceneSegBtns.forEach((btn) => {
		btn.onclick = () => {
			if (isRunning) return;
			const s = (btn.getAttribute('data-scene') as '4k' | '1080p' | 'smpte' | 'custom') || '1080p';
			if (s === 'custom') {
				// Always reset file input so selecting the same or a new custom clip fires change cleanly
				if (customFileInput) {
					customFileInput.value = '';
					customFileInput.click();
				}
			} else {
				setScene(s);
			}
		};
	});

	// --- Unified WebCodecs Encode / Decode Helper ---
	async function encodeFrames(
		width: number,
		height: number,
		fps: number,
		totalFrames: number,
		frameIntervalUs: number,
		chosenCodec: string,
		bitrate: number,
		latencyMode: 'quality' | 'realtime',
		bitrateMode: 'variable' | 'constant',
		hwMode: 'prefer-hardware' | 'prefer-software',
		frames: ImageBitmap[]
	) {
		const encodedChunks: EncodedVideoChunk[] = [];
		let decoderConfig: VideoDecoderConfig | null = null;
		let totalChunkBytes = 0;
		let encError: Error | null = null;

		const encoder = new VideoEncoder({
			output: (chunk, metadata) => {
				totalChunkBytes += chunk.byteLength;
				encodedChunks.push(chunk);
				sparklineChunks.push({
					type: chunk.type,
					size: chunk.byteLength,
					timestamp: chunk.timestamp,
				});
				if (metadata?.decoderConfig && !decoderConfig) {
					decoderConfig = metadata.decoderConfig;
				}
			},
			error: (err) => {
				encError = err instanceof Error ? err : new Error(String(err));
			},
		});

		encoder.configure({
			codec: chosenCodec,
			width,
			height,
			bitrate,
			framerate: fps,
			latencyMode,
			bitrateMode,
			hardwareAcceleration: hwMode,
		});

		const encStartTime = performance.now();
		if (selectedScene === 'smpte') {
			const offCanvas =
				typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
			offCanvas.width = width;
			offCanvas.height = height;
			const offCtx = offCanvas.getContext('2d')!;
			for (let i = 0; i < totalFrames; i++) {
				if (encError) break;
				drawSmpteScene(offCtx, width, height, rangeStartFrame + i, 60);
				const frame = new VideoFrame(offCanvas, {
					timestamp: i * frameIntervalUs,
					duration: frameIntervalUs,
				});
				try {
					encoder.encode(frame, { keyFrame: i === 0 });
				} finally {
					frame.close();
				}
			}
		} else {
			for (let i = 0; i < totalFrames; i++) {
				if (encError) break;
				const frame = new VideoFrame(frames[i], {
					timestamp: i * frameIntervalUs,
					duration: frameIntervalUs,
				});
				try {
					encoder.encode(frame, { keyFrame: i === 0 });
				} finally {
					frame.close();
				}
			}
		}

		await encoder.flush();
		const encEndTime = performance.now();
		encoder.close();
		if (encError) throw encError;

		return {
			encodedChunks,
			decoderConfig,
			totalChunkBytes,
			encDuration: Math.max(1, encEndTime - encStartTime),
		};
	}

	async function decodeChunks(
		width: number,
		height: number,
		totalFrames: number,
		frameIntervalUs: number,
		chosenCodec: string,
		hwMode: 'prefer-hardware' | 'prefer-software',
		encodedChunks: EncodedVideoChunk[],
		decoderConfig: VideoDecoderConfig | null
	) {
		decodedBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		decodedBitmaps = new Array(totalFrames);

		const decOffCanvas =
			typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
		decOffCanvas.width = width;
		decOffCanvas.height = height;
		const decOffCtx = decOffCanvas.getContext('2d');
		const decBmpPromises: Promise<void>[] = [];
		let decError: Error | null = null;

		const decoder = new VideoDecoder({
			output: (videoFrame) => {
				const fIdx = Math.min(totalFrames - 1, Math.max(0, Math.round(videoFrame.timestamp / frameIntervalUs)));
				if ('transferToImageBitmap' in decOffCanvas && decOffCtx) {
					try {
						decOffCtx.drawImage(videoFrame, 0, 0, width, height);
						decodedBitmaps[fIdx] = (decOffCanvas as any).transferToImageBitmap();
					} finally {
						videoFrame.close();
					}
				} else {
					// Keep VideoFrame owned by async createImageBitmap to avoid shared-canvas overwrite race on Safari
					const p = createImageBitmap(videoFrame, { resizeWidth: width, resizeHeight: height })
						.then((bmp) => {
							decodedBitmaps[fIdx] = bmp;
						})
						.catch(() => {})
						.finally(() => {
							try { videoFrame.close(); } catch {}
						});
					decBmpPromises.push(p);
				}
			},
			error: (err) => {
				decError = err instanceof Error ? err : new Error(String(err));
			},
		});

		const decConfig: VideoDecoderConfig = decoderConfig
			? { ...decoderConfig, hardwareAcceleration: hwMode }
			: { codec: chosenCodec, codedWidth: width, codedHeight: height, hardwareAcceleration: hwMode };

		decoder.configure(decConfig);
		const decStartTime = performance.now();
		for (const chunk of encodedChunks) {
			if (decError) break;
			decoder.decode(chunk);
		}
		await decoder.flush();
		if (decBmpPromises.length > 0) await Promise.all(decBmpPromises);
		const decEndTime = performance.now();
		decoder.close();
		if (decError) throw decError;

		// Safely duplicate missing trailing/B-frame gaps via fresh ImageBitmap clone so close() never double-frees
		for (let i = 0; i < totalFrames; i++) {
			if (!decodedBitmaps[i] && i > 0 && decodedBitmaps[i - 1]) {
				try {
					decodedBitmaps[i] = await createImageBitmap(decodedBitmaps[i - 1]);
				} catch {}
			}
		}

		return Math.max(1, decEndTime - decStartTime);
	}

	async function runVerification() {
		if (isRunning) return;
		if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
			if (statusText) {
				statusText.textContent = 'WebCodecs VideoEncoder/Decoder API not available in this browser.';
				statusText.style.color = '#f97316';
			}
			return;
		}

		stopPlayback();
		const runId = ++activeRunId;
		isRunning = true;
		if (runBtn) runBtn.disabled = true;
		const btnLabel = document.getElementById('codec-btn-label');
		if (btnLabel) btnLabel.textContent = 'Testing...';

		decodedBitmaps.forEach((b) => { try { b?.close(); } catch {} });
		decodedBitmaps = [];
		decodedStartFrameLoaded = -1;
		decodedSceneLoaded = '';
		decCanvas?.removeAttribute('data-has-frame');

		try {
			const isMobileDevice = isMobileOrTabletDevice();
			let width = 1920;
			let height = 1080;

			if (selectedScene === 'custom' && srcVideo) {
				await ensureVideoReady();
				const rawW = srcVideo.videoWidth || 1920;
				const rawH = srcVideo.videoHeight || 1080;
				const capW = isMobileDevice ? Math.min(rawW, 1920) : rawW;
				const capH = Math.round((capW * rawH) / Math.max(1, rawW));
				width = Math.max(2, capW & ~1);
				height = Math.max(2, capH & ~1);
			} else if (selectedScene === '4k') {
				width = isMobileDevice ? 1920 : 3840;
				height = isMobileDevice ? 1080 : 2160;
			}

			const isHighRes = width > 1920 || height > 1080;
			const fps = 24;
			const totalFrames = TEST_WINDOW_FRAMES;
			const frameIntervalUs = 41667;

			let codecCandidates = isHighRes
				? ['avc1.640033', 'avc1.4d0033', 'avc1.640034']
				: ['avc1.640028', 'avc1.4d0028', 'avc1.420028'];
			if (selectedCodec === 'vp9') {
				codecCandidates = isHighRes ? ['vp09.00.51.08', 'vp09.00.50.08'] : ['vp09.00.40.08', 'vp09.00.41.08'];
			} else if (selectedCodec === 'av1') {
				codecCandidates = isHighRes ? ['av01.0.12M.08', 'av01.0.13M.08'] : ['av01.0.08M.08', 'av01.0.05M.08'];
			} else if (selectedCodec === 'hevc') {
				codecCandidates = isHighRes
					? ['hvc1.1.6.L150.B0', 'hev1.1.6.L150.B0', 'hvc1.1.6.L153.B0', 'hev1.1.6.L153.B0']
					: ['hvc1.1.6.L120.B0', 'hev1.1.6.L120.B0', 'hvc1.1.6.L93.B0', 'hev1.1.6.L93.B0'];
			}

			let bitrate = isHighRes ? 20_000_000 : 5_000_000;
			let latencyMode: 'quality' | 'realtime' = 'quality';
			let bitrateMode: 'variable' | 'constant' = 'variable';
			if (selectedQuality === 'low') {
				bitrate = isHighRes ? 3_500_000 : 750_000;
				latencyMode = 'realtime';
				bitrateMode = 'constant';
			} else if (selectedQuality === 'high') {
				bitrate = isHighRes ? 50_000_000 : 18_000_000;
				latencyMode = 'quality';
				bitrateMode = 'variable';
			}

			if (!decCanvas) throw new Error('Decoded canvas not found');
			decCanvas.width = width;
			decCanvas.height = height;

			let chosenCodec = codecCandidates[0];
			let encPrepMode: 'prefer-hardware' | 'prefer-software' = selectedMode;

			if (selectedPipeline !== 'decode') {
				let encSupported = false;
				for (const c of codecCandidates) {
					try {
						const res = await VideoEncoder.isConfigSupported({
							codec: c,
							width,
							height,
							bitrate,
							framerate: fps,
							latencyMode,
							bitrateMode,
							hardwareAcceleration: selectedMode,
						});
						if (res?.supported) {
							chosenCodec = c;
							encSupported = true;
							break;
						}
					} catch {}
				}
				if (!encSupported) {
					if (selectedCodec === 'hevc' && selectedMode === 'prefer-software') {
						throw new Error('HEVC Software Fallback is not supported by Chromium due to MPEG licensing (requires Hardware ASIC)');
					}
					const codecLabel = selectedCodec === 'avc' ? 'H.264' : selectedCodec.toUpperCase();
					if (selectedMode === 'prefer-hardware') {
						throw new Error(`${codecLabel} HW Encode is not available on this GPU. Switch to "Decode" or "Software".`);
					}
					throw new Error(`${codecLabel} Encoder not supported with Software Fallback`);
				}
			}

			if (selectedPipeline !== 'encode') {
				let decSupported = false;
				for (const c of codecCandidates) {
					try {
						const res = await VideoDecoder.isConfigSupported({
							codec: c,
							codedWidth: width,
							codedHeight: height,
							hardwareAcceleration: selectedMode,
						});
						if (res?.supported) {
							chosenCodec = c;
							decSupported = true;
							break;
						}
					} catch {}
				}
				if (!decSupported) {
					throw new Error(`${selectedCodec.toUpperCase()} Decoder not supported with ${selectedMode === 'prefer-hardware' ? 'Hardware Acceleration' : 'Software Fallback'}`);
				}

				// In decode-only mode, verify encoder can actually generate the bitstream (falling back to SW prep if HW encode unavailable)
				if (selectedPipeline === 'decode') {
					let canPrepHw = false;
					if (selectedMode === 'prefer-hardware') {
						try {
							const res = await VideoEncoder.isConfigSupported({
								codec: chosenCodec,
								width,
								height,
								bitrate,
								framerate: fps,
								latencyMode,
								bitrateMode,
								hardwareAcceleration: 'prefer-hardware',
							});
							canPrepHw = !!res?.supported;
						} catch {}
					}
					if (!canPrepHw) {
						encPrepMode = 'prefer-software';
						const swRes = await VideoEncoder.isConfigSupported({
							codec: chosenCodec,
							width,
							height,
							bitrate,
							framerate: fps,
							latencyMode,
							bitrateMode,
							hardwareAcceleration: 'prefer-software',
						}).catch(() => null);
						if (!swRes?.supported) {
							throw new Error(`Browser cannot synthesize ${selectedCodec.toUpperCase()} bitstream locally for Decode test.`);
						}
					}
				}
			}

			if (statusText) {
				statusText.textContent = `Extracting ${selectedScene.toUpperCase()} reference frames...`;
				statusText.style.color = '';
			}
			const frames = await ensureSourceFrames(isHighRes, width, height);
			if (!isRunning || runId !== activeRunId) return;

			srcVideo?.classList.add('hidden');
			if (srcCanvas) {
				srcCanvas.classList.remove('hidden');
				srcCanvas.width = width;
				srcCanvas.height = height;
				const ctx = srcCanvas.getContext('2d');
				if (ctx) {
					if (selectedScene === 'smpte') drawSmpteScene(ctx, width, height, rangeStartFrame, 60);
					else if (frames[0]) ctx.drawImage(frames[0], 0, 0, width, height);
				}
			}

			sparklineChunks = [];
			if (statusText) {
				const pipeVerb = selectedPipeline === 'encode' ? 'encoder' : selectedPipeline === 'decode' ? 'decoder' : 'encode & decode';
				statusText.textContent = `Benchmarking ${selectedCodec.toUpperCase()} ${selectedMode === 'prefer-hardware' ? 'hardware ASIC' : 'software CPU'} ${pipeVerb}...`;
				statusText.style.color = '';
			}
			if (selectedPipeline !== 'encode' && decPlaceholder) decPlaceholder.style.display = 'none';

			const encResult = await encodeFrames(
				width,
				height,
				fps,
				totalFrames,
				frameIntervalUs,
				chosenCodec,
				bitrate,
				latencyMode,
				bitrateMode,
				selectedPipeline === 'decode' ? encPrepMode : selectedMode,
				frames
			);
			if (runId !== activeRunId) return;

			let decDuration = 0;
			if (selectedPipeline !== 'encode') {
				decDuration = await decodeChunks(
					width,
					height,
					totalFrames,
					frameIntervalUs,
					chosenCodec,
					selectedMode,
					encResult.encodedChunks,
					encResult.decoderConfig
				);
				if (runId !== activeRunId) return;
				decCanvas.setAttribute('data-has-frame', 'true');
				if (decPlaceholder) decPlaceholder.style.display = 'none';
			} else if (decPlaceholder) {
				decPlaceholder.style.display = 'flex';
				decPlaceholder.innerHTML = '<span>Encoding benchmark complete. Select &ldquo;Both&rdquo; or &ldquo;Decode&rdquo; to view reconstructed frames.</span>';
			}

			const encFps = Math.round(totalFrames / (encResult.encDuration / 1000));
			const encLatency = (encResult.encDuration / totalFrames).toFixed(1);
			const decFps = decDuration ? Math.round(totalFrames / (decDuration / 1000)) : 0;
			const decLatency = decDuration ? (decDuration / totalFrames).toFixed(1) : '0.0';

			const rawBytes = width * height * 1.5 * totalFrames;
			const kbSize = encResult.totalChunkBytes / 1024;
			const mbSize = kbSize / 1024;
			const displaySize = mbSize >= 1.0 ? `${mbSize.toFixed(1)} MB` : `${kbSize.toFixed(0)} KB`;
			const bitrateMbps = ((encResult.totalChunkBytes * 8) / ((totalFrames / fps) * 1_000_000)).toFixed(1);
			const rawMb = Math.round(rawBytes / (1024 * 1024));
			const ratioX = Math.round(rawBytes / Math.max(1, encResult.totalChunkBytes));
			const engineTag = selectedMode === 'prefer-hardware' ? 'ASIC' : 'CPU';

			if (metricEncFps) {
				metricEncFps.innerHTML =
					selectedPipeline === 'decode'
						? `Bypassed <span class="webgpu-tile-sub">(${encPrepMode === 'prefer-hardware' ? 'HW Prep' : 'SW Prep'})</span>`
						: `${encFps.toLocaleString()} <span class="webgpu-tile-sub">FPS (${encLatency} ms · ${engineTag})</span>`;
			}
			if (metricDecFps) {
				metricDecFps.innerHTML =
					selectedPipeline === 'encode'
						? 'Bypassed <span class="webgpu-tile-sub">(Encode Only)</span>'
						: `${decFps.toLocaleString()} <span class="webgpu-tile-sub">FPS (${decLatency} ms · ${engineTag})</span>`;
			}
			if (selectedPipeline === 'encode' && metricQuality) {
				metricQuality.innerHTML = 'Bypassed <span class="webgpu-tile-sub">(Encode Only)</span>';
			}
			if (metricRatio) {
				const inSize = getInputFileSize();
				metricRatio.innerHTML = `${inSize} &rarr; ${displaySize}`;
				metricRatio.title =
					selectedScene === 'smpte'
						? `Input: Procedural vector canvas (24-frame window, 0 KB network download) → Transcoded output: ${displaySize} (${bitrateMbps} Mbps bitstream at 24 fps). Uncompressed 24-frame YUV 4:2:0 raster in RAM: ${rawMb} MB.`
						: `Input clip size: ${inSize} (testing 24-frame window) → Transcoded output: ${displaySize} (${bitrateMbps} Mbps average bitstream at 24 fps). Uncompressed 24-frame YUV 4:2:0 raster: ${rawMb} MB (${ratioX}:1 reduction).`;
			}

			if (statusText) {
				statusText.style.color = '#22c55e';
				if (selectedPipeline === 'encode') {
					statusText.textContent = `✓ Encoded ${totalFrames} frames in ${encResult.encDuration.toFixed(0)}ms ▪ ${encFps.toLocaleString()} FPS (${engineTag}) ▪ ${bitrateMbps} Mbps`;
				} else if (selectedPipeline === 'decode') {
					statusText.textContent = `✓ Decoded ${totalFrames} frames in ${decDuration.toFixed(0)}ms ▪ ${decFps.toLocaleString()} FPS (${engineTag}) ▪ ${bitrateMbps} Mbps`;
				} else {
					statusText.textContent = `✓ Verified ${totalFrames} frames in ${(encResult.encDuration + decDuration).toFixed(0)}ms ▪ ${encFps.toLocaleString()} FPS enc / ${decFps.toLocaleString()} FPS dec ▪ ${bitrateMbps} Mbps`;
				}
			}

			processedStartFrameLoaded = rangeStartFrame;
			decodedStartFrameLoaded = selectedPipeline === 'encode' ? -1 : rangeStartFrame;
			decodedSceneLoaded = selectedPipeline === 'encode' ? '' : selectedScene;
			currentFrameIdx = 0;
			if (selectedPipeline !== 'encode') {
				computeAllQualityMetrics(totalFrames, width, height, runId);
			}
			drawGopSparkline();
			syncTimelineUI(0);
			startPlayback(false);
		} catch (err: any) {
			if (statusText) {
				statusText.textContent = `Verification Notice: ${err?.message || 'Codec profile unsupported'}.`;
				statusText.style.color = '#f97316';
			}
			if (decodedBitmaps.length < TEST_WINDOW_FRAMES && selectedScene !== 'smpte') {
				srcCanvas?.classList.add('hidden');
				srcVideo?.classList.remove('hidden');
			}
		} finally {
			isRunning = false;
			if (runBtn) runBtn.disabled = false;
			const labelEl = document.getElementById('codec-btn-label');
			if (labelEl) labelEl.textContent = 'Start';
		}
	}

	runBtn?.addEventListener('click', runVerification);

	if (!codecGlobalListenersBound) {
		codecGlobalListenersBound = true;

		document.addEventListener('fullscreenchange', () => {
			const modal = document.getElementById('codec-applet-modal');
			if (!modal) return;
			const inFs = !!document.fullscreenElement;
			updateMaximizeUi(inFs);
		});

		document.addEventListener('click', (e) => {
			const btn = (e.target as HTMLElement)?.closest('#launch-codec-spotlight-btn, [data-open-codec-studio]');
			if (btn) {
				e.preventDefault();
				openCodecModal('loopback');
			}
		});

		window.addEventListener('open-codec-studio', (e: any) => {
			openCodecModal(e?.detail?.pipeline || 'loopback');
		});

		window.addEventListener('keydown', (e) => {
			const modal = document.getElementById('codec-applet-modal');
			if (!modal || modal.classList.contains('hidden')) return;

			if (e.key === 'Escape' || e.key === 'Esc') {
				e.preventDefault();
				e.stopPropagation();
				if (document.fullscreenElement) {
					try {
						if (document.exitFullscreen) document.exitFullscreen();
						else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
					} catch {}
					return;
				}
				const curPinBtn = document.getElementById('codec-pin-btn');
				if (curPinBtn?.classList.contains('active')) {
					curPinBtn.click();
					return;
				}
				if (modal.classList.contains('is-maximized')) {
					updateMaximizeUi(false);
					return;
				}
				closeCodecModal();
				return;
			}

			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.code === 'Space') {
				e.preventDefault();
				togglePlayback();
			} else if (e.code === 'ArrowLeft') {
				e.preventDefault();
				stopPlayback();
				seekToFrame(currentFrameIdx - 1);
			} else if (e.code === 'ArrowRight') {
				e.preventDefault();
				stopPlayback();
				seekToFrame(currentFrameIdx + 1);
			} else if (e.code === 'KeyP') {
				e.preventDefault();
				if (isLoupePinned) setLoupePinned(false);
				else setLoupePinned(true, lastNormX ?? 0.5, lastNormY ?? 0.5);
			}
		});
	}

	probeCodecCapabilities();
}
