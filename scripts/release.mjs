import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const readJson = async name => JSON.parse(await readFile(join(root, name), 'utf8'));
const manifest = await readJson('manifest.json');
const pkg = await readJson('package.json');
const versions = await readJson('versions.json');
if (manifest.version !== pkg.version || versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error('Release metadata is inconsistent');
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.id !== 'read-and-return') throw new Error('Invalid release path');
const destination = join(root, 'release', manifest.version, manifest.id);
const files = ['manifest.json', 'main.js', 'styles.css'];
await mkdir(destination, { recursive: true });
// Refuse unknown runtime files rather than silently packaging stale artifacts or deleting user files.
const unexpected = (await readdir(destination)).filter(file => !files.includes(file));
if (unexpected.length) throw new Error(`Unexpected release files: ${unexpected.join(', ')}`);
for (const file of files) {
  const source = await readFile(join(root, file));
  let previous;
  try { previous = await readFile(join(destination, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(join(destination, file), source);
  const output = await readFile(join(destination, file));
  if (!source.equals(output)) throw new Error(`Release verification failed: ${file}`);
  const state = !previous ? 'Added' : previous.equals(output) ? 'Unchanged' : 'Modified';
  console.log(`${state}: ${file} (${output.length} bytes, SHA256 ${createHash('sha256').update(output).digest('hex')})`);
}
console.log(`Release ready: ${destination}`);
