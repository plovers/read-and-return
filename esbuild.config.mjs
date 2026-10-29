import * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', target: 'es2020', outfile: 'main.js', platform: 'browser',
  sourcemap: false, minify: false, banner: { js: `/* Read & Return v${manifest.version} */` }
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else await esbuild.build(options);
