#!/usr/bin/env node
// CLI entry point for the temporal-transformer codemod.
//
// Usage:
//   npx @master4n/temporal-transformer-codemod <path> [<path>...]
//   npx @master4n/temporal-transformer-codemod ./src
//   npx @master4n/temporal-transformer-codemod --dry ./src
//
// Walks the given paths, parses each .ts/.tsx/.js file with jscodeshift, and
// rewrites moment-style format strings inside calls to convertEpoch /
// convertEpochToTimezone / parseToEpoch (and safe variants). Pass --dry to
// preview without modifying files.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packageRoot = resolve(__dirname, '..');
const transformerPath = resolve(packageRoot, 'dist/codemod.js');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  process.stdout.write(
    `temporal-transformer-codemod — migrate v1.x format strings to v2.0\n\n` +
    `Usage: temporal-transformer-codemod [--dry] <path> [<path>...]\n\n` +
    `Examples:\n` +
    `  temporal-transformer-codemod ./src\n` +
    `  temporal-transformer-codemod --dry ./src ./test\n`,
  );
  process.exit(args.length === 0 ? 1 : 0);
}

const dry = args.includes('--dry');
const targets = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p));

const { run: runJscodeshift } = require('jscodeshift/src/Runner.js');

const result = await runJscodeshift(transformerPath, targets, {
  parser: 'tsx',
  extensions: 'ts,tsx,js,jsx',
  dry,
  print: dry,
  silent: false,
  verbose: 1,
});

if (result.error > 0) {
  process.exit(1);
}
