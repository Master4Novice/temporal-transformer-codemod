// Translates a moment.js format string into the equivalent Luxon format string.
//
// The translator is a character-by-character parser, not a regex sub. moment
// uses [literal] to escape literal text; Luxon uses 'literal'. A regex-only
// translator would mangle inputs like "YYYY-[don't]" because of the embedded
// apostrophe. We walk the string state-machine style.
//
// Tokens not present in MOMENT_TO_LUXON are emitted unchanged. Callers that
// pipe the output to convertEpoch / convertEpochToTimezone / parseToEpoch will
// see EpochError.FormatInvalid if any unmapped token is rejected by the
// v2.0 allowlist — that is the intended signal to manually review the call.

// Order matters: longer tokens come first so the matcher consumes greedily.
const MOMENT_TO_LUXON: ReadonlyArray<[string, string]> = [
  // Year
  ['YYYY', 'yyyy'],
  ['YY', 'yy'],
  // Month — moment 'MMMM' is the long month name, same in Luxon as 'LLLL' (standalone)
  ['MMMM', 'LLLL'],
  ['MMM', 'LLL'],
  ['MM', 'MM'],
  ['M', 'M'],
  // Day of week — moment 'dddd'/'ddd' → Luxon 'cccc'/'ccc'
  ['dddd', 'cccc'],
  ['ddd', 'ccc'],
  // Day of month — moment 'DD'/'D' → Luxon 'dd'/'d'
  ['DD', 'dd'],
  ['D', 'd'],
  // Hour, minute, second — same tokens in both libs
  ['HH', 'HH'], ['H', 'H'],
  ['hh', 'hh'], ['h', 'h'],
  ['mm', 'mm'], ['m', 'm'],
  ['ss', 'ss'], ['s', 's'],
  // Fractional seconds — moment supports SSSSSS (6 digits); Luxon caps at SSS (3).
  // Mapping all wider variants to SSS is the documented v2.0 break (B1).
  ['SSSSSS', 'SSS'],
  ['SSSSS', 'SSS'],
  ['SSSS', 'SSS'],
  ['SSS', 'SSS'],
  ['SS', 'SSS'],
  ['S', 'S'],
  // AM/PM — moment 'A' (uppercase) → Luxon 'a' (Luxon is case-insensitive but lowercase is canonical)
  ['A', 'a'],
  ['a', 'a'],
  // Offset — moment 'Z' (+05:30) is what Luxon calls 'ZZ'
  ['ZZ', 'ZZ'],
  ['Z', 'ZZ'],
];

/**
 * Tokens that have no clean Luxon equivalent. The translator emits them
 * unchanged so the runtime allowlist rejects them with FormatInvalid and
 * the developer manually decides what to do.
 */
const UNTRANSLATABLE_TOKENS: ReadonlySet<string> = new Set([
  'X',  // unix seconds → use the function return value (epochInSeconds) instead
  'x',  // unix milliseconds → use epochInMilliseconds
  'Q',  // quarter
  'DDD', 'DDDo', 'DDDD', // day of year (Luxon's 'o' is similar but not 1:1)
  'GGGG', 'gggg', // ISO week year
  'W', 'WW', 'Wo', // moment-style week tokens
]);

interface TranslateResult {
  output: string;
  warnings: string[]; // unmapped tokens we left as-is
}

export function translateMomentFormat(input: string): TranslateResult {
  let i = 0;
  let out = '';
  const warnings: string[] = [];

  while (i < input.length) {
    const ch = input[i];

    // Moment literal escape: [literal text] → Luxon 'literal text'
    if (ch === '[') {
      const end = input.indexOf(']', i + 1);
      if (end === -1) {
        // Unterminated — preserve original char and move on
        out += ch;
        i++;
        continue;
      }
      const literal = input.slice(i + 1, end);
      // Luxon's literal escape character is a single quote. Embedded single
      // quotes must be doubled per Luxon's escape rules.
      const luxonLiteral = literal.replace(/'/g, "''");
      out += `'${luxonLiteral}'`;
      i = end + 1;
      continue;
    }

    // Luxon-style literal already (e.g. someone partially migrated). Preserve.
    if (ch === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) {
        out += ch;
        i++;
        continue;
      }
      out += input.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // Greedy match of moment tokens (longer first)
    let matched = false;
    for (const [moment, luxon] of MOMENT_TO_LUXON) {
      if (input.startsWith(moment, i)) {
        out += luxon;
        i += moment.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Untranslatable run of alphabetic chars — warn and emit as-is
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < input.length && input[j] === ch) j++;
      const token = input.slice(i, j);
      if (UNTRANSLATABLE_TOKENS.has(token)) {
        warnings.push(
          `Untranslatable moment token "${token}" left as-is. ` +
          `Use the dedicated API (epochInSeconds / epochInMilliseconds) instead.`,
        );
      } else {
        // Unknown alphabetic token — let the runtime allowlist surface it.
        warnings.push(
          `Unknown moment token "${token}" emitted unchanged. ` +
          `Library will throw FormatInvalid at runtime.`,
        );
      }
      out += token;
      i = j;
      continue;
    }

    // Non-alphabetic punctuation/digits/whitespace — pass through
    out += ch;
    i++;
  }

  return { output: out, warnings };
}
