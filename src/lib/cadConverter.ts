import type * as ThreeTypes from 'three';
import {
	mergeMeshesToCadJson,
	occtResultToMeshInputs,
	OCCT_TESSELLATION_PARAMS,
	SUPPORTED_CAD_EXTENSIONS,
} from './cadMeshCore.mjs';

export { SUPPORTED_CAD_EXTENSIONS };

export interface CadJsonModel {
	id: string;
	name: string;
	file: string;
	category: string;
	desc: string;
	bbox: { width: number; height: number; depth: number };
	triangles: number;
	vertices: number;
	positions: number[];
	normals: number[];
	indices: number[];
}

let occtInstancePromise: Promise<any> | null = null;

async function getOcctInstance() {
	if (!occtInstancePromise) {
		occtInstancePromise = (async () => {
			const [{ default: occtimportjs }, { default: wasmUrl }] = await Promise.all([
				import('occt-import-js'),
				import('occt-import-js/dist/occt-import-js.wasm?url'),
			]);
			return occtimportjs({
				locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
			});
		})();
	}
	return occtInstancePromise;
}

function collectThreeObjectMeshes(root: ThreeTypes.Object3D, THREE: typeof ThreeTypes) {
	const inputs: Array<{ positions: Float32Array; normals: Float32Array | null; indices: ArrayLike<number> | null }> = [];
	root.updateMatrixWorld(true);
	const normalMatrix = new THREE.Matrix3();

	root.traverse((obj: any) => {
		if (!obj.isMesh || !obj.geometry) return;
		const geom: ThreeTypes.BufferGeometry = obj.geometry;
		const posAttr = geom.getAttribute('position');
		if (!posAttr) return;

		const cloned = geom.clone();
		cloned.applyMatrix4(obj.matrixWorld);
		const pos = cloned.getAttribute('position');
		const norm = cloned.getAttribute('normal');
		if (norm) {
			normalMatrix.getNormalMatrix(obj.matrixWorld);
			const nArr = norm.array as Float32Array;
			const v = new THREE.Vector3();
			for (let i = 0; i < norm.count; i++) {
				v.set(nArr[i * 3], nArr[i * 3 + 1], nArr[i * 3 + 2]).applyMatrix3(normalMatrix).normalize();
				nArr[i * 3] = v.x;
				nArr[i * 3 + 1] = v.y;
				nArr[i * 3 + 2] = v.z;
			}
		}

		const idxAttr = cloned.getIndex();
		inputs.push({
			positions: new Float32Array(pos.array as ArrayLike<number>),
			normals: norm ? new Float32Array(norm.array as ArrayLike<number>) : null,
			indices: idxAttr ? idxAttr.array : null,
		});
		cloned.dispose();
	});

	if (!inputs.length) {
		throw new Error('No mesh geometry found in file.');
	}
	return inputs;
}

export function getFileExtension(filename: string): string {
	const dot = filename.lastIndexOf('.');
	return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export function isSupportedCadFile(filename: string): boolean {
	return SUPPORTED_CAD_EXTENSIONS.includes(getFileExtension(filename));
}

/**
 * Converts a user-uploaded CAD file (STEP, IGES, STL, OBJ, 3MF, GLB/GLTF)
 * into the viewer's high-quality JSON mesh format entirely client-side.
 */
export async function convertCadFileToJson(file: File): Promise<CadJsonModel> {
	const ext = getFileExtension(file.name);
	if (!SUPPORTED_CAD_EXTENSIONS.includes(ext)) {
		throw new Error(`Unsupported file format "${ext || 'unknown'}". Supported: ${SUPPORTED_CAD_EXTENSIONS.join(', ')}`);
	}

	const buffer = await file.arrayBuffer();
	const baseName = file.name.replace(/\.[^.]+$/, '');
	const id = `upload-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
	const meta = {
		id,
		name: baseName,
		file: file.name,
		category: 'Uploaded (Session)',
		desc: `Local ${ext.slice(1).toUpperCase()} upload (${file.name}) converted in-browser.`,
	};

	if (ext === '.stp' || ext === '.step' || ext === '.igs' || ext === '.iges') {
		const occt = await getOcctInstance();
		const bytes = new Uint8Array(buffer);
		const result =
			ext === '.igs' || ext === '.iges'
				? occt.ReadIgesFile(bytes, OCCT_TESSELLATION_PARAMS)
				: occt.ReadStepFile(bytes, OCCT_TESSELLATION_PARAMS);
		const meshInputs = occtResultToMeshInputs(result);
		return mergeMeshesToCadJson(meshInputs, meta);
	}

	const THREE = await import('three');

	if (ext === '.stl') {
		const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
		const geom = new STLLoader().parse(buffer);
		const pos = geom.getAttribute('position');
		const norm = geom.getAttribute('normal');
		const idx = geom.getIndex();
		const inputs = [
			{
				positions: new Float32Array(pos.array as ArrayLike<number>),
				normals: norm ? new Float32Array(norm.array as ArrayLike<number>) : null,
				indices: idx ? idx.array : null,
			},
		];
		geom.dispose();
		return mergeMeshesToCadJson(inputs, meta);
	}

	if (ext === '.obj') {
		const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
		const text = new TextDecoder().decode(buffer);
		const group = new OBJLoader().parse(text);
		return mergeMeshesToCadJson(collectThreeObjectMeshes(group, THREE), meta);
	}

	if (ext === '.3mf') {
		const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
		const group = new ThreeMFLoader().parse(buffer);
		return mergeMeshesToCadJson(collectThreeObjectMeshes(group, THREE), meta);
	}

	if (ext === '.glb' || ext === '.gltf') {
		const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
		const gltf = await new Promise<any>((resolve, reject) => {
			new GLTFLoader().parse(buffer, '', resolve, reject);
		});
		return mergeMeshesToCadJson(collectThreeObjectMeshes(gltf.scene, THREE), meta);
	}

	throw new Error(`Unsupported file format "${ext}".`);
}
