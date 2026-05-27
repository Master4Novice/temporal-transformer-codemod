#!/usr/bin/env node
// CLI entry point for the @master4n/temporal-transformer-codemod.
//
// Migrates callers of @master4n/temporal-transformer from v1.x (1.3.0 is the
// last legacy moment-backed release) to v2.0.2 (Luxon-backed).
//
// Usage:
//   npx @master4n/temporal-transformer-codemod [options] <path> [<path>...]
//
// Options:
//   --dry           Preview changes without modifying files.
//   --update-deps   Also bump @master4n/temporal-transformer in package.json
//                   files found under the target paths to ^2.0.2.
//   --help, -h      Show this help.
//
// Examples:
//   npx @master4n/temporal-transformer-codemod ./src
//   npx @master4n/temporal-transformer-codemod --dry ./src ./test
//   npx @master4n/temporal-transformer-codemod --update-deps ./
//
// The transform rewrites moment-style format-string arguments inside calls to
// convertEpoch / convertEpochToTimezone / parseToEpoch and their safe variants,
// converts [literal] escapes to 'literal' (with proper '' escaping), and warns
// on untranslatable moment-only tokens (X, x, Q, GGGG, gggg, W, WW).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packageRoot = resolve(__dirname, '..');
const transformerPath = resolve(packageRoot, 'dist/codemod.js');

const HELP = `temporal-transformer-codemod — migrate v1.x format strings to v2.0.2

Usage:  temporal-transformer-codemod [options] <path> [<path>...]

Options:
  --dry           Preview changes without modifying files.
  --update-deps   Also bump @master4n/temporal-transformer in package.json
                  files found under the target paths to ^2.0.2.
  -h, --help      Show this help.

Examples:
  temporal-transformer-codemod ./src
  temporal-transformer-codemod --dry ./src ./test
  temporal-transformer-codemod --update-deps ./
`;

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(args.length === 0 ? 1 : 0);
}

const dry = args.includes('--dry');
const updateDeps = args.includes('--update-deps');
const targets = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p));

if (targets.length === 0) {
  process.stderr.write('Error: no target paths supplied.\n\n');
  process.stdout.write(HELP);
  process.exit(1);
}

// ── 1. Source-code transform via jscodeshift ────────────────────────────
const { run: runJscodeshift } = require('jscodeshift/src/Runner.js');

const result = await runJscodeshift(transformerPath, targets, {
  parser: 'tsx',
  extensions: 'ts,tsx,js,jsx',
  dry,
  print: dry,
  silent: false,
  verbose: 1,
});

let exitCode = result.error > 0 ? 1 : 0;

// ── 2. Optional package.json dep bump ───────────────────────────────────
if (updateDeps) {
  const { findPackageJsons, bumpPackageJson, DEFAULT_TARGET_RANGE, RUNTIME_LIB_NAME } =
    await import(resolve(packageRoot, 'dist/updateDeps.js'));

  process.stdout.write(`\nScanning for package.json files to bump ${RUNTIME_LIB_NAME} → ${DEFAULT_TARGET_RANGE}...\n`);
  const pkgPaths = await findPackageJsons(targets);
  if (pkgPaths.length === 0) {
    process.stdout.write('  (no package.json files found under the target paths)\n');
  } else {
    let bumped = 0;
    for (const pkgPath of pkgPaths) {
      if (dry) {
        // Read-only check: would this file change?
        const { readFileSync } = await import('node:fs');
        let pkg;
        try {
          pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        } catch {
          continue;
        }
        const depMaps = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
        const hasOld = depMaps.some(
          (k) => pkg[k] && typeof pkg[k] === 'object' && pkg[k][RUNTIME_LIB_NAME] && pkg[k][RUNTIME_LIB_NAME] !== DEFAULT_TARGET_RANGE,
        );
        if (hasOld) {
          process.stdout.write(`  [dry] would bump: ${pkgPath}\n`);
          bumped++;
        }
      } else {
        const r = bumpPackageJson(pkgPath);
        if (r.changed) {
          process.stdout.write(`  bumped: ${pkgPath}\n`);
          bumped++;
        }
      }
    }
    if (bumped === 0) {
      process.stdout.write('  (no package.json declared @master4n/temporal-transformer or all were already at the target range)\n');
    } else {
      process.stdout.write(`\n${dry ? 'would update' : 'updated'} ${bumped} package.json file${bumped === 1 ? '' : 's'}\n`);
    }
  }
}

process.exit(exitCode);
