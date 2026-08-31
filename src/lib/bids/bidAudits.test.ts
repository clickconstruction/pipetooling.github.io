import { describe, it, expect } from 'vitest'
import {
  threadAuditNotes,
  openQuestionCount,
  computeAuditDraftTotal,
  sortAuditsForTab,
  canWriteBidAudit,
  formatAuditRequestedStamp,
  type BidAuditNoteRow,
} from './bidAudits'

const note = (over: Partial<BidAuditNoteRow>): BidAuditNoteRow => ({
  id: 'n0',
  bid_id: 'b1',
  audit_id: 'a1',
  section: 'general',
  kind: 'note',
  body: 'body',
  parent_id: null,
  author_id: null,
  created_at: '2026-08-30T10:00:00Z',
  digested_at: null,
  digest_outcome: null,
  ...over,
})

describe('threadAuditNotes', () => {
  it('pairs questions with answers and notes with receipts, by section', () => {
    const notes = [
      note({ id: 'q1', kind: 'question', body: 'Wet tables owner-furnished?', created_at: '2026-08-30T09:00:00Z' }),
      note({ id: 'q2', kind: 'question', body: 'HR-1 spec?', created_at: '2026-08-30T09:01:00Z' }),
      note({ id: 'ans1', kind: 'answer', parent_id: 'q1', body: 'Yes — plumber connects only.', created_at: '2026-08-30T11:00:00Z' }),
      note({ id: 'n1', section: 'footage', body: 'Waste footage way low.', created_at: '2026-08-30T11:05:00Z' }),
      note({ id: 'r1', kind: 'receipt', parent_id: 'n1', body: 'Learned: developed-length multiplier.', created_at: '2026-08-30T12:00:00Z' }),
      note({ id: 'n2', section: 'pricing', body: 'Per-ft rates too high.', created_at: '2026-08-30T11:06:00Z' }),
    ]
    const t = threadAuditNotes(notes)
    expect(t.questions.map((q) => [q.question.id, q.answer?.id ?? null])).toEqual([
      ['q1', 'ans1'],
      ['q2', null],
    ])
    expect(openQuestionCount(t)).toBe(1)
    const bySection = Object.fromEntries(t.sections.map((s) => [s.section, s.items]))
    expect(bySection.footage?.map((i) => [i.note.id, i.receipt?.id ?? null])).toEqual([['n1', 'r1']])
    expect(bySection.pricing?.map((i) => i.note.id)).toEqual(['n2'])
    // Every section renders (composers need them), even when empty.
    expect(t.sections.map((s) => s.section)).toEqual(['counts', 'footage', 'pricing', 'scope', 'general'])
    expect(bySection.counts).toEqual([])
  })

  it('drops orphaned replies and keeps first reply on duplicates', () => {
    const t = threadAuditNotes([
      note({ id: 'n1', body: 'a note' }),
      note({ id: 'r-orphan', kind: 'receipt', parent_id: 'gone', body: 'orphan' }),
      note({ id: 'r1', kind: 'receipt', parent_id: 'n1', body: 'first', created_at: '2026-08-30T12:00:00Z' }),
      note({ id: 'r2', kind: 'receipt', parent_id: 'n1', body: 'second', created_at: '2026-08-30T13:00:00Z' }),
    ])
    const general = t.sections.find((s) => s.section === 'general')!
    expect(general.items).toHaveLength(1)
    expect(general.items[0]?.receipt?.id).toBe('r1')
  })
})

describe('computeAuditDraftTotal', () => {
  const rows = [
    { id: 'r1', count: 3, bid_version_id: 'v1' },
    { id: 'r2', count: 10, bid_version_id: 'v1' },
    { id: 'r3', count: 5, bid_version_id: 'v2' },
    { id: 'r4', count: 2, bid_version_id: null },
  ]
  const assignments = [
    { count_row_id: 'r1', price_book_entry_id: 'e1', unit_price_override: null },
    { count_row_id: 'r2', price_book_entry_id: 'e2', unit_price_override: 4 },
    { count_row_id: 'r3', price_book_entry_id: 'e1', unit_price_override: null },
    { count_row_id: 'r4', price_book_entry_id: 'e1', unit_price_override: null },
  ]
  const prices = { e1: 100, e2: 7 }

  it('scopes to the selected version and lets overrides win', () => {
    const { total, rowCount } = computeAuditDraftTotal(rows, 'v1', assignments, prices)
    expect(rowCount).toBe(2)
    expect(total).toBe(3 * 100 + 10 * 4)
  })

  it('falls back to version-less rows on an unsplit bid; unassigned rows contribute 0', () => {
    const { total, rowCount } = computeAuditDraftTotal(
      [...rows, { id: 'r5', count: 9, bid_version_id: null }],
      null,
      assignments,
      prices,
    )
    expect(rowCount).toBe(2)
    expect(total).toBe(2 * 100)
  })
})

describe('sortAuditsForTab', () => {
  it('pending oldest-first, then done, then digested newest-first', () => {
    const audits = [
      { id: 'dg-new', status: 'digested' as const, requested_at: '2026-08-29' },
      { id: 'p-new', status: 'pending' as const, requested_at: '2026-08-28' },
      { id: 'dn', status: 'done' as const, requested_at: '2026-08-20' },
      { id: 'p-old', status: 'pending' as const, requested_at: '2026-08-21' },
      { id: 'dg-old', status: 'digested' as const, requested_at: '2026-08-22' },
    ]
    expect(sortAuditsForTab(audits).map((a) => a.id)).toEqual(['p-old', 'p-new', 'dn', 'dg-new', 'dg-old'])
  })
})

describe('canWriteBidAudit', () => {
  it('matches the write-RLS role list', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      expect(canWriteBidAudit(role)).toBe(true)
    }
    for (const role of ['primary', 'superintendent', 'subcontractor', 'helpers', null, undefined, '']) {
      expect(canWriteBidAudit(role)).toBe(false)
    }
  })

  it('twin accounts are view-only regardless of role', () => {
    expect(canWriteBidAudit('estimator', true)).toBe(false)
    expect(canWriteBidAudit('dev', true)).toBe(false)
  })
})

describe('formatAuditRequestedStamp', () => {
  const at = new Date('2026-08-30T14:14:00').getTime()
  const iso = new Date(at).toISOString()
  it('rolls minutes → hours → days', () => {
    expect(formatAuditRequestedStamp(iso, at + 12 * 60_000)).toMatch(/· 12m ago$/)
    expect(formatAuditRequestedStamp(iso, at + 19 * 3_600_000)).toMatch(/· 19h ago$/)
    expect(formatAuditRequestedStamp(iso, at + 72 * 3_600_000)).toMatch(/· 3d ago$/)
  })
  it('carries date and time of day', () => {
    const s = formatAuditRequestedStamp(iso, at + 3_600_000)
    expect(s).toMatch(/^requested Aug 30, /)
    expect(s).toMatch(/\d{1,2}:\d{2}/)
  })
  it('falls back to the date slice on a bad timestamp', () => {
    expect(formatAuditRequestedStamp('nonsense-date')).toBe('requested nonsense-d')
  })
})
