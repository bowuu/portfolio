import type { APIRoute } from 'astro';

export const prerender = false;

// Known automated scrapers and bots to exclude from human count tally
const BOT_UA_REGEX = /bot|spider|crawl|slurp|curl|wget|python|httpclient|postman|go-http|facebookexternalhit|bytespider|gptbot|claudebot|headless|lighthouse|inspect/i;

// Baseline fallback count for local development when D1 is not bound
const BASELINE_COUNT = 100;

// Secret salt for one-way cryptographic hashing (rotates daily with the date)
const SALT_SECRET = 'brob-salt-d1-850c6005';

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
 * Computes a mathematically irreversible, one-way SHA-256 hash
 * combining the raw IP address with the current date and secret salt.
 * The raw IP is discarded immediately from volatile memory and NEVER stored.
 */
async function computeDailyHash(ip: string, day: string): Promise<string> {
	const raw = `${ip}::${day}::${SALT_SECRET}`;
	const msgBuffer = new TextEncoder().encode(raw);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureTables(db: D1Database): Promise<void> {
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
}

// GET: Read current visitor count without incrementing
export const GET: APIRoute = async ({ locals }) => {
	const db = (locals as any)?.runtime?.env?.DB as D1Database | undefined;

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

// POST: Increment visitor count after verified human interaction with daily salted hash deduplication
export const POST: APIRoute = async ({ request, locals }) => {
	const cf = (locals as any)?.runtime?.cf || (request as any)?.cf || {};

	// 1. Filter bots and automated scrapers
	if (isLikelyBot(request, cf)) {
		return new Response(JSON.stringify({ status: 'ignored', reason: 'automated_agent' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = (locals as any)?.runtime?.env?.DB as D1Database | undefined;

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

		// Extract connection IP to compute one-way daily hash (never saved to database)
		const clientIp = request.headers.get('cf-connecting-ip') ||
			(request.headers.get('x-forwarded-for')?.split(',')[0].trim()) ||
			'127.0.0.1';

		const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
		const dailyHash = await computeDailyHash(clientIp, today);

		// 2. Attempt to register the daily hash.
		// If changes === 1, this visitor is brand new for today.
		// If changes === 0, this visitor has already been counted today.
		const insertResult = await db.prepare(
			`INSERT OR IGNORE INTO daily_visitors (hash, day) VALUES (?1, ?2);`
		).bind(dailyHash, today).run();

		let count: number;

		if (insertResult.meta?.changes && insertResult.meta.changes > 0) {
			// Brand new unique human visit today -> atomic counter increment
			const result = await db.prepare(
				`INSERT INTO site_counter (id, count) VALUES ('visitors', 1)
				 ON CONFLICT(id) DO UPDATE SET count = count + 1
				 RETURNING count;`
			).first<{ count: number }>();

			count = result?.count ?? BASELINE_COUNT;

			// Purge previous calendar days' deduplication hashes upon UTC midnight rollover
			db.prepare(`DELETE FROM daily_visitors WHERE day < ?1;`).bind(today).run().catch(() => {});
		} else {
			// Already counted today -> read current count without incrementing
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
