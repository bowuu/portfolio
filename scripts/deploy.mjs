import { execSync } from 'node:child_process';

console.log('🔍 Checking git working tree cleanliness...');
const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

if (status) {
	console.error('\n❌ \x1b[31m[DEPLOY ERROR] Cannot deploy with uncommitted changes!\x1b[0m');
	console.error('The following files have uncommitted modifications:\n');
	console.error(status.split('\n').map(l => '   ' + l).join('\n'));
	console.error('\n\x1b[33mPlease commit your changes before deploying:\x1b[0m');
	console.error('   1. git add <files>');
	console.error('   2. git commit -m "your descriptive commit message"');
	console.error('\nThis guarantees the build hash, timestamp, and footer commit link on brob.uk');
	console.error('always match the verified code in your GitHub repository.\n');
	process.exit(1);
}

console.log('🚀 Pushing latest commit to origin main...');
execSync('git push origin main', { stdio: 'inherit' });

console.log('⚡ Deploying with Wrangler (executes fresh build automatically)...');
execSync('npx wrangler deploy', { stdio: 'inherit' });

console.log('\n✅ Deployment successful! Live footer commit hash is 100% in sync with GitHub.');
