import type { APIRoute } from 'astro';

export const prerender = false;

// Known automated scrapers and bots to exclude from human count tally
const BOT_UA_REGEX = /bot|spider|crawl|slurp|curl|wget|python|httpclient|postman|go-http|facebookexternalhit|bytespider|gptbot|claudebot|headless|lighthouse|inspect/i;

// Baseline fallback count for local development when D1 is not bound
const BASELINE_COUNT = 100;

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

async function ensureTable(db: D1Database): Promise<void> {
	await db.prepare(
		`CREATE TABLE IF NOT EXISTS site_counter (
			id TEXT PRIMARY KEY,
			count INTEGER NOT NULL DEFAULT 0
		);`
	).run();
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
		await ensureTable(db);
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

// POST: Increment visitor count after verified human interaction
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
		await ensureTable(db);

		// Atomic upsert with RETURNING in SQLite/D1
		const result = await db.prepare(
			`INSERT INTO site_counter (id, count) VALUES ('visitors', 1)
			 ON CONFLICT(id) DO UPDATE SET count = count + 1
			 RETURNING count;`
		).first<{ count: number }>();

		const count = result?.count ?? BASELINE_COUNT;

		return new Response(JSON.stringify({ count }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (err: any) {
		console.error('Failed to increment visitor count in D1:', err);
		return new Response(JSON.stringify({ count: BASELINE_COUNT, error: 'Database write error' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	}
};
