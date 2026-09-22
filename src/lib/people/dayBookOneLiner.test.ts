import { describe, expect, it } from 'vitest'
import { dayBookLinePhrase, dayBookOneLiner } from './dayBookOneLiner'
import type { DayBookLine } from './dayBook'

const line = (kind: DayBookLine['kind'], count: number, verb = '', qualifier: string | null = null, quiet = false): DayBookLine => ({ kind, count, verb, qualifier, refs: [], amountUsd: null, quiet })

describe('dayBookOneLiner', () => {
  it('reads the office lines as one sentence, in the Day book’s order', () => {
    const s = dayBookOneLiner({
      lines: [line('billed', 3, 'Billed 3'), line('deposit', 4, 'Applied 4 deposits'), line('contract_sent', 2, 'Sent 2 contracts'), line('approval', 12, 'Approved 12 clock sessions', '5 people · 61.5h'), line('status', 2, 'Moved 2 jobs to Paid')],
    })
    expect(s).toBe('billed 3 · 4 deposits · 2 contracts sent · approved 12 sessions · moved 2 jobs to Paid')
  })
  it('caps at five and counts the rest; skips muted lines; null when nothing', () => {
    const many = ['billed', 'deposit', 'payment', 'contract_filed', 'hours_reviewed', 'dispatch_answered'].map((k) => line(k as DayBookLine['kind'], 1, 'X'))
    expect(dayBookOneLiner({ lines: many })).toBe('billed 1 · 1 deposit · 1 payment · 1 signed contract filed · reviewed hours · +1')
    expect(dayBookOneLiner({ lines: [line('deleted', 4, 'Deleted 4 records', 'recoverable', true)] })).toBeNull()
    expect(dayBookOneLiner({ lines: [] })).toBeNull()
  })
  it('a kind it does not know reads as the Day book’s verb, lowercased', () => {
    expect(dayBookLinePhrase({ kind: 'schedule' as DayBookLine['kind'], count: 9, verb: 'Updated the schedule', qualifier: '6 people · 9 blocks', quiet: false })).toBe('updated the schedule')
  })
})
