import { describe, expect, it } from 'vitest'
import type { LienNextUpRow } from './lienNextUp'
import { countLienSteps, lienLaddersShown, lienStepCard, lienStepOfRow } from './lienNextUpSteps'

const row = (over: Partial<LienNextUpRow>): LienNextUpRow => ({
  key: 'notice:j1', kind: 'notice', jobId: 'j1', gcId: 'gc1', title: '650 · ATI Schertz', sub: 'Notice to draft', dueOn: '2026-10-15', daysLeft: 10, severity: 'amber', group: 'coming', action: 'draft', button: 'Draft notice', target: { open: 'notices', jobId: 'j1', pile: 'to_draft' },
  ...over,
})

describe('lienStepOfRow (v2.4631)', () => {
  it('puts each act on its rung, and a row beside the ladder on none', () => {
    expect(lienStepOfRow(row({ action: 'find_owner' }))).toEqual({ ladder: 'notice', step: 1 })
    expect(lienStepOfRow(row({ action: 'draft' }))).toEqual({ ladder: 'notice', step: 2 })
    expect(lienStepOfRow(row({ action: 'approve' }))).toEqual({ ladder: 'notice', step: 3 })
    expect(lienStepOfRow(row({ action: 'send' }))).toEqual({ ladder: 'notice', step: 4 })
    expect(lienStepOfRow(row({ action: 'send_run', jobId: null }))).toEqual({ ladder: 'notice', step: 4 })
    expect(lienStepOfRow(row({ kind: 'affidavit', action: 'fix_property' }))).toEqual({ ladder: 'affidavit', step: 1 })
    expect(lienStepOfRow(row({ kind: 'affidavit', action: 'file_affidavit' }))).toEqual({ ladder: 'affidavit', step: 4 })
    for (const action of ['note_missed', 'add_tracking', 'letter_two', 'review_hold', 'record_service'] as const) expect(lienStepOfRow(row({ action }))).toBeNull()
  })
})

describe('countLienSteps + lienLaddersShown', () => {
  it('adds the rows up per rung, takes the run count the desk hands over as the fourth rung, and shows a ladder only when something stands on it', () => {
    const rows = [
      row({ action: 'find_owner' }),
      row({ key: 'n2', action: 'draft' }),
      row({ key: 'n3', action: 'draft' }),
      row({ key: 'n4', action: 'approve' }),
      row({ key: 'run', jobId: null, action: 'send_run' }),
      row({ key: 'a1', kind: 'affidavit', action: 'fix_property' }),
      row({ key: 'm', action: 'note_missed' }),
    ]
    const counts = countLienSteps(rows, { notice: 11 })
    expect(counts.notice).toEqual([1, 2, 1, 11])
    expect(counts.affidavit).toEqual([1, 0, 0, 0])
    expect(counts.retainage).toEqual([0, 0, 0, 0])
    expect(lienLaddersShown(counts)).toEqual(['notice', 'affidavit'])
    // Without a handed-over count the run rows are the fourth rung; notices always show.
    expect(countLienSteps(rows).notice[3]).toBe(1)
    expect(lienLaddersShown(countLienSteps([]))).toEqual(['notice'])
  })
})

describe('lienStepCard', () => {
  it('an approved notice with a pay offer (v2.4713) says so on the Approve rung', () => {
    const c = lienStepCard(row({ action: 'send', sub: 'Approved · ready to send', button: 'Send' }), { approvedOn: '2026-10-30T14:00:00Z', offer: { pct: 10, by: '2026-11-15' } })
    expect(c.items[2]!.detail).toBe('Approved Oct 30 with a 10% offer, by Nov 15.')
  })
  it("writes a notice's ladder out: done rungs carry the facts, the current rung says who is waiting, the foot counts", () => {
    const c = lienStepCard(row({ action: 'approve', sub: 'Waiting on your approval', button: 'Approve' }), { ownerName: 'Take 5 Properties LLC', draftedOn: '2026-10-03T14:00:00Z', coverNote: true, readyToSend: 11, viewerIsLeader: true })
    expect(c.kindWords).toBe('Notice')
    expect(c.deadline).toBe('In the mail by Oct 15 · 10 days left')
    expect(c.items.map((i) => i.state)).toEqual(['done', 'done', 'now', 'todo'])
    expect(c.items[0]).toEqual({ state: 'done', title: 'Owner found', detail: 'Take 5 Properties LLC, from the property record.' })
    expect(c.items[1]!.detail).toBe('Drafted Oct 3, with a cover note.')
    expect(c.items[2]!.detail).toBe('Waiting on you. One press, or hold it.')
    expect(c.items[3]!.detail).toContain('with the 11 that are ready')
    expect(c.blocked).toBeNull()
    expect(c.foot).toBe('Step 3 of 4 · 2 done · 2 to go')
    expect(c.button).toBe('Approve')
  })
  it('names what blocks the first rung, and the months a draft will name', () => {
    const owner = lienStepCard(row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner' }))
    expect(owner.blocked).toBe('the owner of record')
    expect(owner.items[0]!.state).toBe('now')
    expect(owner.foot).toBe('Step 1 of 4 · 0 done · 4 to go')
    const draft = lienStepCard(row({}), { months: 'June and July 2026', viewerIsLeader: false })
    expect(draft.items[1]!.detail).toBe('The office drafts it. It names June and July 2026.')
    expect(draft.items[2]!.detail).toBe('The leader approves it, once per notice or once per GC.')
  })
  it("an affidavit's ladder names the missing gates and files with the clerk; its deadline says File by", () => {
    const c = lienStepCard(row({ kind: 'affidavit', action: 'fix_property', sub: 'Affidavit · the property record is not complete', button: 'Fix the property' }), { gatesMissing: ['Legal description', 'County'] })
    expect(c.kindWords).toBe('Affidavit')
    expect(c.deadline).toBe('File by Oct 15 · 10 days left')
    expect(c.items[0]!.detail).toBe('Missing: Legal description, County. The affidavit cannot be drafted without them.')
    expect(c.items[3]!.title).toBe('File it')
    expect(c.blocked).toBe('the property record')
  })
  it('a row beside the ladder gets its state as two rungs, a late day reads late and red', () => {
    const c = lienStepCard(row({ action: 'note_missed', sub: 'A window closed with nothing recorded', dueOn: null, daysLeft: null, severity: 'red', button: 'Note it' }))
    expect(c.items.map((i) => i.title)).toEqual(['The window closed', 'Note it'])
    expect(c.foot).toBe('Missed')
    expect(c.deadline).toBe('No day of its own')
    expect(c.tone).toBe('red')
    const late = lienStepCard(row({ dueOn: '2026-10-01', daysLeft: -4 }))
    expect(late.deadline).toBe('In the mail by Oct 1 · 4 days late')
    expect(late.tone).toBe('red')
  })
})
