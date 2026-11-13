import { describe, expect, it } from 'vitest'
import type { SentCopy, SentCopyLine } from './sentCopies'
import { sentCopyDayGroups, sentCopyTimeOnly } from './sentCopyDays'

const row = (over: Partial<SentCopy>): SentCopy => ({ id: 's1', kind: 'gc_statement', title: 'Statement', how: 'email', recipientName: 'RLC', recipientEmails: [], subject: '', sourceTable: '', sourceId: null, copyPath: 's1/copy.html', copyType: 'text/html', copyHash: 'h1', attachments: [], sentAt: '2026-11-01T16:30:00Z', sentByName: 'Dana', sourceSnapshot: null, ...over })
const line = (over: Partial<SentCopy>): SentCopyLine => ({ row: row(over), times: [row(over).sentAt] })

describe('sentCopyDayGroups', () => {
  it('puts the lines under Today, Yesterday and the day alone, in the order given', () => {
    const groups = sentCopyDayGroups(
      [line({ id: 'a', sentAt: '2026-11-01T16:30:00Z' }), line({ id: 'b', sentAt: '2026-11-01T14:00:00Z' }), line({ id: 'c', sentAt: '2026-10-31T20:00:00Z' }), line({ id: 'd', sentAt: '2026-10-23T15:00:00Z' })],
      '2026-11-01',
    )
    expect(groups.map((g) => [g.label, g.lines.map((l) => l.row.id)])).toEqual([
      ['Today · Sun, Nov 1', ['a', 'b']],
      ['Yesterday · Sat, Oct 31', ['c']],
      ['Fri, Oct 23', ['d']],
    ])
  })

  it('groups a time that does not parse under No date', () => {
    const groups = sentCopyDayGroups([line({ id: 'x', sentAt: 'never' })], '2026-11-01')
    expect(groups.map((g) => g.label)).toEqual(['No date'])
    expect(sentCopyTimeOnly('never')).toBe('')
  })

  it('gives the time alone for a line under its day', () => {
    expect(sentCopyTimeOnly('2026-11-01T16:30:00Z')).toMatch(/^1[01]:30 AM$/)
  })
})
