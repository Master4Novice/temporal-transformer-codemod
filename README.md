# @master4n/temporal-transformer-codemod

[![npm version](https://img.shields.io/npm/v/%40master4n%2Ftemporal-transformer-codemod)](https://www.npmjs.com/package/@master4n/temporal-transformer-codemod)
[![License: MIT](https://img.shields.io/npm/l/%40master4n%2Ftemporal-transformer-codemod)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/Master4Novice/temporal-transformer-codemod/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/temporal-transformer-codemod/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/%40master4n%2Ftemporal-transformer-codemod)](https://nodejs.org/)

One-shot codemod CLI for migrating [`@master4n/temporal-transformer`](https://www.npmjs.com/package/@master4n/temporal-transformer) callers from **v1.x (last legacy release: `1.3.0`)** to **v2.0.4** (Luxon-backed).

You only need this once, during the upgrade. After that you can uninstall the codemod.

## Why you need this

`@master4n/temporal-transformer` v2.0 swapped its internal engine from moment.js to Luxon. The public API surface is unchanged — every function, type, and error code from v1.x still exists — but **format-string grammar changed** (moment tokens → Luxon tokens) and the **default format dropped from 6-digit to 3-digit fractional seconds**. Without this codemod, every format string in your codebase needs manual rewriting.

## Quickstart

```bash
# Preview what would change (recommended first run)
npx @master4n/temporal-transformer-codemod --dry ./src

# Apply
npx @master4n/temporal-transformer-codemod ./src

# Also bump @master4n/temporal-transformer in package.json files to ^2.0.4
npx @master4n/temporal-transformer-codemod --update-deps ./

# Multiple paths
npx @master4n/temporal-transformer-codemod ./src ./test ./scripts
```

## CLI options

| Flag             | Purpose |
|------------------|---------|
| `--dry`          | Preview changes without modifying files. Prints a diff per file. |
| `--update-deps`  | Find every `package.json` under the target paths (skipping `node_modules`, `dist`, `build`, `.git`, etc.) and bump `@master4n/temporal-transformer` in `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` to `^2.0.4`. Idempotent. |
| `--help`, `-h`   | Show usage. |

## What it does

For every `.ts`, `.tsx`, `.js`, `.jsx` file under the target path, the codemod finds calls to:

- `convertEpoch(epoch, format)`
- `convertEpochToTimezone(epoch, tz, format)`
- `parseToEpoch(input, format, tz)`
- `safeConvertEpoch`, `safeConvertEpochToTimezone`, `safeParseToEpoch`

…and rewrites the format-string argument from moment-style to Luxon-style:

| Before (v1.x)                       | After (v2.0.4)                  |
|-------------------------------------|---------------------------------|
| `'YYYY-MM-DD'`                      | `'yyyy-MM-dd'`                  |
| `'YYYY-MM-DD HH:mm:ss.SSSSSS'`      | `'yyyy-MM-dd HH:mm:ss.SSS'`     |
| `'dddd, MMMM D YYYY'`               | `'cccc, LLLL d yyyy'`           |
| `'DD/MM/YYYY'`                      | `'dd/MM/yyyy'`                  |
| `` `YYYY-MM-DD` ``                  | `` `yyyy-MM-dd` ``              |
| `'[Date:] YYYY-MM-DD'`              | `"'Date:' yyyy-MM-dd"`          |
| `"YYYY-[don't] DD"`                 | `"yyyy-'don''t' dd"`            |

Format strings are recognized whether they are:

- Plain string literals: `'YYYY-MM-DD'` or `"YYYY-MM-DD"`
- Untemplated template literals: `` `YYYY-MM-DD` `` (no `${...}` interpolations)

The codemod correctly handles:

- **Greedy token matching** — `YYYY` matches as one token, not `YY + YY`.
- **6-digit fractional cap (B1)** — moment's `SSSSSS` (always zero-padded fiction in JS) collapses to Luxon's `SSS`.
- **Moment's `[literal]` escape → Luxon's `'literal'`**, with proper `''` doubling of embedded apostrophes.
- **Pre-existing Luxon-style `'literal'` blocks** — left alone.

It does **not** translate:

- **Dynamic format strings** — template literals *with* `${...}` interpolations, identifier references, member access expressions. These are left unchanged for manual review.
- **Untranslatable moment-only tokens** — `X` (unix seconds), `x` (unix milliseconds), `Q` (quarter), `GGGG`, `gggg`, `W`, `WW`. These remain in the output and a stderr warning is printed. The v2.0 runtime allowlist throws `FormatInvalid` on those at execution time, so the wrong code cannot ship silently — but you should replace them with the dedicated API:
  - `X` → use the result's `epochInSeconds` field
  - `x` → use `epochInMilliseconds`

## Migration walkthrough (v1.3.0 → v2.0.4)

```bash
# 1. Preview every change
npx @master4n/temporal-transformer-codemod --dry ./src ./test

# 2. Apply source rewrites and bump package.json in one pass
npx @master4n/temporal-transformer-codemod --update-deps ./

# 3. Install the new version
npm install

# 4. Run your tests — most code now works unchanged
npm test
```

After the codemod completes, review the stderr warnings for any untranslatable tokens, then remove the codemod itself:

```bash
npm uninstall @master4n/temporal-transformer-codemod
```

## Programmatic API

If you need to integrate the translator into a custom build step or migration script:

```typescript
import {
  translateMomentFormat,
  bumpPackageJson,
  findPackageJsons,
  DEFAULT_TARGET_RANGE,    // '^2.0.4'
  RUNTIME_LIB_NAME,        // '@master4n/temporal-transformer'
} from '@master4n/temporal-transformer-codemod';

// Translate a single format string
const { output, warnings } = translateMomentFormat('YYYY-MM-DD HH:mm:ss');
console.log(output);    // 'yyyy-MM-dd HH:mm:ss'
console.log(warnings);  // []

// Bump a single package.json
const result = bumpPackageJson('./package.json');
console.log(result.changed);           // true | false
console.log(result.packageJsonPath);   // absolute path

// Discover package.json files under one or more roots
const paths = await findPackageJsons(['./packages']);
for (const p of paths) bumpPackageJson(p);
```

The translator is a hand-written state machine, not a regex — `[literal]` blocks containing tokens or punctuation are handled correctly. The package.json walker skips `node_modules`, `dist`, `build`, `out`, `coverage`, `.next`, `.nuxt`, `.git`, `.idea`, `.vscode`, and any directory starting with `.`.

## Companion library

This codemod is the migration tool for [`@master4n/temporal-transformer`](https://github.com/Master4Novice/temporal-transformer), a TypeScript library that auto-detects whether epoch timestamps are in seconds, milliseconds, microseconds, or nanoseconds. Install the v2.0 line with:

```bash
npm install @master4n/temporal-transformer
```

For details on what changed between v1.x and v2.0, see the runtime library's [MIGRATION.md](https://github.com/Master4Novice/temporal-transformer/blob/master/MIGRATION.md).

## Changelog

### 2.0.5

- **Packaging:** `llms.txt` is now included in the published tarball (it was
  present in the repo but not copied into `dist`).
- **Discoverability:** broadened npm keywords (automated-refactor,
  dependency-migration, cli) and added a "Part of the @master4n toolkit" section.

### 2.0.4

- **`--update-deps` now targets `^2.0.4`** (`DEFAULT_TARGET_RANGE`), the latest
  `@master4n/temporal-transformer` release — which makes the zero-dependency core
  and rejects ambiguous fractional epochs (`EpochError.NotAnInteger`). Bumping the
  floor ensures migrated projects pull the fixed runtime. Idempotent as before.
- **No API or translator change** — CLI flags and programmatic exports unchanged.

### 2.0.3

- **Build:** Switched from raw `tsc` to a Rollup setup matching [`@master4n/temporal-transformer`](https://github.com/Master4Novice/temporal-transformer). Three standalone bundles + one bundled `.d.ts`:
  - `dist/index.js` — bundled programmatic API
  - `dist/codemod.js` — standalone (jscodeshift's Runner requires a file path)
  - `dist/updateDeps.js` — standalone (the bin script `await import()`s it)
  - `dist/index.d.ts` — bundled types via `rollup-plugin-dts`
- **Publish flow:** Now publishes from `dist/` via `publishConfig.directory`. The shipped `package.json` strips `scripts`, `devDependencies`, `publishConfig`, and `gitHead`. Paths in the published `main`/`types`/`bin` are flat (no `./dist/` prefix) so consumers `npm install` a clean tree.
- **CI fix:** Windows path bug in `test/updateDeps.test.ts` (was using `'/'` for `lastIndexOf` — now uses `path.dirname()`).
- **CI fix:** CommonJS `jscodeshift` import in `test/codemod.test.ts` is now resilient under ts-jest's ESM mode (namespace import with synthetic default fallback).
- **DX:** Jest now ignores `dist/` via `modulePathIgnorePatterns` so bundled output isn't accidentally treated as a test target.
- **No API change** — translator output, CLI flags, and programmatic exports identical to 2.0.2.

### 2.0.2

- **New:** `--update-deps` flag — bumps `@master4n/temporal-transformer` in every `package.json` under the target paths from `^1.x` to `^2.0.2`. Handles `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`. Idempotent.
- **New:** Format strings written as no-expression template literals (`` `YYYY-MM-DD` ``) are now recognized and rewritten. Template literals with `${...}` expressions are still skipped for safety.
- **New:** Programmatic API — `bumpPackageJson`, `findPackageJsons`, `DEFAULT_TARGET_RANGE`, `RUNTIME_LIB_NAME` are exported alongside `translateMomentFormat` and `transformer`.
- **Tests:** 50 tests (up from 27). Added integration-style tests for the jscodeshift transformer and full coverage of the package.json bumper.
- **No behavior change for existing callers** — every prior translation pair still passes its test.

### 2.0.1

- **CI:** Workflow now triggers on `master`, `main`; added `workflow_dispatch` and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` (silences the Node 20 deprecation warning ahead of 2026-09-16 removal).
- **DX:** `npm test` is now cross-platform via `cross-env` (Windows-safe TZ env var).
- **Docs:** Added `SECURITY.md`, `CONTRIBUTING.md`, `llms.txt`, CI badge, Node-version badge.
- **No behavior change** — translator output identical to 2.0.0.

### 2.0.0

- Initial public release.

## Reporting issues

Bug reports & feature requests: [github.com/Master4Novice/temporal-transformer-codemod/issues](https://github.com/Master4Novice/temporal-transformer-codemod/issues)

Security vulnerabilities: see [SECURITY.md](./SECURITY.md).

## Part of the @master4n toolkit

A small ecosystem of focused, agent-friendly packages:

- [`@master4n/temporal-transformer`](https://www.npmjs.com/package/@master4n/temporal-transformer) — epoch/timestamp ↔ date conversion with auto unit-detection and IANA timezones (Luxon-backed)
- [`@master4n/http-status`](https://www.npmjs.com/package/@master4n/http-status) — machine-readable HTTP status-code registry for apps & AI agents
- [`@master4n/decorators`](https://www.npmjs.com/package/@master4n/decorators) — zero-dependency TypeScript decorators (DI, validation, resilience, redaction)
- [`@master4n/master-cli`](https://www.npmjs.com/package/@master4n/master-cli) — headless, JSON-first dev CLI (`mfn`) for humans and AI agents

## License

MIT © [Master4Novice](https://github.com/Master4Novice)
