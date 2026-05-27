# Contributing to @master4n/temporal-transformer-codemod

Thanks for considering a contribution. This is a small package with a narrow purpose — migration tooling for [`@master4n/temporal-transformer`](https://github.com/Master4Novice/temporal-transformer) v1.x → v2.0 callers — so the scope is intentionally tight.

## Quick start

```bash
git clone https://github.com/Master4Novice/temporal-transformer-codemod.git
cd temporal-transformer-codemod
npm install
npm test          # 27 translator tests
npm run build     # produces dist/ (ESM-only)
```

## What we accept

- **Bug fixes** in the translator (token mapping mistakes, literal-escape edge cases, file corruption)
- **New entries in the moment→Luxon translation table** when a moment token has a clean Luxon equivalent we missed
- **Better warning messages** for untranslatable tokens — anything that helps the user understand what to do next
- **Documentation improvements**

## What we don't accept

- **New runtime features** — this is a one-shot migration tool, not a long-lived utility
- **Direct dependencies beyond jscodeshift** — keep the install footprint minimal
- **AST transformations that aren't moment→Luxon migration related** — out of scope
- **Support for other date libraries** — moment is the only source, Luxon the only target

## Architectural rules

1. **The translator is a state machine, not a regex.** Adding regex passes for "convenience" is rejected — they break edge cases like `[don't]` (apostrophe-in-literal).
2. **Untranslatable tokens stay in the output unchanged.** The runtime library's `FormatInvalid` allowlist catches them, giving the user a clear error site. Do not delete unknown tokens "to be helpful."
3. **AST callsite matching is opt-in.** Only the function names listed in `FORMAT_ARG_INDEX` (in `src/codemod.ts`) are rewritten. Don't add wildcards.
4. **Tests pin every translation pair.** Every entry in `MOMENT_TO_LUXON` has at least one test case.

## PR checklist

- [ ] `npm test` passes
- [ ] `npm run build` is clean
- [ ] If you added a new token mapping: at least one test case in `test/translate.test.ts`
- [ ] If you changed AST matching: tested against a multi-callsite fixture
- [ ] CHANGELOG entry in the README's `## Changelog` section
- [ ] No new runtime dependencies

## Security issues

See [SECURITY.md](./SECURITY.md). Do not open public issues for vulnerabilities.

## Versioning

Semver. Since this is a one-shot migration tool, breaking changes should be exceedingly rare and well-justified.
