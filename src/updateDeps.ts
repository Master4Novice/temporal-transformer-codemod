// Locate package.json files under the given root paths and bump the
// `@master4n/temporal-transformer` dependency range to a v2.x-compatible
// specifier. Idempotent — running it twice is a no-op.
//
// Only touches the four dep maps where the runtime library would
// realistically appear (`dependencies`, `devDependencies`,
// `peerDependencies`, `optionalDependencies`). `bundledDependencies` and
// `overrides` are intentionally not modified.

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const RUNTIME_LIB = '@master4n/temporal-transformer';
const TARGET_RANGE = '^2.0.2';

const DEP_KEYS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

// Skip these directory names when walking — there's no point updating
// package.json files inside dependency installs or build outputs.
const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.git',
  '.idea',
  '.vscode',
]);

export interface UpdateDepsResult {
  packageJsonPath: string;
  before: string;
  after: string;
  changed: boolean;
}

async function walk(root: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return; // not a directory, or unreadable
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      await walk(join(root, entry.name), results);
    } else if (entry.isFile() && entry.name === 'package.json') {
      results.push(join(root, entry.name));
    }
  }
}

/** Find all package.json files under the given paths (recursive). */
export async function findPackageJsons(paths: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const p of paths) {
    const abs = resolve(p);
    let s;
    try {
      s = await stat(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      await walk(abs, results);
    } else if (s.isFile() && abs.endsWith('package.json')) {
      results.push(abs);
    }
  }
  return [...new Set(results)];
}

/**
 * Bump @master4n/temporal-transformer in a single package.json. Pure-ish:
 * reads from disk, writes only if a dep was changed. Preserves trailing
 * newline and indent (best-effort 2-space).
 */
export function bumpPackageJson(
  packageJsonPath: string,
  targetRange: string = TARGET_RANGE,
): UpdateDepsResult {
  const before = readFileSync(packageJsonPath, 'utf8');
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(before);
  } catch {
    return { packageJsonPath, before, after: before, changed: false };
  }

  let changed = false;
  for (const key of DEP_KEYS) {
    const map = pkg[key];
    if (!map || typeof map !== 'object') continue;
    const deps = map as Record<string, string>;
    if (deps[RUNTIME_LIB] && deps[RUNTIME_LIB] !== targetRange) {
      deps[RUNTIME_LIB] = targetRange;
      changed = true;
    }
  }

  if (!changed) {
    return { packageJsonPath, before, after: before, changed: false };
  }

  // Preserve trailing newline + use 2-space indent (the npm default).
  const trailingNewline = before.endsWith('\n') ? '\n' : '';
  const after = JSON.stringify(pkg, null, 2) + trailingNewline;
  writeFileSync(packageJsonPath, after, 'utf8');
  return { packageJsonPath, before, after, changed: true };
}

export const DEFAULT_TARGET_RANGE = TARGET_RANGE;
export const RUNTIME_LIB_NAME = RUNTIME_LIB;
