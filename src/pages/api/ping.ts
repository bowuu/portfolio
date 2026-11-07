import type { APIRoute } from 'astro';

export const prerender = false;

// High-speed, zero-allocation edge ping probe endpoint
export const GET: APIRoute = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
			'Timing-Allow-Origin': '*',
			'Access-Control-Allow-Origin': '*',
		},
	});
};
