# @master4n/temporal-transformer-codemod

[![npm version](https://img.shields.io/npm/v/%40master4n%2Ftemporal-transformer-codemod)](https://www.npmjs.com/package/@master4n/temporal-transformer-codemod)
[![License: MIT](https://img.shields.io/npm/l/%40master4n%2Ftemporal-transformer-codemod)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/Master4Novice/temporal-transformer-codemod/actions/workflows/ci.yml/badge.svg)](https://github.com/Master4Novice/temporal-transformer-codemod/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/%40master4n%2Ftemporal-transformer-codemod)](https://nodejs.org/)

One-shot codemod CLI for migrating [`@master4n/temporal-transformer`](https://www.npmjs.com/package/@master4n/temporal-transformer) callers from v1.x (moment.js tokens) to v2.0 (Luxon tokens).

You only need this once, during the v1.x → v2.0 upgrade. After that you can remove the dep.

## Usage

```bash
# Preview the changes
npx @master4n/temporal-transformer-codemod --dry ./src

# Apply
npx @master4n/temporal-transformer-codemod ./src

# Multiple paths
npx @master4n/temporal-transformer-codemod ./src ./test ./scripts
```

## What it does

For every `.ts`, `.tsx`, `.js`, `.jsx` file under the target path, the codemod finds calls to:

- `convertEpoch(epoch, format)`
- `convertEpochToTimezone(epoch, tz, format)`
- `parseToEpoch(input, format, tz)`
- `safeConvertEpoch`, `safeConvertEpochToTimezone`, `safeParseToEpoch`

…and rewrites the format-string argument from moment-style to Luxon-style:

| Before (v1.x) | After (v2.0) |
|---|---|
| `'YYYY-MM-DD'` | `'yyyy-MM-dd'` |
| `'YYYY-MM-DD HH:mm:ss.SSSSSS'` | `'yyyy-MM-dd HH:mm:ss.SSS'` |
| `'dddd, MMMM D YYYY'` | `'cccc, LLLL d yyyy'` |
| `'DD/MM/YYYY'` | `'dd/MM/yyyy'` |
| `'[Date:] YYYY-MM-DD'` | `"'Date:' yyyy-MM-dd"` |
| `"YYYY-[don't] DD"` | `"yyyy-'don''t' dd"` |

It correctly handles:

- Greedy token matching (matches `YYYY` not `YY+YY`).
- The 6-digit fractional cap (B1): `SSSSSS` → `SSS`.
- Moment's `[literal]` escape → Luxon's `'literal'`, with proper `''`-escaping of embedded apostrophes.
- Pre-existing Luxon-style `'literal'` blocks (leaves them alone).

It does **not** translate:

- Dynamic format strings (template literals, identifier references). These are left as-is — you need to update them manually.
- Untranslatable moment-only tokens (`X`, `x`, `Q`, `GGGG`, `gggg`, `W`, `WW`). These remain in the output and the CLI prints a stderr warning. The runtime allowlist in v2.0 will throw `FormatInvalid` on those, so you cannot ship the wrong code by accident.

## Programmatic API

If you need to integrate the translator into a custom build step:

```typescript
import { translateMomentFormat } from '@master4n/temporal-transformer-codemod';

const { output, warnings } = translateMomentFormat('YYYY-MM-DD HH:mm:ss');
console.log(output);    // 'yyyy-MM-dd HH:mm:ss'
console.log(warnings);  // []
```

The translator is a hand-written state machine, not a regex — `[literal]` blocks containing tokens or punctuation are handled correctly.

## Companion library

This codemod is the migration tool for [`@master4n/temporal-transformer`](https://github.com/Master4Novice/temporal-transformer), a TypeScript library that auto-detects whether epoch timestamps are in seconds, milliseconds, microseconds, or nanoseconds. Install:

```bash
npm install @master4n/temporal-transformer
```

## Changelog

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

## License

MIT © [Master4Novice](https://github.com/Master4Novice)
