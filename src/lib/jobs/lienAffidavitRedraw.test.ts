import { describe, expect, it } from 'vitest'
import { lienAffidavitRedrawOutcome, lienAffidavitRedrawPlan, lienAffidavitRedrawWords, type LienAffidavitRedrawEntry } from './lienAffidavitRedraw'

const entry = (jobId: string, pile: LienAffidavitRedrawEntry['pile'], item: Record<string, unknown> | null): LienAffidavitRedrawEntry =>
  ({ jobId, pile, item: item ? { id: `it-${jobId}`, kind: 'affidavit', voided_at: null, ...item } : null }) as unknown as LienAffidavitRedrawEntry
const earlier = (status: string) => ({ status, fields: { notice: {} } })
const short = (status: string) => ({ status, fields: { notice: {}, affidavitForm: 'short' } })

describe('lienAffidavitRedrawPlan · which papers the one press moves (punch list #305)', () => {
  it('takes every affidavit in Ready to file that is on the earlier form, and nothing else', () => {
    const plan = lienAffidavitRedrawPlan([
      entry('a', 'ready', earlier('approved')),
      entry('b', 'ready', earlier('approved')),
      entry('c', 'ready', short('approved')), // already on the short form
      entry('d', 'to_draft', null), // no draft yet: drawn on the short form already
      entry('e', 'filed', earlier('sent')), // filed on the earlier form: a recorded paper is never redrawn
    ])
    expect(plan.ready.map((e) => e.jobId)).toEqual(['a', 'b'])
    expect(plan.held).toEqual([])
  })

  it('leaves an earlier-form paper in another pile where it is: the leader’s queue, his hold, a draft', () => {
    const plan = lienAffidavitRedrawPlan([entry('a', 'ready', earlier('approved')), entry('w', 'awaiting', earlier('awaiting_approval')), entry('h', 'held', earlier('held')), entry('d', 'to_draft', earlier('drafted')), entry('m', 'missed', earlier('missed'))])
    expect(plan.ready.map((e) => e.jobId)).toEqual(['a'])
    expect(plan.held.map((e) => e.jobId)).toEqual(['w', 'h', 'd'])
  })

  it('nothing on the earlier form: nothing ready, nothing held', () => {
    expect(lienAffidavitRedrawPlan([entry('c', 'ready', short('approved')), entry('d', 'to_draft', null)])).toEqual({ ready: [], held: [] })
    expect(lienAffidavitRedrawPlan([])).toEqual({ ready: [], held: [] })
  })
})

describe('lienAffidavitRedrawWords · the button says exactly what it will do', () => {
  const plan = (ready: number, held = 0) => ({ ready: Array.from({ length: ready }, (_, i) => entry(`r${i}`, 'ready', earlier('approved'))), held: Array.from({ length: held }, (_, i) => entry(`h${i}`, 'held', earlier('held'))) })

  it('names the count on the button, in the confirm window and on its own button', () => {
    const w = lienAffidavitRedrawWords(plan(12))
    expect(w).toMatchObject({ button: 'Redraw 12 on the short form…', title: 'Redraw 12 affidavits on the short form?', confirmLabel: 'Redraw 12 on the short form', foot: null, dead: false })
    expect(w.message).toBe('Each affidavit goes back to To draft on the short form. Each needs approval again before it is filed.')
    expect(lienAffidavitRedrawWords(plan(1))).toMatchObject({ button: 'Redraw 1 on the short form…', title: 'Redraw 1 affidavit on the short form?', message: 'The affidavit goes back to To draft on the short form. It needs approval again before it is filed.' })
  })

  it('says what it leaves, and is dead when nothing is ready', () => {
    expect(lienAffidavitRedrawWords(plan(3, 2)).foot).toBe('2 on the earlier form are not in Ready to file. Redraw each from its own paper.')
    expect(lienAffidavitRedrawWords(plan(3, 1)).foot).toBe('1 on the earlier form is not in Ready to file. Redraw it from its own paper.')
    expect(lienAffidavitRedrawWords(plan(0, 1)).dead).toBe(true)
    expect(lienAffidavitRedrawWords(plan(0)).dead).toBe(true)
  })
})

describe('lienAffidavitRedrawOutcome · what took and what did not', () => {
  it('every paper took, some did, none did', () => {
    expect(lienAffidavitRedrawOutcome(12, 0)).toEqual({ line: 'Redrew 12 affidavits.', head: null, tone: 'success' })
    expect(lienAffidavitRedrawOutcome(11, 1)).toEqual({ line: 'Redrew 11 affidavits. 1 did not redraw.', head: '1 affidavit did not redraw. It stays here with the reason.', tone: 'warning' })
    expect(lienAffidavitRedrawOutcome(0, 2)).toMatchObject({ line: 'Nothing redrew. 2 did not redraw.', tone: 'error' })
  })
})
