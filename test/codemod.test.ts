// Integration-style tests for the jscodeshift transformer. We invoke it
// programmatically with a minimal API stub to verify the AST-walking and
// argument-extraction logic on real source fragments.

import transformer from '../src/codemod.js';
import jscodeshift from 'jscodeshift';

function runCodemod(source: string): string {
  const fileInfo = { path: '/test/in.ts', source };
  const api = {
    jscodeshift: jscodeshift.withParser('tsx'),
    j: jscodeshift.withParser('tsx'),
    stats: () => {},
    report: () => {},
  } as unknown as Parameters<typeof transformer>[1];
  const result = transformer(fileInfo, api, {});
  return typeof result === 'string' ? result : source;
}

describe('codemod transformer', () => {
  test('rewrites convertEpoch format-string literal (moment → Luxon)', () => {
    const out = runCodemod(`
      import { convertEpoch } from '@master4n/temporal-transformer';
      const r = convertEpoch(1622547800000, 'YYYY-MM-DD HH:mm:ss');
    `);
    expect(out).toContain("'yyyy-MM-dd HH:mm:ss'");
  });

  test('rewrites convertEpochToTimezone format-string at correct arg index (2)', () => {
    const out = runCodemod(`
      import { convertEpochToTimezone } from '@master4n/temporal-transformer';
      const r = convertEpochToTimezone(1622547800000, 'Asia/Kolkata', 'YYYY-MM-DD dddd');
    `);
    expect(out).toContain("'yyyy-MM-dd cccc'");
  });

  test('rewrites parseToEpoch format-string at correct arg index (1)', () => {
    const out = runCodemod(`
      import { parseToEpoch } from '@master4n/temporal-transformer';
      const r = parseToEpoch('25/12/2024', 'DD/MM/YYYY', 'Europe/London');
    `);
    expect(out).toContain("'dd/MM/yyyy'");
  });

  test('rewrites all safe variants', () => {
    const out = runCodemod(`
      import { safeConvertEpoch, safeConvertEpochToTimezone, safeParseToEpoch } from '@master4n/temporal-transformer';
      const a = safeConvertEpoch(0, 'YYYY');
      const b = safeConvertEpochToTimezone(0, 'UTC', 'YYYY');
      const c = safeParseToEpoch('x', 'YYYY');
    `);
    // All three YYYY tokens should be rewritten to yyyy.
    expect((out.match(/'yyyy'/g) || []).length).toBe(3);
    expect(out.includes("'YYYY'")).toBe(false);
  });

  test('rewrites format passed as a no-expression template literal', () => {
    const out = runCodemod(
      'import { convertEpoch } from "@master4n/temporal-transformer";\n' +
      'const r = convertEpoch(1622547800000, `YYYY-MM-DD`);'
    );
    expect(out).toContain('`yyyy-MM-dd`');
  });

  test('leaves template literals WITH expressions alone (dynamic)', () => {
    const inSrc =
      'import { convertEpoch } from "@master4n/temporal-transformer";\n' +
      'const fmt = "Y";\n' +
      'const r = convertEpoch(1622547800000, `${fmt}YYY-MM-DD`);';
    const out = runCodemod(inSrc);
    // The template literal with expression should be unchanged.
    expect(out).toContain('`${fmt}YYY-MM-DD`');
  });

  test('leaves identifier-referenced format strings alone', () => {
    const inSrc =
      'import { convertEpoch } from "@master4n/temporal-transformer";\n' +
      'const fmt = "YYYY-MM-DD";\n' +
      'const r = convertEpoch(1622547800000, fmt);';
    const out = runCodemod(inSrc);
    expect(out).toContain('const fmt = "YYYY-MM-DD"');
    expect(out).toContain('convertEpoch(1622547800000, fmt)');
  });

  test('ignores unrelated function calls of the same name pattern', () => {
    // A user-defined convertEpoch (not from temporal-transformer) is matched
    // by name — by design. The codemod cannot distinguish imports without
    // module resolution. This test documents the behaviour, not asks for it
    // to be different.
    const out = runCodemod(`
      function convertEpoch(_e: number, _fmt: string) { return _fmt; }
      const r = convertEpoch(0, 'YYYY-MM-DD');
    `);
    expect(out).toContain("'yyyy-MM-dd'");
  });

  test('does not change a file that has no matching calls', () => {
    const src = `const x = 1;\nconst y = 'YYYY';\nconsole.log(x, y);`;
    expect(runCodemod(src)).toBe(src);
  });

  test('handles [literal] → \'literal\' conversion with apostrophe escape', () => {
    // Source: convertEpoch(0, '[don\'t panic] YYYY')
    // Translator produces:  'don''t panic' yyyy
    // recast/jscodeshift then wraps the string in single quotes, escaping
    // the inner ones — but the doubled-apostrophe Luxon escape is preserved.
    const out = runCodemod(
      "import { convertEpoch } from '@master4n/temporal-transformer';\n" +
      "const r = convertEpoch(0, '[don\\'t panic] YYYY');"
    );
    // Locate the rewritten format-string literal in the output.
    const m = out.match(/convertEpoch\([^,]+,\s*('[^]+?')\s*\)/);
    expect(m).not.toBeNull();
    // Unescape the source-level quoting (codegen escapes ' inside ' '),
    // leaving us with the true runtime value of the format string.
    const literal = (m as RegExpMatchArray)[1];
    const runtimeValue = literal.slice(1, -1).replace(/\\'/g, "'");
    expect(runtimeValue).toBe("'don''t panic' yyyy");
  });
});
