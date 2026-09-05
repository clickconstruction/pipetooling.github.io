import { describe, expect, it } from 'vitest'
import { buildSheetRail, daysBetweenYmd, sheetMoneyStep, sheetNextAction, type SheetRailInput } from './sheetRail'
import type { JobWorkOrderCoverage } from './workOrderCoverage'

const TODAY = '2026-09-05'
const none: JobWorkOrderCoverage = { kind: 'none' }
const draft = (unpriced = true): JobWorkOrderCoverage => ({ kind: 'draft', id: 'o', subName: 'Behar Kraja', unpriced })
const sent = (over: Partial<Extract<JobWorkOrderCoverage, { kind: 'sent' }>> = {}): JobWorkOrderCoverage => ({ kind: 'sent', id: 'o', subName: 'Cale Yarbrough', amount: 1208.97, sentAt: '2026-09-02', expiresOn: '2026-09-09', expired: false, ...over })
const signed: JobWorkOrderCoverage = { kind: 'signed', id: 'o', subName: 'Miguel Rodriguez', amount: 1750, signedOn: '2026-09-05', laborJobId: 's', recordId: 'WO-892-01' }
const declined: JobWorkOrderCoverage = { kind: 'declined', id: 'o', subName: 'Jonathan Bartlett', reason: 'price is low' }
const rail = (over: Partial<SheetRailInput> = {}) => buildSheetRail({ coverage: none, sheetStage: 'working', agreed: 40000, open: 40000, unpriced: false, ...over })
const states = (r: ReturnType<typeof buildSheetRail>) => r.steps.map((s) => s.state).join(' ')

describe('buildSheetRail — the gap', () => {
  it('work under way with nothing signed: three dashed office dots, Work is the current dot', () => {
    const r = rail()
    expect(states(r)).toBe('gap gap gap now todo todo todo')
    expect(r).toMatchObject({ current: 'work', gap: true, group: 'no_agreement', position: 0, label: 'Work · no agreement', tone: 'gap' })
  })
  it('the gap follows the sheet stage — an inspection with no agreement is still a gap', () => {
    const r = rail({ sheetStage: 'walkthrough' })
    expect(states(r)).toBe('gap gap gap done now todo todo')
    expect(r.label).toBe('Walk-through · no agreement')
    expect(r.position).toBe(0)
  })
  it('an unpriced sheet says so under the label', () => {
    expect(rail({ agreed: 0, open: 0, unpriced: true }).sublabel).toBe('sheet never priced')
  })
  it('declined: drafted done, the rest of the office run dashed, sheet still working', () => {
    const r = rail({ coverage: declined })
    expect(states(r)).toBe('done gap gap now todo todo todo')
    expect(r).toMatchObject({ gap: true, group: 'no_agreement', label: 'Declined · still working', sublabel: '“price is low”' })
  })
  it('an expired offer is a gap in the no-agreement group', () => {
    const r = rail({ coverage: sent({ expired: true, expiresOn: '2026-09-01' }) })
    expect(r).toMatchObject({ gap: true, group: 'no_agreement', label: 'Offer expired · still working', sublabel: 'sent 2026-09-02' })
  })
  it('a job-anchored decline with no sheet yet has no sub dots lit', () => {
    const r = rail({ coverage: declined, sheetStage: null, agreed: 0, open: 0, unpriced: true })
    expect(states(r)).toBe('done now gap todo todo todo todo')
    expect(r.label).toBe('Declined')
  })
})

describe('buildSheetRail — the office steps', () => {
  it('drafted: first small dot is current, sub dots wait', () => {
    const r = rail({ coverage: draft(true), agreed: 0, open: 0, unpriced: true })
    expect(states(r)).toBe('now todo todo todo todo todo todo')
    expect(r).toMatchObject({ group: 'drafted', position: 1, label: 'Drafted', sublabel: 'no price yet', gap: false, tone: 'now' })
  })
  it('sent: drafted done, sent current, with the send date and the good-through date', () => {
    const r = rail({ coverage: sent(), agreed: 1208.97, open: 1208.97 })
    expect(states(r)).toBe('done now todo todo todo todo todo')
    expect(r).toMatchObject({ group: 'sent', position: 2, label: 'Sent', sublabel: '2026-09-02 · good through 2026-09-09' })
  })
})

describe('buildSheetRail — signed, the sub’s four', () => {
  it('signed + working: office done, Work current', () => {
    const r = rail({ coverage: signed, agreed: 1750, open: 1750 })
    expect(states(r)).toBe('done done done now todo todo todo')
    expect(r).toMatchObject({ group: 'signed', position: 3, label: 'Work', sublabel: 'signed 2026-09-05', current: 'work' })
  })
  it('walk-through reads Walk-through (the portal word); customer_pay reads Customer pays', () => {
    expect(rail({ coverage: signed, sheetStage: 'walkthrough', agreed: 1750, open: 1750 })).toMatchObject({ current: 'inspection', position: 4, label: 'Walk-through' })
    expect(rail({ coverage: signed, sheetStage: 'customer_pay', agreed: 1750, open: 1750 })).toMatchObject({ current: 'customer_pays', position: 5, label: 'Customer pays' })
  })
  it('paid: every dot done, the last one current, green tone', () => {
    const r = rail({ coverage: signed, sheetStage: 'customer_pay', agreed: 1750, open: 0 })
    expect(states(r)).toBe('done done done done done done done')
    expect(r).toMatchObject({ current: 'paid', position: 6, label: 'Paid', tone: 'paid' })
  })
  it('queued for the pay run lights Paid before the money moves (portal parity)', () => {
    const r = rail({ coverage: signed, sheetStage: 'customer_pay', payableAfter: '2026-09-11', agreed: 1750, open: 1750 })
    expect(r).toMatchObject({ current: 'paid', sublabel: 'queued for the pay run' })
    expect(sheetMoneyStep({ sheetStage: 'customer_pay', payableAfter: '2026-09-11', agreed: 1, open: 1, unpriced: false })).toBe('paid')
  })
  it('signed with no sheet yet still points at Work', () => {
    expect(rail({ coverage: signed, sheetStage: null, agreed: 0, open: 0, unpriced: true })).toMatchObject({ current: 'work', label: 'Signed' })
  })
  it('exactly one current dot on every rail', () => {
    const inputs: Array<Partial<SheetRailInput>> = [{}, { coverage: draft() }, { coverage: sent() }, { coverage: signed }, { coverage: declined }, { coverage: signed, sheetStage: 'customer_pay', open: 0 }]
    for (const i of inputs) expect(rail(i).steps.filter((s) => s.state === 'now').length).toBeLessThanOrEqual(1)
  })
})

describe('sheetNextAction', () => {
  const ctx = { subName: 'Texas R & A Electrical LLC', agreed: 40000, open: 40000, unpriced: false, todayYmd: TODAY }
  it('no agreement → Get it in writing, draft button first', () => {
    expect(sheetNextAction(rail(), none, ctx)).toEqual({ label: 'Get it in writing', hint: '$40,000 of work on a handshake', button: 'draft', buttonLabel: 'Draft a work order…' })
    expect(sheetNextAction(rail({ unpriced: true, agreed: 0, open: 0 }), none, { ...ctx, unpriced: true }).hint).toBe('price the sheet, then send the order')
  })
  it('draft → price or send', () => {
    expect(sheetNextAction(rail({ coverage: draft(true) }), draft(true), ctx)).toMatchObject({ label: 'Price it and send', button: 'price' })
    expect(sheetNextAction(rail({ coverage: draft(false) }), draft(false), ctx)).toMatchObject({ label: 'Send it', button: 'send' })
  })
  it('sent → waiting on the sub; a nudge is due after three days', () => {
    const fresh = sent({ sentAt: '2026-09-04' })
    expect(sheetNextAction(rail({ coverage: fresh }), fresh, { ...ctx, subName: 'Cale Yarbrough' })).toEqual({ label: 'Waiting on Cale Yarbrough · 1 day', hint: 'good through 2026-09-09', button: null, buttonLabel: null })
    const stale = sent({ sentAt: '2026-09-02' })
    expect(sheetNextAction(rail({ coverage: stale }), stale, { ...ctx, subName: 'Cale Yarbrough' })).toEqual({ label: 'Waiting on Cale Yarbrough · 3 days', hint: 'a nudge is due', button: 'nudge', buttonLabel: 'Nudge' })
  })
  it('declined / expired → re-offer', () => {
    expect(sheetNextAction(rail({ coverage: declined }), declined, ctx)).toMatchObject({ label: 'Re-offer or re-price', button: 'reoffer', buttonLabel: 'Re-offer…' })
    const exp = sent({ expired: true })
    expect(sheetNextAction(rail({ coverage: exp }), exp, ctx)).toMatchObject({ label: 'Offer expired — send it again', button: 'reoffer', buttonLabel: 'Re-send…' })
  })
  it('signed → the sub’s steps, no button', () => {
    const c = { ...ctx, subName: 'Miguel Rodriguez', agreed: 1750, open: 1750 }
    expect(sheetNextAction(rail({ coverage: signed, agreed: 1750, open: 1750 }), signed, c).label).toBe('Wait for “done”')
    expect(sheetNextAction(rail({ coverage: signed, sheetStage: 'walkthrough', agreed: 1750, open: 1750 }), signed, c).label).toBe('Schedule the walk-through')
    expect(sheetNextAction(rail({ coverage: signed, sheetStage: 'customer_pay', agreed: 1750, open: 1750 }), signed, c)).toMatchObject({ label: 'Bill and collect', hint: 'Miguel Rodriguez is owed $1,750' })
    expect(sheetNextAction(rail({ coverage: signed, sheetStage: 'customer_pay', payableAfter: '2026-09-11', agreed: 1750, open: 1750 }), signed, c).label).toBe('Pay Miguel Rodriguez')
    expect(sheetNextAction(rail({ coverage: signed, sheetStage: 'customer_pay', agreed: 1750, open: 0 }), signed, { ...c, open: 0 }).label).toBe('Nothing — done')
  })
})

describe('daysBetweenYmd', () => {
  it('counts calendar days and tolerates timestamps and blanks', () => {
    expect(daysBetweenYmd('2026-09-02', '2026-09-05')).toBe(3)
    expect(daysBetweenYmd('2026-09-02T10:00:00Z', '2026-09-05')).toBe(3)
    expect(daysBetweenYmd(null, '2026-09-05')).toBe(0)
    expect(daysBetweenYmd('2026-09-05', '2026-09-02')).toBe(-3)
  })
})

describe('buildSheetRail — crew pay', () => {
  it('draws only the sub’s four dots, never a gap, and Next skips the agreement', () => {
    const r = rail({ coverage: none, sheetStage: 'walkthrough', crewPay: true, agreed: 1000, open: 1000 })
    expect(r.steps.map((s) => s.key)).toEqual(['work', 'inspection', 'customer_pays', 'paid'])
    expect(states(r)).toBe('done now todo todo')
    expect(r).toMatchObject({ crewPay: true, gap: false, current: 'inspection', label: 'Walk-through', position: 4 })
    expect(sheetNextAction(r, none, { subName: 'Abraham, Misses Taunya TESTING', agreed: 1000, open: 1000, unpriced: false, todayYmd: TODAY }).label).toBe('Schedule the walk-through')
    const paid = rail({ coverage: none, sheetStage: 'customer_pay', crewPay: true, agreed: 1000, open: 0 })
    expect(paid).toMatchObject({ current: 'paid', tone: 'paid', label: 'Paid' })
    expect(sheetNextAction(rail({ coverage: none, crewPay: true, agreed: 1000, open: 1000 }), none, { subName: 'Abraham', agreed: 1000, open: 1000, unpriced: false, todayYmd: TODAY })).toMatchObject({ label: 'Wait for “done”', hint: 'crew pay — no work order needed', button: null })
  })
})
