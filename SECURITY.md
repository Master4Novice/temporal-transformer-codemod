# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 2.x | ✅ Active development — security and bug fixes |
| < 2.0 | ❌ Not released |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.** Use a private channel:

1. **GitHub Security Advisories** (preferred): https://github.com/Master4Novice/temporal-transformer-codemod/security/advisories/new
2. **Email:** a.dwivedispu@gmail.com with subject prefix `[SECURITY temporal-transformer-codemod]`

Include:
- The affected version(s)
- A minimal reproduction (source file before + expected vs actual output after running the codemod)
- The impact (incorrect translation, file corruption, command injection, etc.)
- Suggested fix, if you have one

Acknowledgement within **72 hours**; fix targeted within **14 days** for high/critical severity, **30 days** for medium.

## What we treat as a vulnerability

✅ **In scope:**
- Codemod corrupts source files (truncation, invalid syntax output, encoding mangling)
- Codemod fails to escape literals safely, generating Luxon format strings that throw at runtime
- Codemod processes file paths in a way that allows directory traversal beyond the user-specified targets
- jscodeshift transformer chain triggers infinite loops or memory exhaustion on malformed input
- Translator produces output that, when executed by the runtime library, leaks data or crashes

❌ **Out of scope:**
- Vulnerabilities in transitive dependencies (`jscodeshift`) — report those upstream
- Codemod refusing to translate an unsupported moment token (this is by design — see [`UNTRANSLATABLE_TOKENS`](./src/translate.ts))
- Output that differs from moment.js semantics in cases documented in the runtime library's MIGRATION.md
- Manual code that calls the codemod programmatically and misuses the API

## Defenses already in place

- Translator is a hand-written state machine, not a regex chain — eliminates entire classes of escape-handling bugs
- `[literal]` → `'literal'` conversion correctly doubles embedded `'` per Luxon escape rules
- Untranslatable tokens (`X`, `x`, `Q`, etc.) are left as-is and emit warnings to stderr rather than being silently dropped
- AST-level rewriting via jscodeshift — only string-literal arguments are touched; dynamic format strings (template literals, identifier refs) are left alone
- Only specific known function callees are matched (`convertEpoch`, `convertEpochToTimezone`, `parseToEpoch`, and their `safeXxx` variants)
- 27 unit tests cover token translation, literal escaping, greedy matching, untranslatable tokens, and punctuation passthrough
