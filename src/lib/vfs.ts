// Virtual File System (VFS) for brobsh
// Build-time repository snapshot via Vite import.meta.glob

export interface VFSNode {
	name: string;
	type: 'file' | 'dir';
	content?: string;
	size: number;
	mtime: string;
	executable?: boolean;
	children?: Map<string, VFSNode>;
}

// Vite snapshots source files as raw strings at build time
const rawSourceFiles = import.meta.glob([
	'/src/**/*.astro',
	'/src/**/*.ts',
	'/src/**/*.css',
	'/package.json',
	'/astro.config.mjs',
	'/wrangler.json',
	'/tsconfig.json',
	'/README.md',
	'/LICENSE',
	'/public/models/manifest.json'
], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Root node of in-memory virtual filesystem
const rootNode: VFSNode = {
	name: '',
	type: 'dir',
	size: 4096,
	mtime: 'Nov 06 23:30',
	children: new Map()
};

let currentWorkingDir = '/home/guest/portfolio';
let oldWorkingDir = '/home/guest/portfolio';
const HOME_DIR = '/home/guest/portfolio';

function ensureDir(pathSegments: string[]): VFSNode {
	let curr = rootNode;
	for (const seg of pathSegments) {
		if (!seg) continue;
		if (!curr.children) curr.children = new Map();
		let child = curr.children.get(seg);
		if (!child) {
			child = {
				name: seg,
				type: 'dir',
				size: 4096,
				mtime: 'Nov 06 23:30',
				children: new Map()
			};
			curr.children.set(seg, child);
		}
		curr = child;
	}
	return curr;
}

function addFile(absPath: string, content: string, executable = false, mtime = 'Nov 06 23:30') {
	const parts = absPath.split('/').filter(Boolean);
	if (parts.length === 0) return;
	const fileName = parts.pop()!;
	const dirNode = ensureDir(parts);
	if (!dirNode.children) dirNode.children = new Map();
	dirNode.children.set(fileName, {
		name: fileName,
		type: 'file',
		content,
		size: new TextEncoder().encode(content).length,
		mtime,
		executable
	});
}

// 1. Mount System Directories & Files
addFile('/etc/os-release', `NAME="brobOS"
VERSION="1.0.0-release"
ID=brob
VERSION_ID="1.0"
PRETTY_NAME="brobOS 1.0.0(1)-release (x86_64-brob-linux-edge)"
HOME_URL="https://brob.uk"
SUPPORT_URL="https://github.com/bowuu/portfolio"
BUG_REPORT_URL="https://github.com/bowuu/portfolio/issues"
`);

addFile('/etc/hostname', 'brob-edge\n');

addFile('/proc/cpuinfo', `processor\t: 0
vendor_id\t: BoSilicon
cpu family\t: 6
model\t\t: 185
model name\t: BROB-VAL Silicon Core 3nm FinFET (Stepping A0)
cpu MHz\t\t: 4800.000
cache size\t: 32768 KB
clflush size\t: 64
cache_alignment\t: 64
address sizes\t: 48 bits physical, 48 bits virtual
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ss ht syscall nx lm constant_tsc rep_good nopl cpuid pni pclmulqdq ssse3 fma cx16 pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand hypervisor lahf_lm abm fsgsbase bmi1 avx2 smep bmi2 erms invpcid rdseed adx smap clflushopt clwb sha_ni
`);

addFile('/proc/meminfo', `MemTotal:       67108864 kB
MemFree:        58291456 kB
MemAvailable:   62914560 kB
Buffers:          524288 kB
Cached:          4194304 kB
SwapTotal:             0 kB
SwapFree:              0 kB
`);

addFile('/proc/version', 'Linux version 6.12.0-ate-val (gcc version 14.2.1) #1 SMP PREEMPT_DYNAMIC\n');

addFile('/home/guest/.brobrc', `# brobOS shell environment configuration
export ARCH=x86_64
export COLOC_GATEWAY=edge.cloudflare.com
export DIE_LOT=850C-W14
alias ll='ls -la'
alias cls='clear'
`);

// 2. Mount Repository Files
for (const [key, content] of Object.entries(rawSourceFiles)) {
	// Strictly skip any private agent rules, secrets, or internal configs
	if (
		key.toLowerCase().includes('agent') ||
		key.toLowerCase().includes('rule') ||
		key.includes('.env') ||
		key.includes('worker-configuration') ||
		key.includes('package-lock')
	) {
		continue;
	}

	const cleanKey = key.startsWith('/') ? key.slice(1) : key;
	const vfsPath = `/home/guest/portfolio/${cleanKey}`;
	addFile(vfsPath, content);
}


// Path resolution helper
export function resolvePath(pathInput: string, baseCwd: string = currentWorkingDir): string {
	let target = pathInput.trim();
	if (!target || target === '~') return HOME_DIR;
	if (target.startsWith('~/')) {
		target = HOME_DIR + target.slice(1);
	} else if (!target.startsWith('/')) {
		target = baseCwd + '/' + target;
	}

	const rawParts = target.split('/');
	const resolved: string[] = [];

	for (const part of rawParts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (resolved.length > 0) resolved.pop();
		} else {
			resolved.push(part);
		}
	}

	return '/' + resolved.join('/');
}

export function getNode(absPath: string): VFSNode | null {
	if (absPath === '/' || absPath === '') return rootNode;
	const parts = absPath.split('/').filter(Boolean);
	let curr = rootNode;
	for (const part of parts) {
		if (!curr.children || curr.type !== 'dir') return null;
		const child = curr.children.get(part);
		if (!child) return null;
		curr = child;
	}
	return curr;
}

export function getCwd(): string {
	return currentWorkingDir;
}

export function getDisplayPath(path: string = currentWorkingDir): string {
	if (path === HOME_DIR) return '~/portfolio';
	if (path.startsWith(HOME_DIR + '/')) {
		return '~/portfolio/' + path.slice(HOME_DIR.length + 1);
	}
	if (path === '/home/guest') return '~';
	if (path.startsWith('/home/guest/')) {
		return '~/' + path.slice('/home/guest/'.length);
	}
	return path;
}

export function changeDirectory(targetInput: string = ''): { success: boolean; error?: string; newCwd?: string } {
	let target = targetInput.trim();
	if (!target) {
		target = HOME_DIR;
	} else if (target === '-') {
		target = oldWorkingDir;
	}

	const resolved = resolvePath(target);
	const node = getNode(resolved);

	if (!node) {
		return { success: false, error: `cd: no such file or directory: ${targetInput}` };
	}
	if (node.type !== 'dir') {
		return { success: false, error: `cd: not a directory: ${targetInput}` };
	}

	oldWorkingDir = currentWorkingDir;
	currentWorkingDir = resolved;
	return { success: true, newCwd: currentWorkingDir };
}

function formatBytes(bytes: number, human: boolean): string {
	if (!human) return bytes.toString().padStart(6, ' ');
	if (bytes < 1024) return `${bytes}B`.padStart(5, ' ');
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`.padStart(5, ' ');
	return `${(bytes / (1024 * 1024)).toFixed(1)}M`.padStart(5, ' ');
}

export function listDirectory(pathInput: string = '', flags: { all?: boolean; long?: boolean; human?: boolean } = {}): { success: boolean; output: string } {
	const resolved = pathInput ? resolvePath(pathInput) : currentWorkingDir;
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">ls: cannot access '${escapeHtml(pathInput)}': No such file or directory</span>` };
	}

	if (node.type === 'file') {
		if (flags.long) {
			const sizeStr = formatBytes(node.size, !!flags.human);
			const nameStr = node.executable ? `<span class="term-hl">${escapeHtml(node.name)}*</span>` : escapeHtml(node.name);
			return { success: true, output: `-rw-r--r-- 1 guest brob ${sizeStr} ${node.mtime} ${nameStr}` };
		}
		return { success: true, output: node.executable ? `<span class="term-hl">${escapeHtml(node.name)}*</span>` : escapeHtml(node.name) };
	}

	const children = node.children || new Map<string, VFSNode>();
	const entries: { name: string; node: VFSNode; isSpecial?: boolean }[] = [];

	if (flags.all) {
		entries.push({ name: '.', node: { name: '.', type: 'dir', size: 4096, mtime: node.mtime }, isSpecial: true });
		entries.push({ name: '..', node: { name: '..', type: 'dir', size: 4096, mtime: node.mtime }, isSpecial: true });
	}

	const sortedNames = Array.from(children.keys()).sort((a, b) => a.localeCompare(b));
	for (const name of sortedNames) {
		if (!flags.all && name.startsWith('.')) continue;
		entries.push({ name, node: children.get(name)! });
	}

	if (flags.long) {
		const totalBlocks = Math.ceil(entries.reduce((sum, e) => sum + e.node.size, 0) / 1024);
		const lines = [`<span class="term-dim">total ${totalBlocks}</span>`];

		for (const entry of entries) {
			const isDir = entry.node.type === 'dir';
			const perm = isDir ? 'drwxr-xr-x' : (entry.node.executable ? '-rwxr-xr-x' : '-rw-r--r--');
			const links = isDir ? '2' : '1';
			const sizeStr = formatBytes(entry.node.size, !!flags.human);
			let styledName = escapeHtml(entry.name);
			if (isDir) {
				styledName = `<span class="term-cyan">${styledName}/</span>`;
			} else if (entry.node.executable) {
				styledName = `<span class="term-hl">${styledName}*</span>`;
			}
			lines.push(`${perm} ${links} guest brob ${sizeStr} ${entry.node.mtime} ${styledName}`);
		}
		return { success: true, output: lines.join('\n') };
	}

	// Compact horizontal column layout
	const formatted = entries.map(entry => {
		if (entry.node.type === 'dir') {
			return `<span class="term-cyan">${escapeHtml(entry.name)}/</span>`;
		}
		if (entry.node.executable) {
			return `<span class="term-hl">${escapeHtml(entry.name)}*</span>`;
		}
		return escapeHtml(entry.name);
	});

	return { success: true, output: formatted.join('  ') };
}

export function readFile(pathInput: string): { success: boolean; output: string } {
	if (!pathInput) {
		return { success: false, output: '<span class="term-err">cat: missing file operand</span>' };
	}
	const resolved = resolvePath(pathInput);
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">cat: ${escapeHtml(pathInput)}: No such file or directory</span>` };
	}
	if (node.type === 'dir') {
		return { success: false, output: `<span class="term-err">cat: ${escapeHtml(pathInput)}: Is a directory</span>` };
	}

	const content = node.content ?? '';
	const totalLines = content.split('\n').length;
	let hint = '';
	if (totalLines > 80) {
		hint = `\n<span class="term-dim">Tip: File has ${totalLines} lines. Try 'head -n 25 ${escapeHtml(pathInput)}' or 'grep <pattern> ${escapeHtml(pathInput)}'.</span>`;
	}

	return { success: true, output: escapeHtml(content) + hint };
}

export function headFile(pathInput: string, numLines = 10): { success: boolean; output: string } {
	if (!pathInput) {
		return { success: false, output: '<span class="term-err">head: missing file operand</span>' };
	}
	const resolved = resolvePath(pathInput);
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">head: cannot open '${escapeHtml(pathInput)}' for reading: No such file or directory</span>` };
	}
	if (node.type === 'dir') {
		return { success: false, output: `<span class="term-err">head: error reading '${escapeHtml(pathInput)}': Is a directory</span>` };
	}

	const lines = (node.content ?? '').split('\n');
	const slice = lines.slice(0, Math.max(1, numLines));
	return { success: true, output: escapeHtml(slice.join('\n')) };
}

export function tailFile(pathInput: string, numLines = 10): { success: boolean; output: string } {
	if (!pathInput) {
		return { success: false, output: '<span class="term-err">tail: missing file operand</span>' };
	}
	const resolved = resolvePath(pathInput);
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">tail: cannot open '${escapeHtml(pathInput)}' for reading: No such file or directory</span>` };
	}
	if (node.type === 'dir') {
		return { success: false, output: `<span class="term-err">tail: error reading '${escapeHtml(pathInput)}': Is a directory</span>` };
	}

	const lines = (node.content ?? '').split('\n');
	const slice = lines.slice(-Math.max(1, numLines));
	return { success: true, output: escapeHtml(slice.join('\n')) };
}

export function grepFile(pattern: string, pathInput: string): { success: boolean; output: string } {
	if (!pattern || !pathInput) {
		return { success: false, output: '<span class="term-err">usage: grep &lt;pattern&gt; &lt;file&gt;</span>' };
	}
	const resolved = resolvePath(pathInput);
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">grep: ${escapeHtml(pathInput)}: No such file or directory</span>` };
	}
	if (node.type === 'dir') {
		return { success: false, output: `<span class="term-err">grep: ${escapeHtml(pathInput)}: Is a directory</span>` };
	}

	const lines = (node.content ?? '').split('\n');
	const matches: string[] = [];
	const searchLower = pattern.toLowerCase();

	lines.forEach((line, idx) => {
		if (line.toLowerCase().includes(searchLower)) {
			const lineNum = `<span class="term-dim">${(idx + 1).toString().padStart(4, ' ')}:</span> `;
			// Highlight matched term
			const escaped = escapeHtml(line);
			const regex = new RegExp(`(${escapeRegex(escapeHtml(pattern))})`, 'gi');
			const highlighted = escaped.replace(regex, '<span class="term-hl">$1</span>');
			matches.push(lineNum + highlighted);
		}
	});

	if (matches.length === 0) {
		return { success: true, output: `<span class="term-dim">[grep: 0 matches found for '${escapeHtml(pattern)}']</span>` };
	}

	return { success: true, output: matches.join('\n') };
}

export function tree(pathInput: string = '', maxDepth = 3): { success: boolean; output: string } {
	const resolved = pathInput ? resolvePath(pathInput) : currentWorkingDir;
	const node = getNode(resolved);

	if (!node) {
		return { success: false, output: `<span class="term-err">tree: '${escapeHtml(pathInput)}': No such file or directory</span>` };
	}
	if (node.type === 'file') {
		return { success: true, output: escapeHtml(node.name) };
	}

	const lines: string[] = [`<span class="term-cyan">${escapeHtml(getDisplayPath(resolved))}/</span>`];
	let dirCount = 0;
	let fileCount = 0;

	function walk(currNode: VFSNode, prefix: string, depth: number) {
		if (depth > maxDepth || !currNode.children) return;
		const entries = Array.from(currNode.children.values())
			.filter(c => !c.name.startsWith('.'))
			.sort((a, b) => a.name.localeCompare(b.name));

		entries.forEach((child, idx) => {
			const isLast = idx === entries.length - 1;
			const branch = isLast ? '└── ' : '├── ';
			const nextPrefix = prefix + (isLast ? '    ' : '│   ');

			if (child.type === 'dir') {
				dirCount++;
				lines.push(`${prefix}${branch}<span class="term-cyan">${escapeHtml(child.name)}/</span>`);
				walk(child, nextPrefix, depth + 1);
			} else {
				fileCount++;
				const nameStr = child.executable ? `<span class="term-hl">${escapeHtml(child.name)}*</span>` : escapeHtml(child.name);
				lines.push(`${prefix}${branch}${nameStr}`);
			}
		});
	}

	walk(node, '', 1);
	lines.push(`\n<span class="term-dim">${dirCount} directories, ${fileCount} files</span>`);
	return { success: true, output: lines.join('\n') };
}

export function autocompletePath(partial: string, baseCwd: string = currentWorkingDir): string[] {
	const lastSlash = partial.lastIndexOf('/');
	let searchDirStr = '';
	let prefix = partial;

	if (lastSlash !== -1) {
		searchDirStr = partial.slice(0, lastSlash);
		prefix = partial.slice(lastSlash + 1);
	}

	const resolvedDir = searchDirStr ? resolvePath(searchDirStr, baseCwd) : baseCwd;
	const dirNode = getNode(resolvedDir);
	if (!dirNode || dirNode.type !== 'dir' || !dirNode.children) return [];

	const matches: string[] = [];
	for (const [name, child] of dirNode.children.entries()) {
		if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
			const suffix = child.type === 'dir' ? '/' : '';
			const completed = searchDirStr ? `${searchDirStr}/${name}${suffix}` : `${name}${suffix}`;
			matches.push(completed);
		}
	}
	return matches;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
