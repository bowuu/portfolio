// src/lib/colo.ts
// Shared Cloudflare Anycast IATA airport-to-city lookup and deduplicated /api/visitor-info fetcher.

export const COLO_NAMES: Record<string, string> = {
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

export interface VisitorInfoResponse {
	ip?: string;
	location?: string;
	city?: string;
	region?: string;
	country?: string;
	postalCode?: string;
	isp?: string;
	asn?: number | string;
	colo?: string;
	coloCode?: string;
	latitude?: string | number;
	longitude?: string | number;
	protocol?: string;
	tlsVersion?: string;
	tlsCipher?: string;
	timezone?: string;
	rayId?: string;
	serverTime?: number;
	userAgent?: string;
}

/**
 * Reuse a single in-flight/resolved /api/visitor-info promise across NetworkTest and Debug telemetry.
 */
export function getVisitorInfoCached(): Promise<VisitorInfoResponse | null> {
	if (typeof window === 'undefined') return Promise.resolve(null);
	const win = window as Window & { __visitorInfoPromise?: Promise<VisitorInfoResponse | null> };
	if (!win.__visitorInfoPromise) {
		win.__visitorInfoPromise = fetch('/api/visitor-info', { cache: 'no-store' })
			.then((res) => (res.ok ? (res.json() as Promise<VisitorInfoResponse>) : null))
			.catch(() => null);
	}
	return win.__visitorInfoPromise;
}
