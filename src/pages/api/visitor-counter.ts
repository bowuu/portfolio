import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

// Known automated scrapers and bots to exclude from human count tally
const BOT_UA_REGEX = /bot|spider|crawl|slurp|curl|wget|python|httpclient|postman|go-http|facebookexternalhit|bytespider|gptbot|claudebot|headless|lighthouse|inspect/i;

// Baseline fallback count for local development when D1 is not bound
const BASELINE_COUNT = 100;

// 30-day rolling deduplication window (in ms) so repeat visits and multi-device
// testing on the same network don't re-increment every UTC midnight.
const EPOCH_DAYS = 30;
const EPOCH_MS = EPOCH_DAYS * 86_400_000;

// Only allow live counter increments on production hostnames (preview/staging stays read-only)
const PRODUCTION_HOSTS = new Set(['brob.uk', 'www.brob.uk']);

let tablesEnsured = false;

function getEnvVar(locals: any, key: string): string | undefined {
	try {
		return (env as any)?.[key] || (locals as any)?.cfContext?.env?.[key];
	} catch (_) {
		return (locals as any)?.cfContext?.env?.[key];
	}
}

function getDB(locals: any): D1Database | undefined {
	try {
		return (env as any)?.DB || (locals as any)?.cfContext?.env?.DB;
	} catch (_) {
		return (locals as any)?.cfContext?.env?.DB;
	}
}

function getVisitorSalt(locals: any): string {
	return getEnvVar(locals, 'VISITOR_SALT') || 'brob-local-dev-salt';
}

function getOwnerIpHashes(locals: any): Set<string> {
	const raw = getEnvVar(locals, 'OWNER_IP_HASHES') || '';
	if (!raw) return new Set();
	return new Set(
		raw
			.split(/[\s,]+/)
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
}

function isLikelyBot(request: Request, cf: any): boolean {
	const userAgent = request.headers.get('user-agent') || '';
	if (!userAgent || BOT_UA_REGEX.test(userAgent)) {
		return true;
	}

	// Cloudflare Verified Search Bot check (Google, Bing, DuckDuckGo)
	if (cf?.botManagement?.verifiedBot === true) {
		return true;
	}

	// Cloudflare ML Bot Score (1 = bot, 99 = human). Scores < 30 are almost certainly automated
	if (typeof cf?.botManagement?.score === 'number' && cf.botManagement.score < 30) {
		return true;
	}

	return false;
}

/**
 * Normalizes a client IP in volatile memory before hashing:
 * - IPv4 addresses are kept as-is.
 * - IPv6 addresses are truncated to their /64 network prefix so RFC 8981
 *   privacy-address rotation doesn't double-count the same device/network.
 */
function normalizeIpForHash(rawIp: string): string {
	const ip = rawIp.trim().split('%')[0].toLowerCase();
	if (!ip.includes(':')) {
		return ip;
	}

	// Expand IPv4-mapped suffix (e.g. ::ffff:192.0.2.1) into two hextets if present
	let working = ip;
	const lastColon = working.lastIndexOf(':');
	if (lastColon !== -1 && working.slice(lastColon + 1).includes('.')) {
		const ipv4Parts = working
			.slice(lastColon + 1)
			.split('.')
			.map((n) => Number(n));
		if (ipv4Parts.length === 4 && ipv4Parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
			// Check for standard ::ffff:a.b.c.d mapped IPv4
			if (working.startsWith('::ffff:')) {
				return ipv4Parts.join('.');
			}
			const hi = ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16);
			const lo = ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16);
			working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
		}
	}

	const parts = working.split('::');
	if (parts.length > 2) return ip;

	const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
	const right = parts.length === 2 && parts[1] ? parts[1].split(':').filter(Boolean) : [];
	const missing = 8 - (left.length + right.length);
	if (missing < 0) return ip;

	const expanded = [
		...left,
		...Array(parts.length === 2 ? missing : 0).fill('0'),
		...right,
	].map((h) => h.padStart(4, '0'));

	if (expanded.length !== 8) return ip;
	return `${expanded.slice(0, 4).join(':')}::/64`;
}

async function sha256Hex(input: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a mathematically irreversible, one-way SHA-256 hash
 * combining the normalized network prefix (IPv4 or IPv6 /64) with
 * the current 30-day epoch and a secret salt.
 *
 * Omitting User-Agent and Accept-Language keeps all devices and browsers
 * on the same home/office network deduplicated without tracking devices,
 * and discards all raw connection headers immediately from volatile RAM.
 */
async function computeEpochHash(normalizedIp: string, epoch: string, salt: string): Promise<string> {
	return sha256Hex(`${normalizedIp}::${epoch}::${salt}`);
}

async function ensureTables(db: D1Database): Promise<void> {
	if (tablesEnsured) return;
	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS site_counter (
				id TEXT PRIMARY KEY,
				count INTEGER NOT NULL DEFAULT 0
			);
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS daily_visitors (
				hash TEXT PRIMARY KEY,
				day TEXT NOT NULL
			);
		`),
		db.prepare(`
			CREATE INDEX IF NOT EXISTS idx_daily_visitors_day ON daily_visitors (day);
		`),
	]);
	tablesEnsured = true;
}

// GET: Read current visitor count without incrementing
export const GET: APIRoute = async ({ locals }) => {
	const db = getDB(locals);

	if (!db) {
		return new Response(JSON.stringify({ count: BASELINE_COUNT, mode: 'local' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	}

	try {
		await ensureTables(db);
		const row = await db.prepare(`SELECT count FROM site_counter WHERE id = 'visitors'`).first<{ count: number }>();
		const count = row ? row.count : BASELINE_COUNT;

		return new Response(JSON.stringify({ count }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (err: any) {
		console.error('Failed to read visitor count from D1:', err);
		return new Response(JSON.stringify({ count: BASELINE_COUNT, error: 'Database read error' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	}
};

// POST: Increment visitor count after verified human interaction with 30-day network-level salted hash deduplication
export const POST: APIRoute = async ({ request, locals }) => {
	const cf = (request as any)?.cf || (locals as any)?.cfContext?.cf || {};

	// 1. Filter bots and automated scrapers
	if (isLikelyBot(request, cf)) {
		return new Response(JSON.stringify({ status: 'ignored', reason: 'automated_agent' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = getDB(locals);

	if (!db) {
		return new Response(JSON.stringify({ count: BASELINE_COUNT + 1, mode: 'local' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	}

	try {
		await ensureTables(db);

		// 2. Keep preview/staging hostnames read-only so test deploys don't inflate production tally
		const hostname = new URL(request.url).hostname.toLowerCase();
		if (!PRODUCTION_HOSTS.has(hostname)) {
			const row = await db.prepare(`SELECT count FROM site_counter WHERE id = 'visitors'`).first<{ count: number }>();
			const count = row ? row.count : BASELINE_COUNT;
			return new Response(JSON.stringify({ count, mode: 'preview' }), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			});
		}

		// Extract and normalize connection IP (IPv4 or IPv6 /64 prefix) in volatile memory
		const rawIp = request.headers.get('cf-connecting-ip') ||
			(request.headers.get('x-forwarded-for')?.split(',')[0].trim()) ||
			'127.0.0.1';
		const normalizedIp = normalizeIpForHash(rawIp);
		const salt = getVisitorSalt(locals);

		// 3. Optional zero-plaintext-IP owner exclusion via hashed Worker secret (OWNER_IP_HASHES)
		const ownerHashes = getOwnerIpHashes(locals);
		if (ownerHashes.size > 0) {
			const ownerCheckHash = await sha256Hex(`${normalizedIp}::${salt}`);
			if (ownerHashes.has(ownerCheckHash)) {
				const row = await db.prepare(`SELECT count FROM site_counter WHERE id = 'visitors'`).first<{ count: number }>();
				const count = row ? row.count : BASELINE_COUNT;
				return new Response(JSON.stringify({ count }), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
					},
				});
			}
		}

		// 4. Compute 30-day rolling epoch hash (with expiry date stored in `day` for schema-compatible cleanup)
		const now = Date.now();
		const epochIndex = Math.floor(now / EPOCH_MS);
		const today = new Date(now).toISOString().slice(0, 10);
		const expiresOn = new Date((epochIndex + 1) * EPOCH_MS).toISOString().slice(0, 10);
		const epochHash = await computeEpochHash(normalizedIp, String(epochIndex), salt);

		// Attempt to register the epoch hash.
		// If changes === 1, this network is new for the current 30-day epoch.
		// If changes === 0, this network has already been counted in the current epoch.
		const insertResult = await db.prepare(
			`INSERT OR IGNORE INTO daily_visitors (hash, day) VALUES (?1, ?2);`
		).bind(epochHash, expiresOn).run();

		let count: number;

		if (insertResult.meta?.changes && insertResult.meta.changes > 0) {
			// Brand new unique visit in this 30-day epoch -> atomic counter increment
			const result = await db.prepare(
				`INSERT INTO site_counter (id, count) VALUES ('visitors', ?1)
				 ON CONFLICT(id) DO UPDATE SET count = count + 1
				 RETURNING count;`
			).bind(BASELINE_COUNT + 1).first<{ count: number }>();

			count = result?.count ?? BASELINE_COUNT;

			// Purge expired deduplication hashes (including any legacy daily rows <= today)
			const purgePromise = db.prepare(`DELETE FROM daily_visitors WHERE day <= ?1;`).bind(today).run().catch(() => {});
			const ctx = (locals as any)?.cfContext?.ctx;
			if (ctx && typeof ctx.waitUntil === 'function') {
				ctx.waitUntil(purgePromise);
			} else {
				await purgePromise;
			}
		} else {
			// Already counted in this 30-day epoch -> read current count without incrementing
			const row = await db.prepare(`SELECT count FROM site_counter WHERE id = 'visitors'`).first<{ count: number }>();
			count = row ? row.count : BASELINE_COUNT;
		}

		return new Response(JSON.stringify({ count }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (err: any) {
		console.error('Failed to process visitor count in D1:', err);
		return new Response(JSON.stringify({ count: BASELINE_COUNT, error: 'Database write error' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	}
};
