/**
 * Main's own tests for a trade's money and closeout (the Building lane's U2): a draw's money from its
 * pay application, approved for less, the drafts a trade starts from, what we hold, our own crew's
 * work, closeout by trade and for the job, and a change order's trade side, run through the kernels
 * on the test data. The spike's own cases: on Fair Oaks D, today Fri Oct 2, Sitework is accepted and
 * may ask for its retainage, Concrete waits on its punch list, Structural steel's draw 2 waits on us,
 * and our own crew does the plumbing.
 */
import { describe, expect, it } from 'vitest'
import {
  changeOrderTradePct,
  drawApprovedLess,
  drawLinesOf,
  drawMoney,
  finalPayApplication,
  jobCloseout,
  newPayAppDraft,
  ownCrewWork,
  payApplication,
  payApplicationForDraw,
  projectCloseout,
  resendPayAppDraft,
  retainageHeldNow,
  storedBefore,
  tradeChangesFor,
  tradeCloseout,
  tradePayAppParties,
  tradeRetainageOpensOn,
} from './building'
import { GC_COMPANY } from './company'
import { partnerById } from './lookups'
import type { ChangeOrder, GcProject, GcState, Sow } from './types'
import { initialGcState } from './schedule/testState'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const pkg = (s: GcState, id: string) => job(s).packages.find((k) => k.id === id)!
/** The job with its own changes. */
function withJob(change: (p: GcProject) => GcProject): GcState {
  const s = initialGcState()
  return { ...s, projects: s.projects.map((p) => (p.id === ID ? change(p) : p)) }
}

describe('a draw’s money from its pay application', () => {
  it('asks for the work this period, less retainage, and approves less on the lines we doubt', () => {
    const steel = pkg(initialGcState(), 'fsteel').sow!
    const draw2 = steel.draws[1]!
    expect(drawMoney(steel, payApplicationForDraw(steel, draw2))).toEqual({ gross: 88000, retainage: 8800, net: 79200 })
    // Connections at half, not done: $32,000 of it, and the deck as asked.
    expect(drawApprovedLess(steel, draw2, { 'fsteel-2': 50 })).toEqual({
      lines: [
        { sovId: 'fsteel-2', toPct: 50 },
        { sovId: 'fsteel-3', toPct: 80 },
      ],
      gross: 56000,
      retainage: 5600,
      net: 50400,
    })
  })

  it('counts what was stored on site on the draw before', () => {
    const steel = pkg(initialGcState(), 'fsteel').sow!
    expect(storedBefore(steel, 3)).toBe(0)
    const stored = { ...steel, draws: steel.draws.map((d) => (d.number === 2 ? { ...d, lines: d.lines.map((l) => ({ ...l, stored: 4000 })) } : d)) }
    expect(storedBefore(stored, 3)).toBe(8000)
    expect(storedBefore(stored, 2)).toBe(0)
  })

  it('keeps a credit’s line on the draw that takes it, so the next draw does not take it again', () => {
    // A $2,000 credit signed into the statement of work, reported done at once (tradeSignChange).
    const sow: Sow = {
      status: 'signed',
      price: 12000,
      retainagePct: 10,
      basedOnRev: 0,
      signedOn: '2026-10-01',
      draws: [],
      sov: [
        { id: 'L1', label: 'Footings', amount: 12000, pctReported: 100, pctBilled: 0 },
        { id: 'L3', label: 'Change order 1: Leave out the curb', amount: -2000, pctReported: 100, pctBilled: 0, changeOrderId: 'co1' },
      ],
    }
    const first = payApplication(sow, 1, { L1: 50, L3: 100 })
    expect(drawMoney(sow, first)).toEqual({ gross: 4000, retainage: 400, net: 3600 })
    expect(drawLinesOf(first)).toEqual([
      { sovId: 'L1', toPct: 50 },
      { sovId: 'L3', toPct: 100 },
    ])
    const paid: Sow = { ...sow, draws: [{ id: 'd1', number: 1, requestedOn: '2026-10-09', gross: 4000, retainage: 400, net: 3600, status: 'paid', waiver: 'conditional', lines: drawLinesOf(first) }] }
    const second = payApplication(paid, 2, { L1: 100, L3: 100 })
    expect(drawMoney(paid, second)).toEqual({ gross: 6000, retainage: 600, net: 5400 })
    expect(drawLinesOf(second)).toEqual([{ sovId: 'L1', toPct: 100 }])
  })
})

describe('the drafts a trade starts from', () => {
  it('starts a new pay application from what it reported, with its contact to sign', () => {
    const s = initialGcState()
    const summit = s.partners.find((p) => p.id === 'summit')!
    const roof = pkg(s, 'froof').sow!
    expect(newPayAppDraft(roof, summit)).toEqual({
      toPct: { 'froof-1': 100, 'froof-2': 100, 'froof-3': 0, 'froof-4': 0 },
      periodTo: '',
      address: '',
      license: '',
      signedBy: 'Carla Nguyen',
      signedTitle: '',
      waiverSigned: false,
      stored: {},
    })
  })

  it('starts a resend from the one we sent back, with what we see on the lines we doubt', () => {
    const s = initialGcState()
    const summit = s.partners.find((p) => p.id === 'summit')!
    const roof = pkg(s, 'froof').sow!
    const draft = resendPayAppDraft(roof, summit, roof.sentBack![0]!)
    expect(draft.toPct).toEqual({ 'froof-1': 50, 'froof-2': 100, 'froof-3': 0, 'froof-4': 0 })
    expect([draft.periodTo, draft.address, draft.signedTitle]).toEqual(['2026-09-25', '640 FM 306, New Braunfels, TX 78130', 'Office manager'])
  })
})

describe('what we hold, and our own crew', () => {
  it('holds each trade’s retainage on the draws approved', () => {
    const s = initialGcState()
    expect(['fsite', 'fconc', 'fsteel', 'felec', 'froof', 'fhvac'].map((id) => retainageHeldNow(pkg(s, id).sow!))).toEqual([16800, 21400, 9200, 8900, 0, 3240])
  })

  it('reads our own crew’s work from its stages, and has none for a trade we hire', () => {
    const s = initialGcState()
    const crew = ownCrewWork(pkg(s, 'fplumb'))!
    expect([crew.pct, crew.worth, crew.done, crew.ref, crew.byStage]).toEqual([65, 112000, 72800, 'J 1088', true])
    expect(crew.stages.map((st) => [st.label, st.pct])).toEqual([
      ['Underground', 100],
      ['Rough in', 100],
      ['Top out', 40],
      ['Trim', 0],
    ])
    expect(ownCrewWork(pkg(s, 'fsite'))).toBeNull()
  })

  it('opens a trade’s retainage 10 days after the customer pays our final', () => {
    expect(tradeRetainageOpensOn(job(initialGcState()))).toBeNull()
    const paid = withJob((p) => ({ ...p, ownerBilling: { ...(p.ownerBilling ?? { billed: 0, paid: 0, retainageHeld: 0 }), payApps: [...(p.ownerBilling?.payApps ?? []), { number: (p.ownerBilling?.payApps?.length ?? 0) + 1, periodTo: '2026-09-30', sentOn: '2026-09-30', doneToDate: {}, workToDate: 0, retainagePct: 0, retainage: 0, due: 0, final: true, paidOn: '2026-10-01' }] } }))
    expect(tradeRetainageOpensOn(job(paid))).toBe('2026-10-11')
  })
})

describe('closeout, by trade and for the job', () => {
  it('releases the retainage held, never a back-charge taken off a draw', () => {
    const sow: Sow = {
      status: 'signed',
      price: 30000,
      retainagePct: 10,
      basedOnRev: 0,
      signedOn: '2026-08-01',
      sov: [
        { id: 'L1', label: 'Footings', amount: 12000, pctReported: 100, pctBilled: 100 },
        { id: 'L2', label: 'Slab', amount: 18000, pctReported: 100, pctBilled: 100 },
      ],
      draws: [
        { id: 'd1', number: 1, requestedOn: '2026-09-08', gross: 15000, retainage: 1500, net: 13500, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'L1', toPct: 50 }, { sovId: 'L2', toPct: 50 }] },
        // A $500 back-charge came off draw 2: its net is what we paid (takeBackCharge).
        { id: 'd2', number: 2, requestedOn: '2026-10-03', gross: 13200, retainage: 1320, net: 11380, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'L1', toPct: 100 }, { sovId: 'L2', toPct: 90 }], backCharges: [{ chargeId: 'c1', amount: 500 }] },
        { id: 'd3', number: 3, requestedOn: '2026-10-09', gross: 1800, retainage: 180, net: 1620, status: 'paid', waiver: 'unconditional', lines: [{ sovId: 'L2', toPct: 100 }] },
      ],
    }
    expect(finalPayApplication(sow).summary.previousCertificates).toBe(27000)
    expect(finalPayApplication(sow).summary.currentDue).toBe(3000)
    expect(retainageHeldNow(sow)).toBe(3000)
  })

  it('walks each trade to its next step', () => {
    const s = initialGcState()
    const site = tradeCloseout(pkg(s, 'fsite').sow!, job(s), s.today)
    expect([site.held, site.canAskFinal, site.next?.label, site.closed]).toEqual([16800, true, 'Final pay application', false])
    const concrete = tradeCloseout(pkg(s, 'fconc').sow!, job(s), s.today)
    expect([concrete.canAskFinal, concrete.next?.label]).toEqual([false, 'We accept the work'])
    expect(tradeCloseout(pkg(s, 'fsteel').sow!, job(s), s.today).next?.label).toBe('Every line billed')
  })

  it('totals what we hold across the job, with our own crew apart', () => {
    const s = initialGcState()
    const all = projectCloseout(s, job(s))
    expect([all.rows.length, all.held, all.released, all.closed]).toEqual([6, 59540, 0, 0])
    expect(all.ours.map((k) => k.id)).toEqual(['fplumb'])
  })

  it('says what is left before the job closes', () => {
    const s = initialGcState()
    expect(jobCloseout(s, job(s))).toEqual({
      ready: false,
      left: [
        'Sitework: final pay application.',
        'Concrete: we accept the work.',
        'Structural steel: every line billed.',
        'Electrical: every line billed.',
        'Roofing: every line billed.',
        'Plumbing: our own crew is 65% done.',
        'HVAC: every line billed.',
        'The customer has not paid our final pay application.',
      ],
      closedOn: null,
    })
  })
})

describe('a change order’s trade side', () => {
  /** A signed change to the steel: a canopy, sent to Iron Horse and signed as a line of its own. */
  const CANOPY: ChangeOrder = {
    id: 'co-canopy',
    number: 1,
    description: 'Add the entry canopy steel',
    reason: 'owner',
    schedule: 'none',
    packageId: 'fsteel',
    cost: 18400,
    price: 20240,
    status: 'signed',
    sentOn: '2026-09-20',
    answeredOn: '2026-09-22',
    tradeChange: { status: 'signed', sentOn: '2026-09-23', signedOn: '2026-09-24', sovLineId: 'fsteel-co-1' },
    pctDone: 0,
  }

  it('says where each stands, and reads the trade’s percent once it signed', () => {
    const s = withJob((p) => ({
      ...p,
      changeOrders: [CANOPY, { ...CANOPY, id: 'co-sent', number: 2, status: 'sent', tradeChange: undefined }, { ...CANOPY, id: 'co-no', number: 3, status: 'declined' }],
      packages: p.packages.map((k) =>
        k.id === 'fsteel' && k.sow ? { ...k, sow: { ...k.sow, sov: [...k.sow.sov, { id: 'fsteel-co-1', label: 'Entry canopy', amount: 12000, pctReported: 25, pctBilled: 0, changeOrderId: 'co-canopy' }] } } : k,
      ),
    }))
    expect(tradeChangesFor(job(s), pkg(s, 'fsteel')).map((c) => [c.co.id, c.state])).toEqual([
      ['co-canopy', 'signed'],
      ['co-sent', 'owner'],
    ])
    expect(tradeChangesFor(job(s), pkg(s, 'fplumb'))).toEqual([])
    expect(changeOrderTradePct(job(s), CANOPY)).toBe(25)
    expect(changeOrderTradePct(job(s), { ...CANOPY, tradeChange: { ...CANOPY.tradeChange!, status: 'sent', signedOn: null } })).toBeNull()
  })
})

describe('who a trade’s pay application is from and to (U6b)', () => {
  /** Two signed changes on the steel: one before draw 1's period ended, one in draw 2's. */
  const signed = (id: string, cost: number, signedOn: string): ChangeOrder => ({
    id,
    number: id === 'co-early' ? 1 : 2,
    description: 'A change to the steel',
    reason: 'owner',
    schedule: 'none',
    packageId: 'fsteel',
    cost,
    price: cost,
    status: 'signed',
    sentOn: '2026-08-01',
    answeredOn: '2026-08-02',
    tradeChange: { status: 'signed', sentOn: '2026-08-03', signedOn, sovLineId: `line-${id}` },
    pctDone: 0,
  })
  const s = withJob((p) => ({
    ...p,
    changeOrders: [signed('co-early', 4000, '2026-08-10'), signed('co-late', -1500, '2026-09-12')],
    packages: p.packages.map((k) =>
      k.id === 'fsteel' && k.sow
        ? {
            ...k,
            sow: {
              ...k.sow,
              sov: [
                ...k.sow.sov,
                { id: 'line-co-early', label: 'Change order 1', amount: 4000, pctReported: 0, pctBilled: 0, changeOrderId: 'co-early' },
                { id: 'line-co-late', label: 'Change order 2', amount: -1500, pctReported: 0, pctBilled: 0, changeOrderId: 'co-late' },
              ],
            },
          }
        : k,
    ),
  }))
  const steel = pkg(s, 'fsteel')
  const partner = partnerById(s, steel.invites.find((i) => i.id === steel.awardedInviteId)!.partnerId)!

  it('is from the trade to us, numbered, on its contract day, with the changes it signed this period', () => {
    const app = payApplicationForDraw(steel.sow!, steel.sow!.draws[1]!)
    const parties = tradePayAppParties(job(s), steel.sow!, partner, app, { periodTo: '2026-09-30', address: '1 Forge Rd', license: 'TX-77', signedOn: '2026-09-30' })
    expect(parties).toMatchObject({
      project: 'Fair Oaks Shops, Building D',
      applicationNo: '2',
      periodTo: '2026-09-30',
      sentOn: '2026-09-30',
      contractDate: steel.sow!.signedOn,
      to: { name: GC_COMPANY.name, address: GC_COMPANY.address },
      from: { name: partner.company, address: '1 Forge Rd', license: 'TX-77' },
    })
    // Draw 1 ran to Aug 21: the change signed Aug 10 was before it, the credit signed Sep 12 is this period's.
    expect(parties.changeOrders).toEqual([
      { amount: 4000, thisPeriod: false },
      { amount: -1500, thisPeriod: true },
    ])
  })

  it('leaves out a license it was not given, and a draft is not sent yet', () => {
    const app = payApplicationForDraw(steel.sow!, steel.sow!.draws[1]!)
    const parties = tradePayAppParties(job(s), steel.sow!, partner, app, { periodTo: '', address: '', license: '', signedOn: null })
    expect(parties.from).toEqual({ name: partner.company, address: '' })
    expect(parties.sentOn).toBeNull()
    // With no period yet, every change signed since the last application counts.
    expect(parties.changeOrders.map((c) => c.thisPeriod)).toEqual([false, true])
  })
})
