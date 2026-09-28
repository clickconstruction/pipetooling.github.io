import { describe, expect, it } from 'vitest'
import { parseWorkflowLineItemPaste } from './parseWorkflowLineItemPaste'

describe('parseWorkflowLineItemPaste', () => {
  it('reads date, memo and amount from tab-separated lines', () => {
    expect(parseWorkflowLineItemPaste('3/23/2026\tPipe and fittings\t$1,234.56\n12/01/2026\tPermit\t85')).toEqual({
      ok: true,
      rows: [
        { itemDate: '2026-03-23', memo: 'Pipe and fittings', amount: 1234.56 },
        { itemDate: '2026-12-01', memo: 'Permit', amount: 85 },
      ],
    })
  })

  it('skips blank lines and reads Windows line endings', () => {
    const res = parseWorkflowLineItemPaste('\r\n1/2/2026\tA\t1\r\n\r\n   \r\n1/3/2026\tB\t2\r\n')
    expect(res).toEqual({
      ok: true,
      rows: [
        { itemDate: '2026-01-02', memo: 'A', amount: 1 },
        { itemDate: '2026-01-03', memo: 'B', amount: 2 },
      ],
    })
  })

  it('refuses an empty clipboard', () => {
    expect(parseWorkflowLineItemPaste('')).toEqual({
      ok: false,
      message: 'Clipboard is empty or has no lines to import.',
    })
    expect(parseWorkflowLineItemPaste(' \n\t\n').ok).toBe(false)
  })

  it('reads a negative amount and strips $ , and spaces', () => {
    const res = parseWorkflowLineItemPaste('1/2/2026\tCredit\t-$ 1,000.50')
    expect(res).toEqual({ ok: true, rows: [{ itemDate: '2026-01-02', memo: 'Credit', amount: -1000.5 }] })
  })

  it('keeps tabs inside the memo: the first cell is the date, the last the amount', () => {
    const res = parseWorkflowLineItemPaste('1/2/2026\tPipe\tsecond half\t40')
    expect(res).toEqual({ ok: true, rows: [{ itemDate: '2026-01-02', memo: 'Pipe\tsecond half', amount: 40 }] })
  })

  it('is all or nothing: one bad line refuses the whole paste and names the line', () => {
    expect(parseWorkflowLineItemPaste('1/2/2026\tA\t1\n1/3/2026\tB\tabc')).toEqual({
      ok: false,
      message: 'Line 2: invalid amount "abc".',
    })
  })

  it('counts lines after the blank ones are dropped', () => {
    const res = parseWorkflowLineItemPaste('\n\n1/2/2026\tA\t1\n\nnot a date\tB\t2')
    expect(res).toEqual({
      ok: false,
      message: 'Line 2: invalid date "not a date". Use M/D/YYYY (e.g. 3/23/2026).',
    })
  })

  it('refuses a line with fewer than three cells', () => {
    expect(parseWorkflowLineItemPaste('1/2/2026\tMemo only')).toEqual({
      ok: false,
      message: 'Line 1: expected date, memo, and amount separated by tabs.',
    })
  })

  it('a line whose amount cell is empty loses its trailing tab and reads as two cells', () => {
    expect(parseWorkflowLineItemPaste('1/2/2026\tMemo\t')).toEqual({
      ok: false,
      message: 'Line 1: expected date, memo, and amount separated by tabs.',
    })
  })

  it('refuses a date that is not on the calendar, or not M/D/YYYY', () => {
    for (const bad of ['2/30/2026', '13/1/2026', '0/5/2026', '2026-03-23', '3/23/26']) {
      const res = parseWorkflowLineItemPaste(`${bad}\tMemo\t1`)
      expect(res).toEqual({
        ok: false,
        message: `Line 1: invalid date "${bad}". Use M/D/YYYY (e.g. 3/23/2026).`,
      })
    }
  })

  it('takes a leap day in a leap year only', () => {
    expect(parseWorkflowLineItemPaste('2/29/2028\tMemo\t1').ok).toBe(true)
    expect(parseWorkflowLineItemPaste('2/29/2026\tMemo\t1').ok).toBe(false)
  })

  it('refuses an empty memo', () => {
    expect(parseWorkflowLineItemPaste('1/2/2026\t \t5')).toEqual({
      ok: false,
      message: 'Line 1: memo is required.',
    })
  })

  it('refuses accounting parentheses — a credit is typed with a minus', () => {
    expect(parseWorkflowLineItemPaste('1/2/2026\tCredit\t(100.00)')).toEqual({
      ok: false,
      message: 'Line 1: invalid amount "(100.00)".',
    })
  })

  it('reads the leading number of an amount with text after it', () => {
    // parseFloat stops at the first character it cannot read: "12abc" → 12.
    expect(parseWorkflowLineItemPaste('1/2/2026\tMemo\t12abc')).toEqual({
      ok: true,
      rows: [{ itemDate: '2026-01-02', memo: 'Memo', amount: 12 }],
    })
  })
})
