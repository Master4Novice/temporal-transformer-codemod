import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bumpPackageJson,
  findPackageJsons,
  DEFAULT_TARGET_RANGE,
  RUNTIME_LIB_NAME,
} from '../src/updateDeps.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'tt-codemod-updateDeps-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writePkg(filePath: string, contents: object): string {
  mkdirSync(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });
  writeFileSync(filePath, JSON.stringify(contents, null, 2) + '\n', 'utf8');
  return filePath;
}

describe('bumpPackageJson', () => {
  test('bumps dependencies range from ^1.x to ^2.0.2', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      dependencies: { [RUNTIME_LIB_NAME]: '^1.3.0', other: '^5.0.0' },
    });
    const result = bumpPackageJson(pkgPath);
    expect(result.changed).toBe(true);
    const after = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(after.dependencies[RUNTIME_LIB_NAME]).toBe(DEFAULT_TARGET_RANGE);
    expect(after.dependencies.other).toBe('^5.0.0');
  });

  test('bumps devDependencies', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      devDependencies: { [RUNTIME_LIB_NAME]: '~1.2.1' },
    });
    bumpPackageJson(pkgPath);
    const after = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(after.devDependencies[RUNTIME_LIB_NAME]).toBe(DEFAULT_TARGET_RANGE);
  });

  test('bumps peerDependencies', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'plugin',
      peerDependencies: { [RUNTIME_LIB_NAME]: '>=1.2.0 <2.0.0' },
    });
    bumpPackageJson(pkgPath);
    const after = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(after.peerDependencies[RUNTIME_LIB_NAME]).toBe(DEFAULT_TARGET_RANGE);
  });

  test('is a no-op when already at the target range', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      dependencies: { [RUNTIME_LIB_NAME]: DEFAULT_TARGET_RANGE },
    });
    const result = bumpPackageJson(pkgPath);
    expect(result.changed).toBe(false);
  });

  test('does not touch unrelated deps', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      dependencies: { moment: '^2.30.0', luxon: '^3.5.0' },
    });
    const before = readFileSync(pkgPath, 'utf8');
    const result = bumpPackageJson(pkgPath);
    expect(result.changed).toBe(false);
    expect(readFileSync(pkgPath, 'utf8')).toBe(before);
  });

  test('preserves other dep maps untouched', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      dependencies: { [RUNTIME_LIB_NAME]: '^1.3.0' },
      devDependencies: { jest: '^29.0.0' },
    });
    bumpPackageJson(pkgPath);
    const after = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(after.devDependencies.jest).toBe('^29.0.0');
  });

  test('handles malformed JSON gracefully (no throw, no change)', () => {
    const pkgPath = join(workDir, 'package.json');
    writeFileSync(pkgPath, '{ this is not json', 'utf8');
    const result = bumpPackageJson(pkgPath);
    expect(result.changed).toBe(false);
  });

  test('preserves trailing newline', () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), {
      name: 'consumer',
      dependencies: { [RUNTIME_LIB_NAME]: '^1.3.0' },
    });
    bumpPackageJson(pkgPath);
    expect(readFileSync(pkgPath, 'utf8').endsWith('\n')).toBe(true);
  });
});

describe('findPackageJsons', () => {
  test('finds package.json in target dir', async () => {
    writePkg(join(workDir, 'package.json'), { name: 'a' });
    const results = await findPackageJsons([workDir]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/package\.json$/);
  });

  test('finds package.json recursively', async () => {
    writePkg(join(workDir, 'package.json'), { name: 'root' });
    writePkg(join(workDir, 'packages/a/package.json'), { name: 'a' });
    writePkg(join(workDir, 'packages/b/package.json'), { name: 'b' });
    const results = await findPackageJsons([workDir]);
    expect(results).toHaveLength(3);
  });

  test('ignores node_modules', async () => {
    writePkg(join(workDir, 'package.json'), { name: 'root' });
    writePkg(join(workDir, 'node_modules/foo/package.json'), { name: 'foo' });
    const results = await findPackageJsons([workDir]);
    expect(results).toHaveLength(1);
  });

  test('ignores dist, build, .git', async () => {
    writePkg(join(workDir, 'package.json'), { name: 'root' });
    writePkg(join(workDir, 'dist/package.json'), { name: 'dist' });
    writePkg(join(workDir, 'build/package.json'), { name: 'build' });
    writePkg(join(workDir, '.git/package.json'), { name: 'git' });
    const results = await findPackageJsons([workDir]);
    expect(results).toHaveLength(1);
  });

  test('accepts a direct path to a package.json file', async () => {
    const pkgPath = writePkg(join(workDir, 'package.json'), { name: 'root' });
    const results = await findPackageJsons([pkgPath]);
    expect(results).toEqual([pkgPath]);
  });
});
