/** GC mode design spike: the owner's pay application, read off the made-up Helotes Dental Office. */
import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  missingTradeWaivers,
  nextOwnerBillDay,
  ourOwnerWaivers,
  ownerAllBilled,
  ownerCloseout,
  ownerReleasedRetainage,
  ownerAccount,
  ownerPayApp,
  ownerPayAppHasWork,
  proposalTotals,
  sentPayAppLines,
  tradeWaiverChecks,
  type GcState,
} from './gcModel'

function helotes() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.id === 'helotes')
  if (!project) throw new Error('fixture has no helotes')
  return { state, project }
}

describe('ownerPayApp', () => {
  it('bills the trades’ reported work, our costs in step with it, less 10% held', () => {
    const { state, project } = helotes()
    const app = ownerPayApp(state, project)
    expect(Math.round(app.contract)).toBe(Math.round(proposalTotals(project).price))
    // Hill Country reported framing 100% of $22,000 and hang and tape 60% of $27,200.
    const dry = app.lines.find((l) => l.id === 'dry')
    expect(dry?.doneToDate).toBe(38_320)
    expect(Math.round(app.doneToDate)).toBe(52_557)
    expect(Math.round(app.retainage)).toBe(5_256)
    expect(Math.round(app.due)).toBe(47_301)
    expect(Math.round(app.leftToBill)).toBe(291_466)
    expect(app.billOn).toBe('2026-10-25')
    expect(app.expectPaidOn).toBe('2026-11-15')
    expect(app.started).toBe(false)
  })

  it('counts nothing for a trade with no signed statement of work, our own crew, or no award', () => {
    const { state, project } = helotes()
    const app = ownerPayApp(state, project)
    for (const id of ['delec', 'dhvac', 'dplumb', 'mill']) {
      expect(app.lines.find((l) => l.id === id)?.doneToDate).toBe(0)
    }
  })
})

describe('sending the owner a pay application, then the next month', () => {
  const project = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('fixture has no helotes')
    return p
  }

  it('keeps pay application 1 as it went, and starts pay application 2 from it', () => {
    const sent = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    const apps = project(sent).ownerBilling?.payApps ?? []
    expect(apps.map((a) => [a.number, a.periodTo, a.sentOn, Math.round(a.due), a.paidOn])).toEqual([[1, '2026-10-25', '2026-10-02', 47_301, null]])
    // The made-up billed and paid numbers are left alone: the owner window still reads them.
    expect(project(sent).ownerBilling?.billed).toBe(61_000)
    const next = ownerPayApp(sent, project(sent))
    expect(next.number).toBe(2)
    expect(next.billOn).toBe('2026-11-25')
    expect(ownerPayAppHasWork(next)).toBe(false)
    // Nothing new: a second send does nothing.
    expect(gcReducer(sent, { type: 'sendOwnerPayApp', projectId: 'helotes' })).toBe(sent)
  })

  it('bills only the new work the next month, less what it asked for before', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: 'dry-2', pct: 100 })
    const app = ownerPayApp(state, project(state))
    const dry = app.lines.find((l) => l.id === 'dry')
    expect([dry?.doneBefore, dry?.thisMonth, dry?.doneToDate]).toEqual([38_320, 10_880, 49_200])
    expect(Math.round(app.doneToDate)).toBe(67_479)
    expect(Math.round(app.retainage)).toBe(6_748)
    expect(Math.round(app.askedBefore)).toBe(47_301)
    expect(Math.round(app.due)).toBe(13_430)
  })

  it('marks a pay application paid once, and the account says what is owed', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    expect(Math.round(ownerAccount(project(state))?.owed ?? 0)).toBe(47_301)
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })
    const account = ownerAccount(project(state))
    expect(account && [Math.round(account.billed), Math.round(account.retainageHeld), Math.round(account.paid), Math.round(account.owed)]).toEqual([52_557, 5_256, 47_301, 0])
    expect(gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })).toBe(state)
    expect(ownerAccount(project(initialGcState()))).toBeNull()
  })

  it('sends nothing on a project we are still bidding', () => {
    const state = initialGcState()
    expect(gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'boerne' })).toBe(state)
  })
})

describe('our own crew reports its percent done', () => {
  const plumbing = (state: GcState) => state.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dplumb')

  it('bills the crew’s percent of the trade, and our costs follow', () => {
    const state = gcReducer(initialGcState(), { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 40 })
    expect(plumbing(state)?.selfPerform?.pctDone).toBe(40)
    const project = state.projects.find((p) => p.id === 'helotes')
    if (!project) throw new Error('fixture has no helotes')
    const app = ownerPayApp(state, project)
    const line = app.lines.find((l) => l.id === 'dplumb')
    expect([line?.crewPct, line?.doneToDate, line?.source]).toEqual([40, 15_400, 'Our own crew reported 40% done.'])
    expect(Math.round(app.doneToDate)).toBe(73_678)
    expect(Math.round(app.due)).toBe(66_311)
  })

  it('keeps it between 0 and 100, does nothing when it does not change, and only on a trade we do ourselves', () => {
    const over = gcReducer(initialGcState(), { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 140 })
    expect(plumbing(over)?.selfPerform?.pctDone).toBe(100)
    expect(gcReducer(over, { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 100 })).toBe(over)
    const fresh = initialGcState()
    expect(gcReducer(fresh, { type: 'selfReport', projectId: 'helotes', packageId: 'dplumb', pct: 0 })).toBe(fresh)
    expect(gcReducer(fresh, { type: 'selfReport', projectId: 'helotes', packageId: 'dry', pct: 50 })).toBe(fresh)
  })
})

describe('lien waivers to the owner', () => {
  const helotesOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('fixture has no helotes')
    return p
  }
  const draftChecks = (state: GcState) => {
    const project = helotesOf(state)
    const app = ownerPayApp(state, project)
    return tradeWaiverChecks(state, project, Object.fromEntries(app.lines.map((l) => [l.id, l.doneToDate])))
  }

  it('says how much of each trade’s billed work their waivers cover', () => {
    const checks = draftChecks(initialGcState())
    // Only Hill Country has work on the bill; our own crew and the unsigned trades are left out.
    expect(checks.map((c) => [c.company, c.billed, c.unconditional, c.conditional, c.missing])).toEqual([
      ['Hill Country Interiors', 38_320, 22_000, 0, 16_320],
    ])
    expect(checks[0]?.waivers).toEqual([{ draw: 1, kind: 'unconditional', amount: 19_800, final: false }])
    expect(missingTradeWaivers(checks).map((c) => c.packageId)).toEqual(['dry'])
  })

  it('counts a draw asked for as covered by its conditional waiver', () => {
    const state = gcReducer(initialGcState(), { type: 'tradeRequestDraw', projectId: 'helotes', packageId: 'dry' })
    const checks = draftChecks(state)
    expect(checks.map((c) => [c.unconditional, c.conditional, c.missing])).toEqual([[22_000, 16_320, 0]])
    expect(missingTradeWaivers(checks)).toEqual([])
  })

  it('signs our conditional waiver when a bill goes and the unconditional one when it is paid', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    expect(ourOwnerWaivers(helotesOf(state)).map((w) => [w.payApp, w.kind, Math.round(w.amount), w.signedOn])).toEqual([[1, 'conditional', 47_301, '2026-10-02']])
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })
    expect(ourOwnerWaivers(helotesOf(state)).map((w) => w.kind)).toEqual(['unconditional', 'conditional'])
    expect(ourOwnerWaivers(helotesOf(initialGcState()))).toEqual([])
  })

  it('shows the owner every line of a sent bill, from the one before it', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: 'dry-2', pct: 100 })
    state = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'helotes' })
    const dry = sentPayAppLines(state, helotesOf(state), 2).find((l) => l.id === 'dry')
    expect(dry && [dry.worth, dry.doneBefore, dry.thisMonth, dry.doneToDate]).toEqual([64_200, 38_320, 10_880, 49_200])
    expect(sentPayAppLines(state, helotesOf(state), 3)).toEqual([])
  })
})

describe('the retainage the owner holds, released at the end', () => {
  const stoneOakOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'stoneoak')
    if (!p) throw new Error('fixture has no stoneoak')
    return p
  }
  const coolBreezeCloses = (state: GcState) => {
    const warranty = gcReducer(state, { type: 'tradeSendWarranty', projectId: 'stoneoak', packageId: 'shvac' })
    return gcReducer(warranty, {
      type: 'tradeSendFinalPayApp',
      projectId: 'stoneoak',
      packageId: 'shvac',
      periodTo: '2026-10-02',
      address: '1188 Culebra Rd, San Antonio, TX 78201',
      license: '',
      signedBy: 'Andre Wallace',
      signedTitle: 'Owner',
    })
  }

  it('starts with every line billed, Cool Breeze still to send its final, and $18,241.30 held', () => {
    const state = initialGcState()
    const c = ownerCloseout(state, stoneOakOf(state))
    expect(ownerAllBilled(state, stoneOakOf(state))).toBe(true)
    expect(c.steps.map((st) => [st.key, st.done])).toEqual([['billed', true], ['trades', false], ['accepted', false], ['finalApp', false], ['paid', false]])
    expect(c.tradesWaiting).toEqual([{ packageId: 'shvac', company: 'Cool Breeze Mechanical', why: 'Cool Breeze Mechanical still owes its warranty letter.' }])
    expect(c.held).toBeCloseTo(18_241.3, 2)
    expect([c.canAccept, c.canSendFinal]).toEqual([true, false])
    // Nothing new to bill: the draft asks for nothing.
    expect(ownerPayAppHasWork(ownerPayApp(state, stoneOakOf(state)))).toBe(false)
  })

  it('holds our final until every trade has sent its final pay application, and the owner has accepted', () => {
    let state = gcReducer(initialGcState(), { type: 'ownerAcceptsWork', projectId: 'stoneoak' })
    expect(stoneOakOf(state).ownerBilling?.acceptedOn).toBe('2026-10-02')
    expect(gcReducer(state, { type: 'sendOwnerFinalPayApp', projectId: 'stoneoak' })).toBe(state)
    state = coolBreezeCloses(state)
    const c = ownerCloseout(state, stoneOakOf(state))
    expect([c.tradesWaiting, c.canSendFinal]).toEqual([[], true])
  })

  it('asks for everything the owner holds, with our waivers on final payment, and releases it when paid', () => {
    let state = coolBreezeCloses(initialGcState())
    state = gcReducer(state, { type: 'ownerAcceptsWork', projectId: 'stoneoak' })
    state = gcReducer(state, { type: 'sendOwnerFinalPayApp', projectId: 'stoneoak' })
    const final = stoneOakOf(state).ownerBilling?.payApps?.[3]
    expect(final && [final.number, final.final, final.retainage, Math.round(final.due * 100) / 100, final.paidOn]).toEqual([4, true, 0, 18_241.3, null])
    expect(ourOwnerWaivers(stoneOakOf(state))[0]).toMatchObject({ payApp: 4, kind: 'conditional', final: true })
    expect(ownerReleasedRetainage(stoneOakOf(state))).toBe(false)
    expect(Math.round((ownerAccount(stoneOakOf(state))?.owed ?? 0) * 100) / 100).toBe(18_241.3)
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'stoneoak', number: 4 })
    const c = ownerCloseout(state, stoneOakOf(state))
    expect([c.closed, c.held]).toEqual([true, 0])
    expect(ourOwnerWaivers(stoneOakOf(state))[0]).toMatchObject({ kind: 'unconditional', final: true })
    expect(ownerReleasedRetainage(stoneOakOf(state))).toBe(true)
    expect(Math.round(ownerAccount(stoneOakOf(state))?.owed ?? 1)).toBe(0)
  })

  it('does not let the owner accept, or our final go, before every line is billed', () => {
    const state = initialGcState()
    const helotes = state.projects.find((p) => p.id === 'helotes')
    if (!helotes) throw new Error('fixture has no helotes')
    expect(ownerCloseout(state, helotes).canAccept).toBe(false)
    expect(gcReducer(state, { type: 'ownerAcceptsWork', projectId: 'helotes' })).toBe(state)
    expect(gcReducer(state, { type: 'sendOwnerFinalPayApp', projectId: 'helotes' })).toBe(state)
  })
})

describe('nextOwnerBillDay', () => {
  it('is the 25th of this month until it passes, then next month’s', () => {
    expect(nextOwnerBillDay('2026-10-02')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-30')).toBe('2027-01-25')
  })
})
