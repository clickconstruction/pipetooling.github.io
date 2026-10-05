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
  partnerPaper,
  partnerWork,
  type GcState,
  type Partner,
} from './gcModel'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

const docOf = (state: GcState, id: string, key: string) =>
  partnerDocuments(state, partner(state, id)).groups.flatMap((g) => g.docs).find((d) => d.key === key)

describe("a company's window (the owner, 2026-10-04)", () => {
  it('Documents lead with what is missing, and say what each one is', () => {
    const state = initialGcState()
    const pecan = partnerDocuments(state, partner(state, 'pecanvalley'))
    expect(pecan.groups.map((g) => g.title)).toEqual(['Their company papers', 'Fair Oaks Shops, Building D · Electrical', 'Their quotes'])
    // Their insurance ran out and draw 1's unconditional waiver is owed: two papers to get.
    expect(pecan.toGet).toBe(2)
    expect(docOf(state, 'pecanvalley', 'insurance')).toMatchObject({ status: 'missing', statusWords: 'ran out Sep 15', ask: 'insurance' })
    expect(docOf(state, 'pecanvalley', 'waivers-felec')).toMatchObject({ status: 'missing', statusWords: '1 owed', ask: 'closeout' })
    // A draft statement of work is ours to send, not a paper to get from them.
    expect(docOf(state, 'kendall', 'sow-dhvac')).toMatchObject({ status: 'info', statusWords: 'drafted, not sent yet' })
    expect(docOf(state, 'kendall', 'sow-dhvac')?.ask).toBeUndefined()
  })

  it('a W-9 never shows the tax number', () => {
    const state = initialGcState()
    const paper = partnerPaper(state, partner(state, 'ironhorse'), 'w9')
    expect(paper?.rows.find((r) => r.label === 'Tax number')?.value).toBe('on file · never shown here')
  })

  it('a paper shows what it holds: the waivers by draw', () => {
    const state = initialGcState()
    const paper = partnerPaper(state, partner(state, 'pecanvalley'), 'waivers-felec')
    expect(paper?.table?.rows).toEqual([
      ['1', 'in, with the pay application', 'owed since Aug 29'],
      ['2', 'in, with the pay application', 'once it is paid'],
    ])
    expect(partnerPaper(state, partner(state, 'pecanvalley'), 'no-such-paper')).toBeNull()
  })

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

  it('About counts their work and money with us', () => {
    const state = initialGcState()
    const work = partnerWork(state, partner(state, 'pecanvalley'))
    expect(work.jobs.map((j) => j.pkg.id)).toEqual(['felec'])
    expect(work).toMatchObject({ underContract: 248_000, paid: 80_100, held: 8_900 })
    expect(partnerWork(state, partner(state, 'hillside')).jobs).toEqual([])
  })

  it("a customer's window: our contract, our pay applications, and the calls and bills in one timeline", () => {
    const state = initialGcState()
    const cibolo = state.customers.find((c) => c.id === 'cibolo')
    if (!cibolo) throw new Error('no cibolo')
    const docs = customerDocuments(state, cibolo)
    expect(docs.groups.flatMap((g) => g.docs.map((d) => `${d.key} ${d.statusWords}`))).toEqual(['contract-fairoaksd signed Jun 2', 'owner-payapps-fairoaksd 3 sent'])
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
