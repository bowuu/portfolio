/**
 * Shared CAD mesh normalization & JSON serialization core.
 * Used by both the browser upload converter (`src/lib/cadConverter.ts`)
 * and the repo CLI converter (`scripts/convert-cad.mjs`).
 */

export const SUPPORTED_CAD_EXTENSIONS = [
	'.stp',
	'.step',
	'.igs',
	'.iges',
	'.stl',
	'.obj',
	'.3mf',
	'.glb',
	'.gltf',
];

export const OCCT_TESSELLATION_PARAMS = {
	linearUnit: 'millimeter',
	linearDeflectionType: 'bounding_box_ratio',
	linearDeflection: 0.002,
	angularDeflection: 0.25,
};

/**
 * Converts an `occt-import-js` result into normalized mesh input blocks,
 * preserving authentic CAD NURBS surface normals.
 */
export function occtResultToMeshInputs(occtResult) {
	if (!occtResult || !occtResult.success || !Array.isArray(occtResult.meshes)) {
		throw new Error('Failed to tessellate CAD B-rep geometry.');
	}
	const inputs = [];
	for (const mesh of occtResult.meshes) {
		const pos = mesh?.attributes?.position?.array;
		if (!pos || pos.length < 9) continue;
		const norm = mesh?.attributes?.normal?.array || null;
		const idx = mesh?.index?.array || null;
		inputs.push({ positions: pos, normals: norm, indices: idx });
	}
	if (!inputs.length) {
		throw new Error('No solid or surface geometry found in CAD file.');
	}
	return inputs;
}

/**
 * Computes per-vertex flat face normals for indexed or non-indexed triangle buffers
 * when source geometry lacks authentic normals (e.g. raw ASCII/binary STL).
 */
function ensureNormals(positions, normals, indices) {
	if (normals && normals.length === positions.length) {
		return normals;
	}
	const out = new Float32Array(positions.length);
	const triCount = indices ? indices.length / 3 : positions.length / 9;
	for (let t = 0; t < triCount; t++) {
		const i0 = (indices ? indices[t * 3] : t * 3) * 3;
		const i1 = (indices ? indices[t * 3 + 1] : t * 3 + 1) * 3;
		const i2 = (indices ? indices[t * 3 + 2] : t * 3 + 2) * 3;

		const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
		const ux = positions[i1] - ax, uy = positions[i1 + 1] - ay, uz = positions[i1 + 2] - az;
		const vx = positions[i2] - ax, vy = positions[i2 + 1] - ay, vz = positions[i2 + 2] - az;

		let nx = uy * vz - uz * vy;
		let ny = uz * vx - ux * vz;
		let nz = ux * vy - uy * vx;
		const len = Math.hypot(nx, ny, nz) || 1;
		nx /= len;
		ny /= len;
		nz /= len;

		out[i0] += nx; out[i0 + 1] += ny; out[i0 + 2] += nz;
		out[i1] += nx; out[i1 + 1] += ny; out[i1 + 2] += nz;
		out[i2] += nx; out[i2 + 1] += ny; out[i2 + 2] += nz;
	}
	for (let i = 0; i < out.length; i += 3) {
		const len = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
		out[i] /= len;
		out[i + 1] /= len;
		out[i + 2] /= len;
	}
	return out;
}

function round4(n) {
	return Math.round(n * 10000) / 10000;
}

/**
 * Merges one or more triangle meshes, preserves authentic normals,
 * centers at origin, normalizes max span to 40 viewer units, and builds the
 * portfolio CAD JSON payload.
 */
export function mergeMeshesToCadJson(meshInputs, meta = {}) {
	if (!meshInputs || !meshInputs.length) {
		throw new Error('No mesh geometry to convert.');
	}

	let totalPosFloats = 0;
	let totalIndices = 0;
	const prepared = [];

	for (const item of meshInputs) {
		const pos = item.positions;
		if (!pos || pos.length < 9) continue;
		const vertCount = pos.length / 3;
		let idx = item.indices;
		if (!idx || !idx.length) {
			idx = new Uint32Array(vertCount);
			for (let i = 0; i < vertCount; i++) idx[i] = i;
		}
		const norm = ensureNormals(pos, item.normals, idx);
		prepared.push({ pos, norm, idx, vertCount });
		totalPosFloats += pos.length;
		totalIndices += idx.length;
	}

	if (!prepared.length || totalIndices < 3) {
		throw new Error('Mesh contains no valid triangles.');
	}

	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	let minZ = Infinity, maxZ = -Infinity;

	for (const m of prepared) {
		const p = m.pos;
		for (let i = 0; i < p.length; i += 3) {
			const x = p[i], y = p[i + 1], z = p[i + 2];
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
			if (z < minZ) minZ = z;
			if (z > maxZ) maxZ = z;
		}
	}

	const spanX = Math.max(maxX - minX, 0.0001);
	const spanY = Math.max(maxY - minY, 0.0001);
	const spanZ = Math.max(maxZ - minZ, 0.0001);
	const maxSpan = Math.max(spanX, spanY, spanZ);
	const scale = 40 / maxSpan;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const cz = (minZ + maxZ) / 2;

	const positions = new Array(totalPosFloats);
	const normals = new Array(totalPosFloats);
	const indices = new Array(totalIndices);

	let posOffset = 0;
	let idxOffset = 0;
	let vertOffset = 0;

	for (const m of prepared) {
		const { pos, norm, idx, vertCount } = m;
		for (let i = 0; i < pos.length; i += 3) {
			positions[posOffset + i] = round4((pos[i] - cx) * scale);
			positions[posOffset + i + 1] = round4((pos[i + 1] - cy) * scale);
			positions[posOffset + i + 2] = round4((pos[i + 2] - cz) * scale);

			normals[posOffset + i] = round4(norm[i]);
			normals[posOffset + i + 1] = round4(norm[i + 1]);
			normals[posOffset + i + 2] = round4(norm[i + 2]);
		}
		for (let i = 0; i < idx.length; i++) {
			indices[idxOffset + i] = idx[i] + vertOffset;
		}
		posOffset += pos.length;
		idxOffset += idx.length;
		vertOffset += vertCount;
	}

	const bbox = {
		width: Math.max(1, Math.round(spanX)),
		height: Math.max(1, Math.round(spanY)),
		depth: Math.max(1, Math.round(spanZ)),
	};

	return {
		id: meta.id || 'uploaded-model',
		name: meta.name || 'Uploaded CAD Model',
		file: meta.file || 'model.stp',
		category: meta.category || 'Uploaded (Session)',
		desc: meta.desc || `Client-converted ${meta.file || 'CAD'} mesh (${bbox.width} x ${bbox.height} x ${bbox.depth} mm).`,
		bbox,
		triangles: totalIndices / 3,
		vertices: totalPosFloats / 3,
		positions,
		normals,
		indices,
	};
}
