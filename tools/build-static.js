#!/usr/bin/env node

import { cp, mkdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distDir = path.join(projectRoot, 'dist');

const copyTargets = [
  { from: 'index.html', to: 'index.html' },
  { from: 'sketchs', to: 'sketchs' },
  { from: 'workshop', to: 'workshop', optional: true },
  { from: 'dev', to: 'dev', optional: true }
];

function log(message) {
  console.log(`[build] ${message}`);
}

async function ensureExists(sourcePath, optional) {
  try {
    await stat(sourcePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!optional) {
        throw new Error(`Required source "${sourcePath}" was not found.`);
      }
      log(`skip ${path.relative(projectRoot, sourcePath)} (not found)`);
      return false;
    }
    throw error;
  }
}

async function main() {
  log('clean dist/');
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const { from, to, optional } of copyTargets) {
    const sourcePath = path.join(projectRoot, from);
    const shouldCopy = await ensureExists(sourcePath, optional);
    if (!shouldCopy) {
      continue;
    }
    const destinationPath = path.join(distDir, to);
    await cp(sourcePath, destinationPath, { recursive: true });
    log(`copied ${from} → dist/${to}`);
  }

  // Ensure GitHub Pages does not run Jekyll processing on the static output
  const noJekyllPath = path.join(distDir, '.nojekyll');
  await writeFile(noJekyllPath, '');
  log('created dist/.nojekyll');

  log('build completed');
}

main().catch((error) => {
  console.error('[build] failed:', error);
  process.exitCode = 1;
});
