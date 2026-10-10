import { describe, expect, it } from 'vitest'
import {
  customerActivity,
  customerDocuments,
  customerPaper,
  gcReducer,
  initialGcState,
  partnerActivity,
  partnerById,
  partnerDocuments,
  type GcState,
  type Partner,
} from './gcModel'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

describe("a company's window (the owner, 2026-10-04)", () => {

  it('Ask for it writes a promise, and the asked paper stays to get until it comes', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'recordPromise', partnerId: 'pecanvalley', kind: 'insurance', by: '2026-10-09', from: 'office' })
    expect(state.tradePromises?.some((p) => p.partnerId === 'pecanvalley' && p.kind === 'insurance' && !p.keptOn)).toBe(true)
    expect(partnerDocuments(state, partner(state, 'pecanvalley')).toGet).toBe(2)
  })

  it('Activity is one timeline, newest first, from what the model already keeps', () => {
    let state = initialGcState()
    const before = partnerActivity(state, partner(state, 'pecanvalley'))
    expect(before[0]).toMatchObject({ on: '2026-10-01', kind: 'money', text: 'Asked for draw 2, $45,000.' })
    expect(before.map((e) => e.text)).toContain('Draw 1 paid, $80,100. Unconditional waiver owed.')
    expect(before.map((e) => e.text)).toContain('Asked them to quote electrical.')
    expect(before.every((e, i) => i === 0 || (before[i - 1]?.on ?? '') >= e.on)).toBe(true)
    state = gcReducer(state, { type: 'logPartnerContact', partnerId: 'pecanvalley', note: 'Waiver goes out Monday.' })
    expect(partnerActivity(state, partner(state, 'pecanvalley'))[0]).toMatchObject({ on: state.today, kind: 'note', text: 'You: Waiver goes out Monday.' })
    const calls = partnerActivity(state, partner(state, 'bluebonnet')).filter((e) => e.text.startsWith('Robert, on a call'))
    expect(calls.length).toBeGreaterThan(0)
  })

  it("a customer's window: our contract, our pay applications, and the calls and bills in one timeline", () => {
    const state = initialGcState()
    const cibolo = state.customers.find((c) => c.id === 'cibolo')
    if (!cibolo) throw new Error('no cibolo')
    const docs = customerDocuments(state, cibolo)
    // Pay application 3 is past its due day: its own row, with Remind them (Owner Billing's reminder).
    expect(docs.groups.flatMap((g) => g.docs.map((d) => `${d.key} ${d.statusWords}`))).toEqual([
      'contract-fairoaksd signed Jun 2',
      'owner-payapps-fairoaksd 3 sent',
      'payapp-fairoaksd-3 2 days late',
    ])
    expect(docs.toGet).toBe(1)
    expect(customerPaper(state, cibolo, 'owner-payapps-fairoaksd')?.table?.rows.length).toBe(3)
    const events = customerActivity(state, cibolo)
    expect(events[0]).toMatchObject({ on: '2026-10-01', kind: 'money', text: 'Paid pay application 2.' })
    expect(events.map((e) => e.text)).toContain('Our bid went to them.')
  })
})

describe("the office's own asks on Activity", () => {
  it('reads as our ask, then as the paper coming', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'recordPromise', partnerId: 'pecanvalley', kind: 'closeout', projectId: 'fairoaksd', packageId: 'felec', by: '2026-10-09', from: 'office', what: 'the unconditional lien waiver' })
    const asked = partnerActivity(state, partner(state, 'pecanvalley')).find((e) => e.text.startsWith('We asked'))
    expect(asked).toMatchObject({ text: 'We asked for the unconditional lien waiver by Fri Oct 9.', where: 'Fair Oaks Shops, Building D · Electrical' })
  })
})

describe("a customer's interest bills (Owner Billing, 2026-10-04)", () => {
  it('are a paper and two lines of Activity', () => {
    let state = gcReducer(initialGcState(), { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: 1.5 })
    state = gcReducer(state, { type: 'sendOwnerInterestBill', projectId: 'fairoaksd' })
    const cibolo = state.customers.find((c) => c.id === 'cibolo')
    if (!cibolo) throw new Error('no cibolo')
    const doc = customerDocuments(state, cibolo).groups.flatMap((g) => g.docs).find((d) => d.key === 'interest-fairoaksd')
    expect(doc).toMatchObject({ title: 'Interest bills', statusWords: '1 not paid' })
    expect(customerPaper(state, cibolo, 'interest-fairoaksd')?.rows.find((r) => r.label === 'Rate')?.value).toBe('1.5% a month on a late bill')
    state = gcReducer(state, { type: 'ownerPaidInterest', projectId: 'fairoaksd', number: 1 })
    const texts = customerActivity(state, cibolo).map((e) => e.text)
    expect(texts.some((t) => /^Interest bill 1 sent, \$[\d,]+\.$/.test(t))).toBe(true)
    expect(texts).toContain('Paid interest bill 1.')
  })
})

describe("a trade's Activity also carries the award, pay applications sent back, and change orders", () => {
  it('names the award with its day and who, and the price', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'award', projectId: 'boerne', packageId: 'site', inviteId: 'site-lonestar', by: 'Rosa Treviño' })
    const award = partnerActivity(state, partner(state, 'lonestar')).find((e) => e.text.startsWith('Awarded'))
    expect(award).toMatchObject({ on: state.today, kind: 'quote', text: 'Awarded sitework by Rosa Treviño, $184,900.', where: 'Boerne Retail Shell · Sitework' })
  })

  it("a change order on their trade, sent to them and signed", () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add sound batts to the walls of operatory 3', reason: 'owner', schedule: '+1 working day', packageId: 'dry', cost: 4_800, price: 5_280 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: 'co-1' })
    const texts = partnerActivity(state, partner(state, 'hillcountry')).map((e) => e.text)
    expect(texts).toContain('Change order 1 sent to them to sign: Add sound batts to the walls of operatory 3')
    expect(texts).toContain('Signed change order 1.')
  })

  it('a change they asked for in their portal, and our no with its reason (Portal lane)', () => {
    let state = initialGcState()
    const rock = partnerActivity(state, partner(state, 'tricounty')).find((e) => e.text.startsWith('Asked for a change'))
    expect(rock).toMatchObject({
      on: '2026-09-30',
      kind: 'money',
      text: 'Asked for a change in their portal: Rock at the north footings, about 390 cubic yards to break out and haul off, $14,820.',
      where: 'Fair Oaks Shops, Building D · Sitework',
    })
    state = gcReducer(state, { type: 'turnDownChangeRequest', projectId: 'fairoaksd', requestId: 'fairoaksd-cr-1', note: 'It was in your quote.' })
    expect(partnerActivity(state, partner(state, 'tricounty')).map((e) => e.text)).toContain('Their change turned down: It was in your quote.')
  })

  it('a back-charge, their dispute, our answer and the draw it came off (Portal lane)', () => {
    let state = initialGcState()
    const ids = { projectId: 'fairoaksd', packageId: 'fsteel', chargeId: 'fsteel-bc-1' }
    state = gcReducer(state, { type: 'tradeAnswerBackCharge', ...ids, agree: false, note: 'The line was not marked' })
    state = gcReducer(state, { type: 'settleBackCharge', ...ids, keep: true, note: 'It was on the site plan.' })
    state = gcReducer(state, { type: 'approveDraw', projectId: 'fairoaksd', packageId: 'fsteel', drawId: 'fsteel-draw-2' })
    state = gcReducer(state, { type: 'takeBackCharge', ...ids, drawId: 'fsteel-draw-2' })
    const texts = partnerActivity(state, partner(state, 'ironhorse')).map((e) => e.text)
    expect(texts).toContain('Back-charged $1,250: Your crew cut the temporary power line on the north side while setting joists. Our electrician spliced it the same day.')
    expect(texts).toContain('Disputed the $1,250 back-charge: The line was not marked')
    expect(texts).toContain('Kept the $1,250 back-charge: It was on the site plan.')
    expect(texts).toContain('Took the $1,250 back-charge off draw 2.')
  })
})

describe("a trade's Activity carries what it did on the job (Building, 2026-10-04)", () => {

  it('a failed punch check and a passed inspection show too', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-2', fixed: false, note: 'Two joints are still open.' })
    state = gcReducer(state, { type: 'passInspection', projectId: 'fairoaksd', lineId: 'fairoaksd-insp-service' })
    const texts = (id: string) => partnerActivity(state, partner(state, id)).filter((e) => e.kind === 'work').map((e) => e.text)
    expect(texts('guadalupe')).toContain('A punch item was not fixed: Two joints are still open.')
    expect(texts('pecanvalley')).toContain('Electrical service inspection passed.')
  })
})
