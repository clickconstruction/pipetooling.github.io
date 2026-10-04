import { describe, expect, it } from 'vitest'
import {
  changeOrderTradePct,
  finalPayApplication,
  gcReducer,
  initialGcState,
  jobCloseout,
  ownCrewWork,
  stageProgress,
  payApplication,
  payApplicationForDraw,
  payAppDraftPcts,
  payAppSteps,
  resendPayAppDraft,
  retainageHeldNow,
  sowContractSum,
  tradeChangesFor,
  sentBackOpen,
  timesSentBack,
  tradeCloseout,
  tradePayAppParties,
  drawOnTheirSov,
  payAppClaimedToDate,
  type ChangeOrder,
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

describe('closeout: retainage release and the final releases of lien', () => {
  const ids = { projectId: 'helotes', packageId: 'dry' }
  const typed = { periodTo: '2026-10-02', address: filled.address, license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
  const play = (actions: GcAction[], from: GcState = initialGcState()) => actions.reduce(gcReducer, from)
  const helotes = (s: GcState) => {
    const p = s.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('no Helotes')
    return p
  }
  const closeout = (s: GcState) => tradeCloseout(drySow(s), helotes(s), s.today)

  /** Every line billed: draw 2 takes hang and tape and ceilings to 100%, and we approve it. */
  const allBilled = () =>
    play([
      { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 100, 'dry-3': 100 }, ...typed },
      { type: 'approveDraw', ...ids, drawId: 'dry-draw-2' },
      { type: 'payDraw', ...ids, drawId: 'dry-draw-2' },
    ])
  /** Every line billed and accepted: the final pay application can go in. */
  const ready = () => play([{ type: 'acceptWork', ...ids }], allBilled())
  /** The owner paid our final pay application on `on` (Bill the owner's record, written by hand here). */
  const ownerPaid = (s: GcState, on: string): GcState => ({
    ...s,
    projects: s.projects.map((p) =>
      p.id === 'helotes'
        ? {
            ...p,
            ownerBilling: {
              ...(p.ownerBilling ?? { billed: 0, paid: 0, retainageHeld: 0 }),
              payApps: [
                ...(p.ownerBilling?.payApps ?? []),
                { number: 9, periodTo: on, sentOn: on, doneToDate: {}, workToDate: 0, retainagePct: 10, retainage: 0, due: 0, paidOn: on, final: true },
              ],
            },
          }
        : p,
    ),
  })

  it('holds 10% of every draw until the release is paid', () => {
    expect(retainageHeldNow(drySow(allBilled()))).toBe(6_420)
  })

  it('opens the final pay application once we accept the work', () => {
    const billed = allBilled()
    expect(closeout(billed).next?.key).toBe('accepted')
    const early = { type: 'tradeSendFinalPayApp' as const, ...ids, ...typed }
    expect(gcReducer(billed, early)).toBe(billed)
    expect(closeout(ready())).toMatchObject({ canAskFinal: true, canPay: false })
  })

  it('pays it 10 days after the customer pays us ours', () => {
    const asked = play([{ type: 'tradeSendFinalPayApp', ...ids, ...typed }], ready())
    expect(closeout(asked).next?.key).toBe('ownerReleased')
    // The customer paid us Sep 25: theirs can be paid Oct 5, after today (Oct 2).
    expect(closeout(ownerPaid(asked, '2026-09-25'))).toMatchObject({ canPay: false, opensOn: '2026-10-05' })
    // Paid Sep 20: Sep 30 has passed.
    const paid = ownerPaid(asked, '2026-09-20')
    expect(closeout(paid)).toMatchObject({ canPay: true, opensOn: '2026-09-30' })
    expect(closeout(paid).next?.key).toBe('released')
  })

  it('an older caller without the project never pays early', () => {
    const asked = play([{ type: 'tradeSendFinalPayApp', ...ids, ...typed }], ready())
    expect(tradeCloseout(drySow(ownerPaid(asked, '2026-09-20'))).canPay).toBe(false)
  })

  it('the final 702 releases the retainage: nothing held, line 8 is what was held', () => {
    const app = finalPayApplication(drySow(ready()))
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

  it('closes the trade once the release is paid and the unconditional final release is in', () => {
    const asked = play([{ type: 'tradeSendFinalPayApp', ...ids, ...typed }], ready())
    const release = drySow(asked).draws.find((d) => d.final)
    expect(release).toMatchObject({ id: 'dry-draw-3', gross: 0, retainage: -6_420, net: 6_420, status: 'requested' })
    expect(asked.log[0]?.text).toContain('with a conditional final release of lien')
    if (!release) throw new Error('no release')
    expect(payApplicationForDraw(drySow(asked), release).summary.currentDue).toBe(6_420)

    const approved = play([{ type: 'approveRetainage', ...ids, drawId: 'dry-draw-3' }], asked)
    expect(retainageHeldNow(drySow(approved))).toBe(6_420)
    const paid = play([{ type: 'payDraw', ...ids, drawId: 'dry-draw-3' }], approved)
    expect(retainageHeldNow(drySow(paid))).toBe(0)
    expect(closeout(paid).next?.key).toBe('finalWaiver')
    const closed = play([{ type: 'tradeSignUnconditional', ...ids, drawId: 'dry-draw-3' }], paid)
    expect(closeout(closed).closed).toBe(true)
  })

  it('a job closes only once every trade is closed out, our crew is done and the owner paid our final', () => {
    const left = jobCloseout(ready(), helotes(ready()))
    expect(left.ready).toBe(false)
    expect(left.left).toContain('Plumbing: our own crew is 0% done.')
    expect(left.left).toContain('Framing and drywall: final pay application.')
    expect(left.left).toContain('The customer has not paid our final pay application.')
    const paid = ownerPaid(ready(), '2026-09-20')
    expect(jobCloseout(paid, helotes(paid)).left).not.toContain('The customer has not paid our final pay application.')
  })
})

describe('approve less than asked', () => {
  const ids = { projectId: 'helotes', packageId: 'dry' }
  const typed = { periodTo: '2026-10-02', address: filled.address, license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
  const asked = gcReducer(initialGcState(), { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 60 }, ...typed })

  it('pays the lines we doubt at our percent and keeps what they asked', () => {
    const less = gcReducer(asked, { type: 'approveDrawLess', ...ids, drawId: 'dry-draw-2', weApprove: { 'dry-2': 40 }, note: 'The hall is not taped.' })
    const draw = drySow(less).draws[1]
    // 40% of $27,200 is $10,880; 10% held leaves $9,792. They asked for $14,688.
    expect(draw).toMatchObject({ status: 'approved', gross: 10_880, net: 9_792, asked: { net: 14_688, note: 'The hall is not taped.' } })
    expect(drySow(less).sov.find((l) => l.id === 'dry-2')).toMatchObject({ pctBilled: 40, pctReported: 60 })
    // Their form still shows what they asked; we certified less.
    if (!draw) throw new Error('no draw 2')
    expect(payApplicationForDraw(drySow(less), draw).summary.currentDue).toBe(14_688)
  })

  it('does nothing when it would not be less', () => {
    expect(gcReducer(asked, { type: 'approveDrawLess', ...ids, drawId: 'dry-draw-2', weApprove: { 'dry-2': 60 }, note: '' })).toBe(asked)
  })
})

describe('the office sends a pay application back', () => {
  const ids = { projectId: 'helotes', packageId: 'dry' }
  const typed = { periodTo: '2026-10-02', address: filled.address, license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
  const asked = gcReducer(initialGcState(), { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 60, 'dry-3': 40 }, ...typed })
  const back = gcReducer(asked, {
    type: 'sendDrawBack',
    ...ids,
    drawId: 'dry-draw-2',
    note: 'The break room ceiling is not hung yet.',
    weSee: { 'dry-2': 60, 'dry-3': 20 },
  })
  const hillCountry = () => {
    const p = back.partners.find((x) => x.id === 'hillcountry')
    if (!p) throw new Error('no Hill Country')
    return p
  }

  it('takes the draw off the list and keeps it with the note and the lines we doubt', () => {
    const sow = drySow(back)
    expect(sow.draws.map((d) => d.number)).toEqual([1])
    const open = sentBackOpen(sow)
    expect(open?.note).toBe('The break room ceiling is not hung yet.')
    // A line where we see what they asked is not flagged.
    expect(open?.lines).toEqual([{ sovId: 'dry-3', weSee: 20 }])
    // Their report and what was billed stay as they were.
    expect(sow.sov.find((l) => l.id === 'dry-3')).toMatchObject({ pctReported: 40, pctBilled: 0 })
  })

  it('the resend starts from what they asked for, with our number on the lines we doubt', () => {
    const sow = drySow(back)
    const open = sentBackOpen(sow)
    if (!open) throw new Error('nothing sent back')
    const draft = resendPayAppDraft(sow, hillCountry(), open)
    expect(draft.toPct).toEqual({ 'dry-1': 100, 'dry-2': 60, 'dry-3': 20 })
    expect(draft).toMatchObject({ periodTo: '2026-10-02', signedTitle: 'Office manager', waiverSigned: false })
  })

  it('the fixed one takes the same number, and its percents become their report', () => {
    const fixed = gcReducer(back, { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 60, 'dry-3': 20 }, ...typed })
    const sow = drySow(fixed)
    expect(sow.draws.map((d) => d.id)).toEqual(['dry-draw-1', 'dry-draw-2'])
    expect(timesSentBack(sow, 2)).toBe(1)
    expect(sentBackOpen(sow)).toBeNull()
    expect(sow.sov.find((l) => l.id === 'dry-3')?.pctReported).toBe(20)
    expect(fixed.log[0]?.text).toContain('on Framing and drywall again, fixed')
  })

  it('only a draw waiting on us can go back', () => {
    const approved = gcReducer(asked, { type: 'approveDraw', ...ids, drawId: 'dry-draw-2' })
    expect(gcReducer(approved, { type: 'sendDrawBack', ...ids, drawId: 'dry-draw-2', note: 'x', weSee: {} })).toBe(approved)
  })
})

describe('our own crew in Building', () => {
  const plumbing = (state: GcState) => {
    const pkg = state.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dplumb')
    if (!pkg) throw new Error('no plumbing on Helotes')
    return pkg
  }

  it('reads the one percent Bill the owner bills from, worth our own number', () => {
    const reported = gcReducer(initialGcState(), { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 50 })
    expect(ownCrewWork(plumbing(initialGcState()))).toMatchObject({ pct: 0, worth: 38_500, done: 0, ref: 'J 1042', byStage: false })
    expect(ownCrewWork(plumbing(reported))).toMatchObject({ pct: 50, done: 19_250 })
  })

  it('counts in the Building ring beside the trades we hire', () => {
    const building = (s: GcState): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === 'helotes' ? { ...p, stage: 'building' as const } : p)) })
    const before = building(initialGcState())
    const helotes = (s: GcState) => {
      const p = s.projects.find((x) => x.id === 'helotes')
      if (!p) throw new Error('no Helotes')
      return p
    }
    const ring = stageProgress(before, helotes(before))
    expect(ring.groups[0]?.items.map((i) => [i.label, i.detail])).toContainEqual(['Plumbing', 'Our own crew, 0% done'])
    const after = building(gcReducer(initialGcState(), { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 100 }))
    expect(stageProgress(after, helotes(after)).share).toBeGreaterThan(ring.share)
  })
})

describe('our own crew by stage', () => {
  const report = (lineId: string, pct: number, from: GcState = initialGcState()) =>
    gcReducer(from, { type: 'selfReportStage', projectId: 'helotes', packageId: 'dplumb', lineId, pct })
  const plumbing = (state: GcState) => {
    const pkg = state.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dplumb')
    if (!pkg) throw new Error('no plumbing on Helotes')
    return pkg
  }

  it('weighs each stage by its share and keeps the one percent Bill the owner reads in step', () => {
    // Underground 20, rough in 35, top out 25, trim 20 (my default weights).
    const s = report('dplumb-2', 100, report('dplumb-1', 100))
    expect(ownCrewWork(plumbing(s))).toMatchObject({ pct: 55, byStage: true })
    expect(plumbing(s).selfPerform?.pctDone).toBe(55)
    expect(s.log[0]?.text).toBe('Our own crew reported Rough in on Plumbing at 100%. The whole trade is 55% done.')
  })
})

describe('a pay application sent back twice', () => {
  it('flags it on the ring so someone calls them', () => {
    const ids = { projectId: 'helotes', packageId: 'dry' }
    const typed = { periodTo: '2026-10-02', address: filled.address, license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
    const send = { type: 'tradeSendPayApp' as const, ...ids, toPct: { 'dry-2': 60 }, ...typed }
    const back = { type: 'sendDrawBack' as const, ...ids, drawId: 'dry-draw-2', note: 'Not yet.', weSee: { 'dry-2': 40 } }
    const twice = [send, back, send, back].reduce(gcReducer, initialGcState())
    const building: GcState = { ...twice, projects: twice.projects.map((p) => (p.id === 'helotes' ? { ...p, stage: 'building' as const } : p)) }
    const helotes = building.projects.find((p) => p.id === 'helotes')
    if (!helotes) throw new Error('no Helotes')
    expect(stageProgress(building, helotes).also).toContain('Pay application 2 went back to Hill Country Interiors 2 times. Call them.')
  })
})

describe("change orders, the trade's side", () => {
  const helotes = (st: GcState) => {
    const p = st.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('no Helotes')
    return p
  }
  const dry = (st: GcState) => {
    const k = helotes(st).packages.find((x) => x.id === 'dry')
    if (!k) throw new Error('no drywall')
    return k
  }
  /** A change order on drywall, drafted, sent and signed by the owner (Owner Billing's actions). */
  const signedByOwner = (cost: number) =>
    [
      { type: 'draftChangeOrder', projectId: 'helotes', description: 'Sound batts in operatory 3', reason: 'owner', schedule: '+1 working day', packageId: 'dry', cost, price: 0 },
      { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' },
      { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' },
    ].reduce((st, a) => gcReducer(st, a as GcAction), initialGcState())

  it('goes to the trade once the owner signs, and becomes a line of its statement of work when they sign', () => {
    const owner = signedByOwner(4_800)
    expect(tradeChangesFor(helotes(owner), dry(owner)).map((c) => c.state)).toEqual(['toSend'])
    const sent = gcReducer(owner, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(tradeChangesFor(helotes(sent), dry(sent)).map((c) => c.state)).toEqual(['sent'])
    const signed = gcReducer(sent, { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: 'co-1' })
    const sow = dry(signed).sow
    if (!sow) throw new Error('no statement of work')
    expect(sow.sov[sow.sov.length - 1]).toEqual({ id: 'dry-co1', label: 'Change order 1: Sound batts in operatory 3', amount: 4_800, pctReported: 0, pctBilled: 0, changeOrderId: 'co-1' })
    // The original price stays; the contract to date and the 702's line 2 carry the change.
    expect([sow.price, sowContractSum(sow)]).toEqual([64_200, 69_000])
    expect(payApplication(sow, 2, payAppDraftPcts(sow)).summary).toMatchObject({ originalSum: 64_200, changeOrders: 4_800, sumToDate: 69_000 })
    const reported = gcReducer(signed, { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: 'dry-co1', pct: 50 })
    const co = helotes(reported).changeOrders?.[0]
    if (!co) throw new Error('no change order')
    expect(changeOrderTradePct(helotes(reported), co)).toBe(50)
  })

  it('a credit counts as done at once, so it comes off their next draw', () => {
    const owner = signedByOwner(-1_000)
    const signed = [
      { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' },
      { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: 'co-1' },
    ].reduce((st, a) => gcReducer(st, a as GcAction), owner)
    const sow = dry(signed).sow
    if (!sow) throw new Error('no statement of work')
    expect(sowContractSum(sow)).toBe(63_200)
    expect(sow.sov[sow.sov.length - 1]).toMatchObject({ amount: -1_000, pctReported: 100 })
    // Hang and tape at 60% ($16,320) less the $1,000 credit.
    expect(payApplication(sow, 2, payAppDraftPcts(sow)).totals.thisPeriod).toBe(15_320)
  })

  it('has no trade side for our own crew, and goes only once', () => {
    const owner = signedByOwner(4_800)
    const sent = gcReducer(owner, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(gcReducer(sent, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })).toBe(sent)
    const crew = [
      { type: 'draftChangeOrder', projectId: 'helotes', description: 'A hose bib', reason: 'field', schedule: 'none', packageId: 'dplumb', cost: 600, price: 0 },
      { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' },
      { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' },
    ].reduce((st, a) => gcReducer(st, a as GcAction), initialGcState())
    expect(gcReducer(crew, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })).toBe(crew)
  })
})

describe('materials stored on site (question 12)', () => {
  const send = (toPct: Record<string, number>, stored: Record<string, number>): GcAction => ({
    type: 'tradeSendPayApp',
    projectId: 'helotes',
    packageId: 'dry',
    toPct,
    stored,
    periodTo: filled.periodTo,
    address: filled.address,
    license: '',
    signedBy: filled.signedBy,
    signedTitle: filled.signedTitle,
  })

  it('counts what is on site in column F and in line 4, and holds retainage on it', () => {
    const app = payApplication(drySow(), 2, { 'dry-2': 60 }, false, { 'dry-3': 5_000 })
    const ceilings = app.lines.find((l) => l.sovId === 'dry-3')
    expect(ceilings).toMatchObject({ thisPeriod: 0, stored: 5_000, toDate: 5_000, pct: 0, balance: 10_000, retainage: 500 })
    expect(app.totals.stored).toBe(5_000)
    expect(app.summary).toMatchObject({ completedToDate: 43_320, retainage: 4_332, earnedLessRetainage: 38_988, previousCertificates: 19_800, currentDue: 19_188 })
  })

  it('never stores more than the line has left', () => {
    const app = payApplication(drySow(), 2, { 'dry-2': 60 }, false, { 'dry-2': 50_000 })
    expect(app.lines.find((l) => l.sovId === 'dry-2')?.stored).toBe(10_880)
  })

  it('keeps it on the draw, and once it is built it moves from F into E and is not paid twice', () => {
    const asked = gcReducer(initialGcState(), send({ 'dry-2': 60 }, { 'dry-3': 5_000 }))
    const draw2 = drySow(asked).draws[1]
    expect(draw2).toMatchObject({ gross: 21_320, retainage: 2_132, net: 19_188 })
    expect(draw2?.lines.find((l) => l.sovId === 'dry-3')).toEqual({ sovId: 'dry-3', toPct: 0, stored: 5_000 })
    expect(payApplicationForDraw(drySow(asked), draw2 as NonNullable<typeof draw2>).totals.stored).toBe(5_000)
    const paid = [
      { type: 'approveDraw', projectId: 'helotes', packageId: 'dry', drawId: draw2?.id ?? '' } as GcAction,
      { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: draw2?.id ?? '' } as GcAction,
    ].reduce(gcReducer, asked)
    // The grid is up: ceilings at 50%, nothing stored now.
    const next = gcReducer(paid, send({ 'dry-3': 50 }, {}))
    const draw3 = drySow(next).draws[2]
    expect(draw3).toMatchObject({ gross: 2_500, retainage: 250, net: 2_250 })
    expect(payApplicationForDraw(drySow(next), draw3 as NonNullable<typeof draw3>).summary).toMatchObject({ completedToDate: 45_820, previousCertificates: 38_988, currentDue: 2_250 })
  })
})

describe('the pay application as a file (question 12)', () => {
  it("says who it is from and to, and which signed change orders are new since the last one", () => {
    const state = initialGcState()
    const helotes = state.projects.find((p) => p.id === 'helotes')
    const partner = state.partners.find((p) => p.id === 'hillcountry')
    if (!helotes || !partner) throw new Error('no Helotes')
    // Two signed changes on drywall: one before draw 1 (Sep 19), one after it.
    const co = (id: string, signedOn: string) => ({ id, tradeChange: { status: 'signed', sentOn: signedOn, signedOn, sovLineId: `dry-${id}` } }) as unknown as ChangeOrder
    const base = drySow(state)
    const sow: Sow = {
      ...base,
      sov: [
        ...base.sov,
        { ...base.sov[0]!, id: 'dry-co-8', label: 'Soffit', amount: 1_200, pctBilled: 0, pctReported: 0, changeOrderId: 'co-8' },
        { ...base.sov[0]!, id: 'dry-co-9', label: 'Bulkhead', amount: -400, pctBilled: 0, pctReported: 0, changeOrderId: 'co-9' },
      ],
    }
    const project = { ...helotes, changeOrders: [co('co-8', '2026-09-10'), co('co-9', '2026-09-28')] }
    const app = payApplication(sow, 2, { 'dry-2': 60 })
    const parties = tradePayAppParties(project, sow, partner, app, { periodTo: '2026-10-02', address: filled.address, license: '', signedOn: null })
    expect(parties).toMatchObject({
      project: 'Helotes Dental Office',
      applicationNo: '2',
      periodTo: '2026-10-02',
      sentOn: null,
      contractDate: '2026-08-29',
      to: { name: 'Click Construction' },
      from: { name: 'Hill Country Interiors', address: filled.address },
      architect: 'Studio Ocotillo',
      changeOrders: [
        { amount: 1_200, thisPeriod: false },
        { amount: -400, thisPeriod: true },
      ],
    })
    expect(parties.from.license).toBeUndefined()
  })
})

describe("each draw on the trade's own schedule of values (question 4)", () => {
  it('reads where each draw landed, work in place on the original lines only', () => {
    const sow = initialGcState().projects.find((p) => p.id === 'fairoaksd')?.packages.find((k) => k.id === 'felec')?.sow
    if (!sow) throw new Error('no Pecan Valley statement of work')
    const [one, two] = sow.draws
    if (!one || !two) throw new Error('two draws expected')
    expect(payAppClaimedToDate(sow, payApplicationForDraw(sow, one))).toBe(89_000)
    expect(drawOnTheirSov(sow, one)).toBe('Their schedule: through Underground and gear, 19% into Rough-in.')
    expect(drawOnTheirSov(sow, two)).toBe('Their schedule: through Underground and gear, 65% into Rough-in.')
    expect(drawOnTheirSov({ ...sow, theirSov: [] }, one)).toBeNull()
  })

  it('leaves stored materials out of what is claimed', () => {
    const app = payApplication(drySow(), 2, { 'dry-2': 60 }, false, { 'dry-3': 5_000 })
    expect(app.summary.completedToDate).toBe(43_320)
    expect(payAppClaimedToDate(drySow(), app)).toBe(38_320)
  })
})
