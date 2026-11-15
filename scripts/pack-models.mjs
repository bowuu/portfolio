import fs from 'node:fs';
import path from 'node:path';

const MODELS_DIR = path.resolve('public/models');
const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');

console.log(`Processing ${files.length} CAD models...`);

let totalOriginalBytes = 0;
let totalBinBytes = 0;

for (const file of files) {
	const jsonPath = path.join(MODELS_DIR, file);
	const raw = fs.readFileSync(jsonPath, 'utf-8');
	const d = JSON.parse(raw);
	totalOriginalBytes += Buffer.byteLength(raw);

	// 1. Calculate bounding box
	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	let minZ = Infinity, maxZ = -Infinity;

	for (let i = 0; i < d.positions.length; i += 3) {
		const x = d.positions[i], y = d.positions[i + 1], z = d.positions[i + 2];
		if (x < minX) minX = x; if (x > maxX) maxX = x;
		if (y < minY) minY = y; if (y > maxY) maxY = y;
		if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
	}

	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const spanZ = maxZ - minZ || 1;

	// 2. Prepare metadata header
	const meta = {
		id: d.id,
		name: d.name,
		file: d.file,
		category: d.category,
		desc: d.desc,
		bbox: d.bbox,
		triangles: d.triangles,
		vertices: d.vertices,
		bounds: { minX, maxX, minY, maxY, minZ, maxZ }
	};
	const metaBuf = Buffer.from(JSON.stringify(meta), 'utf-8');
	const headerLen = metaBuf.length;
	const pad = (4 - (headerLen % 4)) % 4;

	// 3. Quantize positions to 16-bit integers
	const posCount = d.positions.length;
	const qPosBuf = Buffer.alloc(posCount * 2);
	for (let i = 0; i < posCount; i += 3) {
		qPosBuf.writeUInt16LE(Math.round(((d.positions[i] - minX) / spanX) * 65535), i * 2);
		qPosBuf.writeUInt16LE(Math.round(((d.positions[i + 1] - minY) / spanY) * 65535), (i + 1) * 2);
		qPosBuf.writeUInt16LE(Math.round(((d.positions[i + 2] - minZ) / spanZ) * 65535), (i + 2) * 2);
	}

	// 4. Pack indices to 16-bit integers
	const idxCount = d.indices.length;
	const idxBuf = Buffer.alloc(idxCount * 2);
	for (let i = 0; i < idxCount; i++) {
		idxBuf.writeUInt16LE(d.indices[i], i * 2);
	}

	// 5. Construct binary packet:
	// [4B Magic: 'CBIN'] + [4B HeaderLen] + [metaBuf] + [pad] + [4B PosCount] + [4B IdxCount] + [qPosBuf] + [idxBuf]
	const bin = Buffer.concat([
		Buffer.from('CBIN', 'ascii'),
		Buffer.alloc(4),
		metaBuf,
		Buffer.alloc(pad),
		Buffer.alloc(8),
		qPosBuf,
		idxBuf
	]);

	bin.writeUInt32LE(headerLen, 4);
	bin.writeUInt32LE(posCount, 8 + headerLen + pad);
	bin.writeUInt32LE(idxCount, 12 + headerLen + pad);

	const binFileName = file.replace(/\.json$/, '.bin');
	const binPath = path.join(MODELS_DIR, binFileName);
	fs.writeFileSync(binPath, bin);

	totalBinBytes += bin.length;
	const savings = Math.round((1 - bin.length / Buffer.byteLength(raw)) * 100);
	console.log(`  ✓ ${binFileName.padEnd(28)} ${(Buffer.byteLength(raw) / 1024).toFixed(1)} KB -> ${(bin.length / 1024).toFixed(1)} KB (-${savings}%)`);

	// 6. Verify accuracy: check round-trip coordinate drift
	let maxDrift = 0;
	for (let i = 0; i < posCount; i += 3) {
		const qx = qPosBuf.readUInt16LE(i * 2);
		const qy = qPosBuf.readUInt16LE((i + 1) * 2);
		const qz = qPosBuf.readUInt16LE((i + 2) * 2);
		const rx = minX + (qx / 65535) * spanX;
		const ry = minY + (qy / 65535) * spanY;
		const rz = minZ + (qz / 65535) * spanZ;
		maxDrift = Math.max(
			maxDrift,
			Math.abs(rx - d.positions[i]),
			Math.abs(ry - d.positions[i + 1]),
			Math.abs(rz - d.positions[i + 2])
		);
	}
	if (maxDrift > 0.01) {
		console.warn(`    ⚠️ Max coordinate drift for ${file}: ${maxDrift.toFixed(5)} mm`);
	}
}

// 7. Update manifest.json with binFile
const manifestPath = path.join(MODELS_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
for (const item of manifest) {
	item.binFile = `/models/${item.id}.bin`;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✓ Updated manifest.json with binFile entries.');

console.log('\n=== SUMMARY ===');
console.log(`Original JSON: ${(totalOriginalBytes / 1024).toFixed(1)} KB`);
console.log(`Packed Binary: ${(totalBinBytes / 1024).toFixed(1)} KB (-${Math.round((1 - totalBinBytes / totalOriginalBytes) * 100)}%)`);
