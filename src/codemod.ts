import type { API, FileInfo, Options } from 'jscodeshift';
import { translateMomentFormat } from './translate.js';

// Maps callee name → zero-based index of the format-string argument.
const FORMAT_ARG_INDEX: Record<string, number> = {
  convertEpoch: 1,
  convertEpochToTimezone: 2,
  parseToEpoch: 1,
  safeConvertEpoch: 1,
  safeConvertEpochToTimezone: 2,
  safeParseToEpoch: 1,
};

interface StringArgInfo {
  original: string;
  /** Apply the translated string back to the AST node. */
  apply: (translated: string) => void;
}

/**
 * Extract a static string value from a call argument, if possible.
 * Returns null for dynamic arguments (identifiers, expressions, template
 * literals with interpolations) — those need manual review.
 */
function extractStaticString(arg: unknown): StringArgInfo | null {
  if (!arg || typeof arg !== 'object') return null;
  const node = arg as { type: string; value?: unknown; raw?: string; expressions?: unknown[]; quasis?: Array<{ value: { raw: string; cooked: string } }> };

  // Regular string literal: "foo" / 'foo'
  if ((node.type === 'Literal' || node.type === 'StringLiteral') && typeof node.value === 'string') {
    return {
      original: node.value,
      apply: (translated: string) => {
        node.value = translated;
        node.raw = JSON.stringify(translated);
      },
    };
  }

  // Template literal with no expressions: `foo` — treat as a static string.
  // (Template literals WITH expressions are dynamic and skipped.)
  if (
    node.type === 'TemplateLiteral' &&
    Array.isArray(node.expressions) &&
    node.expressions.length === 0 &&
    Array.isArray(node.quasis) &&
    node.quasis.length === 1
  ) {
    const quasi = node.quasis[0];
    return {
      original: quasi.value.cooked,
      apply: (translated: string) => {
        quasi.value.cooked = translated;
        quasi.value.raw = translated.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
      },
    };
  }

  return null;
}

export default function transformer(file: FileInfo, api: API, _options: Options): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let modified = false;
  const fileWarnings: string[] = [];

  for (const [calleeName, argIndex] of Object.entries(FORMAT_ARG_INDEX)) {
    root.find(j.CallExpression).forEach((path) => {
      const callee = path.node.callee;
      const name =
        callee.type === 'Identifier'
          ? callee.name
          : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
            ? callee.property.name
            : null;
      if (name !== calleeName) return;

      const arg = path.node.arguments[argIndex];
      if (!arg) return;

      const info = extractStaticString(arg);
      if (!info) return;

      const { output, warnings } = translateMomentFormat(info.original);
      if (warnings.length > 0) {
        fileWarnings.push(
          `${file.path}: ${calleeName}() format "${info.original}":\n  ${warnings.join('\n  ')}`,
        );
      }
      if (output !== info.original) {
        info.apply(output);
        modified = true;
      }
    });
  }

  if (fileWarnings.length > 0) {
    // jscodeshift captures stderr per file; tee warnings so the user sees them.
    process.stderr.write(fileWarnings.join('\n') + '\n');
  }
  return modified ? root.toSource({ quote: 'single' }) : undefined;
}
