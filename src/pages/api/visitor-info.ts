import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
	// 1. Client IP
	const cfIp = request.headers.get('cf-connecting-ip');
	const xForwardedFor = request.headers.get('x-forwarded-for');
	const rawIp = cfIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : '') || '127.0.0.1';
	const ip = rawIp === '::1' || rawIp === '127.0.0.1' ? '127.0.0.1 (Localhost)' : rawIp;

	// 2. Cloudflare Edge Geolocation & Network
	const cf = (locals as any)?.runtime?.cf || (request as any)?.cf || {};
	const city = cf.city || request.headers.get('cf-ipcity') || '';
	const region = cf.region || cf.regionCode || request.headers.get('cf-region') || '';
	const country = cf.country || request.headers.get('cf-ipcountry') || '';
	const postalCode = cf.postalCode || '';

	const locParts = [city, region, postalCode, country].filter(Boolean);
	const location = locParts.length > 0 ? locParts.join(', ') : 'Location unavailable';

	const isp = cf.asOrganization || (cf.asn ? `AS${cf.asn}` : 'Standard ISP');
	const rawColo = cf.colo || (request.headers.get('cf-ray') ? request.headers.get('cf-ray')!.split('-')[1] : '') || '';
	const colo = rawColo ? `${rawColo} Edge Datacenter` : 'Cloudflare Edge Node';
	const protocol = cf.httpProtocol || 'HTTP/2';

	// 3. Raw User-Agent
	const userAgent = request.headers.get('user-agent') || 'Unknown';

	return new Response(
		JSON.stringify({
			ip,
			location,
			city,
			region,
			country,
			postalCode,
			isp,
			colo,
			coloCode: rawColo,
			latitude: cf.latitude || '',
			longitude: cf.longitude || '',
			protocol,
			userAgent,
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		}
	);
};
