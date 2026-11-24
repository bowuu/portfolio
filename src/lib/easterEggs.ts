// src/lib/easterEggs.ts
// Hardware & Silicon Validation Interactive Lab Extras:
// - ExtrasAudioEngine (unified Web Audio compressor + modal acoustic synthesizer)
// - Chief Morale Officer silicon binning ladder
// - 300mm ATE Silicon Wafer Die Sort Inspector
// - 8x8 Carry-Save Array Multiplier Simulator
// - Zero-G Verlet Collapse, 3D Tilt, CRT Degauss, 3D Silicon Cyclone, Quantum Tunneling, Thermal Cam

import { openModalFocus, closeModalFocus } from './ui';

declare global {
	interface Window {
		__pushModalHistory?: (id: string, closeFn: () => void) => void;
		__popModalHistory?: (id: string) => void;
		__openWaferMap?: () => void;
		__closeWaferMap?: () => void;
		__toggleWaferMap?: () => void;
		__boopDog?: () => void;
		__closeAllEasterEggs?: () => void;
		__updateDrawerActiveUI?: () => void;
		__toggleZeroG?: () => void;
		__toggleTilt?: (force?: boolean) => void;
		__toggleDegauss?: () => void;
		__toggleSphere?: () => void;
		__toggleQuantum?: () => void;
		__toggleThermal?: () => void;
		__toggleMultiplier?: () => void;
		__openMultiplier?: () => void;
		__closeMultiplier?: () => void;
		__toggleLabExtras?: () => void;
	}
}

class ExtrasAudioEngine {
	private ctx: AudioContext | null = null;
	private masterFilter: BiquadFilterNode | null = null;
	private masterCompressor: DynamicsCompressorNode | null = null;
	private masterGain: GainNode | null = null;
	private thermalSpraySource: AudioBufferSourceNode | null = null;
	private thermalSprayFilter: BiquadFilterNode | null = null;
	private thermalSprayGain: GainNode | null = null;
	private thermalNoiseBuffer: AudioBuffer | null = null;

	private init() {
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
			if (AudioCtx) {
				this.ctx = new AudioCtx();
				this.masterFilter = this.ctx.createBiquadFilter();
				this.masterFilter.type = 'lowpass';
				this.masterFilter.frequency.setValueAtTime(8500, this.ctx.currentTime);
				this.masterFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

				this.masterCompressor = this.ctx.createDynamicsCompressor();
				this.masterCompressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
				this.masterCompressor.knee.setValueAtTime(24, this.ctx.currentTime);
				this.masterCompressor.ratio.setValueAtTime(6, this.ctx.currentTime);
				this.masterCompressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
				this.masterCompressor.release.setValueAtTime(0.05, this.ctx.currentTime);

				this.masterGain = this.ctx.createGain();
				this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

				this.masterFilter.connect(this.masterCompressor);
				this.masterCompressor.connect(this.masterGain);
				this.masterGain.connect(this.ctx.destination);
			}
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume().catch(() => {});
		}
	}

	private getOutputNode(): AudioNode | null {
		return this.masterFilter || this.masterGain || this.ctx?.destination || null;
	}

	public playProbeTick() {
		this.init();
		if (!this.ctx) return;
		this.playPlasticClack(this.ctx.currentTime, 2200 + Math.random() * 300, 3.5, 0.008, 0.06);
	}

	private playPlasticClack(time: number, freq: number, Q: number, dur: number, vol: number) {
		const out = this.getOutputNode();
		if (!this.ctx || !out) return;
		const sampleRate = this.ctx.sampleRate;
		const bufferSize = Math.max(32, Math.floor(sampleRate * Math.min(dur, 0.03)));
		const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
		}

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;

		const filter = this.ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(Math.max(40, Math.min(18000, freq)), time);
		filter.Q.setValueAtTime(Q, time);

		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(vol, time);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

		source.connect(filter);
		filter.connect(gain);
		gain.connect(out);
		source.start(time);
		source.stop(time + dur);
	}

	private playThump(time: number, startFreq: number, endFreq: number, dur: number, vol: number) {
		const out = this.getOutputNode();
		if (!this.ctx || !out) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(startFreq, time);
		osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + dur);
		gain.gain.setValueAtTime(vol, time);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
		osc.connect(gain);
		gain.connect(out);
		osc.start(time);
		osc.stop(time + dur);
	}

	private playTone(time: number, freq: number, type: OscillatorType, dur: number, vol: number) {
		const out = this.getOutputNode();
		if (!this.ctx || !out) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, time);
		gain.gain.setValueAtTime(vol, time);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
		osc.connect(gain);
		gain.connect(out);
		osc.start(time);
		osc.stop(time + dur);
	}

	private playImpulse(time: number, centerFreq: number, dur: number, vol: number) {
		const out = this.getOutputNode();
		if (!this.ctx || !out) return;
		const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
		const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
		}

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;

		const filter = this.ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(centerFreq, time);
		filter.Q.setValueAtTime(2.5, time);

		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(vol, time);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

		source.connect(filter);
		filter.connect(gain);
		gain.connect(out);
		source.start(time);
		source.stop(time + dur);
	}

	public playDogChime(step: number) {
		try {
			this.init();
			const out = this.getOutputNode();
			if (!this.ctx || !out) return;
			const t = this.ctx.currentTime;
			const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
			const baseFreq = notes[Math.min(step, notes.length - 1)];

			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(baseFreq, t);
			osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, t + 0.12);
			gain.gain.setValueAtTime(0.18, t);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
			osc.connect(gain);
			gain.connect(out);
			osc.start(t);
			osc.stop(t + 0.22);
		} catch {}
	}

	public playDegauss() {
		try {
			this.init();
			const out = this.getOutputNode();
			if (!this.ctx || !out) return;
			const t = this.ctx.currentTime;

			const kickOsc = this.ctx.createOscillator();
			const kickGain = this.ctx.createGain();
			kickOsc.type = 'sine';
			kickOsc.frequency.setValueAtTime(54, t);
			kickOsc.frequency.exponentialRampToValueAtTime(28, t + 0.12);
			kickGain.gain.setValueAtTime(0.35, t);
			kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
			kickOsc.connect(kickGain);
			kickGain.connect(out);
			kickOsc.start(t);
			kickOsc.stop(t + 0.15);

			const coilOsc1 = this.ctx.createOscillator();
			const coilOsc2 = this.ctx.createOscillator();
			const coilGain = this.ctx.createGain();
			const coilFilter = this.ctx.createBiquadFilter();

			coilOsc1.type = 'sawtooth';
			coilOsc1.frequency.setValueAtTime(62, t);
			coilOsc1.frequency.linearRampToValueAtTime(58, t + 1.4);

			coilOsc2.type = 'sawtooth';
			coilOsc2.frequency.setValueAtTime(124, t);
			coilOsc2.frequency.linearRampToValueAtTime(116, t + 1.4);

			coilFilter.type = 'lowpass';
			coilFilter.frequency.setValueAtTime(450, t);
			coilFilter.frequency.exponentialRampToValueAtTime(85, t + 1.4);
			coilFilter.Q.setValueAtTime(2.2, t);

			coilGain.gain.setValueAtTime(0.02, t);
			coilGain.gain.linearRampToValueAtTime(0.32, t + 0.04);
			coilGain.gain.setValueAtTime(0.3, t + 0.18);
			coilGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.42);

			coilOsc1.connect(coilFilter);
			coilOsc2.connect(coilFilter);
			coilFilter.connect(coilGain);
			coilGain.connect(out);

			coilOsc1.start(t);
			coilOsc2.start(t);
			coilOsc1.stop(t + 1.44);
			coilOsc2.stop(t + 1.44);

			// Sample-accurate Web Audio scheduling for dual-contact relay click-clack (zero timer drift)
			this.playImpulse(t + 1.42, 3200, 0.004, 0.22);
			this.playTone(t + 1.42, 1450, 'triangle', 0.01, 0.12);
			this.playImpulse(t + 1.434, 2100, 0.005, 0.16);
			this.playTone(t + 1.434, 820, 'square', 0.014, 0.1);
		} catch {}
	}

	private getThermalNoiseBuffer(): AudioBuffer | null {
		if (this.thermalNoiseBuffer) return this.thermalNoiseBuffer;
		if (!this.ctx) return null;
		const size = Math.floor(this.ctx.sampleRate * 1.5);
		const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
		const data = buf.getChannelData(0);
		let b0 = 0,
			b1 = 0,
			b2 = 0;
		for (let i = 0; i < size; i++) {
			const white = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + white * 0.0555179;
			b1 = 0.99332 * b1 + white * 0.0750759;
			b2 = 0.969 * b2 + white * 0.153852;
			data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.18;
		}
		this.thermalNoiseBuffer = buf;
		return buf;
	}

	public startThermalSpray(mode: 'cryo' | 'heatgun') {
		try {
			this.init();
			const out = this.getOutputNode();
			if (!this.ctx || !out) return;
			const t = this.ctx.currentTime;
			const buf = this.getThermalNoiseBuffer();
			if (!buf) return;

			if (!this.thermalSpraySource) {
				this.thermalSpraySource = this.ctx.createBufferSource();
				this.thermalSpraySource.buffer = buf;
				this.thermalSpraySource.loop = true;

				this.thermalSprayFilter = this.ctx.createBiquadFilter();
				this.thermalSprayGain = this.ctx.createGain();
				this.thermalSprayGain.gain.setValueAtTime(0.0001, t);

				this.thermalSpraySource.connect(this.thermalSprayFilter);
				this.thermalSprayFilter.connect(this.thermalSprayGain);
				this.thermalSprayGain.connect(out);
				this.thermalSpraySource.start(t);
			}

			if (this.thermalSprayFilter && this.thermalSprayGain) {
				if (mode === 'cryo') {
					this.thermalSprayFilter.type = 'bandpass';
					this.thermalSprayFilter.frequency.setTargetAtTime(3400, t, 0.02);
					this.thermalSprayFilter.Q.setTargetAtTime(1.6, t, 0.02);
					this.thermalSprayGain.gain.setTargetAtTime(0.08, t, 0.03);
				} else {
					this.thermalSprayFilter.type = 'lowpass';
					this.thermalSprayFilter.frequency.setTargetAtTime(320, t, 0.02);
					this.thermalSprayFilter.Q.setTargetAtTime(2.4, t, 0.02);
					this.thermalSprayGain.gain.setTargetAtTime(0.12, t, 0.03);
				}
			}
		} catch {}
	}

	public stopThermalSpray(teardown = false) {
		try {
			if (!this.ctx) return;
			const t = this.ctx.currentTime;
			if (this.thermalSprayGain) {
				this.thermalSprayGain.gain.setTargetAtTime(0.0001, t, teardown ? 0.01 : 0.04);
			}
			if (teardown && this.thermalSpraySource) {
				const src = this.thermalSpraySource;
				const filt = this.thermalSprayFilter;
				const g = this.thermalSprayGain;
				this.thermalSpraySource = null;
				this.thermalSprayFilter = null;
				this.thermalSprayGain = null;
				try {
					src.stop(t + 0.05);
				} catch {}
				window.setTimeout(() => {
					try { src.disconnect(); } catch {}
					try { filt?.disconnect(); } catch {}
					try { g?.disconnect(); } catch {}
				}, 80);
			}
		} catch {}
	}

	public playQuantumDisintegrate() {
		try {
			this.init();
			if (!this.ctx) return;
			const t = this.ctx.currentTime;
			this.playImpulse(t, 2400, 0.04, 0.18);
			[880, 1174, 1567, 2093, 2793].forEach((f, idx) => {
				this.playTone(t + idx * 0.06, f, 'sine', 0.25, 0.08);
			});
		} catch {}
	}

	public playBitClick(isHigh: boolean) {
		try {
			this.init();
			if (!this.ctx) return;
			const t = this.ctx.currentTime;
			this.playTone(t, isHigh ? 2200 : 1400, 'sine', 0.022, 0.07);
			this.playImpulse(t, 2800, 0.004, 0.05);
		} catch {}
	}

	public playMultiplierChime() {
		try {
			this.init();
			if (!this.ctx) return;
			const t = this.ctx.currentTime;
			[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
				this.playTone(t + i * 0.035, f, 'sine', 0.11, 0.06);
			});
		} catch {}
	}

	public playCascadeStep(step: number, total = 9) {
		try {
			this.init();
			if (!this.ctx) return;
			const t = this.ctx.currentTime;
			const freq = 340 + (step / total) * 440;
			this.playTone(t, freq, 'sine', 0.035, 0.045);
			this.playImpulse(t, freq * 2, 0.003, 0.03);
		} catch {}
	}
}

const audioEngine = new ExtrasAudioEngine();

// -------------------------------------------------------------
// CHIEF MORALE OFFICER: SILICON LOTTERY BINNING LADDER (6.0 GHz)
// -------------------------------------------------------------
function initDogBoop() {
	const avatarImg = document.getElementById('hero-avatar-img') || document.querySelector('.hero .avatar-img');
	const avatarWrap = document.getElementById('hero-avatar-wrap') || document.querySelector('.hero .avatar-wrap');
	if (!avatarImg || !avatarWrap) return;

	let streak = 0;
	let streakTimer = 0;

	const binReadouts = [
		'🐾 Standard Bin 3: 1.80 GHz @ 0.75V',
		'🐾 Mainstream Bin 2: 3.20 GHz @ 0.90V',
		'🐾 Premium Bin 1: 4.40 GHz @ 1.10V',
		'🐾 Golden Die: 5.20 GHz @ 1.25V (Top 1%)',
		'🐾 Golden Sample: 6.00 GHz (Good Girl! 🐾)',
	];

	function triggerBoop() {
		streak++;
		window.clearTimeout(streakTimer);
		streakTimer = window.setTimeout(() => {
			streak = 0;
		}, 3500);

		audioEngine.playDogChime(streak);

		avatarImg!.classList.remove('booped');
		void (avatarImg as HTMLElement).offsetWidth;
		avatarImg!.classList.add('booped');

		const pill = document.createElement('div');
		const tier = Math.min(streak, 5);
		pill.className = `morale-boost-pill mono bin-tier-${tier}`;
		pill.textContent = binReadouts[Math.min(streak - 1, binReadouts.length - 1)];
		avatarWrap!.appendChild(pill);

		if (streak >= 5) {
			const glyphs = ['🐾', '🦴', '⚡', '🔥', '✨', '🐾'];
			glyphs.forEach((g, i) => {
				const conf = document.createElement('span');
				conf.className = 'boop-particle';
				conf.textContent = g;
				const angle = (i / glyphs.length) * Math.PI * 2;
				const dist = 55 + Math.random() * 35;
				conf.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
				conf.style.setProperty('--dy', `${(Math.sin(angle) * dist - 25).toFixed(1)}px`);
				avatarWrap!.appendChild(conf);
				window.setTimeout(() => conf.remove(), 950);
			});
		}

		window.setTimeout(() => pill.remove(), 1300);
	}

	avatarImg.addEventListener('click', triggerBoop);
	window.__boopDog = () => {
		avatarImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
		window.setTimeout(triggerBoop, 300);
	};
}

// -------------------------------------------------------------
// 300MM SILICON WAFER DIE SORT INSPECTOR
// -------------------------------------------------------------
function initWaferInspector() {
	const modal = document.getElementById('wafer-modal');
	const backdrop = document.getElementById('wafer-backdrop');
	const closeBtn = document.getElementById('wafer-close-btn') as HTMLElement | null;
	const scanBtn = document.getElementById('wafer-scan-btn');
	const randomBtn = document.getElementById('wafer-random-btn');
	const canvas = document.getElementById('wafer-canvas') as HTMLCanvasElement | null;
	if (!modal || !canvas) return;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const waferRadius = 175;
	const cx = 200;
	const cy = 200;
	const dieW = 30;
	const dieH = 24;
	const stepX = 32.5;
	const stepY = 26.5;
	const cols = 12;
	const rows = 14;

	interface WaferDie {
		col: number;
		row: number;
		x: number;
		y: number;
		bin: 1 | 2 | 'x';
		id: string;
		fmax: number;
		vmin: number;
		leakage: number;
		disabledCores: number[];
		tested: boolean;
	}

	const dies: WaferDie[] = [];
	let activeDie: WaferDie | null = null;
	let isScanning = false;

	function generateWaferDies(randomize = false) {
		dies.length = 0;
		const halfW = (cols * stepX) / 2;
		const halfH = (rows * stepY) / 2;

		const clusterX = randomize ? Math.floor(Math.random() * 8 + 2) : 4;
		const clusterY = randomize ? Math.floor(Math.random() * 8 + 3) : 8;
		const edgeDefectThreshold = randomize ? 0.83 + Math.random() * 0.08 : 0.86;
		const lotNum = randomize ? Math.floor(Math.random() * 800 + 100) : 740;
		const waferNum = randomize ? Math.floor(Math.random() * 24 + 1) : 14;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const x = cx - halfW + c * stepX;
				const y = cy - halfH + r * stepY;

				const corners = [
					[x, y],
					[x + dieW, y],
					[x, y + dieH],
					[x + dieW, y + dieH],
				];

				const fits = corners.every(([px, py]) => {
					const dx = px - cx;
					const dy = py - cy;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist > waferRadius - 8) return false;
					if (Math.abs(dx) < 14 && py > cy + waferRadius - 16) return false;
					return true;
				});
				if (!fits) continue;

				const dist = Math.sqrt((x + dieW / 2 - cx) ** 2 + (y + dieH / 2 - cy) ** 2);
				const normR = dist / (waferRadius - 8);
				const rnd = Math.random();

				let bin: 1 | 2 | 'x' = 1;
				const disabledCores: number[] = [];

				if (normR > edgeDefectThreshold && rnd < 0.45) {
					bin = 'x';
				} else if (Math.abs(c - clusterX) <= 1 && Math.abs(r - clusterY) <= 1 && rnd < 0.65) {
					bin = 'x';
				} else if (rnd < 0.35) {
					bin = 2;
					const numDisabled = 2 + Math.floor(Math.random() * 3);
					while (disabledCores.length < numDisabled) {
						const coreIdx = Math.floor(Math.random() * 12);
						if (!disabledCores.includes(coreIdx)) disabledCores.push(coreIdx);
					}
				} else {
					bin = 1;
				}

				const hexId = `0x7E${lotNum.toString(16).toUpperCase()}` + ((r * cols + c) * 137).toString(16).toUpperCase().padStart(4, '0');
				const fmax = bin === 1 ? +(3.7 + Math.random() * 0.22).toFixed(2) : bin === 2 ? +(3.1 + Math.random() * 0.18).toFixed(2) : +(1.6 + Math.random() * 0.4).toFixed(2);
				const vmin = bin === 1 ? +(0.76 + Math.random() * 0.035).toFixed(3) : bin === 2 ? +(0.83 + Math.random() * 0.035).toFixed(3) : +(1.18 + Math.random() * 0.2).toFixed(3);
				const leakage = bin === 1 ? +(22.5 + Math.random() * 4.5).toFixed(1) : bin === 2 ? +(29.5 + Math.random() * 5.0).toFixed(1) : +(85.0 + Math.random() * 30.0).toFixed(1);

				dies.push({
					col: c,
					row: r,
					x,
					y,
					bin,
					id: hexId,
					fmax,
					vmin,
					leakage,
					disabledCores,
					tested: true,
				});
			}
		}

		const subEl = document.getElementById('wafer-sub-meta');
		if (subEl) {
			subEl.textContent = `LOT #${lotNum}C-W${waferNum < 10 ? '0' + waferNum : waferNum} ▪ 3nm HPC Node ▪ Reticle Limit (740 mm²) ▪ ${dies.length} Dies`;
		}

		const b1Count = dies.filter((d) => d.bin === 1).length;
		const b2Count = dies.filter((d) => d.bin === 2).length;
		const bxCount = dies.filter((d) => d.bin === 'x').length;
		const total = dies.length || 1;
		const yieldPct = (((b1Count + b2Count) / total) * 100).toFixed(1);

		const legB1 = document.getElementById('leg-bin1-text');
		const legB2 = document.getElementById('leg-bin2-text');
		const legBx = document.getElementById('leg-binx-text');
		const yieldValEl = document.getElementById('wafer-yield-val');
		const yieldBarEl = document.getElementById('wafer-yield-bar');
		const d0El = document.getElementById('wafer-d0-val');

		if (legB1) legB1.textContent = `Perfect (Bin 1): ${b1Count} (${((b1Count / total) * 100).toFixed(1)}%) ▪ All Cores`;
		if (legB2) legB2.textContent = `Defeatured (Bin 2): ${b2Count} (${((b2Count / total) * 100).toFixed(1)}%) ▪ Harvest`;
		if (legBx) legBx.textContent = `Fallout (Reject): ${bxCount} (${((bxCount / total) * 100).toFixed(1)}%) ▪ Defect`;
		if (yieldValEl) yieldValEl.textContent = `${yieldPct}%`;
		if (yieldBarEl) yieldBarEl.style.width = `${yieldPct}%`;
		if (d0El) {
			const d0 = (0.068 + (bxCount / total) * 0.14).toFixed(3);
			d0El.textContent = `D₀: ${d0}/cm²`;
		}
	}

	generateWaferDies(false);

	function drawWafer() {
		if (!ctx || !canvas) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, cy, waferRadius, 0, Math.PI * 2);
		const grad = ctx.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, waferRadius);
		grad.addColorStop(0, '#1a2233');
		grad.addColorStop(0.7, '#111622');
		grad.addColorStop(1, '#0b0f17');
		ctx.fillStyle = grad;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = '#38bdf8';
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(cx, cy + waferRadius, 9, Math.PI, 0, true);
		ctx.fillStyle = '#0f172a';
		ctx.fill();
		ctx.stroke();
		ctx.restore();

		for (const die of dies) {
			ctx.save();
			if (!die.tested) {
				ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
				ctx.fillRect(die.x, die.y, dieW, dieH);
			} else if (die.bin === 1) {
				ctx.fillStyle = '#10b981';
				ctx.fillRect(die.x, die.y, dieW, dieH);
				ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
				ctx.lineWidth = 0.5;
				const tileW = (dieW - 2) / 4;
				const tileH = (dieH - 2) / 3;
				for (let tr = 0; tr < 3; tr++) {
					for (let tc = 0; tc < 4; tc++) {
						ctx.strokeRect(die.x + 1 + tc * tileW, die.y + 1 + tr * tileH, tileW, tileH);
					}
				}
			} else if (die.bin === 2) {
				ctx.fillStyle = '#f59e0b';
				ctx.fillRect(die.x, die.y, dieW, dieH);
				const tileW = (dieW - 2) / 4;
				const tileH = (dieH - 2) / 3;
				ctx.lineWidth = 0.5;
				for (let tr = 0; tr < 3; tr++) {
					for (let tc = 0; tc < 4; tc++) {
						const cIdx = tr * 4 + tc;
						const tx = die.x + 1 + tc * tileW;
						const ty = die.y + 1 + tr * tileH;
						if (die.disabledCores.includes(cIdx)) {
							ctx.fillStyle = 'rgba(30, 10, 10, 0.85)';
							ctx.fillRect(tx, ty, tileW, tileH);
							ctx.strokeStyle = '#ef4444';
							ctx.strokeRect(tx, ty, tileW, tileH);
						} else {
							ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
							ctx.strokeRect(tx, ty, tileW, tileH);
						}
					}
				}
			} else {
				ctx.fillStyle = '#ef4444';
				ctx.fillRect(die.x, die.y, dieW, dieH);
				ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(die.x + 2, die.y + 2);
				ctx.lineTo(die.x + dieW - 2, die.y + dieH - 2);
				ctx.moveTo(die.x + dieW - 2, die.y + 2);
				ctx.lineTo(die.x + 2, die.y + dieH - 2);
				ctx.stroke();
			}

			ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
			ctx.lineWidth = 1;
			ctx.strokeRect(die.x, die.y, dieW, dieH);
			ctx.restore();
		}

		if (activeDie) {
			ctx.save();
			ctx.strokeStyle = '#00f0ff';
			ctx.lineWidth = 2.5;
			ctx.shadowColor = '#00f0ff';
			ctx.shadowBlur = 10;
			ctx.strokeRect(activeDie.x - 1, activeDie.y - 1, dieW + 2, dieH + 2);

			ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
			ctx.lineWidth = 1;
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			ctx.moveTo(activeDie.x + dieW / 2, 16);
			ctx.lineTo(activeDie.x + dieW / 2, 384);
			ctx.moveTo(16, activeDie.y + dieH / 2);
			ctx.lineTo(384, activeDie.y + dieH / 2);
			ctx.stroke();
			ctx.restore();
		}
	}

	function updateTelemetry(die: WaferDie) {
		const idEl = document.getElementById('wp-id');
		const posEl = document.getElementById('wp-pos');
		const binEl = document.getElementById('wp-bin');
		const configEl = document.getElementById('wp-config');
		const areaEl = document.getElementById('wp-area');
		const fmaxEl = document.getElementById('wp-fmax');
		const vminEl = document.getElementById('wp-vmin');
		const leakEl = document.getElementById('wp-leak');

		if (idEl) idEl.textContent = die.id;
		if (posEl) posEl.textContent = `(${die.col}, ${die.row})`;
		if (binEl) {
			if (die.bin === 1) {
				binEl.textContent = 'Perfect (Bin 1)';
				binEl.style.color = '#10b981';
			} else if (die.bin === 2) {
				binEl.textContent = 'Defeatured (Bin 2)';
				binEl.style.color = '#f59e0b';
			} else {
				binEl.textContent = 'Fallout (Reject)';
				binEl.style.color = '#ef4444';
			}
		}
		if (configEl) {
			if (die.bin === 1) {
				configEl.textContent = 'All Active';
				configEl.style.color = '#10b981';
			} else if (die.bin === 2) {
				configEl.textContent = `-${die.disabledCores.length} Cores`;
				configEl.style.color = '#f59e0b';
			} else {
				configEl.textContent = 'Defect Fail';
				configEl.style.color = '#ef4444';
			}
		}
		if (areaEl) areaEl.textContent = '740 mm²';
		if (fmaxEl) fmaxEl.textContent = `${die.fmax} GHz`;
		if (vminEl) vminEl.textContent = `${die.vmin} V`;
		if (leakEl) leakEl.textContent = `${die.leakage} mA`;
	}

	function handleCanvasPointer(e: MouseEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const px = (e.clientX - rect.left) * (canvas.width / rect.width);
		const py = (e.clientY - rect.top) * (canvas.height / rect.height);
		const found = dies.find((d) => px >= d.x && px <= d.x + dieW && py >= d.y && py <= d.y + dieH);
		if (found) {
			activeDie = found;
			updateTelemetry(found);
			drawWafer();
		}
	}

	canvas.addEventListener('mousemove', handleCanvasPointer);
	canvas.addEventListener('click', handleCanvasPointer);

	function openWaferModal() {
		window.__closeAllEasterEggs?.();
		modal!.classList.remove('hidden');
		modal!.style.display = 'flex';
		openModalFocus(modal, closeBtn);
		window.__pushModalHistory?.('wafer-modal', closeWaferModal);
		window.__updateDrawerActiveUI?.();
		if (!activeDie && dies.length) {
			activeDie = dies[Math.floor(dies.length / 2)];
			updateTelemetry(activeDie);
		}
		drawWafer();
	}

	function closeWaferModal() {
		if (!modal || modal.classList.contains('hidden')) return;
		closeModalFocus(modal);
		modal.classList.add('hidden');
		modal.style.display = 'none';
		window.__updateDrawerActiveUI?.();
		window.__popModalHistory?.('wafer-modal');
	}

	closeBtn?.addEventListener('click', closeWaferModal);
	backdrop?.addEventListener('click', closeWaferModal);

	scanBtn?.addEventListener('click', () => {
		if (isScanning) return;
		isScanning = true;
		generateWaferDies(true);
		dies.forEach((d) => {
			d.tested = false;
		});
		activeDie = null;
		drawWafer();

		const yieldValEl = document.getElementById('wafer-yield-val');
		const yieldBarEl = document.getElementById('wafer-yield-bar');
		const d0El = document.getElementById('wafer-d0-val');

		let idx = 0;
		const batchSize = 4;
		const total = dies.length;

		function stepScan() {
			const end = Math.min(idx + batchSize, total);
			for (let i = idx; i < end; i++) {
				dies[i].tested = true;
			}
			idx = end;
			activeDie = dies[idx - 1] || null;
			if (activeDie) updateTelemetry(activeDie);

			const testedCount = dies.filter((d) => d.tested).length;
			const goodCount = dies.filter((d) => d.tested && d.bin !== 'x').length;
			const curYield = testedCount ? ((goodCount / testedCount) * 100).toFixed(1) : '0.0';
			if (yieldValEl) yieldValEl.textContent = `${curYield}%`;
			if (yieldBarEl) yieldBarEl.style.width = `${curYield}%`;

			audioEngine.playProbeTick();
			drawWafer();

			if (idx < total) {
				requestAnimationFrame(stepScan);
			} else {
				isScanning = false;
				const finalYield = ((goodCount / total) * 100).toFixed(1);
				if (yieldValEl) yieldValEl.textContent = `${finalYield}%`;
				if (yieldBarEl) yieldBarEl.style.width = `${finalYield}%`;
				if (d0El) {
					const bxCount = dies.filter((d) => d.bin === 'x').length;
					d0El.textContent = `D₀: ${(0.068 + (bxCount / total) * 0.14).toFixed(3)}/cm²`;
				}
			}
		}

		requestAnimationFrame(stepScan);
	});

	randomBtn?.addEventListener('click', () => {
		if (!dies.length) return;
		const r = dies[Math.floor(Math.random() * dies.length)];
		activeDie = r;
		updateTelemetry(r);
		drawWafer();
	});

	window.__openWaferMap = openWaferModal;
	window.__closeWaferMap = closeWaferModal;
	window.__toggleWaferMap = () => (modal.classList.contains('hidden') ? openWaferModal() : closeWaferModal());
}

// -------------------------------------------------------------
// INTERACTIVE HARDWARE LAB EXTRAS CORE
// -------------------------------------------------------------
let easterEggsGlobalBound = false;

export function initAllEasterEggs(): void {
	const container = document.getElementById('easter-eggs-container');
	if (!container || container.dataset.bound === '1') return;
	container.dataset.bound = '1';

	initWaferInspector();
	initDogBoop();

	let isZeroG = false;
	let isTilt = false;
	let isDegauss = false;
	let isSphere = false;
	let isQuantum = false;
	let isThermal = false;
	let isMultiplier = false;

	let multX = 170;
	let multY = 85;
	let multSlowMode = false;
	let multCascadeTimeouts: number[] = [];

	const multiplierModal = document.getElementById('multiplier-modal');
	const multBackdrop = document.getElementById('multiplier-backdrop');
	const multCloseBtn = document.getElementById('multiplier-close-btn') as HTMLElement | null;
	const multSvg = document.getElementById('mult-schematic-svg') as SVGSVGElement | null;
	const multCellInfo = document.getElementById('mult-cell-info');
	const multXBits = document.getElementById('mult-x-bits');
	const multYBits = document.getElementById('mult-y-bits');
	const multXMeta = document.getElementById('mult-x-meta');
	const multYMeta = document.getElementById('mult-y-meta');
	const multPDec = document.getElementById('mult-p-dec');
	const multPHex = document.getElementById('mult-p-hex');
	const multPBin = document.getElementById('mult-p-bin');
	const multPBits = document.getElementById('mult-product-bits');
	const multRandBtn = document.getElementById('mult-rand-btn');
	const multSpeedBtn = document.getElementById('mult-speed-btn');
	const multReplayBtn = document.getElementById('mult-replay-btn');
	const multSpeedIcon = document.getElementById('mult-speed-icon');
	const multSpeedText = document.getElementById('mult-speed-text');

	const zerogHud = document.getElementById('zerog-hud');
	const zerogResetBtn = document.getElementById('zerog-reset-btn');
	const tiltHud = document.getElementById('tilt-hud');
	const tiltExitBtn = document.getElementById('tilt-exit-btn');

	const degaussHud = document.getElementById('degauss-hud');
	const degaussReBtn = document.getElementById('degauss-re-btn');
	const degaussExitBtn = document.getElementById('degauss-exit-btn');
	const degaussCanvas = document.getElementById('degauss-canvas') as HTMLCanvasElement | null;

	const sphereHud = document.getElementById('sphere-hud');
	const sphereExitBtn = document.getElementById('sphere-exit-btn');
	const sphereCore = document.getElementById('sphere-core');

	const quantumHud = document.getElementById('quantum-hud');
	const quantumAllBtn = document.getElementById('quantum-all-btn');
	const quantumReBtn = document.getElementById('quantum-reassemble-btn');
	const quantumExitBtn = document.getElementById('quantum-exit-btn');
	const quantumCanvas = document.getElementById('quantum-canvas') as HTMLCanvasElement | null;

	const thermalHud = document.getElementById('thermal-hud');
	const thermalToolBtn = document.getElementById('thermal-tool-btn');
	const thermalResetBtn = document.getElementById('thermal-reset-btn');
	const thermalExitBtn = document.getElementById('thermal-exit-btn');
	const thermalScaleBar = document.getElementById('thermal-scale-bar');
	const thermalSpots = document.getElementById('thermal-spots');
	const thermalCanvas = document.getElementById('thermal-canvas') as HTMLCanvasElement | null;

	const extrasModal = document.getElementById('lab-extras-modal');
	const extrasCloseBtn = document.getElementById('extras-close-btn') as HTMLElement | null;

	const PHYSICS_SELECTOR = '.card, .benchmark-card, .hero .avatar-wrap';
	const DISSOLVE_SELECTOR = '.card, .benchmark-card';

	function closeLabExtras(restoreFocus = true) {
		if (!extrasModal || extrasModal.classList.contains('hidden')) return;
		if (restoreFocus) {
			closeModalFocus(extrasModal);
		} else {
			extrasModal.setAttribute('aria-hidden', 'true');
			extrasModal.setAttribute('inert', '');
		}
		extrasModal.classList.add('hidden');
		extrasModal.style.display = 'none';
		window.__popModalHistory?.('lab-extras-modal');
	}

	function updateDrawerActiveUI() {
		const waferModal = document.getElementById('wafer-modal');
		document.getElementById('trigger-sphere-btn')?.classList.toggle('active', isSphere);
		document.getElementById('trigger-tilt-btn')?.classList.toggle('active', isTilt);
		document.getElementById('trigger-multiplier-btn')?.classList.toggle('active', isMultiplier);
		document.getElementById('trigger-degauss-btn')?.classList.toggle('active', isDegauss);
		document.getElementById('trigger-thermal-btn')?.classList.toggle('active', isThermal);
		document.getElementById('trigger-quantum-btn')?.classList.toggle('active', isQuantum);
		document.getElementById('trigger-zerog-btn')?.classList.toggle('active', isZeroG);
		document.getElementById('trigger-wafer-btn')?.classList.toggle('active', !!(waferModal && !waferModal.classList.contains('hidden')));
	}
	window.__updateDrawerActiveUI = updateDrawerActiveUI;

	function closeAllActiveModes() {
		if (isZeroG) resetZeroG();
		if (isTilt) toggleTilt(false);
		if (isDegauss) resetDegauss();
		if (isSphere) resetSphere();
		if (isQuantum) resetQuantum();
		if (isThermal) resetThermal();
		if (isMultiplier) closeMultiplier();
		window.__closeWaferMap?.();
	}
	window.__closeAllEasterEggs = closeAllActiveModes;

	// --- 1. ZERO-G VERLET COLLAPSE ---
	interface PhysicsBody {
		el: HTMLElement;
		x: number;
		y: number;
		prevX: number;
		prevY: number;
		angle: number;
		prevAngle: number;
		width: number;
		height: number;
		initialLeft: number;
		initialTop: number;
	}

	let bodies: PhysicsBody[] = [];
	let animId = 0;
	let draggedBody: PhysicsBody | null = null;
	let dragOffsetX = 0;
	let dragOffsetY = 0;
	let lastPointerX = 0;
	let lastPointerY = 0;

	function startZeroG() {
		if (isZeroG) return;
		closeAllActiveModes();
		isZeroG = true;
		if (zerogHud) {
			zerogHud.style.display = 'flex';
			zerogHud.classList.remove('hidden');
		}
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';
		window.dispatchEvent(new CustomEvent('pause-cad-render'));

		const winH = window.innerHeight;
		const elements = Array.from(document.querySelectorAll<HTMLElement>(PHYSICS_SELECTOR)).filter((el) => {
			const rect = el.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && rect.bottom > -150 && rect.top < winH + 350;
		});

		bodies = elements.map((el) => {
			const rect = el.getBoundingClientRect();
			el.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
			el.style.transition = 'none';
			el.style.willChange = 'transform';
			el.style.cursor = 'grab';
			return {
				el,
				x: rect.left,
				y: rect.top,
				prevX: rect.left + (Math.random() - 0.5) * 4,
				prevY: rect.top - Math.random() * 3,
				angle: 0,
				prevAngle: (Math.random() - 0.5) * 0.03,
				width: rect.width,
				height: rect.height,
				initialLeft: rect.left,
				initialTop: rect.top,
			};
		});

		runPhysicsLoop();
		updateDrawerActiveUI();
	}

	function resetZeroG() {
		if (!isZeroG) return;
		isZeroG = false;
		cancelAnimationFrame(animId);
		animId = 0;
		if (zerogHud) {
			zerogHud.classList.add('hidden');
			zerogHud.style.display = 'none';
		}
		document.documentElement.style.overflow = '';
		document.body.style.overflow = '';
		window.dispatchEvent(new CustomEvent('resume-cad-render'));

		bodies.forEach((b) => {
			b.el.style.transition = 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)';
			b.el.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
			b.el.style.cursor = '';
		});
		window.setTimeout(() => {
			bodies.forEach((b) => {
				b.el.style.transition = '';
				b.el.style.willChange = '';
				b.el.style.transform = '';
			});
			bodies = [];
		}, 600);
		updateDrawerActiveUI();
	}

	function runPhysicsLoop() {
		const gravity = 0.45;
		const friction = 0.985;
		const restitution = 0.48;
		let settledFrames = 0;

		function step() {
			if (!isZeroG) return;
			const winW = window.innerWidth;
			const winH = window.innerHeight;
			let totalKinetic = 0;

			for (const b of bodies) {
				if (b === draggedBody) {
					b.prevX = b.x;
					b.prevY = b.y;
					b.x = lastPointerX - dragOffsetX;
					b.y = lastPointerY - dragOffsetY;
				} else {
					let vx = (b.x - b.prevX) * friction;
					let vy = (b.y - b.prevY) * friction + gravity;
					const vAngle = (b.angle - b.prevAngle) * friction;

					b.prevX = b.x;
					b.prevY = b.y;
					b.x += vx;
					b.y += vy;
					b.prevAngle = b.angle;
					b.angle += vAngle;

					// Clamp effective floor height so cards taller than viewport still settle cleanly at y = 8..16
					const effectiveFloor = Math.max(8, winH - 12 - b.height);
					if (b.y >= effectiveFloor) {
						b.y = effectiveFloor;
						if (Math.abs(vy) < 1.1 && Math.abs(vx) < 0.2) {
							b.prevY = b.y;
							b.prevX = b.x;
							vy = 0;
							vx = 0;
						} else {
							b.prevY = b.y + vy * restitution;
							b.prevAngle += vx * 0.002;
						}
					}

					if (b.x < 8) {
						b.x = 8;
						b.prevX = b.x + vx * restitution;
					}
					if (b.x + b.width > winW - 8) {
						b.x = winW - 8 - b.width;
						b.prevX = b.x + vx * restitution;
					}

					totalKinetic += Math.abs(vx) + Math.abs(vy);
				}

				const dx = b.x - b.initialLeft;
				const dy = b.y - b.initialTop;
				const deg = (b.angle * 180) / Math.PI;
				b.el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${deg.toFixed(2)}deg)`;
			}

			if (!draggedBody && totalKinetic < 0.12) {
				settledFrames++;
				if (settledFrames > 20) {
					animId = 0;
					return;
				}
			} else {
				settledFrames = 0;
			}
			animId = requestAnimationFrame(step);
		}
		animId = requestAnimationFrame(step);
	}

	window.addEventListener('pointerdown', (e) => {
		if (!isZeroG) return;
		const target = (e.target as HTMLElement).closest(PHYSICS_SELECTOR) as HTMLElement | null;
		if (!target) return;
		const body = bodies.find((b) => b.el === target);
		if (body) {
			draggedBody = body;
			dragOffsetX = e.clientX - body.x;
			dragOffsetY = e.clientY - body.y;
			lastPointerX = e.clientX;
			lastPointerY = e.clientY;
			body.el.style.cursor = 'grabbing';
			if (!animId) runPhysicsLoop();
		}
	});
	window.addEventListener('pointermove', (e) => {
		if (draggedBody) {
			lastPointerX = e.clientX;
			lastPointerY = e.clientY;
		}
	});
	window.addEventListener('pointerup', () => {
		if (draggedBody) {
			draggedBody.el.style.cursor = 'grab';
			draggedBody = null;
		}
	});
	zerogResetBtn?.addEventListener('click', resetZeroG);

	// --- 2. 3D TILT VIEWPORT ---
	const mainEl = document.querySelector('main') as HTMLElement | null;
	function handleTiltMove(e: MouseEvent) {
		if (!isTilt || !mainEl) return;
		const nx = (e.clientX / window.innerWidth - 0.5) * 16;
		const ny = (e.clientY / window.innerHeight - 0.5) * -16;
		mainEl.style.transform = `perspective(1200px) rotateY(${nx.toFixed(2)}deg) rotateX(${ny.toFixed(2)}deg) scale(0.985)`;
	}
	function handleOrientation(e: DeviceOrientationEvent) {
		if (!isTilt || !mainEl || e.gamma == null || e.beta == null) return;
		const nx = Math.max(-15, Math.min(15, e.gamma));
		const ny = Math.max(-15, Math.min(15, (e.beta - 45) * 0.7));
		mainEl.style.transform = `perspective(1200px) rotateY(${nx.toFixed(2)}deg) rotateX(${-ny.toFixed(2)}deg) scale(0.985)`;
	}
	function toggleTilt(force?: boolean) {
		const next = typeof force === 'boolean' ? force : !isTilt;
		if (next === isTilt) return;
		if (next) closeAllActiveModes();
		isTilt = next;

		if (isTilt) {
			if (tiltHud) {
				tiltHud.style.display = 'flex';
				tiltHud.classList.remove('hidden');
			}
			window.addEventListener('mousemove', handleTiltMove);
			if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
				(DeviceOrientationEvent as any)
					.requestPermission()
					.then((state: string) => {
						if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation);
					})
					.catch(() => {});
			} else {
				window.addEventListener('deviceorientation', handleOrientation);
			}
			if (mainEl) mainEl.style.transition = 'transform 0.12s ease-out';
		} else {
			if (tiltHud) {
				tiltHud.classList.add('hidden');
				tiltHud.style.display = 'none';
			}
			window.removeEventListener('mousemove', handleTiltMove);
			window.removeEventListener('deviceorientation', handleOrientation);
			if (mainEl) {
				mainEl.style.transition = 'transform 0.4s ease';
				mainEl.style.transform = '';
				window.setTimeout(() => {
					if (mainEl && !isTilt) mainEl.style.transition = '';
				}, 400);
			}
		}
		updateDrawerActiveUI();
	}
	tiltExitBtn?.addEventListener('click', () => toggleTilt(false));

	// --- 3. CRT DEGAUSS ---
	let degaussAnimId = 0;
	let degaussStartTime = 0;

	function sizeFullscreenCanvas(canvasEl: HTMLCanvasElement): CanvasRenderingContext2D | null {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvasEl.width = Math.max(1, Math.floor(window.innerWidth * dpr));
		canvasEl.height = Math.max(1, Math.floor(window.innerHeight * dpr));
		const ctx = canvasEl.getContext('2d');
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		return ctx;
	}

	function pulseDegauss() {
		audioEngine.playDegauss();
		if (!degaussCanvas || !mainEl) return;

		cancelAnimationFrame(degaussAnimId);
		degaussCanvas.style.display = 'block';
		degaussCanvas.classList.remove('hidden');
		const ctx = sizeFullscreenCanvas(degaussCanvas);
		if (!ctx) return;

		document.body.classList.add('crt-active', 'crt-degaussing');
		degaussStartTime = performance.now();
		const duration = 1600;

		function loopDegauss(now: number) {
			const elapsed = now - degaussStartTime;
			const t = elapsed / 1000;

			if (elapsed >= duration || !isDegauss) {
				ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
				if (mainEl) {
					mainEl.style.transform = '';
					mainEl.style.filter = '';
				}
				document.body.classList.remove('crt-degaussing');
				if (degaussCanvas) {
					degaussCanvas.classList.add('hidden');
					degaussCanvas.style.display = 'none';
				}
				degaussAnimId = 0;
				return;
			}

			const decay = Math.exp(-3.2 * t);
			const omega60 = 2 * Math.PI * 60 * t;
			const omega30 = 2 * Math.PI * 30 * t;
			const omega15 = 2 * Math.PI * 15 * t;
			const sin60 = Math.sin(omega60);
			const cos60 = Math.cos(omega60);
			const sin30 = Math.sin(omega30);
			const cos30 = Math.cos(omega30 + 0.4);
			const sin15 = Math.sin(omega15);

			const tx = sin60 * 16 * decay;
			const ty = cos60 * 10 * decay;
			const sx = 1.0 + sin60 * 0.055 * decay;
			const sy = 1.0 - sin60 * 0.055 * decay;
			const skewX = sin30 * 4.8 * decay;
			const skewY = cos30 * 2.8 * decay;
			const rot = sin15 * 1.6 * decay;

			if (mainEl) {
				mainEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) skew(${skewX.toFixed(2)}deg, ${skewY.toFixed(2)}deg) rotate(${rot.toFixed(2)}deg)`;
				const flash = t < 0.16 ? (1 - t / 0.16) * 0.85 : 0;
				const bright = 1.0 + flash + 0.15 * decay;
				const contrast = 1.0 + 0.75 * decay;
				const sat = 1.0 + 1.2 * decay;
				const redShift = (-15 * sin60 * decay).toFixed(1);
				const cyanShift = (15 * sin60 * decay).toFixed(1);
				mainEl.style.filter = `brightness(${bright.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${sat.toFixed(2)}) drop-shadow(${redShift}px 0 0 rgba(255, 0, 85, ${(0.8 * decay).toFixed(2)})) drop-shadow(${cyanShift}px 0 0 rgba(0, 245, 255, ${(0.8 * decay).toFixed(2)}))`;
			}

			if (ctx) {
				const w = window.innerWidth;
				const h = window.innerHeight;
				const cx = w / 2;
				const cy = h / 2;
				ctx.clearRect(0, 0, w, h);

				if (t < 0.22) {
					const bloomAlpha = (1 - t / 0.22) * 0.45;
					const bGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.7);
					bGrad.addColorStop(0, `rgba(230, 255, 245, ${bloomAlpha.toFixed(2)})`);
					bGrad.addColorStop(0.5, `rgba(160, 255, 220, ${(bloomAlpha * 0.6).toFixed(2)})`);
					bGrad.addColorStop(1, 'rgba(160, 255, 220, 0)');
					ctx.fillStyle = bGrad;
					ctx.fillRect(0, 0, w, h);
				}

				for (let r = 0; r < 3; r++) {
					const ringRadius = Math.max(w, h) * (0.35 + r * 0.25) * (1 + sin60 * 0.08 * decay);
					const ringAlpha = (0.28 - r * 0.06) * decay;

					const gGrad = ctx.createRadialGradient(0, 0, 50, 0, 0, ringRadius);
					gGrad.addColorStop(0, `rgba(16, 185, 129, ${(ringAlpha * 0.9).toFixed(2)})`);
					gGrad.addColorStop(0.4, `rgba(6, 182, 212, ${(ringAlpha * 0.6).toFixed(2)})`);
					gGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
					ctx.fillStyle = gGrad;
					ctx.fillRect(0, 0, w, h);

					const mGrad = ctx.createRadialGradient(w, 0, 50, w, 0, ringRadius * 1.1);
					mGrad.addColorStop(0, `rgba(236, 72, 153, ${(ringAlpha * 0.95).toFixed(2)})`);
					mGrad.addColorStop(0.4, `rgba(168, 85, 247, ${(ringAlpha * 0.65).toFixed(2)})`);
					mGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
					ctx.fillStyle = mGrad;
					ctx.fillRect(0, 0, w, h);

					const aGrad = ctx.createRadialGradient(w, h, 60, w, h, ringRadius * 0.95);
					aGrad.addColorStop(0, `rgba(245, 158, 11, ${(ringAlpha * 0.85).toFixed(2)})`);
					aGrad.addColorStop(0.5, `rgba(239, 68, 68, ${(ringAlpha * 0.45).toFixed(2)})`);
					aGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
					ctx.fillStyle = aGrad;
					ctx.fillRect(0, 0, w, h);
				}

				if (t < 0.65) {
					const rippleAlpha = (1 - t / 0.65) * 0.12 * decay;
					ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha.toFixed(2)})`;
					ctx.lineWidth = 1;
					const step = 8;
					const phase = t * 120;
					ctx.beginPath();
					for (let y = phase % step; y < h; y += step * 3) {
						const waveOffset = Math.sin(y * 0.05 + omega60) * 12 * decay;
						ctx.moveTo(0, y + waveOffset);
						ctx.lineTo(w, y + waveOffset);
					}
					ctx.stroke();
				}

				const bezelGrad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.45, cx, cy, Math.max(w, h) * 0.72);
				bezelGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
				bezelGrad.addColorStop(0.7, `rgba(0, 0, 0, ${(0.45 * decay).toFixed(2)})`);
				bezelGrad.addColorStop(1, `rgba(0, 0, 0, ${(0.85 * decay).toFixed(2)})`);
				ctx.fillStyle = bezelGrad;
				ctx.fillRect(0, 0, w, h);
			}

			degaussAnimId = requestAnimationFrame(loopDegauss);
		}
		degaussAnimId = requestAnimationFrame(loopDegauss);
	}

	function startDegauss() {
		if (isDegauss) return;
		closeAllActiveModes();
		isDegauss = true;
		if (degaussHud) {
			degaussHud.style.display = 'flex';
			degaussHud.classList.remove('hidden');
		}
		document.body.classList.add('crt-active');
		pulseDegauss();
		updateDrawerActiveUI();
	}

	function resetDegauss() {
		if (!isDegauss) return;
		isDegauss = false;
		cancelAnimationFrame(degaussAnimId);
		degaussAnimId = 0;
		if (degaussHud) {
			degaussHud.classList.add('hidden');
			degaussHud.style.display = 'none';
		}
		if (degaussCanvas) {
			degaussCanvas.classList.add('hidden');
			degaussCanvas.style.display = 'none';
			degaussCanvas.getContext('2d')?.clearRect(0, 0, degaussCanvas.width, degaussCanvas.height);
		}
		if (mainEl) {
			mainEl.style.transform = '';
			mainEl.style.filter = '';
		}
		document.body.classList.remove('crt-active', 'crt-degaussing');
		updateDrawerActiveUI();
	}

	degaussReBtn?.addEventListener('click', pulseDegauss);
	degaussExitBtn?.addEventListener('click', resetDegauss);

	// --- 4. 3D SILICON CYCLONE ---
	let sphereAnimId = 0;
	let sphereRotX = 0;
	let sphereRotY = 0;
	let sphereVelX = 0;
	let sphereVelY = 0.005;
	let isSphereDragging = false;
	let lastSphereX = 0;
	let lastSphereY = 0;
	let hoveredSphereEl: HTMLElement | null = null;
	let sphereAbortController: AbortController | null = null;

	interface SpherePoint {
		el: HTMLElement;
		origLeft: number;
		origTop: number;
		origW: number;
		origH: number;
		px: number;
		py: number;
		pz: number;
	}
	let spherePoints: SpherePoint[] = [];

	function handleSpherePointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement)?.closest('.ee-hud, .wafer-modal, .lab-extras-modal')) return;
		isSphereDragging = true;
		lastSphereX = e.clientX;
		lastSphereY = e.clientY;
	}
	function handleSpherePointerMove(e: PointerEvent) {
		if (!isSphereDragging) return;
		sphereVelY = (e.clientX - lastSphereX) * 0.0035;
		sphereVelX = -(e.clientY - lastSphereY) * 0.0035;
		lastSphereX = e.clientX;
		lastSphereY = e.clientY;
	}
	function handleSpherePointerUp() {
		isSphereDragging = false;
	}

	function startSphere() {
		if (isSphere) return;
		closeAllActiveModes();
		isSphere = true;
		if (sphereHud) {
			sphereHud.style.display = 'flex';
			sphereHud.classList.remove('hidden');
		}
		if (sphereCore) {
			sphereCore.style.display = 'flex';
			sphereCore.classList.remove('hidden');
		}
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';
		window.dispatchEvent(new CustomEvent('pause-cad-render'));

		const cards = Array.from(document.querySelectorAll<HTMLElement>(PHYSICS_SELECTOR)).filter(
			(el) => el.getBoundingClientRect().height > 0
		);
		const R = Math.min(window.innerWidth, window.innerHeight) * 0.38;
		const phi = Math.PI * (3 - Math.sqrt(5));

		sphereAbortController?.abort();
		sphereAbortController = new AbortController();
		const sig = sphereAbortController.signal;

		spherePoints = cards.map((el, i) => {
			const rect = el.getBoundingClientRect();
			const y = 1 - (i / Math.max(1, cards.length - 1)) * 2;
			const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
			const theta = phi * i;
			el.style.transition = 'none';
			el.style.willChange = 'transform, opacity';
			el.addEventListener('pointerenter', () => { hoveredSphereEl = el; }, { signal: sig });
			el.addEventListener('pointerleave', () => { if (hoveredSphereEl === el) hoveredSphereEl = null; }, { signal: sig });
			return {
				el,
				origLeft: rect.left,
				origTop: rect.top,
				origW: rect.width,
				origH: rect.height,
				px: Math.cos(theta) * rAtY * R,
				py: y * R,
				pz: Math.sin(theta) * rAtY * R,
			};
		});

		window.addEventListener('pointerdown', handleSpherePointerDown, { signal: sig });
		window.addEventListener('pointermove', handleSpherePointerMove, { signal: sig });
		window.addEventListener('pointerup', handleSpherePointerUp, { signal: sig });

		function loopSphere() {
			if (!isSphere) return;
			if (!isSphereDragging) {
				sphereVelX *= 0.95;
				sphereVelY = sphereVelY * 0.95 + 0.003 * 0.05;
			}
			sphereRotX += sphereVelX;
			sphereRotY += sphereVelY;

			const cosY = Math.cos(sphereRotY),
				sinY = Math.sin(sphereRotY);
			const cosX = Math.cos(sphereRotX),
				sinX = Math.sin(sphereRotX);
			const cx = window.innerWidth / 2;
			const cy = window.innerHeight / 2;

			spherePoints.forEach((p) => {
				const x1 = p.px * cosY - p.pz * sinY;
				const z1 = p.px * sinY + p.pz * cosY;
				const y1 = p.py * cosX - z1 * sinX;
				const z2 = p.py * sinX + z1 * cosX;

				const targetX = cx + x1 - p.origLeft - p.origW / 2;
				const targetY = cy + y1 - p.origTop - p.origH / 2;
				const depthNorm = Math.max(0, Math.min(1, (z2 + R) / (2 * R)));
				const isHovered = hoveredSphereEl === p.el;
				const scale = isHovered ? 1.15 : 0.55 + depthNorm * 0.5;
				const opacity = isHovered ? 1 : 0.35 + depthNorm * 0.65;
				const zIndex = isHovered ? 9999 : Math.round(depthNorm * 1000);

				p.el.style.transform = `translate3d(${targetX.toFixed(1)}px, ${targetY.toFixed(1)}px, ${z2.toFixed(1)}px) scale(${scale.toFixed(2)})`;
				p.el.style.opacity = opacity.toFixed(2);
				p.el.style.zIndex = zIndex.toString();
			});

			const dieCube = sphereCore?.querySelector('.die-cube') as HTMLElement | null;
			if (dieCube) {
				dieCube.style.transform = `rotateX(${-sphereRotX * 57.3}deg) rotateY(${sphereRotY * 57.3}deg)`;
			}
			sphereAnimId = requestAnimationFrame(loopSphere);
		}
		sphereAnimId = requestAnimationFrame(loopSphere);
		updateDrawerActiveUI();
	}

	function resetSphere() {
		if (!isSphere) return;
		isSphere = false;
		hoveredSphereEl = null;
		cancelAnimationFrame(sphereAnimId);
		sphereAnimId = 0;
		sphereAbortController?.abort();
		sphereAbortController = null;

		if (sphereHud) {
			sphereHud.classList.add('hidden');
			sphereHud.style.display = 'none';
		}
		if (sphereCore) {
			sphereCore.classList.add('hidden');
			sphereCore.style.display = 'none';
		}
		document.documentElement.style.overflow = '';
		document.body.style.overflow = '';
		window.dispatchEvent(new CustomEvent('resume-cad-render'));

		spherePoints.forEach((p) => {
			p.el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
			p.el.style.transform = '';
			p.el.style.opacity = '';
			p.el.style.zIndex = '';
		});
		window.setTimeout(() => {
			spherePoints.forEach((p) => {
				p.el.style.transition = '';
				p.el.style.willChange = '';
				p.el.style.transform = '';
				p.el.style.opacity = '';
				p.el.style.zIndex = '';
			});
			spherePoints = [];
		}, 500);
		updateDrawerActiveUI();
	}
	sphereExitBtn?.addEventListener('click', resetSphere);

	// --- 5. QUANTUM TUNNELING (Pointer Events, Pre-rendered Glow Sprites, 0% Idle rAF) ---
	let quantumAnimId = 0;
	let quantumPointerX = -999;
	let quantumPointerY = -999;
	let quantumState: 'swirling' | 'reassembling' = 'swirling';
	let quantumCtx: CanvasRenderingContext2D | null = null;
	const CHIP_COLORS = ['#f97316', '#38bdf8', '#0ea5e9', '#fbbf24', '#ffffff', '#34d399', '#c084fc'];
	const chipSpriteCache = new Map<string, HTMLCanvasElement>();

	function getChipSprite(color: string): HTMLCanvasElement {
		let spr = chipSpriteCache.get(color);
		if (spr) return spr;
		spr = document.createElement('canvas');
		spr.width = 24;
		spr.height = 24;
		const c = spr.getContext('2d');
		if (c) {
			c.shadowBlur = 5;
			c.shadowColor = color;
			c.fillStyle = color;
			c.fillRect(6, 6, 12, 12);
			c.shadowBlur = 0;
			c.fillStyle = '#ffffff';
			c.fillRect(9, 9, 6, 6);
		}
		chipSpriteCache.set(color, spr);
		return spr;
	}

	interface QParticle {
		x: number;
		y: number;
		origX: number;
		origY: number;
		vx: number;
		vy: number;
		color: string;
		size: number;
		rot: number;
		vRot: number;
	}
	let qParticles: QParticle[] = [];
	const dissolvedCards = new Set<HTMLElement>();

	function isDogElement(el: HTMLElement): boolean {
		return !!el.closest('.hero .avatar-wrap, #hero-avatar-wrap, #hero-avatar-img, .avatar-img');
	}

	function handleQuantumPointer(e: PointerEvent) {
		quantumPointerX = e.clientX;
		quantumPointerY = e.clientY;
	}

	function handleQuantumTouchMove(e: TouchEvent) {
		if (e.touches[0]) {
			quantumPointerX = e.touches[0].clientX;
			quantumPointerY = e.touches[0].clientY;
		}
	}

	function loopQuantum() {
		if (!isQuantum || !quantumCtx || !quantumCanvas) {
			quantumAnimId = 0;
			return;
		}
		const w = window.innerWidth;
		const h = window.innerHeight;
		quantumCtx.clearRect(0, 0, w, h);

		if (qParticles.length === 0) {
			quantumAnimId = 0;
			return;
		}

		for (let i = 0; i < qParticles.length; i++) {
			const p = qParticles[i];
			if (quantumState === 'reassembling') {
				const dx = p.origX - p.x;
				const dy = p.origY - p.y;
				p.vx = p.vx * 0.82 + dx * 0.18;
				p.vy = p.vy * 0.82 + dy * 0.18;
				p.x += p.vx;
				p.y += p.vy;
			} else {
				p.vx *= 0.985;
				p.vy *= 0.985;
				p.vy -= 0.035;
				p.x += p.vx;
				p.y += p.vy;
				p.rot += p.vRot;

				const dist = Math.hypot(p.x - quantumPointerX, p.y - quantumPointerY);
				if (dist < 180 && dist > 2) {
					const force = (1 - dist / 180) * 4.5;
					p.vx += (-(p.y - quantumPointerY) / dist) * force;
					p.vy += ((p.x - quantumPointerX) / dist) * force;
				}
			}

			const spr = getChipSprite(p.color);
			const drawSize = p.size * 2;
			quantumCtx.save();
			quantumCtx.translate(p.x, p.y);
			quantumCtx.rotate(p.rot);
			quantumCtx.drawImage(spr, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
			quantumCtx.restore();
		}

		if (quantumState === 'reassembling') {
			let allSnapped = true;
			for (let i = 0; i < qParticles.length; i += 6) {
				const p = qParticles[i];
				if (Math.hypot(p.x - p.origX, p.y - p.origY) > 8) {
					allSnapped = false;
					break;
				}
			}
			if (allSnapped) {
				dissolvedCards.forEach((c) => {
					c.style.opacity = '';
					c.style.transform = '';
					c.style.pointerEvents = '';
				});
				dissolvedCards.clear();
				qParticles = [];
				quantumState = 'swirling';
				quantumCtx.clearRect(0, 0, w, h);
				quantumAnimId = 0;
				return;
			}
		}

		quantumAnimId = requestAnimationFrame(loopQuantum);
	}

	function ensureQuantumLoopRunning() {
		if (!quantumAnimId && isQuantum && qParticles.length > 0) {
			quantumAnimId = requestAnimationFrame(loopQuantum);
		}
	}

	function dissolveCard(card: HTMLElement) {
		if (dissolvedCards.has(card) || isDogElement(card)) return;
		dissolvedCards.add(card);

		const rect = card.getBoundingClientRect();
		card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
		card.style.opacity = '0';
		card.style.transform = 'scale(0.96)';
		card.style.pointerEvents = 'none';

		const count = Math.min(450, Math.max(140, Math.floor((rect.width * rect.height) / 350)));
		for (let i = 0; i < count; i++) {
			const px = rect.left + Math.random() * rect.width;
			const py = rect.top + Math.random() * rect.height;
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 5.5;
			qParticles.push({
				x: px,
				y: py,
				origX: px,
				origY: py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 1.5,
				color: CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)],
				size: Math.random() * 4.5 + 4.5,
				rot: Math.random() * Math.PI * 2,
				vRot: (Math.random() - 0.5) * 0.16,
			});
		}

		audioEngine.playQuantumDisintegrate();
		ensureQuantumLoopRunning();
	}

	function handleQuantumClick(e: MouseEvent) {
		if (!isQuantum) return;
		const target = e.target as HTMLElement;
		if (target.closest('.ee-hud, .wafer-modal, .lab-extras-modal, #footer-extras-btn')) return;

		if (isDogElement(target)) {
			e.preventDefault();
			e.stopPropagation();
			const avatarWrap = document.getElementById('hero-avatar-wrap') || document.querySelector('.hero .avatar-wrap');
			if (avatarWrap) {
				const shieldPill = document.createElement('div');
				shieldPill.className = 'morale-boost-pill mono';
				shieldPill.style.borderColor = '#38bdf8';
				shieldPill.style.color = '#38bdf8';
				shieldPill.textContent = '🐾 Protected by CMO! (Quantum-Stabilized 🛡️)';
				avatarWrap.appendChild(shieldPill);
				window.setTimeout(() => shieldPill.remove(), 1600);
			}
			window.__boopDog?.();
			return;
		}

		const card = target.closest(DISSOLVE_SELECTOR) as HTMLElement | null;
		if (card && !dissolvedCards.has(card)) {
			e.preventDefault();
			e.stopPropagation();
			dissolveCard(card);
		}
	}

	function dissolveAllVisible() {
		if (!isQuantum) return;
		const winH = window.innerHeight;
		const cards = Array.from(document.querySelectorAll<HTMLElement>(DISSOLVE_SELECTOR)).filter((c) => {
			if (isDogElement(c)) return false;
			const r = c.getBoundingClientRect();
			return r.bottom > 0 && r.top < winH && !dissolvedCards.has(c);
		});
		cards.forEach((c, idx) => window.setTimeout(() => dissolveCard(c), idx * 55));
	}

	function startQuantum() {
		if (isQuantum || !quantumCanvas) return;
		closeAllActiveModes();
		isQuantum = true;
		if (quantumHud) {
			quantumHud.style.display = 'flex';
			quantumHud.classList.remove('hidden');
		}
		quantumCanvas.style.display = 'block';
		quantumCanvas.classList.remove('hidden');
		document.body.classList.add('quantum-active');

		quantumCtx = sizeFullscreenCanvas(quantumCanvas);
		document.querySelectorAll<HTMLElement>(DISSOLVE_SELECTOR).forEach((c) => {
			if (!isDogElement(c)) c.classList.add('quantum-targetable');
		});

		quantumState = 'swirling';
		window.addEventListener('pointermove', handleQuantumPointer, { passive: true });
		window.addEventListener('touchmove', handleQuantumTouchMove, { passive: true });
		window.addEventListener('click', handleQuantumClick, true);
		updateDrawerActiveUI();
	}

	function resetQuantum() {
		if (!isQuantum) return;
		isQuantum = false;
		cancelAnimationFrame(quantumAnimId);
		quantumAnimId = 0;
		if (quantumHud) {
			quantumHud.classList.add('hidden');
			quantumHud.style.display = 'none';
		}
		if (quantumCanvas) {
			quantumCanvas.classList.add('hidden');
			quantumCanvas.style.display = 'none';
		}
		document.body.classList.remove('quantum-active');
		window.removeEventListener('pointermove', handleQuantumPointer);
		window.removeEventListener('touchmove', handleQuantumTouchMove);
		window.removeEventListener('click', handleQuantumClick, true);

		document.querySelectorAll<HTMLElement>(DISSOLVE_SELECTOR).forEach((c) => {
			c.style.opacity = '';
			c.style.transform = '';
			c.style.pointerEvents = '';
			c.classList.remove('quantum-targetable');
		});
		dissolvedCards.clear();
		qParticles = [];
		quantumCtx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
		updateDrawerActiveUI();
	}

	quantumAllBtn?.addEventListener('click', dissolveAllVisible);
	quantumReBtn?.addEventListener('click', () => {
		if (!isQuantum || quantumState === 'reassembling') return;
		quantumState = 'reassembling';
		ensureQuantumLoopRunning();
	});
	quantumExitBtn?.addEventListener('click', resetQuantum);

	// --- 6. INFRARED THERMAL CAM (Pointer Events + Touch-Action None + Audio Teardown) ---
	let thermalAnimId = 0;
	let thermalToolMode: 'cryo' | 'heatgun' = 'cryo';
	let isThermalSpraying = false;
	let thermalPointerX = 0;
	let thermalPointerY = 0;
	let probeTemp = 24.5;
	let cpuTemp = 98.4;
	let vrmTemp = 104.2;
	let memTemp = 71.5;

	interface ThermalVapor {
		x: number;
		y: number;
		vx: number;
		vy: number;
		radius: number;
		life: number;
		maxLife: number;
		isCryo: boolean;
	}
	let thermalVapors: ThermalVapor[] = [];
	interface FrostCrystal {
		x: number;
		y: number;
		angle: number;
		length: number;
		branches: { offset: number; angle: number; length: number }[];
		life: number;
		maxLife: number;
	}
	let frostCrystals: FrostCrystal[] = [];
	interface ThermalHeatSpot {
		x: number;
		y: number;
		radius: number;
		life: number;
		maxLife: number;
	}
	let heatSpots: ThermalHeatSpot[] = [];

	const tToolText = document.getElementById('thermal-tool-text');
	const tToolBtn = document.getElementById('thermal-tool-btn');
	const tProbeVal = document.getElementById('t-cursor-val');
	const tCpuVal = document.getElementById('t-cpu-val');
	const tVrmVal = document.getElementById('t-vrm-val');
	const tMemVal = document.getElementById('t-mem-val');
	const tSpotCursor = document.getElementById('t-spot-cursor');

	let cachedCryoSprite: HTMLCanvasElement | null = null;
	let cachedHeatSprite: HTMLCanvasElement | null = null;
	let cachedHeatSpotSprite: HTMLCanvasElement | null = null;
	let thermalCtx: CanvasRenderingContext2D | null = null;

	function initThermalSprites() {
		if (cachedCryoSprite) return;

		cachedCryoSprite = document.createElement('canvas');
		cachedCryoSprite.width = 128;
		cachedCryoSprite.height = 128;
		const cCtx = cachedCryoSprite.getContext('2d');
		if (cCtx) {
			const g = cCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
			g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
			g.addColorStop(0.25, 'rgba(224, 242, 254, 0.75)');
			g.addColorStop(0.55, 'rgba(56, 189, 248, 0.40)');
			g.addColorStop(0.85, 'rgba(14, 165, 233, 0.15)');
			g.addColorStop(1, 'rgba(14, 165, 233, 0)');
			cCtx.fillStyle = g;
			cCtx.fillRect(0, 0, 128, 128);
		}

		cachedHeatSprite = document.createElement('canvas');
		cachedHeatSprite.width = 128;
		cachedHeatSprite.height = 128;
		const hCtx = cachedHeatSprite.getContext('2d');
		if (hCtx) {
			const g = hCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
			g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
			g.addColorStop(0.28, 'rgba(254, 240, 138, 0.80)');
			g.addColorStop(0.58, 'rgba(249, 115, 22, 0.45)');
			g.addColorStop(0.85, 'rgba(225, 29, 72, 0.18)');
			g.addColorStop(1, 'rgba(147, 51, 234, 0)');
			hCtx.fillStyle = g;
			hCtx.fillRect(0, 0, 128, 128);
		}

		cachedHeatSpotSprite = document.createElement('canvas');
		cachedHeatSpotSprite.width = 96;
		cachedHeatSpotSprite.height = 96;
		const sCtx = cachedHeatSpotSprite.getContext('2d');
		if (sCtx) {
			const g = sCtx.createRadialGradient(48, 48, 0, 48, 48, 48);
			g.addColorStop(0, 'rgba(255, 255, 255, 0.80)');
			g.addColorStop(0.3, 'rgba(249, 115, 22, 0.60)');
			g.addColorStop(0.7, 'rgba(225, 29, 72, 0.30)');
			g.addColorStop(1, 'rgba(225, 29, 72, 0)');
			sCtx.fillStyle = g;
			sCtx.fillRect(0, 0, 96, 96);
		}
	}

	function handleThermalPointerMove(e: PointerEvent) {
		thermalPointerX = e.clientX;
		thermalPointerY = e.clientY;
		if (tSpotCursor) {
			tSpotCursor.style.transform = `translate3d(${e.clientX + 14}px, ${e.clientY + 14}px, 0)`;
		}
	}
	function handleThermalPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement)?.closest('.ee-hud, .wafer-modal, .lab-extras-modal')) return;
		isThermalSpraying = true;
		thermalPointerX = e.clientX;
		thermalPointerY = e.clientY;
		if (tSpotCursor) {
			tSpotCursor.style.transform = `translate3d(${e.clientX + 14}px, ${e.clientY + 14}px, 0)`;
		}
		audioEngine.startThermalSpray(thermalToolMode);
	}
	function handleThermalPointerUp() {
		if (!isThermalSpraying) return;
		isThermalSpraying = false;
		audioEngine.stopThermalSpray(false);
	}

	function startThermal() {
		if (isThermal || !thermalCanvas) return;
		closeAllActiveModes();
		isThermal = true;
		initThermalSprites();

		if (thermalHud) {
			thermalHud.style.display = 'flex';
			thermalHud.classList.remove('hidden');
		}
		if (thermalScaleBar) {
			thermalScaleBar.style.display = 'flex';
			thermalScaleBar.classList.remove('hidden');
		}
		if (thermalSpots) {
			thermalSpots.style.display = 'block';
			thermalSpots.classList.remove('hidden');
		}
		thermalCanvas.style.display = 'block';
		thermalCanvas.classList.remove('hidden');
		document.body.classList.add('thermal-active');

		thermalCtx = sizeFullscreenCanvas(thermalCanvas);
		window.addEventListener('pointermove', handleThermalPointerMove, { passive: true });
		window.addEventListener('pointerdown', handleThermalPointerDown);
		window.addEventListener('pointerup', handleThermalPointerUp);
		window.addEventListener('pointercancel', handleThermalPointerUp);

		let lastDomUpdate = 0;
		function loopThermal() {
			if (!isThermal || !thermalCtx || !thermalCanvas) return;
			const w = window.innerWidth;
			const h = window.innerHeight;
			thermalCtx.clearRect(0, 0, w, h);

			if (isThermalSpraying) {
				if (thermalToolMode === 'cryo') {
					probeTemp = Math.max(-196, probeTemp - 8.5);
					if (thermalVapors.length < 45) {
						for (let i = 0; i < 2; i++) {
							const ang = Math.random() * Math.PI * 2;
							const spd = 1.5 + Math.random() * 4.0;
							thermalVapors.push({
								x: thermalPointerX + (Math.random() - 0.5) * 16,
								y: thermalPointerY + (Math.random() - 0.5) * 16,
								vx: Math.cos(ang) * spd,
								vy: Math.sin(ang) * spd + 1.2,
								radius: 18 + Math.random() * 22,
								life: 0,
								maxLife: 26 + Math.random() * 16,
								isCryo: true,
							});
						}
					}
					if (Math.random() > 0.65 && frostCrystals.length < 25) {
						const branches = [];
						const branchCount = 3 + Math.floor(Math.random() * 2);
						for (let b = 0; b < branchCount; b++) {
							branches.push({
								offset: 0.3 + Math.random() * 0.5,
								angle: (Math.random() > 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.3),
								length: 6 + Math.random() * 8,
							});
						}
						frostCrystals.push({
							x: thermalPointerX + (Math.random() - 0.5) * 36,
							y: thermalPointerY + (Math.random() - 0.5) * 36,
							angle: Math.random() * Math.PI * 2,
							length: 15 + Math.random() * 18,
							branches,
							life: 0,
							maxLife: 80 + Math.random() * 40,
						});
					}
				} else {
					probeTemp = Math.min(450, probeTemp + 12.0);
					if (thermalVapors.length < 45) {
						for (let i = 0; i < 2; i++) {
							const ang = Math.random() * Math.PI * 2;
							const spd = 1.8 + Math.random() * 4.0;
							thermalVapors.push({
								x: thermalPointerX + (Math.random() - 0.5) * 16,
								y: thermalPointerY + (Math.random() - 0.5) * 16,
								vx: Math.cos(ang) * spd,
								vy: Math.sin(ang) * spd - 2.5,
								radius: 16 + Math.random() * 22,
								life: 0,
								maxLife: 24 + Math.random() * 14,
								isCryo: false,
							});
						}
					}
					if (Math.random() > 0.65 && heatSpots.length < 20) {
						heatSpots.push({
							x: thermalPointerX + (Math.random() - 0.5) * 20,
							y: thermalPointerY + (Math.random() - 0.5) * 20,
							radius: 16 + Math.random() * 22,
							life: 0,
							maxLife: 55 + Math.random() * 25,
						});
					}
				}
			} else {
				probeTemp += (24.5 - probeTemp) * 0.05;
			}

			const now = performance.now();
			if (now - lastDomUpdate > 60) {
				lastDomUpdate = now;
				cpuTemp += (Math.random() - 0.49) * 0.3;
				vrmTemp += (Math.random() - 0.49) * 0.4;
				memTemp += (Math.random() - 0.49) * 0.2;
				if (tCpuVal) tCpuVal.textContent = `${cpuTemp.toFixed(1)}°C`;
				if (tVrmVal) tVrmVal.textContent = `${vrmTemp.toFixed(1)}°C`;
				if (tMemVal) tMemVal.textContent = `${memTemp.toFixed(1)}°C`;
				if (tProbeVal) {
					if (probeTemp <= -100) {
						tProbeVal.textContent = `${probeTemp.toFixed(1)}°C [SUPERCOOLED 77K]`;
						tProbeVal.style.color = '#38bdf8';
					} else if (probeTemp >= 120) {
						tProbeVal.textContent = `${probeTemp.toFixed(1)}°C [RUNAWAY SATURATION]`;
						tProbeVal.style.color = '#ef4444';
					} else {
						tProbeVal.textContent = `${probeTemp.toFixed(1)}°C`;
						tProbeVal.style.color = '#10b981';
					}
				}
			}

			if (cachedHeatSpotSprite) {
				for (let i = heatSpots.length - 1; i >= 0; i--) {
					const hs = heatSpots[i];
					hs.life++;
					thermalCtx.globalAlpha = Math.max(0, Math.min(1, (1 - hs.life / hs.maxLife) * 0.45));
					const d = hs.radius * 2;
					thermalCtx.drawImage(cachedHeatSpotSprite, hs.x - hs.radius, hs.y - hs.radius, d, d);
					if (hs.life >= hs.maxLife) heatSpots.splice(i, 1);
				}
			}

			for (let i = frostCrystals.length - 1; i >= 0; i--) {
				const fc = frostCrystals[i];
				fc.life++;
				const alpha = (1 - fc.life / fc.maxLife) * 0.85;
				thermalCtx.strokeStyle = `rgba(224, 242, 254, ${alpha.toFixed(2)})`;
				thermalCtx.lineWidth = 1.4;
				thermalCtx.beginPath();
				for (let sym = 0; sym < 6; sym++) {
					const rootAngle = fc.angle + (sym * Math.PI) / 3;
					const cosR = Math.cos(rootAngle);
					const sinR = Math.sin(rootAngle);
					thermalCtx.moveTo(fc.x, fc.y);
					thermalCtx.lineTo(fc.x + cosR * fc.length, fc.y + sinR * fc.length);
					for (const br of fc.branches) {
						const bx = fc.x + cosR * (fc.length * br.offset);
						const by = fc.y + sinR * (fc.length * br.offset);
						thermalCtx.moveTo(bx, by);
						thermalCtx.lineTo(bx + Math.cos(rootAngle + br.angle) * br.length, by + Math.sin(rootAngle + br.angle) * br.length);
						thermalCtx.moveTo(bx, by);
						thermalCtx.lineTo(bx + Math.cos(rootAngle - br.angle) * br.length, by + Math.sin(rootAngle - br.angle) * br.length);
					}
				}
				thermalCtx.stroke();
				if (fc.life >= fc.maxLife) frostCrystals.splice(i, 1);
			}

			for (let i = thermalVapors.length - 1; i >= 0; i--) {
				const v = thermalVapors[i];
				v.x += v.vx;
				v.y += v.vy;
				v.vx *= 0.96;
				v.vy *= 0.96;
				v.life++;
				const progress = v.life / v.maxLife;
				const currentRadius = v.radius * (1 + progress * 1.5);
				const sprite = v.isCryo ? cachedCryoSprite : cachedHeatSprite;
				if (sprite) {
					thermalCtx.globalAlpha = Math.max(0, Math.min(1, (1 - progress) * 0.4));
					const d = currentRadius * 2;
					thermalCtx.drawImage(sprite, v.x - currentRadius, v.y - currentRadius, d, d);
				}
				if (v.life >= v.maxLife) thermalVapors.splice(i, 1);
			}
			thermalCtx.globalAlpha = 1.0;

			thermalAnimId = requestAnimationFrame(loopThermal);
		}
		thermalAnimId = requestAnimationFrame(loopThermal);
		updateDrawerActiveUI();
	}

	function resetThermal() {
		if (!isThermal) return;
		isThermal = false;
		isThermalSpraying = false;
		audioEngine.stopThermalSpray(true);
		cancelAnimationFrame(thermalAnimId);
		thermalAnimId = 0;

		if (thermalHud) {
			thermalHud.classList.add('hidden');
			thermalHud.style.display = 'none';
		}
		if (thermalScaleBar) {
			thermalScaleBar.classList.add('hidden');
			thermalScaleBar.style.display = 'none';
		}
		if (thermalSpots) {
			thermalSpots.classList.add('hidden');
			thermalSpots.style.display = 'none';
		}
		if (thermalCanvas) {
			thermalCanvas.classList.add('hidden');
			thermalCanvas.style.display = 'none';
		}
		document.body.classList.remove('thermal-active');
		window.removeEventListener('pointermove', handleThermalPointerMove);
		window.removeEventListener('pointerdown', handleThermalPointerDown);
		window.removeEventListener('pointerup', handleThermalPointerUp);
		window.removeEventListener('pointercancel', handleThermalPointerUp);
		thermalVapors = [];
		frostCrystals = [];
		heatSpots = [];
		thermalCtx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
		updateDrawerActiveUI();
	}

	tToolBtn?.addEventListener('click', () => {
		if (thermalToolMode === 'cryo') {
			thermalToolMode = 'heatgun';
			if (tToolText) tToolText.textContent = 'TOOL: HEAT GUN (450°C)';
			tToolBtn.textContent = 'Switch to LN2 Cryo (-196°C)';
		} else {
			thermalToolMode = 'cryo';
			if (tToolText) tToolText.textContent = 'TOOL: LN2 CRYO-SPRAY (-196°C)';
			tToolBtn.textContent = 'Switch to Heat Gun (450°C)';
		}
		if (isThermalSpraying) audioEngine.startThermalSpray(thermalToolMode);
	});
	thermalResetBtn?.addEventListener('click', () => {
		probeTemp = 24.5;
		cpuTemp = 98.4;
		vrmTemp = 104.2;
		memTemp = 71.5;
		thermalVapors = [];
		frostCrystals = [];
		heatSpots = [];
	});
	thermalExitBtn?.addEventListener('click', resetThermal);

	// --- 7. 8x8 BIT CARRY-SAVE ARRAY MULTIPLIER ---
	const multDx = 56;
	const multDy = 46;
	const multCellW = 28;
	const multCellH = 28;
	const multXBase = 500;
	const multYBase = 46;
	const multPBusY = 470;

	function getCellPos(r: number, c: number) {
		if (r < 8) {
			const x = multXBase + (7 - r) * multDx - c * multDx;
			const y = multYBase + r * multDy;
			return { x, y, cx: x + multCellW / 2, cy: y + multCellH / 2 };
		}
		const x = c < 7 ? multXBase - (c + 1) * multDx : multXBase - 8 * multDx;
		const y = multYBase + 8 * multDy;
		return { x, y, cx: x + multCellW / 2, cy: y + multCellH / 2 };
	}

	interface MultiplierState {
		S: number[][];
		C: number[][];
		PP: number[][];
		P: number[];
		pVal: number;
	}

	function computeMultiplierState(X: number, Y: number): MultiplierState {
		const S = Array.from({ length: 9 }, () => Array(8).fill(0));
		const C = Array.from({ length: 9 }, () => Array(8).fill(0));
		const PP = Array.from({ length: 8 }, () => Array(8).fill(0));
		const P = Array(16).fill(0);

		for (let r = 0; r < 8; r++) {
			const xr = (X >> r) & 1;
			for (let c = 0; c < 8; c++) PP[r][c] = xr & ((Y >> c) & 1);
		}
		for (let c = 0; c < 8; c++) S[0][c] = PP[0][c];
		P[0] = S[0][0];

		for (let r = 1; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				const pp = PP[r][c];
				const sin = c < 7 ? S[r - 1][c + 1] : 0;
				const cin = C[r - 1][c];
				S[r][c] = sin ^ cin ^ pp;
				C[r][c] = (sin & cin) | (sin & pp) | (cin & pp);
			}
			P[r] = S[r][0];
		}

		let cInRight = 0;
		for (let k = 0; k < 8; k++) {
			const sin = k < 7 ? S[7][k + 1] : 0;
			const cinTop = C[7][k];
			S[8][k] = sin ^ cinTop ^ cInRight;
			C[8][k] = (sin & cinTop) | (sin & cInRight) | (cinTop & cInRight);
			cInRight = C[8][k];
			P[8 + k] = S[8][k];
		}

		let pVal = 0;
		for (let i = 0; i < 16; i++) pVal |= P[i] << i;
		return { S, C, PP, P, pVal };
	}

	function buildMultiplierSvg() {
		if (!multSvg) return;
		let svgHtml = `
			<defs>
				<marker id="arr-dim" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
					<polygon points="0 0, 5 2.5, 0 5" fill="rgba(148, 163, 184, 0.45)" />
				</marker>
				<marker id="arr-act" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
					<polygon points="0 0, 5 2.5, 0 5" fill="#22c55e" />
				</marker>
				<filter id="mult-glow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="2.0" result="blur" />
					<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
				</filter>
			</defs>`;

		for (let c = 0; c < 8; c++) {
			const pos = getCellPos(0, c);
			svgHtml += `<line class="mult-wire wire-dim" x1="${pos.cx}" y1="${pos.y - 18}" x2="${pos.cx}" y2="${pos.y}" marker-end="url(#arr-dim)" /><text class="wire-label" x="${pos.cx}" y="${pos.y - 21}" text-anchor="middle">0</text>`;
		}
		for (let r = 1; r < 8; r++) {
			const pos = getCellPos(r, 7);
			svgHtml += `<line class="mult-wire wire-dim" x1="${pos.cx}" y1="${pos.y - 16}" x2="${pos.cx}" y2="${pos.y}" marker-end="url(#arr-dim)" /><text class="wire-label" x="${pos.cx}" y="${pos.y - 19}" text-anchor="middle">0</text>`;
		}
		const r8TopPos = getCellPos(8, 7);
		svgHtml += `<line class="mult-wire wire-dim" x1="${r8TopPos.cx}" y1="${r8TopPos.y - 16}" x2="${r8TopPos.cx}" y2="${r8TopPos.y}" marker-end="url(#arr-dim)" /><text class="wire-label" x="${r8TopPos.cx}" y="${r8TopPos.y - 19}" text-anchor="middle">0</text>`;
		const r8Cell0 = getCellPos(8, 0);
		svgHtml += `<line class="mult-wire wire-dim" x1="${r8Cell0.x + multCellW + 16}" y1="${r8Cell0.cy}" x2="${r8Cell0.x + multCellW}" y2="${r8Cell0.cy}" marker-end="url(#arr-dim)" /><text class="wire-label" x="${r8Cell0.x + multCellW + 21}" y="${r8Cell0.cy + 3}">0</text>`;
		const r8Cell7 = getCellPos(8, 7);
		svgHtml += `<line class="mult-wire wire-dim" x1="${r8Cell7.x}" y1="${r8Cell7.cy}" x2="${r8Cell7.x - 18}" y2="${r8Cell7.cy}" marker-end="url(#arr-dim)" /><text class="wire-label" x="${r8Cell7.x - 23}" y="${r8Cell7.cy + 3}" text-anchor="end">0</text>`;

		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 7; c++) {
				const top = getCellPos(r, c + 1);
				const bot = getCellPos(r + 1, c);
				svgHtml += `<line id="wire-sum-${r}-${c + 1}" class="mult-wire wire-dim" x1="${top.cx}" y1="${top.y + multCellH}" x2="${bot.cx}" y2="${bot.y}" marker-end="url(#arr-dim)" data-type="sum" data-r="${r}" data-c="${c + 1}" />`;
			}
		}
		for (let k = 0; k < 7; k++) {
			const top = getCellPos(7, k + 1);
			const bot = getCellPos(8, k);
			svgHtml += `<line id="wire-sum-7-${k + 1}" class="mult-wire wire-dim" x1="${top.cx}" y1="${top.y + multCellH}" x2="${bot.cx}" y2="${bot.y}" marker-end="url(#arr-dim)" data-type="sum" data-r="7" data-c="${k + 1}" />`;
		}
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 8; c++) {
				const top = getCellPos(r, c);
				const bot = getCellPos(r + 1, c);
				svgHtml += `<line id="wire-carry-${r}-${c}" class="mult-wire wire-dim" x1="${top.x + 6}" y1="${top.y + multCellH}" x2="${bot.x + multCellW - 6}" y2="${bot.y}" marker-end="url(#arr-dim)" data-type="carry" data-r="${r}" data-c="${c}" />`;
			}
		}
		for (let k = 0; k < 8; k++) {
			const top = getCellPos(7, k);
			const bot = getCellPos(8, k);
			svgHtml += `<line id="wire-carry-7-${k}" class="mult-wire wire-dim" x1="${top.x + 6}" y1="${top.y + multCellH}" x2="${bot.x + multCellW - 6}" y2="${bot.y}" marker-end="url(#arr-dim)" data-type="carry" data-r="7" data-c="${k}" />`;
		}
		for (let k = 0; k < 7; k++) {
			const left = getCellPos(8, k);
			const right = getCellPos(8, k + 1);
			svgHtml += `<line id="wire-carry-8-${k}" class="mult-wire wire-dim" x1="${left.x}" y1="${left.cy}" x2="${right.x + multCellW}" y2="${right.cy}" marker-end="url(#arr-dim)" data-type="carry" data-r="8" data-c="${k}" />`;
		}
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				const pos = getCellPos(r, c);
				svgHtml += `<line id="wire-pp-${r}-${c}" class="mult-wire wire-dim" x1="${pos.x + multCellW + 14}" y1="${pos.cy}" x2="${pos.x + multCellW}" y2="${pos.cy}" marker-end="url(#arr-dim)" data-type="pp" data-r="${r}" data-c="${c}" /><text id="lbl-pp-${r}-${c}" class="wire-label" x="${pos.x + multCellW + 7}" y="${pos.cy - 3}" text-anchor="middle">X${r}Y${c}</text>`;
			}
		}
		for (let r = 0; r < 8; r++) {
			const pos = getCellPos(r, 0);
			svgHtml += `<line id="wire-prod-${r}" class="mult-wire wire-dim" x1="${pos.cx}" y1="${pos.y + multCellH}" x2="${pos.cx}" y2="${multPBusY}" marker-end="url(#arr-dim)" data-type="prod" data-bit="${r}" /><text id="lbl-prod-${r}" class="prod-label" x="${pos.cx}" y="${multPBusY + 18}">P${r}</text>`;
		}
		for (let k = 0; k < 8; k++) {
			const pos = getCellPos(8, k);
			svgHtml += `<line id="wire-prod-${8 + k}" class="mult-wire wire-dim" x1="${pos.cx}" y1="${pos.y + multCellH}" x2="${pos.cx}" y2="${multPBusY}" marker-end="url(#arr-dim)" data-type="prod" data-bit="${8 + k}" /><text id="lbl-prod-${8 + k}" class="prod-label" x="${pos.cx}" y="${multPBusY + 18}">P${8 + k}</text>`;
		}
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				const pos = getCellPos(r, c);
				svgHtml += `<g class="mult-cell" id="cell-f-${r}-${c}" data-r="${r}" data-c="${c}"><rect class="cell-box" x="${pos.x}" y="${pos.y}" width="${multCellW}" height="${multCellH}" rx="3" /><text class="cell-label" x="${pos.cx}" y="${pos.cy + 3.5}">F</text></g>`;
			}
		}
		for (let k = 0; k < 8; k++) {
			const pos = getCellPos(8, k);
			svgHtml += `<g class="mult-cell" id="cell-f-8-${k}" data-r="8" data-c="${k}"><rect class="cell-box" x="${pos.x}" y="${pos.y}" width="${multCellW}" height="${multCellH}" rx="3" /><text class="cell-label" x="${pos.cx}" y="${pos.cy + 3.5}">F</text></g>`;
		}

		multSvg.innerHTML = svgHtml;
	}

	function clearCascadeTimeouts() {
		multCascadeTimeouts.forEach((id) => window.clearTimeout(id));
		multCascadeTimeouts = [];
		document.querySelectorAll('.mult-cell.cell-evaluating').forEach((el) => el.classList.remove('cell-evaluating'));
	}

	function renderRegisterBits(containerEl: HTMLElement | null, metaEl: HTMLElement | null, val: number, prefix: string, onToggle: (bit: number) => void) {
		if (containerEl) {
			containerEl.innerHTML = '';
			for (let i = 7; i >= 0; i--) {
				if (i === 3) {
					const gap = document.createElement('div');
					gap.className = 'mult-nibble-gap';
					containerEl.appendChild(gap);
				}
				const bitVal = (val >> i) & 1;
				const col = document.createElement('div');
				col.className = 'mult-bit-col';
				const nameSpan = document.createElement('span');
				nameSpan.className = 'bit-col-name mono';
				nameSpan.textContent = `${prefix}${i}`;
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = `bit-val-btn mono ${bitVal ? 'active' : ''}`;
				btn.title = `Toggle Bit ${prefix}[${i}] (Weight 2^${i} = ${1 << i})`;
				btn.textContent = String(bitVal);
				btn.addEventListener('click', () => onToggle(i));
				col.appendChild(nameSpan);
				col.appendChild(btn);
				containerEl.appendChild(col);
			}
		}
		if (metaEl) {
			const bin = val.toString(2).padStart(8, '0');
			metaEl.textContent = `0x${val.toString(16).toUpperCase().padStart(2, '0')} ▪ ${val} ▪ ${bin.slice(0, 4)} ${bin.slice(4)}₂`;
		}
	}

	function renderMultiplierInputs() {
		renderRegisterBits(multXBits, multXMeta, multX, 'X', (i) => {
			multX ^= 1 << i;
			audioEngine.playBitClick(((multX >> i) & 1) === 1);
			updateMultiplier(true);
		});
		renderRegisterBits(multYBits, multYMeta, multY, 'Y', (i) => {
			multY ^= 1 << i;
			audioEngine.playBitClick(((multY >> i) & 1) === 1);
			updateMultiplier(true);
		});
	}

	function setWireState(wireId: string, val: number, lblId?: string) {
		const wire = document.getElementById(wireId);
		if (wire) {
			wire.setAttribute('class', `mult-wire ${val ? 'wire-active' : 'wire-dim'}`);
			wire.setAttribute('marker-end', val ? 'url(#arr-act)' : 'url(#arr-dim)');
		}
		if (lblId) document.getElementById(lblId)?.classList.toggle('active', !!val);
	}

	function setProductBitUI(bit: number, val: number) {
		setWireState(`wire-prod-${bit}`, val, `lbl-prod-${bit}`);
		const led = document.getElementById(`mult-p-led-${bit}`);
		if (led) {
			led.textContent = String(val);
			led.className = `p-val-led mono ${val ? 'active' : ''}`;
		}
	}

	function renderProductBitsSkeleton(st?: MultiplierState) {
		if (!multPBits) return;
		multPBits.innerHTML = '';
		for (let i = 15; i >= 0; i--) {
			if (i === 11 || i === 7 || i === 3) {
				const gap = document.createElement('div');
				gap.className = 'mult-nibble-gap';
				multPBits.appendChild(gap);
			}
			const val = st ? st.P[i] : 0;
			const col = document.createElement('div');
			col.className = 'mult-bit-col';
			const nameSpan = document.createElement('span');
			nameSpan.className = 'bit-col-name mono';
			nameSpan.textContent = `P${i}`;
			const span = document.createElement('span');
			span.id = `mult-p-led-${i}`;
			span.className = `p-val-led mono ${val && st ? 'active' : ''}`;
			span.title = `Product Bit P[${i}] (Weight 2^${i} = ${1 << i})`;
			span.textContent = st ? String(val) : '0';
			col.appendChild(nameSpan);
			col.appendChild(span);
			multPBits.appendChild(col);
		}
	}

	function runMultiplierCascade(playSound: boolean) {
		clearCascadeTimeouts();
		const st = computeMultiplierState(multX, multY);
		renderMultiplierInputs();
		if (multPDec) multPDec.textContent = 'Calculating...';
		if (multPHex) multPHex.textContent = '0x----';
		if (multPBin) multPBin.textContent = '---- ---- ---- ----₂';
		renderProductBitsSkeleton();

		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				document.getElementById(`cell-f-${r}-${c}`)?.classList.remove('cell-active', 'cell-evaluating');
				setWireState(`wire-pp-${r}-${c}`, 0, `lbl-pp-${r}-${c}`);
				if (r < 7 && c < 7) setWireState(`wire-sum-${r}-${c + 1}`, 0);
				if (r < 7) setWireState(`wire-carry-${r}-${c}`, 0);
			}
		}
		for (let k = 0; k < 8; k++) {
			document.getElementById(`cell-f-8-${k}`)?.classList.remove('cell-active', 'cell-evaluating');
			if (k < 7) setWireState(`wire-sum-7-${k + 1}`, 0);
			setWireState(`wire-carry-7-${k}`, 0);
			if (k < 7) setWireState(`wire-carry-8-${k}`, 0);
			setWireState(`wire-prod-${8 + k}`, 0, `lbl-prod-${8 + k}`);
		}
		for (let i = 0; i < 8; i++) setWireState(`wire-prod-${i}`, 0, `lbl-prod-${i}`);

		multCascadeTimeouts.push(
			window.setTimeout(() => {
				for (let r = 0; r < 8; r++) {
					for (let c = 0; c < 8; c++) setWireState(`wire-pp-${r}-${c}`, st.PP[r][c], `lbl-pp-${r}-${c}`);
				}
				if (multCellInfo) multCellInfo.innerHTML = '<strong>Stage 1/9: Partial Product Generation (t = 0)</strong> ▪ 64 parallel AND gates computing X[r]&middot;Y[c]';
				audioEngine.playCascadeStep(0, 9);
			}, 20)
		);

		const rowDelay = 140;
		for (let r = 0; r < 8; r++) {
			const stepTime = 160 + r * rowDelay;
			multCascadeTimeouts.push(
				window.setTimeout(() => {
					for (let c = 0; c < 8; c++) document.getElementById(`cell-f-${r}-${c}`)?.classList.add('cell-evaluating');
				}, stepTime - 40)
			);
			multCascadeTimeouts.push(
				window.setTimeout(() => {
					for (let c = 0; c < 8; c++) {
						const cell = document.getElementById(`cell-f-${r}-${c}`);
						if (cell) {
							cell.classList.remove('cell-evaluating');
							cell.classList.toggle('cell-active', !!(st.S[r][c] || st.C[r][c] || st.PP[r][c]));
						}
						setWireState(`wire-carry-${r}-${c}`, st.C[r][c]);
						if (c < 7) setWireState(`wire-sum-${r}-${c + 1}`, st.S[r][c + 1]);
					}
					setProductBitUI(r, st.P[r]);
					if (multCellInfo) {
						multCellInfo.innerHTML = r < 7
							? `<strong>Stage ${r + 2}/9: CSA Row ${r} Evaluated</strong> ▪ Product Bit <strong>P[${r}] = ${st.P[r]}</strong> settled`
							: `<strong>Stage 9/9: CSA Row 7 Evaluated</strong> ▪ Product Bit <strong>P[7] = ${st.P[7]}</strong> settled ▪ Entering Vector Merge stage`;
					}
					audioEngine.playCascadeStep(r + 1, 9);
				}, stepTime)
			);
		}

		const r8StartTime = 160 + 7 * rowDelay + 150;
		const r8BitDelay = 60;
		for (let k = 0; k < 8; k++) {
			const bitTime = r8StartTime + k * r8BitDelay;
			multCascadeTimeouts.push(window.setTimeout(() => document.getElementById(`cell-f-8-${k}`)?.classList.add('cell-evaluating'), bitTime - 25));
			multCascadeTimeouts.push(
				window.setTimeout(() => {
					const cell = document.getElementById(`cell-f-8-${k}`);
					if (cell) {
						cell.classList.remove('cell-evaluating');
						cell.classList.toggle('cell-active', !!(st.S[8][k] || st.C[8][k]));
					}
					if (k < 7) setWireState(`wire-carry-8-${k}`, st.C[8][k]);
					setProductBitUI(8 + k, st.P[8 + k]);
					if (multCellInfo) {
						multCellInfo.innerHTML = `<strong>Vector Merge Ripple Adder:</strong> Cell [8,${k}] ▪ Carry propagating left ▪ Bit <strong>P[${8 + k}] = ${st.P[8 + k]}</strong> settled`;
					}
					audioEngine.playCascadeStep(8 + (k + 1) / 8, 9);
				}, bitTime)
			);
		}

		multCascadeTimeouts.push(
			window.setTimeout(() => {
				if (multPDec) multPDec.textContent = `P = ${st.pVal.toLocaleString()}`;
				if (multPHex) multPHex.textContent = `0x${st.pVal.toString(16).toUpperCase().padStart(4, '0')}`;
				if (multPBin) {
					const b = st.pVal.toString(2).padStart(16, '0');
					multPBin.textContent = `${b.slice(0, 4)} ${b.slice(4, 8)} ${b.slice(8, 12)} ${b.slice(12)}₂`;
				}
				if (multCellInfo) {
					multCellInfo.innerHTML = `<strong>✓ Wavefront Settled:</strong> All 9 combinational stages evaluated ▪ <strong>P = ${st.pVal.toLocaleString()}</strong> (0x${st.pVal.toString(16).toUpperCase().padStart(4, '0')})`;
				}
				if (playSound) audioEngine.playMultiplierChime();
			}, r8StartTime + 8 * r8BitDelay + 70)
		);
	}

	function updateMultiplier(playSound = false, forceSlow = false) {
		if (multSlowMode || forceSlow) {
			runMultiplierCascade(playSound);
			return;
		}
		clearCascadeTimeouts();
		const st = computeMultiplierState(multX, multY);
		renderMultiplierInputs();
		if (multPDec) multPDec.textContent = `P = ${st.pVal.toLocaleString()}`;
		if (multPHex) multPHex.textContent = `0x${st.pVal.toString(16).toUpperCase().padStart(4, '0')}`;
		if (multPBin) {
			const b = st.pVal.toString(2).padStart(16, '0');
			multPBin.textContent = `${b.slice(0, 4)} ${b.slice(4, 8)} ${b.slice(8, 12)} ${b.slice(12)}₂`;
		}
		renderProductBitsSkeleton(st);

		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				setWireState(`wire-pp-${r}-${c}`, st.PP[r][c], `lbl-pp-${r}-${c}`);
				if (r < 7 && c < 7) setWireState(`wire-sum-${r}-${c + 1}`, st.S[r][c + 1]);
				if (r < 7) setWireState(`wire-carry-${r}-${c}`, st.C[r][c]);
				document.getElementById(`cell-f-${r}-${c}`)?.classList.toggle('cell-active', !!(st.S[r][c] || st.C[r][c] || st.PP[r][c]));
			}
		}
		for (let k = 0; k < 8; k++) {
			if (k < 7) setWireState(`wire-sum-7-${k + 1}`, st.S[7][k + 1]);
			setWireState(`wire-carry-7-${k}`, st.C[7][k]);
			if (k < 7) setWireState(`wire-carry-8-${k}`, st.C[8][k]);
			document.getElementById(`cell-f-8-${k}`)?.classList.toggle('cell-active', !!(st.S[8][k] || st.C[8][k]));
		}
		for (let i = 0; i < 16; i++) setWireState(`wire-prod-${i}`, st.P[i], `lbl-prod-${i}`);
		if (playSound) audioEngine.playMultiplierChime();
	}

	const DEFAULT_CELL_INFO = 'Hover or tap any cell F or wire to inspect Boolean logic, partial products, sum, and carry propagation.';
	let pinnedMultiplierTargetId: string | null = null;

	function inspectMultiplierTarget(target: SVGElement | null): string | null {
		if (!target || !multCellInfo) return null;
		const cellEl = target.closest('.mult-cell') as SVGElement | null;
		const wireEl = target.closest('.mult-wire') as SVGElement | null;
		const st = computeMultiplierState(multX, multY);

		if (cellEl) {
			const r = parseInt(cellEl.getAttribute('data-r') || '0', 10);
			const c = parseInt(cellEl.getAttribute('data-c') || '0', 10);
			if (r < 8) {
				const pp = st.PP[r][c];
				const sin = c < 7 && r > 0 ? st.S[r - 1][c + 1] : 0;
				const cin = r > 0 ? st.C[r - 1][c] : 0;
				multCellInfo.innerHTML = `<strong>Cell F[${r},${c}] (CSA Row ${r}):</strong> PP=X${r}&middot;Y${c}=<strong>${pp}</strong> ▪ Sin=<strong>${sin}</strong> ▪ Cin=<strong>${cin}</strong> &rarr; <strong>Sum=${st.S[r][c]}</strong>, <strong>Cout=${st.C[r][c]}</strong> ▪ Bit Weight: 2<sup>${r + c}</sup> (${1 << (r + c)})`;
			} else {
				const k = c;
				const sin = k < 7 ? st.S[7][k + 1] : 0;
				const cInRight = k > 0 ? st.C[8][k - 1] : 0;
				multCellInfo.innerHTML = `<strong>Cell F[8,${k}] (Vector-Merge Ripple Adder):</strong> Sin(R7)=<strong>${sin}</strong> ▪ Ctop(R7)=<strong>${st.C[7][k]}</strong> ▪ Cright=<strong>${cInRight}</strong> &rarr; <strong>P${8 + k}=${st.S[8][k]}</strong>, Cout=<strong>${st.C[8][k]}</strong>`;
			}
			return cellEl.id || `cell-${r}-${c}`;
		}

		if (wireEl) {
			const type = wireEl.getAttribute('data-type');
			if (type === 'pp') {
				const r = parseInt(wireEl.getAttribute('data-r') || '0', 10);
				const c = parseInt(wireEl.getAttribute('data-c') || '0', 10);
				multCellInfo.innerHTML = `<strong>Partial Product Wire:</strong> X[${r}] &times; Y[${c}] = ${(multX >> r) & 1} &times; ${(multY >> c) & 1} = <strong>${st.PP[r][c]}</strong> (Weight 2<sup>${r + c}</sup> = ${1 << (r + c)})`;
			} else if (type === 'sum') {
				const r = parseInt(wireEl.getAttribute('data-r') || '0', 10);
				const c = parseInt(wireEl.getAttribute('data-c') || '0', 10);
				multCellInfo.innerHTML = `<strong>Sum Propagation Wire:</strong> S[${r}][${c}] = <strong>${st.S[r][c]}</strong> (Feeding cell below)`;
			} else if (type === 'carry') {
				const r = parseInt(wireEl.getAttribute('data-r') || '0', 10);
				const c = parseInt(wireEl.getAttribute('data-c') || '0', 10);
				multCellInfo.innerHTML = `<strong>Carry Propagation Wire:</strong> C[${r}][${c}] = <strong>${st.C[r][c]}</strong> (Feeding diagonally down-left)`;
			} else if (type === 'prod') {
				const bit = parseInt(wireEl.getAttribute('data-bit') || '0', 10);
				multCellInfo.innerHTML = `<strong>Product Drop Line:</strong> Output Bit <strong>P[${bit}] = ${st.P[bit]}</strong> (Weight 2<sup>${bit}</sup> = ${1 << bit})`;
			}
			return wireEl.id || null;
		}
		return null;
	}

	multSvg?.addEventListener('mouseover', (e) => {
		if (pinnedMultiplierTargetId) return;
		inspectMultiplierTarget(e.target as SVGElement);
	});
	multSvg?.addEventListener('pointerdown', (e) => {
		const hitId = inspectMultiplierTarget(e.target as SVGElement);
		if (!hitId || hitId === pinnedMultiplierTargetId) {
			pinnedMultiplierTargetId = null;
			if (!hitId && multCellInfo) multCellInfo.textContent = DEFAULT_CELL_INFO;
		} else {
			pinnedMultiplierTargetId = hitId;
		}
	});
	multSvg?.addEventListener('mouseleave', () => {
		if (!pinnedMultiplierTargetId && multCellInfo) multCellInfo.textContent = DEFAULT_CELL_INFO;
	});

	document.querySelectorAll('.mult-pre-btn[data-x]').forEach((btn) => {
		btn.addEventListener('click', () => {
			multX = parseInt(btn.getAttribute('data-x') || '0', 10);
			multY = parseInt(btn.getAttribute('data-y') || '0', 10);
			updateMultiplier(true);
		});
	});
	multRandBtn?.addEventListener('click', () => {
		multX = Math.floor(Math.random() * 256);
		multY = Math.floor(Math.random() * 256);
		updateMultiplier(true);
	});
	multSpeedBtn?.addEventListener('click', () => {
		multSlowMode = !multSlowMode;
		multSpeedBtn.classList.toggle('active', multSlowMode);
		if (multSpeedIcon) multSpeedIcon.textContent = multSlowMode ? '🐢' : '⚡';
		if (multSpeedText) multSpeedText.textContent = multSlowMode ? 'Cascade' : 'Instant';
		updateMultiplier(true);
	});
	multReplayBtn?.addEventListener('click', () => {
		if (multSlowMode) {
			runMultiplierCascade(true);
		} else {
			clearCascadeTimeouts();
			multSvg?.classList.add('instant-reflash');
			window.setTimeout(() => multSvg?.classList.remove('instant-reflash'), 120);
			updateMultiplier(true, false);
		}
	});

	function openMultiplier() {
		closeAllActiveModes();
		isMultiplier = true;
		if (multiplierModal) {
			multiplierModal.classList.remove('hidden');
			multiplierModal.style.display = 'flex';
			openModalFocus(multiplierModal, multCloseBtn);
		}
		window.__pushModalHistory?.('multiplier-modal', closeMultiplier);
		updateDrawerActiveUI();
		updateMultiplier(false);
	}

	function closeMultiplier() {
		if (!isMultiplier && (!multiplierModal || multiplierModal.classList.contains('hidden'))) return;
		clearCascadeTimeouts();
		isMultiplier = false;
		pinnedMultiplierTargetId = null;
		if (multiplierModal) {
			closeModalFocus(multiplierModal);
			multiplierModal.classList.add('hidden');
			multiplierModal.style.display = 'none';
		}
		updateDrawerActiveUI();
		window.__popModalHistory?.('multiplier-modal');
	}

	multCloseBtn?.addEventListener('click', closeMultiplier);
	multBackdrop?.addEventListener('click', closeMultiplier);

	buildMultiplierSvg();

	// --- Wire Global API ---
	window.__toggleZeroG = () => (isZeroG ? resetZeroG() : startZeroG());
	window.__toggleTilt = (force?: boolean) => toggleTilt(force);
	window.__toggleDegauss = () => (isDegauss ? resetDegauss() : startDegauss());
	window.__toggleSphere = () => (isSphere ? resetSphere() : startSphere());
	window.__toggleQuantum = () => (isQuantum ? resetQuantum() : startQuantum());
	window.__toggleThermal = () => (isThermal ? resetThermal() : startThermal());
	window.__toggleMultiplier = () => (isMultiplier ? closeMultiplier() : openMultiplier());
	window.__openMultiplier = openMultiplier;
	window.__closeMultiplier = closeMultiplier;
	window.__toggleLabExtras = () => {
		if (!extrasModal) return;
		if (extrasModal.classList.contains('hidden')) {
			updateDrawerActiveUI();
			extrasModal.classList.remove('hidden');
			extrasModal.style.display = 'block';
			openModalFocus(extrasModal, document.getElementById('trigger-sphere-btn') || extrasCloseBtn);
			window.__pushModalHistory?.('lab-extras-modal', closeLabExtras);
		} else {
			closeLabExtras(true);
		}
	};

	// --- Wire Drawer Items (Alphabetical A-Z) ---
	document.getElementById('trigger-sphere-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isSphere) resetSphere();
		else startSphere();
	});
	document.getElementById('trigger-tilt-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		toggleTilt(!isTilt);
	});
	document.getElementById('trigger-multiplier-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isMultiplier) closeMultiplier();
		else openMultiplier();
	});
	document.getElementById('trigger-boop-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		window.__boopDog?.();
	});
	document.getElementById('trigger-degauss-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isDegauss) resetDegauss();
		else startDegauss();
	});
	document.getElementById('trigger-quantum-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isQuantum) resetQuantum();
		else startQuantum();
	});
	document.getElementById('trigger-thermal-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isThermal) resetThermal();
		else startThermal();
	});
	document.getElementById('trigger-wafer-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		const waferModal = document.getElementById('wafer-modal');
		if (waferModal && !waferModal.classList.contains('hidden')) window.__closeWaferMap?.();
		else window.__openWaferMap?.();
	});
	document.getElementById('trigger-zerog-btn')?.addEventListener('click', () => {
		closeLabExtras(false);
		if (isZeroG) resetZeroG();
		else startZeroG();
	});
	extrasCloseBtn?.addEventListener('click', () => closeLabExtras(true));

	// --- Resize Canvases & Global Keyboard Shortcuts ---
	const handleResize = () => {
		if (isDegauss && degaussCanvas) sizeFullscreenCanvas(degaussCanvas);
		if (isQuantum && quantumCanvas) quantumCtx = sizeFullscreenCanvas(quantumCanvas);
		if (isThermal && thermalCanvas) thermalCtx = sizeFullscreenCanvas(thermalCanvas);
	};

	if (!easterEggsGlobalBound) {
		easterEggsGlobalBound = true;
		window.addEventListener('resize', handleResize, { passive: true });
		window.addEventListener('orientationchange', handleResize);

		document.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			const drawer = document.getElementById('lab-extras-modal');
			if (drawer && !drawer.classList.contains('hidden')) {
				if (!drawer.contains(target) && !target.closest('#footer-extras-btn')) {
					closeLabExtras(true);
				}
			}
		});

		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' || e.key === 'Esc') {
				let handled = false;
				const waferModal = document.getElementById('wafer-modal');
				if (waferModal && !waferModal.classList.contains('hidden')) {
					window.__closeWaferMap?.();
					handled = true;
				}
				if (isMultiplier) {
					closeMultiplier();
					handled = true;
				}
				if (isZeroG || isTilt || isDegauss || isSphere || isQuantum || isThermal) {
					closeAllActiveModes();
					handled = true;
				}
				if (extrasModal && !extrasModal.classList.contains('hidden')) {
					closeLabExtras(true);
					handled = true;
				}
				if (handled) {
					e.preventDefault();
					updateDrawerActiveUI();
				}
				return;
			}

			const hasModifiers = (e.ctrlKey || e.metaKey) && e.altKey;
			if (!hasModifiers) return;
			const activeTag = document.activeElement?.tagName;
			if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
			if (document.getElementById('terminal-modal')?.classList.contains('open')) return;

			const kbLabEl = document.getElementById('keyboard-lab');
			if (kbLabEl) {
				const rect = kbLabEl.getBoundingClientRect();
				if (rect.bottom > -80 && rect.top < window.innerHeight + 80) return;
				if (document.activeElement?.closest('#keyboard-lab')) return;
			}

			if (e.code === 'KeyG') {
				e.preventDefault();
				window.__toggleZeroG?.();
			} else if (e.code === 'KeyH') {
				e.preventDefault();
				window.__toggleTilt?.();
			}
		});
	}
}
