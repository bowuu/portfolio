#!/usr/bin/env node
/**
 * Rebuilds public/models/*.json from source CAD files (.stp/.step/.igs/.iges)
 * using the exact same mesh normalization & normal-preserving pipeline as the
 * browser CAD upload converter (`src/lib/cadMeshCore.mjs`).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import occtimportjs from 'occt-import-js';
import {
	mergeMeshesToCadJson,
	occtResultToMeshInputs,
	OCCT_TESSELLATION_PARAMS,
} from '../src/lib/cadMeshCore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const manifestPath = path.join(publicDir, 'models', 'manifest.json');

async function main() {
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const occt = await occtimportjs();

	let converted = 0;
	for (const entry of manifest) {
		const stepRel = (entry.stepFile || `/models/${entry.file}`).replace(/^\/+/, '');
		const stepAbs = path.join(publicDir, stepRel);
		const jsonRel = (entry.jsonFile || `/models/${entry.id}.json`).replace(/^\/+/, '');
		const jsonAbs = path.join(publicDir, jsonRel);

		if (!fs.existsSync(stepAbs)) {
			console.warn(`⚠️  Skipping ${entry.id}: missing ${stepRel}`);
			continue;
		}

		const ext = path.extname(stepAbs).toLowerCase();
		const bytes = new Uint8Array(fs.readFileSync(stepAbs));
		const occtResult =
			ext === '.igs' || ext === '.iges'
				? occt.ReadIgesFile(bytes, OCCT_TESSELLATION_PARAMS)
				: occt.ReadStepFile(bytes, OCCT_TESSELLATION_PARAMS);

		const meshInputs = occtResultToMeshInputs(occtResult);
		const payload = mergeMeshesToCadJson(meshInputs, {
			id: entry.id,
			name: entry.name,
			file: entry.file,
			category: entry.category,
			desc: entry.desc,
		});

		fs.writeFileSync(jsonAbs, JSON.stringify(payload));

		entry.dimensions = `${payload.bbox.width} x ${payload.bbox.height} x ${payload.bbox.depth} mm`;
		entry.triangles = payload.triangles;
		entry.vertices = payload.vertices;

		converted++;
		console.log(
			`✅ ${entry.id.padEnd(22)} ${entry.dimensions.padEnd(20)} ${String(payload.triangles).padStart(6)} tris  ${String(payload.vertices).padStart(6)} verts`
		);
	}

	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
	console.log(`\nDone! Rebuilt ${converted} CAD JSON models and synced manifest.json.`);
}

main().catch((err) => {
	console.error('❌ CAD conversion failed:', err);
	process.exit(1);
});
