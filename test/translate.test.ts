import { translateMomentFormat } from '../src/translate.js';

describe('translateMomentFormat — token translation', () => {
  test.each([
    ['YYYY', 'yyyy'],
    ['YY', 'yy'],
    ['YYYY-MM-DD', 'yyyy-MM-dd'],
    ['YYYY-MM-DD HH:mm:ss', 'yyyy-MM-dd HH:mm:ss'],
    ['YYYY-MM-DD HH:mm:ss.SSS', 'yyyy-MM-dd HH:mm:ss.SSS'],
    ['YYYY-MM-DD HH:mm:ss.SSSSSS', 'yyyy-MM-dd HH:mm:ss.SSS'], // B1: caps at 3
    ['dddd', 'cccc'],
    ['ddd', 'ccc'],
    ['DD/MM/YYYY', 'dd/MM/yyyy'],
    ['HH:mm:ss A', 'HH:mm:ss a'],
    ['Z', 'ZZ'],
    ['ZZ', 'ZZ'],
    ['MMMM D, YYYY', 'LLLL d, yyyy'],
  ])('translates "%s" → "%s"', (input, expected) => {
    const { output, warnings } = translateMomentFormat(input);
    expect(output).toBe(expected);
    expect(warnings).toEqual([]);
  });
});

describe('translateMomentFormat — literal escape conversion', () => {
  test('[Date:] YYYY-MM-DD → \'Date:\' yyyy-MM-dd', () => {
    const { output } = translateMomentFormat('[Date:] YYYY-MM-DD');
    expect(output).toBe("'Date:' yyyy-MM-dd");
  });

  test('embedded apostrophe in literal is doubled per Luxon escape rules', () => {
    const { output } = translateMomentFormat("YYYY [don't] DD");
    expect(output).toBe("yyyy 'don''t' dd");
  });

  test('empty literal block', () => {
    const { output } = translateMomentFormat('[] YYYY');
    expect(output).toBe("'' yyyy");
  });

  test('literal with embedded tokens (tokens NOT translated inside literal)', () => {
    const { output } = translateMomentFormat('[YYYY is not a token] YYYY');
    expect(output).toBe("'YYYY is not a token' yyyy");
  });

  test('unterminated [literal — character preserved as-is', () => {
    const { output } = translateMomentFormat('YYYY [unterminated');
    expect(output).toContain('yyyy ');
  });

  test('preserves already-Luxon-style single-quoted literals', () => {
    const { output } = translateMomentFormat("'already luxon' yyyy");
    expect(output).toBe("'already luxon' yyyy");
  });
});

describe('translateMomentFormat — untranslatable tokens', () => {
  test('X token left as-is with warning', () => {
    const { output, warnings } = translateMomentFormat('X');
    expect(output).toBe('X');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('X');
  });

  test('x token left as-is with warning', () => {
    const { output, warnings } = translateMomentFormat('x');
    expect(output).toBe('x');
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('Q (quarter) emitted unchanged with warning', () => {
    const { output, warnings } = translateMomentFormat('Q');
    expect(output).toBe('Q');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('translateMomentFormat — punctuation passthrough', () => {
  test('preserves spaces, dashes, slashes, colons, periods, commas', () => {
    const { output } = translateMomentFormat('YYYY-MM-DD, HH:mm:ss.SSS / dddd');
    expect(output).toBe('yyyy-MM-dd, HH:mm:ss.SSS / cccc');
  });

  test('preserves digits adjacent to tokens', () => {
    const { output } = translateMomentFormat('123 YYYY 456');
    expect(output).toBe('123 yyyy 456');
  });
});

describe('translateMomentFormat — greedy matching', () => {
  test('matches longer tokens first (YYYY not YY+YY)', () => {
    const { output } = translateMomentFormat('YYYY');
    expect(output).toBe('yyyy');
  });

  test('matches SSSSSS not S+S+S+S+S+S', () => {
    const { output } = translateMomentFormat('SSSSSS');
    expect(output).toBe('SSS');
  });

  test('matches dddd not ddd+d', () => {
    const { output } = translateMomentFormat('dddd');
    expect(output).toBe('cccc');
  });
});
