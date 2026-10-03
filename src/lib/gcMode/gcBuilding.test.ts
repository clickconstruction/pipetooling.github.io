import { describe, expect, it } from 'vitest'
import {
  finalPayApplication,
  gcReducer,
  initialGcState,
  payApplication,
  payApplicationForDraw,
  payAppDraftPcts,
  payAppSteps,
  retainageHeldNow,
  tradeCloseout,
  type GcAction,
  type GcState,
  type PayAppInput,
  type Sow,
} from './gcModel'

/** Helotes, Framing and drywall: $64,200, 10% held, draw 1 paid framing ($22,000). */
function drySow(state: GcState = initialGcState()): Sow {
  const sow = state.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dry')?.sow
  if (!sow) throw new Error('no dry statement of work in the fixture')
  return sow
}

const filled: PayAppInput = {
  toPct: {},
  periodTo: '2026-10-02',
  address: '418 River Rd, Boerne, TX 78006',
  license: '',
  signedBy: 'Rosa Medina',
  signedTitle: 'Office manager',
  waiverSigned: true,
}

describe('payApplication: the G702 and G703', () => {
  it('fills from what the trade reported (hang and tape at 60%)', () => {
    const sow = drySow()
    const app = payApplication(sow, 2, payAppDraftPcts(sow))
    expect(app.lines.map((l) => [l.label, l.fromPrevious, l.thisPeriod, l.toDate, l.pct, l.balance])).toEqual([
      ['Framing', 22_000, 0, 22_000, 100, 0],
      ['Hang and tape', 0, 16_320, 16_320, 60, 10_880],
      ['Ceilings', 0, 0, 0, 0, 15_000],
    ])
    expect(app.summary).toEqual({
      originalSum: 64_200,
      changeOrders: 0,
      sumToDate: 64_200,
      completedToDate: 38_320,
      retainagePct: 10,
      retainage: 3_832,
      earnedLessRetainage: 34_488,
      previousCertificates: 19_800,
      currentDue: 14_688,
      balanceToFinish: 29_712,
    })
  })

  it('never goes below what was billed before', () => {
    const app = payApplication(drySow(), 2, { 'dry-1': 40 })
    expect(app.lines[0]?.pct).toBe(100)
    expect(app.totals.thisPeriod).toBe(0)
  })

  it('rebuilds a past draw from the draws (draw 1 asked for $19,800)', () => {
    const sow = drySow()
    const draw = sow.draws[0]
    if (!draw) throw new Error('no draw 1')
    const app = payApplicationForDraw(sow, draw)
    expect(app.summary.previousCertificates).toBe(0)
    expect(app.totals.thisPeriod).toBe(22_000)
    expect(app.summary.currentDue).toBe(draw.net)
  })
})

describe('payAppSteps', () => {
  it('starts on the work when nothing new is reported', () => {
    const app = payApplication(drySow(), 2, { 'dry-2': 0 })
    const { steps, ready } = payAppSteps(app, { ...filled, signedTitle: '' })
    expect(steps.map((s) => s.state)).toEqual(['now', 'done', 'wait', 'wait'])
    expect(ready).toBe(false)
  })

  it('is ready once the work, the details and the signature are in', () => {
    const sow = drySow()
    const { steps, ready } = payAppSteps(payApplication(sow, 2, payAppDraftPcts(sow)), filled)
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now'])
    expect(ready).toBe(true)
  })
})

describe('tradeSendPayApp', () => {
  const action = {
    type: 'tradeSendPayApp' as const,
    projectId: 'helotes',
    packageId: 'dry',
    toPct: { 'dry-2': 60 },
    periodTo: filled.periodTo,
    address: filled.address,
    license: '',
    signedBy: filled.signedBy,
    signedTitle: filled.signedTitle,
  }

  it('asks for the draw the application says, and keeps the address for next time', () => {
    const next = gcReducer(initialGcState(), action)
    const draw = drySow(next).draws[1]
    expect(draw?.net).toBe(14_688)
    expect(draw?.payApp?.signedBy).toBe('Rosa Medina')
    expect(next.partners.find((p) => p.id === 'hillcountry')?.address).toBe(filled.address)
  })

  it('waits while a draw is open', () => {
    const once = gcReducer(initialGcState(), action)
    expect(gcReducer(once, { ...action, toPct: { 'dry-3': 50 } })).toBe(once)
  })
})

describe('closeout: retainage release and the final waivers', () => {
  const ids = { projectId: 'helotes', packageId: 'dry' }
  const typed = { periodTo: '2026-10-02', address: filled.address, license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
  const play = (actions: GcAction[], from: GcState = initialGcState()) => actions.reduce(gcReducer, from)

  /** Every line billed: draw 2 takes hang and tape and ceilings to 100%, and we approve it. */
  const allBilled = () =>
    play([
      { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 100, 'dry-3': 100 }, ...typed },
      { type: 'approveDraw', ...ids, drawId: 'dry-draw-2' },
      { type: 'payDraw', ...ids, drawId: 'dry-draw-2' },
    ])

  it('holds 10% of every draw until the release is paid', () => {
    expect(retainageHeldNow(drySow(allBilled()))).toBe(6_420)
  })

  it('waits for our acceptance and their warranty letter before the final pay application', () => {
    const billed = allBilled()
    expect(tradeCloseout(drySow(billed)).next?.key).toBe('accepted')
    const early = { type: 'tradeSendFinalPayApp' as const, ...ids, ...typed }
    expect(gcReducer(billed, early)).toBe(billed)
    const accepted = play([{ type: 'acceptWork', ...ids }], billed)
    expect(gcReducer(accepted, early)).toBe(accepted)
    const ready = play([{ type: 'tradeSendWarranty', ...ids }], accepted)
    expect(tradeCloseout(drySow(ready)).canAskFinal).toBe(true)
  })

  it('the final 702 releases the retainage: nothing held, line 8 is what was held', () => {
    const ready = play([{ type: 'acceptWork', ...ids }, { type: 'tradeSendWarranty', ...ids }], allBilled())
    const app = finalPayApplication(drySow(ready))
    expect(app.final).toBe(true)
    expect(app.totals.thisPeriod).toBe(0)
    expect(app.summary).toMatchObject({
      completedToDate: 64_200,
      retainage: 0,
      earnedLessRetainage: 64_200,
      previousCertificates: 57_780,
      currentDue: 6_420,
      balanceToFinish: 0,
    })
  })

  it('closes the trade once the release is paid and the unconditional final waiver is in', () => {
    const asked = play(
      [{ type: 'acceptWork', ...ids }, { type: 'tradeSendWarranty', ...ids }, { type: 'tradeSendFinalPayApp', ...ids, ...typed }],
      allBilled(),
    )
    const release = drySow(asked).draws.find((d) => d.final)
    expect(release).toMatchObject({ id: 'dry-draw-3', gross: 0, retainage: -6_420, net: 6_420, status: 'requested' })
    expect(payApplicationForDraw(drySow(asked), release!).summary.currentDue).toBe(6_420)

    const approved = play([{ type: 'approveRetainage', ...ids, drawId: 'dry-draw-3' }], asked)
    expect(retainageHeldNow(drySow(approved))).toBe(6_420)
    const paid = play([{ type: 'payDraw', ...ids, drawId: 'dry-draw-3' }], approved)
    expect(retainageHeldNow(drySow(paid))).toBe(0)
    expect(tradeCloseout(drySow(paid)).next?.key).toBe('finalWaiver')
    const closed = play([{ type: 'tradeSignUnconditional', ...ids, drawId: 'dry-draw-3' }], paid)
    expect(tradeCloseout(drySow(closed)).closed).toBe(true)
  })
})
