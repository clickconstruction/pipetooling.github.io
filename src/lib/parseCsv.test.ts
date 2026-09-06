import { describe, expect, it } from 'vitest'
import { parseCsv } from './parseCsv'

describe('parseCsv', () => {
  it('splits plain rows and cells', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"Smith, John",42\n')).toEqual([['Smith, John', '42']])
  })

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseCsv('"He said ""hi""",x\n')).toEqual([['He said "hi"', 'x']])
  })

  it('keeps newlines inside a quoted field as one cell', () => {
    expect(parseCsv('"line 1\nline 2",x\n')).toEqual([['line 1\nline 2', 'x']])
  })

  it('treats CRLF like LF (no stray \\r in cells)', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿a,b\n')).toEqual([['a', 'b']])
  })

  it('flushes the last row when the file has no trailing newline', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('keeps empty cells, including a trailing empty cell', () => {
    expect(parseCsv('a,,c\nd,e,\n')).toEqual([
      ['a', '', 'c'],
      ['d', 'e', ''],
    ])
  })

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('represents a blank line as a single empty cell (callers skip it)', () => {
    expect(parseCsv('a\n\nb\n')).toEqual([['a'], [''], ['b']])
  })
})
