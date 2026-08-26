import { describe, expect, it } from 'vitest'
import { dueChangeEntryText, originallyDueLine, pushedChipLabel, pushedEscalationSuffix, summarizeDuePushes } from './checklistDuePushes'

const row = (from: string | null, to: string | null, at = '2026-08-26T10:00:00Z') => ({ changed_at: at, changed_by: null, from_due: from, to_due: to })

describe('summarizeDuePushes', () => {
  it('original = first from_due (pre-ledger commitment), pushes counted, slip = current − original', () => {
    const rows = [row('2026-08-29', '2026-09-01'), row('2026-09-01', '2026-09-03')]
    const s = summarizeDuePushes(rows, '2026-09-03')
    expect(s).toEqual({ originalDue: '2026-08-29', pushCount: 2, netSlipDays: 5, pushedBack: true })
  })
  it('original = first non-null to_due when the date was first set through the ledger', () => {
    const rows = [row(null, '2026-08-29'), row('2026-08-29', '2026-09-01')]
    const s = summarizeDuePushes(rows, '2026-09-01')
    expect(s.originalDue).toBe('2026-08-29')
    expect(s.pushCount).toBe(1)
    expect(s.netSlipDays).toBe(3)
  })
  it('no ledger rows: the current due IS the original — never pushed', () => {
    const s = summarizeDuePushes([], '2026-08-29')
    expect(s).toEqual({ originalDue: '2026-08-29', pushCount: 0, netSlipDays: 0, pushedBack: false })
  })
  it('pull-ins earn no marker; a net return to the original clears it', () => {
    const rows = [row('2026-08-29', '2026-09-03'), row('2026-09-03', '2026-08-29')]
    const s = summarizeDuePushes(rows, '2026-08-29')
    expect(s.pushedBack).toBe(false)
    expect(s.netSlipDays).toBe(0)
    expect(pushedChipLabel(s)).toBe('')
  })
  it('clearing the due date clears the markers', () => {
    const rows = [row('2026-08-29', '2026-09-03'), row('2026-09-03', null)]
    const s = summarizeDuePushes(rows, null)
    expect(s.pushedBack).toBe(false)
  })
})

describe('labels', () => {
  const pushed = summarizeDuePushes([row('2026-08-29', '2026-09-01'), row('2026-09-01', '2026-09-03')], '2026-09-03')
  it('chip / modal line / escalation rider', () => {
    expect(pushedChipLabel(pushed)).toBe('pushed ×2')
    expect(originallyDueLine(pushed)).toBe('Originally due Sat, Aug 29 — pushed ×2, +5 days so far.')
    expect(pushedEscalationSuffix(pushed)).toBe(' (pushed ×2, +5d)')
  })
  it('spine sentences for each row shape', () => {
    expect(dueChangeEntryText(row(null, '2026-08-29'))).toBe('set the due date to Sat, Aug 29')
    expect(dueChangeEntryText(row('2026-08-29', '2026-09-01'))).toBe('pushed the due date Sat, Aug 29 → Tue, Sep 1')
    expect(dueChangeEntryText(row('2026-09-01', '2026-08-29'))).toBe('moved the due date up Tue, Sep 1 → Sat, Aug 29')
    expect(dueChangeEntryText(row('2026-08-29', null))).toBe('removed the due date (was Sat, Aug 29)')
  })
})
