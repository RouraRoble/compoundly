import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from '../../src/lib/csv';

describe('csvCell', () => {
  it('leaves plain values untouched', () => {
    expect(csvCell('Index fund')).toBe('Index fund');
    expect(csvCell(123.45)).toBe('123.45');
  });
  it('quotes a cell containing a comma, so it cannot shift columns', () => {
    expect(csvCell('Fund, low fee')).toBe('"Fund, low fee"');
  });
  it('doubles embedded double quotes and wraps in quotes', () => {
    expect(csvCell('12" pipe')).toBe('"12"" pipe"');
  });
  it('quotes a cell containing a newline', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('neutralises spreadsheet formula injection with a leading apostrophe', () => {
    expect(csvCell('=HYPERLINK("http://evil",1)')).toBe(`"'=HYPERLINK(""http://evil"",1)"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@SUM(1)')).toBe("'@SUM(1)");
  });
  it('does not treat a value that merely contains "=" elsewhere as a formula', () => {
    expect(csvCell('a=b')).toBe('a=b');
  });
  it('does not prefix a plain negative number (audit-3 P3)', () => {
    expect(csvCell('-286.76')).toBe('-286.76');
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(-286.76)).toBe('-286.76');
  });
  it('still neutralises a leading "-" that is not just a number', () => {
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('-cmd|calc')).toBe("'-cmd|calc");
  });
});

describe('csvRow', () => {
  it('joins cells with commas, quoting only the cells that need it', () => {
    expect(csvRow([1, 'Fund, low fee', 'Savings'])).toBe('1,"Fund, low fee",Savings');
  });
  it('produces a header row identical to the pre-fix behaviour when nothing needs escaping', () => {
    expect(csvRow(['Year', 'Index fund balance', 'Savings account balance'])).toBe('Year,Index fund balance,Savings account balance');
  });
});
