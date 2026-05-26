# @master4n/temporal-transformer-codemod

[![npm version](https://img.shields.io/npm/v/%40master4n%2Ftemporal-transformer-codemod)](https://www.npmjs.com/package/@master4n/temporal-transformer-codemod)

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

## License

MIT © [Master4Novice](https://github.com/Master4Novice)
