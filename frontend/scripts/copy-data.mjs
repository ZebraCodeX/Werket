// Copies the Amharic dictionary/model into the web build so the packaged
// (offline) apps can spell-check and predict without a server.
// The source of truth stays in the repo-root data/ directory.
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '../../data');
const outDir = resolve(here, '../public/data');

mkdirSync(outDir, { recursive: true });

for (const name of ['amharic_words.json', 'nl_model.json']) {
  const src = resolve(srcDir, name);
  if (existsSync(src)) {
    copyFileSync(src, resolve(outDir, name));
    console.log(`[copy-data] ${name}`);
  } else {
    console.warn(`[copy-data] WARNING: missing ${src}`);
  }
}
