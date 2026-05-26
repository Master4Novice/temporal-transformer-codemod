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

      // Only translate untemplated string literals — leave dynamic format
      // strings (template literals, identifier references) to manual review.
      if (arg.type === 'Literal' && typeof (arg as { value: unknown }).value === 'string') {
        const original = (arg as { value: string }).value;
        const { output, warnings } = translateMomentFormat(original);
        if (warnings.length > 0) {
          fileWarnings.push(
            `${file.path}: ${calleeName}() format "${original}":\n  ${warnings.join('\n  ')}`,
          );
        }
        if (output !== original) {
          (arg as { value: string }).value = output;
          (arg as { raw?: string }).raw = JSON.stringify(output);
          modified = true;
        }
      } else if (arg.type === 'StringLiteral' && typeof (arg as { value: unknown }).value === 'string') {
        // Some parsers emit StringLiteral instead of Literal.
        const original = (arg as { value: string }).value;
        const { output, warnings } = translateMomentFormat(original);
        if (warnings.length > 0) {
          fileWarnings.push(
            `${file.path}: ${calleeName}() format "${original}":\n  ${warnings.join('\n  ')}`,
          );
        }
        if (output !== original) {
          (arg as { value: string }).value = output;
          modified = true;
        }
      }
    });
  }

  if (fileWarnings.length > 0) {
    // jscodeshift captures stderr per file; tee warnings so the user sees them.
    process.stderr.write(fileWarnings.join('\n') + '\n');
  }
  return modified ? root.toSource({ quote: 'single' }) : undefined;
}
