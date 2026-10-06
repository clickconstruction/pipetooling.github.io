/** GC mode design spike: the owner's pay application, read off the made-up Helotes Dental Office. */
import { describe, expect, it } from 'vitest'
import {
  allJobsMargin,
  billDay,
  allJobsMoney,
  jobMargin,
  openChangeRequests,
  customerMessages,
  latePayApps,
  payReminderEmail,
  payReminderSentWords,
  payReminderStep,
  ownerFinishRisk,
  ownerInterest,
  ownerInterestFrom,
  ownerRetainageOn,
  ownerRetainageWords,
  substantialCompletionOn,
  priceToOwner,
  ownerContractPrice,
  ownerContractWorthNow,
  cashAhead,
  changeOrderScheduleWords,
  contractDaysAdded,
  gcReducer,
  initialGcState,
  missingTradeWaivers,
  changeOrderPrice,
  nextOwnerBillDay,
  ourOwnerWaivers,
  owedDrawWords,
  ownerAllBilled,
  ownerCarriedForward,
  ownerLateBills,
  ownerPayDue,
  ownerPayAppForm,
  ownerCloseout,
  ownerReleasedRetainage,
  projectCash,
  ownerAccount,
  ownerPayApp,
  ownerPayAppHasWork,
  proposalTotals,
  markupOnTop,
  sentPayAppLines,
  spreadMarkup,
  tradesOwingUnconditional,
  tradeWaiverChecks,
  type GcProject,
  type GcState,
  type OwnerPayAppSent,
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
    // Helotes started with nothing billed (owner's call): the record is made when the first bill goes.
    expect(project(sent).ownerBilling?.billed).toBe(0)
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
    expect(c.steps.map((st) => [st.key, st.done])).toEqual([['billed', true], ['trades', false], ['accepted', false], ['finalApp', false], ['certified', false], ['paid', false]])
    // Building lane, owner's call 2026-10-02: closeout asks for no warranty letter, so the next step is the final.
    expect(c.tradesWaiting).toEqual([{ packageId: 'shvac', company: 'Cool Breeze Mechanical', why: 'Cool Breeze Mechanical has not sent it yet.' }])
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
    expect(ownerCloseout(state, stoneOakOf(state)).next?.key).toBe('certified')
    state = gcReducer(state, { type: 'architectCertify', projectId: 'stoneoak', number: 4, amount: 18_241.3, note: '' })
    expect(ownerCloseout(state, stoneOakOf(state)).next?.key).toBe('paid')
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

describe('Fair Oaks D: three months billed to Cibolo, and a pay application we sent back', () => {
  const fairOaksOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'fairoaksd')
    if (!p) throw new Error('fixture has no fairoaksd')
    return p
  }
  const cents = (n: number) => Math.round(n * 100) / 100

  it('reads the account off the three pay applications, the same as the record says', () => {
    const project = fairOaksOf(initialGcState())
    const account = ownerAccount(project)
    expect(account && [cents(account.billed), cents(account.retainageHeld), cents(account.paid), cents(account.owed)]).toEqual([956_327.91, 95_632.79, 571_816.61, 288_878.51])
    expect(project.ownerBilling && [project.ownerBilling.billed, project.ownerBilling.retainageHeld, project.ownerBilling.paid]).toEqual([956_327.91, 95_632.79, 571_816.61])
  })

  it('bills October from what we see on the roofing we sent back', () => {
    const state = initialGcState()
    const app = ownerPayApp(state, fairOaksOf(state))
    expect([app.number, app.billOn, cents(app.doneToDate), cents(app.retainage), cents(app.askedBefore), cents(app.due)]).toEqual([4, '2026-10-25', 1_065_846.03, 106_584.6, 860_695.12, 98_566.31])
    const roof = app.lines.find((l) => l.id === 'froof')
    expect([roof?.doneBefore, roof?.thisMonth, roof?.source]).toEqual([32_000, 28_000, 'Summit Roofing reported 70%. We sent their pay application back, so this bills what we see: 45%.'])
    expect(roof?.detail[0]).toEqual({ label: 'TPO membrane', pct: 50, theySay: 100 })
  })

  it('bills their own numbers again once they resend', () => {
    const state = gcReducer(initialGcState(), {
      type: 'tradeSendPayApp',
      projectId: 'fairoaksd',
      packageId: 'froof',
      toPct: { 'froof-1': 50, 'froof-2': 100 },
      periodTo: '2026-10-02',
      address: '4100 Broadway, San Antonio, TX 78209',
      license: '',
      signedBy: 'Carla Nguyen',
      signedTitle: 'Owner',
    })
    const roof = ownerPayApp(state, fairOaksOf(state)).lines.find((l) => l.id === 'froof')
    expect([roof?.doneToDate, roof?.source]).toEqual([60_000, 'Summit Roofing reported 45% done.'])
  })

  it('every made-up pay application adds up to the cent', () => {
    for (const project of initialGcState().projects) {
      let asked = 0
      for (const app of project.ownerBilling?.payApps ?? []) {
        const lines = Object.values(app.doneToDate).reduce((s, x) => s + x, 0)
        expect(cents(lines)).toBe(app.workToDate)
        expect(cents((app.workToDate * app.retainagePct) / 100)).toBe(app.retainage)
        expect(cents(app.workToDate - app.retainage - asked)).toBe(app.due)
        asked = cents(asked + app.due)
      }
    }
  })
})

describe('a paid draw still owing its unconditional waiver', () => {
  const checksOn = (state: GcState, id: string) => {
    const project = state.projects.find((p) => p.id === id)
    if (!project) throw new Error(`fixture has no ${id}`)
    const app = ownerPayApp(state, project)
    return tradeWaiverChecks(state, project, Object.fromEntries(app.lines.map((l) => [l.id, l.doneToDate])))
  }

  it('flags Pecan Valley on Fair Oaks D: draw 1 paid, only the conditional waiver in', () => {
    const owing = tradesOwingUnconditional(checksOn(initialGcState(), 'fairoaksd'))
    expect(owing.map((c) => [c.company, c.owedUnconditional])).toEqual([['Pecan Valley Electric', [{ draw: 1, amount: 80_100, final: false }]]])
  })

  it('flags a draw once we pay it, and clears when they sign the unconditional waiver', () => {
    let state = gcReducer(initialGcState(), { type: 'tradeRequestDraw', projectId: 'helotes', packageId: 'dry' })
    state = gcReducer(state, { type: 'approveDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' })
    expect(tradesOwingUnconditional(checksOn(state, 'helotes'))).toEqual([])
    state = gcReducer(state, { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' })
    expect(tradesOwingUnconditional(checksOn(state, 'helotes')).map((c) => owedDrawWords(c.owedUnconditional))).toEqual(['draw 2'])
    state = gcReducer(state, { type: 'tradeSignUnconditional', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' })
    expect(tradesOwingUnconditional(checksOn(state, 'helotes'))).toEqual([])
  })

  it('names the draws in words', () => {
    const d = (draw: number, final = false) => ({ draw, amount: 1, final })
    expect(owedDrawWords([d(1)])).toBe('draw 1')
    expect(owedDrawWords([d(1), d(2)])).toBe('draws 1 and 2')
    expect(owedDrawWords([d(1), d(2), d(3)])).toBe('draws 1, 2 and 3')
    expect(owedDrawWords([d(4, true)])).toBe('the final draw')
    expect(owedDrawWords([d(2), d(4, true)])).toBe('draw 2 and the final draw')
  })
})

describe('our costs and fee spread into the trades', () => {
  const sum = (rows: { worth: number; doneBefore: number; thisMonth: number; doneToDate: number }[], key: 'worth' | 'doneBefore' | 'thisMonth' | 'doneToDate') =>
    Math.round(rows.reduce((s, l) => s + l[key], 0) * 100) / 100

  it('keeps every total and every percent, with no line of our own', () => {
    for (const id of ['helotes', 'fairoaksd', 'stoneoak']) {
      const state = initialGcState()
      const project = state.projects.find((p) => p.id === id)
      if (!project) throw new Error(`fixture has no ${id}`)
      const lines = ownerPayApp(state, project).lines
      const spread = spreadMarkup(lines)
      expect(spread.some((l) => ['gc', 'contingency', 'fee'].includes(l.id))).toBe(false)
      for (const key of ['worth', 'doneBefore', 'thisMonth', 'doneToDate'] as const) expect(sum(spread, key)).toBe(sum(lines, key))
      for (const l of spread) {
        const own = lines.find((x) => x.id === l.id)
        if (own && own.worth > 0) expect(Math.round((l.doneToDate / l.worth) * 1000)).toBe(Math.round((own.doneToDate / own.worth) * 1000))
      }
    }
  })

  it('puts 37.2% on top of each trade on Helotes', () => {
    const state = initialGcState()
    const helotes = state.projects.find((p) => p.id === 'helotes')
    if (!helotes) throw new Error('fixture has no helotes')
    const lines = ownerPayApp(state, helotes).lines
    expect(Math.round(markupOnTop(lines) * 1000) / 10).toBe(37.2)
    const dry = spreadMarkup(lines).find((l) => l.id === 'dry')
    expect(dry && [dry.tradeWorth, Math.round(dry.ourShare), Math.round(dry.worth), Math.round(dry.doneToDate)]).toEqual([64_200, 23_852, 88_052, 52_557])
  })

  it('reads a line with no new work as exactly $0 this month, never minus zero', () => {
    const state = initialGcState()
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')
    if (!fairOaks) throw new Error('fixture has no fairoaksd')
    const site = spreadMarkup(ownerPayApp(state, fairOaks).lines).find((l) => l.id === 'fsite')
    expect(Object.is(site?.thisMonth, 0)).toBe(true)
  })

  it('spreads a sent bill the same way, from what it said when it went', () => {
    const state = initialGcState()
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')
    if (!fairOaks) throw new Error('fixture has no fairoaksd')
    const lines = sentPayAppLines(state, fairOaks, 3)
    const spread = spreadMarkup(lines)
    expect(sum(spread, 'doneToDate')).toBe(956_327.91)
    expect(sum(spread, 'doneBefore')).toBe(635_351.79)
  })
})

describe('our own crew on Bill the owner, read from Draws', () => {
  const plumbingLine = (state: GcState) => {
    const project = state.projects.find((p) => p.id === 'fairoaksd')
    if (!project) throw new Error('fixture has no fairoaksd')
    return ownerPayApp(state, project).lines.find((l) => l.id === 'fplumb')
  }

  it('shows the stages as Draws keeps them, and bills the same number', () => {
    const line = plumbingLine(initialGcState())
    expect([line?.source, line?.doneToDate, line?.crewPct]).toEqual(['Our own crew reported 65% done, by stage.', 72_800, 65])
    expect(line?.detail).toEqual([
      { label: 'Underground', pct: 100 },
      { label: 'Rough in', pct: 100 },
      { label: 'Top out', pct: 40 },
      { label: 'Trim', pct: 0 },
    ])
  })

  it('follows a stage reported on Draws', () => {
    const state = gcReducer(initialGcState(), { type: 'selfReportStage', projectId: 'fairoaksd', packageId: 'fplumb', lineId: 'fplumb-3', pct: 100 })
    const line = plumbingLine(state)
    expect([line?.crewPct, line?.doneToDate, line?.detail[2]]).toEqual([80, 89_600, { label: 'Top out', pct: 100 }])
  })
})

describe('change orders to the owner', () => {
  const helotesOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('fixture has no helotes')
    return p
  }
  const draft = (state: GcState, cost: number, price = 0) =>
    gcReducer(state, { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add sound batts to operatory 3', reason: 'owner', schedule: '+1 working day', packageId: 'dry', cost, price })
  const signedOne = () => {
    let state = draft(initialGcState(), 4_800)
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    return gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
  }

  it('carries the days it adds; only signed ones add to the contract time', () => {
    const withDays = (days?: number) =>
      gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'helotes', description: 'Bulletin 1, Drywall: rated wall at the X-ray room', reason: 'plans', schedule: '', packageId: 'dry', cost: 4_800, price: 0, days })
    let state = withDays(5)
    const co = helotesOf(state).changeOrders?.[0]
    expect([co?.days, co?.schedule, co && changeOrderScheduleWords(co)]).toEqual([5, '+5 days', 'adds 5 days to the job'])
    expect(contractDaysAdded(helotesOf(state))).toBe(0)
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(contractDaysAdded(helotesOf(state))).toBe(0)
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(contractDaysAdded(helotesOf(state))).toBe(5)
    for (const none of [undefined, 0, -3]) {
      const c = helotesOf(withDays(none)).changeOrders?.[0]
      expect([c && 'days' in c, c?.schedule, c && changeOrderScheduleWords(c)]).toEqual([false, 'none', 'no days added'])
    }
    const said = helotesOf(draft(initialGcState(), 4_800)).changeOrders?.[0]
    expect(said && changeOrderScheduleWords(said)).toBe('schedule: +1 working day')
  })

  it('a signed one pushes back substantial completion by its days (question 28)', () => {
    const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'fairoaksd', description: 'A second drive-through lane', reason: 'owner', schedule: '', packageId: 'fsite', cost: 12_000, price: 0, days: 5 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    expect(substantialCompletionOn(fairOaks(state))).toEqual({ planned: '2026-12-11', days: 0, on: '2026-12-11' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    expect(substantialCompletionOn(fairOaks(state))).toEqual({ planned: '2026-12-11', days: 5, on: '2026-12-16' })
  })

  it('prices at the cost plus the job fee, unless typed', () => {
    expect(changeOrderPrice(helotesOf(initialGcState()), 4_800)).toBe(5_280)
    expect(helotesOf(draft(initialGcState(), 4_800)).changeOrders?.[0]).toMatchObject({ id: 'co-1', number: 1, price: 5_280, status: 'draft', pctDone: 0 })
    expect(helotesOf(draft(initialGcState(), 4_800, 6_000)).changeOrders?.[0]?.price).toBe(6_000)
  })

  it('changes nothing on the bill until the owner signs', () => {
    const before = ownerPayApp(initialGcState(), helotesOf(initialGcState()))
    let state = draft(initialGcState(), 4_800)
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    const sent = ownerPayApp(state, helotesOf(state))
    expect([sent.contract, sent.changeOrdersTotal, sent.lines.length]).toEqual([before.contract, 0, before.lines.length])
  })

  it('a signed one raises the price and is its own line, not spread', () => {
    let state = signedOne()
    const before = ownerPayApp(initialGcState(), helotesOf(initialGcState()))
    let app = ownerPayApp(state, helotesOf(state))
    expect([Math.round(app.contract - before.contract), Math.round(app.originalContract), app.changeOrdersTotal]).toEqual([5_280, Math.round(before.contract), 5_280])
    const line = app.lines.find((l) => l.id === 'co-1')
    expect(line && [line.label, line.kind, line.worth, line.doneToDate]).toEqual(['Change order 1', 'changeOrder', 5_280, 0])
    state = gcReducer(state, { type: 'setChangeOrderPct', projectId: 'helotes', changeOrderId: 'co-1', pct: 100 })
    app = ownerPayApp(state, helotesOf(state))
    expect(app.lines.find((l) => l.id === 'co-1')?.doneToDate).toBe(5_280)
    expect(Math.round(app.doneToDate - before.doneToDate)).toBe(5_280)
    const spread = spreadMarkup(app.lines)
    expect(spread.find((l) => l.id === 'co-1')).toMatchObject({ worth: 5_280, doneToDate: 5_280, ourShare: 0 })
    expect(Math.round(markupOnTop(app.lines) * 1000) / 10).toBe(37.2)
  })

  it('bills a change the trade signed once: on its own line, not again on the trade\'s', () => {
    let state = signedOne()
    state = gcReducer(state, { type: 'sendTradeChange', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: 'co-1' })
    const dryOf = (st: GcState) => ownerPayApp(st, helotesOf(st)).lines.find((l) => l.id === 'dry')
    const before = dryOf(state)
    const lineId = helotesOf(state).packages.find((p) => p.id === 'dry')?.sow?.sov.find((l) => l.changeOrderId === 'co-1')?.id
    expect(lineId).toBeDefined()
    state = gcReducer(state, { type: 'tradeReport', projectId: 'helotes', packageId: 'dry', sovId: lineId ?? '', pct: 100 })
    const after = dryOf(state)
    expect([after?.doneToDate, after?.worth, after?.source]).toEqual([before?.doneToDate, 64_200, before?.source])
    expect(after?.detail.map((d) => d.label)).toEqual(['Framing', 'Hang and tape', 'Ceilings'])
    // The change order's own line reads the trade's report, and the hand-set percent no longer applies.
    const co = ownerPayApp(state, helotesOf(state)).lines.find((l) => l.id === 'co-1')
    expect([co?.doneToDate, co?.source.endsWith('Hill Country Interiors reported 100% done.')]).toEqual([5_280, true])
    expect(gcReducer(state, { type: 'setChangeOrderPct', projectId: 'helotes', changeOrderId: 'co-1', pct: 20 })).toBe(state)
  })

  it('a declined credit never reaches the bill', () => {
    let state = draft(initialGcState(), -1_200)
    expect(helotesOf(state).changeOrders?.[0]?.price).toBe(-1_320)
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerDeclineChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(helotesOf(state).changeOrders?.[0]?.status).toBe('declined')
    expect(ownerPayApp(state, helotesOf(state)).changeOrdersTotal).toBe(0)
  })

  it('keeps each step in order', () => {
    const fresh = initialGcState()
    expect(gcReducer(fresh, { type: 'draftChangeOrder', projectId: 'boerne', description: 'x', reason: 'owner', schedule: '', packageId: null, cost: 100, price: 0 })).toBe(fresh)
    expect(draft(fresh, 0)).toBe(fresh)
    const drafted = draft(fresh, 4_800)
    expect(gcReducer(drafted, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })).toBe(drafted)
    expect(gcReducer(drafted, { type: 'setChangeOrderPct', projectId: 'helotes', changeOrderId: 'co-1', pct: 50 })).toBe(drafted)
    const signed = signedOne()
    expect(gcReducer(signed, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })).toBe(signed)
  })
})

describe('our pay application as the form (G702 and G703)', () => {
  const projectOf = (state: GcState, id: string) => {
    const p = state.projects.find((x) => x.id === id)
    if (!p) throw new Error(`fixture has no ${id}`)
    return p
  }
  const cents = (n: number) => Math.round(n * 100) / 100

  it('reads Fair Oaks D pay application 3 line by line', () => {
    const state = initialGcState()
    const form = ownerPayAppForm(state, projectOf(state, 'fairoaksd'), 3)
    if (!form) throw new Error('no form')
    const s = form.app.summary
    expect([s.originalSum, s.changeOrders, s.sumToDate].map(cents)).toEqual([1_488_762, 0, 1_488_762])
    expect([s.completedToDate, s.retainage, s.earnedLessRetainage, s.previousCertificates, s.currentDue, s.balanceToFinish].map(cents)).toEqual([
      956_327.91, 95_632.79, 860_695.12, 571_816.61, 288_878.51, 628_066.88,
    ])
    // Seven trades, our costs and fee spread into them; no line of their own.
    expect(form.app.lines.map((l) => l.sovId)).toEqual(['fsite', 'fconc', 'fsteel', 'felec', 'froof', 'fplumb', 'fhvac'])
    expect(cents(form.app.totals.toDate)).toBe(956_327.91)
    expect(form.app.lines.filter((l) => l.pct === 100).map((l) => Object.is(l.balance, 0))).toEqual([true, true])
    expect([form.periodTo, form.sentOn, form.contractDate]).toEqual(['2026-09-25', '2026-09-25', '2026-06-02'])
    expect(ownerPayAppForm(state, projectOf(state, 'fairoaksd'), 9)).toBeNull()
  })

  it('puts a signed change order on line 2, and not on a bill that went before it', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add sound batts to operatory 3', reason: 'owner', schedule: 'none', packageId: 'dry', cost: 4_800, price: 0 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    const helotes = projectOf(state, 'helotes')
    const first = ownerPayAppForm(state, helotes, 1)
    expect([first?.app.summary.changeOrders, first?.app.lines.some((l) => l.sovId === 'co-1')]).toEqual([0, false])
    const next = ownerPayAppForm(state, helotes, 'draft')
    expect([next?.app.number, next?.sentOn, next?.app.summary.changeOrders, Math.round(next?.app.summary.originalSum ?? 0)]).toEqual([2, null, 5_280, 338_767])
    expect(next?.changeOrders).toEqual([{ number: 1, description: 'Add sound batts to operatory 3', price: 5_280 }])
  })

  it('shows the final pay application with nothing held', () => {
    let state = gcReducer(initialGcState(), {
      type: 'tradeSendFinalPayApp',
      projectId: 'stoneoak',
      packageId: 'shvac',
      periodTo: '2026-10-02',
      address: '1188 Culebra Rd, San Antonio, TX 78201',
      license: '',
      signedBy: 'Andre Wallace',
      signedTitle: 'Owner',
    })
    state = gcReducer(state, { type: 'ownerAcceptsWork', projectId: 'stoneoak' })
    state = gcReducer(state, { type: 'sendOwnerFinalPayApp', projectId: 'stoneoak' })
    const form = ownerPayAppForm(state, projectOf(state, 'stoneoak'), 4)
    expect([form?.app.final, form?.app.summary.retainage, form?.app.totals.retainage, cents(form?.app.summary.currentDue ?? 0)]).toEqual([true, 0, 0, 18_241.3])
  })
})

describe('money in and money out on a job', () => {
  const projectOf = (state: GcState, id: string) => {
    const p = state.projects.find((x) => x.id === id)
    if (!p) throw new Error(`fixture has no ${id}`)
    return p
  }
  const cents = (n: number) => Math.round(n * 100) / 100

  it('reads Stone Oak: the owner paid three bills, the trades were paid, two asked for their retainage', () => {
    const state = initialGcState()
    const cash = projectCash(state, projectOf(state, 'stoneoak'))
    expect([cents(cash.in.paid), cash.in.owed, cents(cash.in.held)]).toEqual([164_171.7, 0, 18_241.3])
    expect(cash.out).toEqual({ paid: 99_900, approved: 0, asked: 8_000, held: 11_100 })
    expect(cents(cash.net)).toBe(64_271.7)
    expect(cash.byTrade.map((t) => t.company)).toEqual(['Live Oak Drywall', 'Westside Electric', 'Cool Breeze Mechanical'])
    expect(cash.ownCrew).toEqual(['Plumbing'])
  })

  it('starts Helotes with nothing billed, so we carry the framing we paid for, until the owner pays', () => {
    let state = initialGcState()
    const before = projectCash(state, projectOf(state, 'helotes'))
    expect([before.in.paid, before.in.owed, before.in.held, before.out.paid, before.net]).toEqual([0, 0, 0, 19_800, -19_800])
    state = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })
    const after = projectCash(state, projectOf(state, 'helotes'))
    expect([Math.round(after.in.paid), after.in.owed, Math.round(after.net)]).toEqual([47_301, 0, 27_501])
  })

  it('a draw we pay moves money out, and where we stand', () => {
    let state = gcReducer(initialGcState(), { type: 'tradeRequestDraw', projectId: 'helotes', packageId: 'dry' })
    expect(projectCash(state, projectOf(state, 'helotes')).out.asked).toBe(14_688)
    state = gcReducer(state, { type: 'approveDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' })
    expect(projectCash(state, projectOf(state, 'helotes')).out.approved).toBe(14_688)
    state = gcReducer(state, { type: 'payDraw', projectId: 'helotes', packageId: 'dry', drawId: 'dry-draw-2' })
    const cash = projectCash(state, projectOf(state, 'helotes'))
    expect([cash.out.paid, cash.out.approved, cash.net]).toEqual([34_488, 0, -34_488])
  })
})

describe('the architect certifies first', () => {
  const helotesOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('fixture has no helotes')
    return p
  }
  const sent = () => gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })

  it('a bill waits on the architect until certified', () => {
    const state = sent()
    const app = helotesOf(state).ownerBilling?.payApps?.[0]
    expect([app?.certified, app?.certifiedOn]).toEqual([null, null])
    const account = ownerAccount(helotesOf(state))
    expect([Math.round(account?.waitingOnArchitect ?? 0), account?.certifiedUnpaid]).toEqual([47_301, 0])
  })

  it('certified for less: the owner pays that, our waiver names it, and the rest comes back on the next bill', () => {
    let state = gcReducer(sent(), { type: 'architectCertify', projectId: 'helotes', number: 1, amount: 40_000, note: 'Ceilings are not hung yet.' })
    const app = helotesOf(state).ownerBilling?.payApps?.[0]
    expect([app?.certified, app?.certifiedOn, app?.certifiedNote]).toEqual([40_000, '2026-10-02', 'Ceilings are not hung yet.'])
    expect(gcReducer(state, { type: 'architectCertify', projectId: 'helotes', number: 1, amount: 47_301, note: '' })).toBe(state)
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })
    const account = ownerAccount(helotesOf(state))
    expect([account?.paid, account?.owed]).toEqual([40_000, 0])
    expect(ourOwnerWaivers(helotesOf(state))[0]).toMatchObject({ kind: 'unconditional', amount: 40_000 })
    // No new work, yet the next bill asks for what the architect cut: line 7 counts the certificate.
    const next = ownerPayApp(state, helotesOf(state))
    expect([Math.round(next.askedBefore), Math.round(next.due)]).toEqual([40_000, 7_301])
    expect(Math.round(ownerCarriedForward(next))).toBe(7_301)
    const form = ownerPayAppForm(state, helotesOf(state), 1)
    expect([form?.certificate.amount, form?.certificate.note]).toEqual([40_000, 'Ceilings are not hung yet.'])
  })

  it('never certifies more than asked', () => {
    const state = gcReducer(sent(), { type: 'architectCertify', projectId: 'helotes', number: 1, amount: 999_999, note: '' })
    const app = helotesOf(state).ownerBilling?.payApps?.[0]
    expect(app?.certified).toBe(app?.due)
  })
})

describe('when the owner pays: late, short, or on their word', () => {
  const projectOf = (state: GcState, id: string) => {
    const p = state.projects.find((x) => x.id === id)
    if (!p) throw new Error(`fixture has no ${id}`)
    return p
  }
  const certified = () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'architectCertify', projectId: 'helotes', number: 1, amount: 40_000, note: 'Ceilings are not hung yet' })
    return state
  }

  it('a part payment leaves the rest open, and each payment has its own waiver', () => {
    let state = gcReducer(certified(), { type: 'ownerPayPart', projectId: 'helotes', number: 1, amount: 15_000 })
    let account = ownerAccount(projectOf(state, 'helotes'))
    expect([account?.paid, account?.owed, account?.certifiedUnpaid]).toEqual([15_000, 25_000, 25_000])
    expect(projectOf(state, 'helotes').ownerBilling?.payApps?.[0]?.paidOn).toBeNull()
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'helotes', number: 1 })
    account = ownerAccount(projectOf(state, 'helotes'))
    expect([account?.paid, account?.owed]).toEqual([40_000, 0])
    const unconditional = ourOwnerWaivers(projectOf(state, 'helotes')).filter((w) => w.kind === 'unconditional').map((w) => w.amount)
    expect(unconditional.sort((a, b) => a - b)).toEqual([15_000, 25_000])
  })

  it('a part payment of everything open closes the bill; nothing more is taken', () => {
    const state = gcReducer(certified(), { type: 'ownerPayPart', projectId: 'helotes', number: 1, amount: 99_999 })
    const app = projectOf(state, 'helotes').ownerBilling?.payApps?.[0]
    expect([app?.paidOn, app?.payments]).toEqual(['2026-10-02', [{ on: '2026-10-02', amount: 40_000 }]])
    expect(gcReducer(state, { type: 'ownerPayPart', projectId: 'helotes', number: 1, amount: 10 })).toBe(state)
    expect(gcReducer(certified(), { type: 'ownerPayPart', projectId: 'helotes', number: 1, amount: 0 })).toEqual(certified())
  })

  it('their word sets the day; Fair Oaks D is two days past Cibolo\'s', () => {
    const state = gcReducer(certified(), { type: 'ownerPromisePay', projectId: 'helotes', number: 1, by: '2026-10-28', note: 'Dr. Raman, on the phone', who: 'office' })
    const app = projectOf(state, 'helotes').ownerBilling?.payApps?.[0]
    if (!app) throw new Error('no app')
    expect(ownerPayDue(state, projectOf(state, 'helotes'), app)).toEqual({ on: '2026-10-28', promised: true, daysLate: 0, missed: 0 })
    const fresh = initialGcState()
    const late = ownerLateBills(fresh, projectOf(fresh, 'fairoaksd'))
    expect(late.map((b) => [b.app.number, b.due.on, b.due.promised, b.due.daysLate, Math.round(b.open * 100) / 100])).toEqual([[3, '2026-09-30', true, 2, 288_878.51]])
    expect(gcReducer(fresh, { type: 'ownerPromisePay', projectId: 'fairoaksd', number: 3, by: 'soon', note: '', who: 'office' })).toBe(fresh)
  })

  it('a new day after a missed one: no longer late, but the miss stays on the record', () => {
    const state = gcReducer(initialGcState(), { type: 'ownerPromisePay', projectId: 'fairoaksd', number: 3, by: '2026-10-09', note: 'Checks go out next Friday', who: 'office' })
    const app = projectOf(state, 'fairoaksd').ownerBilling?.payApps?.[2]
    if (!app) throw new Error('no app')
    expect(ownerPayDue(state, projectOf(state, 'fairoaksd'), app)).toEqual({ on: '2026-10-09', promised: true, daysLate: 0, missed: 1 })
  })
})

describe('money across every job', () => {
  const r = (n: number) => Math.round(n)

  it('adds up only the jobs that are ours: we are $80,428 ahead, and Cibolo owes us', () => {
    const state = initialGcState()
    const m = allJobsMoney(state)
    expect(m.jobs.map((j) => j.project.id)).toEqual(['helotes', 'fairoaksd', 'stoneoak'])
    expect(state.projects.length).toBeGreaterThan(m.jobs.length)
    const t = m.totals
    expect([t.paidIn, t.paidOut, t.net, t.owed, t.ownerHolds, t.weHold, t.tradesWaiting].map(r)).toEqual([
      735_988, 655_560, 80_428, 288_879, 113_874, 72_840, 127_700,
    ])
    expect(m.jobs.map((j) => r(j.cash.net))).toEqual([-19_800, 35_957, 64_272])
    expect(m.owed.map((b) => [b.project.id, b.app.number, r(b.open), b.due.daysLate, b.waitingOnArchitect])).toEqual([['fairoaksd', 3, 288_879, 2, false]])
  })

  it('puts a late bill first and one waiting on the architect last; a paid bill leaves the list', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    expect(allJobsMoney(state).owed.map((b) => [b.project.id, b.waitingOnArchitect])).toEqual([
      ['fairoaksd', false],
      ['helotes', true],
    ])
    state = gcReducer(state, { type: 'ownerPaid', projectId: 'fairoaksd', number: 3 })
    const m = allJobsMoney(state)
    expect(m.owed.map((b) => b.project.id)).toEqual(['helotes'])
    expect(r(m.totals.paidIn)).toBe(735_988 + 288_879)
  })
})

describe('the next weeks of money across every job', () => {
  const r = (n: number) => Math.round(n)
  const line = (a: ReturnType<typeof cashAhead>) => a.weeks.map((w) => [w.start, r(w.in), r(w.out), r(w.standing)])

  it('says how many days away each later week starts, counting to its Monday (the owner, 2026-10-04)', () => {
    // Today is Fri Oct 2: next week's Monday, Oct 5, is 3 days away.
    expect(cashAhead(initialGcState()).weeks.map((w) => w.daysAway)).toEqual([-4, 3, 10, 17, 24, 31])
    // On a Sunday the next Monday is 1 day away, as in the owner's example.
    expect(cashAhead({ ...initialGcState(), today: '2026-10-04' }).weeks.slice(1, 3).map((w) => w.daysAway)).toEqual([1, 8])
  })

  it('counts what is on the books: the two draws asked at Fair Oaks D take us to $39,272 carrying', () => {
    const a = cashAhead(initialGcState(), { countExpected: false })
    expect(r(a.standingNow)).toBe(80_428)
    expect(line(a)).toEqual([
      ['2026-09-28', 0, 0, 80_428],
      ['2026-10-05', 0, 0, 80_428],
      ['2026-10-12', 0, 119_700, -39_272],
      ['2026-10-19', 0, 0, -39_272],
      ['2026-10-26', 0, 0, -39_272],
      ['2026-11-02', 0, 0, -39_272],
    ])
    expect(a.lowest?.start).toBe('2026-10-12')
    expect(a.weeks[2]?.moves.map((m) => [m.who, m.why, m.on])).toEqual([
      ['Iron Horse Fabrication', 'ifApprovedToday', '2026-10-12'],
      ['Pecan Valley Electric', 'ifApprovedToday', '2026-10-12'],
    ])
    expect(a.late.map((m) => [m.who, r(m.amount), m.on])).toEqual([['Cibolo Creek Partners', 288_879, '2026-09-30']])
  })

  it('counts the late bill this week only when asked, and then never drops below today', () => {
    const a = cashAhead(initialGcState(), { countLate: true, countExpected: false })
    expect(line(a).map((w) => w[3])).toEqual([369_307, 369_307, 249_607, 249_607, 249_607, 249_607])
    expect(a.lowest).toBeNull()
  })

  it('keeps retainage on both sides out of the weeks until it has a day, the same totals as the Money tab', () => {
    const state = initialGcState()
    // Every bar at what it reported (G-140): the cash weeks as they counted before the schedule.
    const a = cashAhead(state, { bars: 'reported' })
    const t = allJobsMoney(state).totals
    const held = (dir: 'in' | 'out') => r(a.noDay.filter((m) => m.dir === dir).reduce((s, m) => s + m.amount, 0))
    expect([held('in'), held('out')]).toEqual([r(t.ownerHolds), r(t.weHold)])
    expect([a.nextBills.on, r(a.nextBills.amount), a.nextBills.jobs]).toEqual(['2026-10-25', 145_868, 2])
  })

  it('an approved draw counts on its pay-by day; a paid one leaves the weeks', () => {
    const fresh = initialGcState()
    const pkg = fresh.projects.find((p) => p.id === 'fairoaksd')?.packages.find((k) => k.sow?.draws.some((d) => d.status === 'requested' && d.net === 79_200))
    const drawId = pkg?.sow?.draws.find((d) => d.status === 'requested')?.id ?? ''
    const ids = { projectId: 'fairoaksd', packageId: pkg?.id ?? '', drawId }
    let state = gcReducer(fresh, { type: 'approveDraw', ...ids })
    const approved = cashAhead(state, { bars: 'reported' }).weeks.flatMap((w) => w.moves).find((m) => m.who === 'Iron Horse Fabrication')
    expect([approved?.why, approved?.on]).toEqual(['payBy', '2026-10-12'])
    state = gcReducer(state, { type: 'payDraw', ...ids })
    const a = cashAhead(state, { bars: 'reported' })
    expect(a.weeks.flatMap((w) => w.moves).some((m) => m.who === 'Iron Horse Fabrication')).toBe(false)
    expect(r(a.standingNow)).toBe(80_428 - 79_200)
  })
})

describe('the owner’s price stays what they signed', () => {
  const mill = (project: GcProject, budget: number): GcProject => ({
    ...project,
    packages: project.packages.map((k) => (k.id === 'mill' ? { ...k, awardedInviteId: null, carried: 'plug' as const, budget } : k)),
  })

  it('keeps Helotes at the $338,767 Dr. Raman signed when we buy a trade out for less', () => {
    const { state, project } = helotes()
    expect([ownerPayApp(state, project).contract, ownerContractPrice(project)]).toEqual([338_767, 338_767])
    const cheaper = mill(project, 30_000)
    const app = ownerPayApp(state, cheaper)
    expect([app.contract, app.lines.find((l) => l.id === 'mill')?.worth]).toEqual([338_767, 39_800])
    // Before it was kept, the price followed what we carry.
    const { ownerContractWorth: _kept, ...floating } = cheaper
    expect(Math.round(ownerPayApp(state, floating).contract)).toBeLessThan(338_767)
    expect(ownerContractWorthNow(floating).mill).toBe(30_000)
  })

  it('is the same price the Board shows (`priceToOwner`), change orders included', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add a sink', reason: 'owner', schedule: '', packageId: 'dry', cost: 4_800, price: 0 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    const r = (n: number) => Math.round(n * 100) / 100
    for (const project of state.projects.filter((p) => p.ownerContractSignedOn)) {
      expect([project.id, r(ownerPayApp(state, project).contract)]).toEqual([project.id, r(priceToOwner(project).price)])
    }
  })

  it('bills a trade its share done of what the owner signed for it', () => {
    const { state, project } = helotes()
    const was = ownerPayApp(state, project).lines.find((l) => l.id === 'dry')
    const more = { ...project, ownerContractWorth: { ...project.ownerContractWorth, dry: 70_000 } }
    const now = ownerPayApp(state, more).lines.find((l) => l.id === 'dry')
    expect(Math.round(((now?.doneToDate ?? 0) / 70_000) * 1000)).toBe(Math.round(((was?.doneToDate ?? 0) / 64_200) * 1000))
    expect(now?.source).toBe(was?.source)
  })

  it('a trade that came after they signed is worth nothing on it: its change order bills it', () => {
    const { state, project } = helotes()
    const { mill: _gone, ...kept } = project.ownerContractWorth ?? {}
    const app = ownerPayApp(state, { ...project, ownerContractWorth: kept })
    expect([app.lines.find((l) => l.id === 'mill')?.worth, app.contract]).toEqual([0, 338_767 - 39_800])
  })
})

describe('retainage that drops partway, ours to choose per job', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
  const step = (way: 'after' | 'all') => ({ atPct: 50, toPct: 5, way })
  const r = (n: number) => Math.round(n)

  it('holds the full percent to the point, then the lower one on the rest or on all of it', () => {
    expect(ownerRetainageOn(10, undefined, 640_000, 1_000_000)).toBe(64_000)
    expect(ownerRetainageOn(10, step('after'), 640_000, 1_000_000)).toBe(57_000)
    expect(ownerRetainageOn(10, step('all'), 640_000, 1_000_000)).toBe(32_000)
    expect(ownerRetainageOn(10, step('all'), 400_000, 1_000_000)).toBe(40_000)
    expect(ownerRetainageWords(10, undefined)).toBe('10% of every bill until the end')
    expect(ownerRetainageWords(10, step('after'))).toBe('10% until the work is half done, then 5% on the rest')
    expect(ownerRetainageWords(10, { atPct: 75, toPct: 0, way: 'all' })).toBe('10% until the work is 75% done, then 0% on all of it')
  })

  it('on Fair Oaks D, past half done, dropping on all of it puts what comes back on the next bill', () => {
    const before = ownerPayApp(initialGcState(), fairOaks(initialGcState()))
    const state = gcReducer(initialGcState(), { type: 'setOwnerRetainageStep', projectId: 'fairoaksd', step: step('all') })
    const after = ownerPayApp(state, fairOaks(state))
    expect(r(after.retainage)).toBe(r(after.doneToDate * 0.05))
    expect(r(after.due - before.due)).toBe(r(before.retainage - after.retainage))
    expect(ownerCarriedForward(after)).toBe(ownerCarriedForward(before))
  })

  it('goes out on the bill: the form says it and each line holds its share', () => {
    let state = gcReducer(initialGcState(), { type: 'setOwnerRetainageStep', projectId: 'fairoaksd', step: step('after') })
    state = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'fairoaksd' })
    const lastOf = (st: GcState) => {
      const apps = fairOaks(st).ownerBilling?.payApps ?? []
      return apps[apps.length - 1]
    }
    const sent = lastOf(state)
    expect(sent?.retainageStep).toEqual(step('after'))
    const form = sent && ownerPayAppForm(state, fairOaks(state), sent.number)
    expect(form?.retainageWords).toBe('10% until the work is half done, then 5% on the rest')
    expect(r(form?.app.lines.reduce((t, l) => t + l.retainage, 0) ?? 0)).toBe(r(sent?.retainage ?? 0))
    // Changing the step later leaves the bill that went as it went.
    state = gcReducer(state, { type: 'setOwnerRetainageStep', projectId: 'fairoaksd', step: null })
    expect(lastOf(state)?.retainageStep).toEqual(step('after'))
    expect(fairOaks(state).ownerRetainageStep).toBeUndefined()
  })

  it('only on a job that is ours, and only ever lower than the owner’s percent', () => {
    const fresh = initialGcState()
    for (const bad of [
      { projectId: 'fairoaksd', step: { atPct: 50, toPct: 10, way: 'after' as const } },
      { projectId: 'fairoaksd', step: { atPct: 0, toPct: 5, way: 'after' as const } },
      { projectId: 'fairoaksd', step: { atPct: 100, toPct: 5, way: 'all' as const } },
      { projectId: 'boerne', step: step('after') },
      { projectId: 'fairoaksd', step: null },
    ]) {
      expect(gcReducer(fresh, { type: 'setOwnerRetainageStep', ...bad })).toBe(fresh)
    }
  })
})

describe('interest on late bills, ours to choose per job', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
  const charged = (pct = 1.5) => gcReducer(initialGcState(), { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: pct })
  const cents = (n: number) => Math.round(n * 100) / 100
  const perDay = (pct: number) => ((pct / 100) * 12) / 365

  it('is off until we choose it', () => {
    const state = initialGcState()
    expect(ownerInterest(state, fairOaks(state))).toMatchObject({ pctPerMonth: null, bills: [], builtUp: 0, toBill: 0 })
  })

  it('runs from the first day it was due: Cibolo’s promise of Sep 30, two days late on what was certified', () => {
    const state = charged()
    const i = ownerInterest(state, fairOaks(state))
    expect(i.bills.map((b) => [b.app.number, b.from, b.days])).toEqual([[3, '2026-09-30', 2]])
    expect(cents(i.builtUp)).toBe(cents(288_878.51 * perDay(1.5) * 2))
    // A later promise does not move the day it runs from.
    const later = gcReducer(state, { type: 'ownerPromisePay', projectId: 'fairoaksd', number: 3, by: '2026-10-09', note: 'Next Friday', who: 'office' })
    expect(ownerInterestFrom(later, fairOaks(later), fairOaks(later).ownerBilling?.payApps?.[2] as OwnerPayAppSent)).toBe('2026-09-30')
  })

  it('runs on what is still open: a part payment lowers it from that day', () => {
    let state = charged()
    state = gcReducer({ ...state, today: '2026-10-02' }, { type: 'ownerPayPart', projectId: 'fairoaksd', number: 3, amount: 88_878.51 })
    state = { ...state, today: '2026-10-12' }
    const b = ownerInterest(state, fairOaks(state)).bills[0]
    expect([b?.days, cents(b?.amount ?? 0)]).toEqual([12, cents(288_878.51 * perDay(1.5) * 2 + 200_000 * perDay(1.5) * 10)])
  })

  it('goes on a bill of its own; the owner pays it and it counts as money in', () => {
    let state = gcReducer(charged(), { type: 'sendOwnerInterestBill', projectId: 'fairoaksd' })
    const sent = fairOaks(state).ownerBilling?.interestBills ?? []
    expect(sent.map((b) => [b.number, b.sentOn, b.paidOn])).toEqual([[1, '2026-10-02', null]])
    const i = ownerInterest(state, fairOaks(state))
    expect([cents(i.toBill), cents(i.owed)]).toEqual([0, sent[0]?.amount])
    // Nothing more to bill until more builds up.
    expect(gcReducer(state, { type: 'sendOwnerInterestBill', projectId: 'fairoaksd' })).toBe(state)
    const before = projectCash(state, fairOaks(state)).in.paid
    state = gcReducer(state, { type: 'ownerPaidInterest', projectId: 'fairoaksd', number: 1 })
    expect(cents(projectCash(state, fairOaks(state)).in.paid - before)).toBe(sent[0]?.amount)
    expect(ownerInterest(state, fairOaks(state)).owed).toBe(0)
  })

  it('only on a job that is ours, at a rate above 0% and up to 5% a month', () => {
    const fresh = initialGcState()
    for (const bad of [
      { projectId: 'fairoaksd', pctPerMonth: 0 },
      { projectId: 'fairoaksd', pctPerMonth: 6 },
      { projectId: 'boerne', pctPerMonth: 1.5 },
      { projectId: 'fairoaksd', pctPerMonth: null },
    ]) {
      expect(gcReducer(fresh, { type: 'setOwnerLateInterest', ...bad })).toBe(fresh)
    }
    const state = gcReducer(charged(), { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: null })
    expect(fairOaks(state).ownerLateInterest).toBeUndefined()
  })
})

describe('materials stored on site, from the trades’ pay applications (question 12)', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
  const stored = () =>
    gcReducer(initialGcState(), {
      type: 'tradeSendPayApp',
      projectId: 'fairoaksd',
      packageId: 'fhvac',
      toPct: { 'fhvac-2': 100 },
      stored: { 'fhvac-1': 36_000 },
      periodTo: '2026-10-02',
      address: '1188 Culebra Rd, San Antonio, TX 78201',
      license: '',
      signedBy: 'Marco Ruiz',
      signedTitle: 'Owner',
    })
  const r = (n: number) => Math.round(n)

  it('rolls Cool Breeze’s stored rooftop units into its line, and the bill holds and asks on them', () => {
    const before = ownerPayApp(initialGcState(), fairOaks(initialGcState()))
    const state = stored()
    const app = ownerPayApp(state, fairOaks(state))
    const hvac = app.lines.find((l) => l.id === 'fhvac')
    expect(r(hvac?.stored ?? 0)).toBe(36_000)
    expect(r(app.stored)).toBe(36_000)
    // Line 4 counts it, the owner holds 10% of it, and the rest is on this bill.
    expect(r(app.retainage - before.retainage - (app.doneToDate - before.doneToDate) * 0.1)).toBe(3_600)
    expect(ownerCarriedForward(app)).toBe(ownerCarriedForward(before))
  })

  it('goes on the 703 in column F, and the bill keeps it once sent', () => {
    let state = stored()
    const draft = ownerPayAppForm(state, fairOaks(state), 'draft')
    const hvacRow = draft?.app.lines.find((l) => l.sovId === 'fhvac')
    expect(r(hvacRow?.stored ?? 0)).toBe(r(ownerPayApp(state, fairOaks(state)).lines.find((l) => l.id === 'fhvac')?.stored ?? 0))
    expect(r(draft?.app.totals.stored ?? 0)).toBe(36_000)
    expect(r(draft?.app.summary.completedToDate ?? 0)).toBe(r(draft?.app.totals.toDate ?? 0))
    state = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'fairoaksd' })
    const apps = fairOaks(state).ownerBilling?.payApps ?? []
    const sent = apps[apps.length - 1]
    expect(r(sent?.storedByLine?.fhvac ?? 0)).toBe(36_000)
    const form = sent && ownerPayAppForm(state, fairOaks(state), sent.number)
    expect(r(form?.app.totals.stored ?? 0)).toBe(36_000)
    expect(r(sent?.workToDate ?? 0)).toBe(r(form?.app.totals.toDate ?? 0))
  })
})

describe('finishing late against the owner contract', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
  const pushedOut = (project: GcProject, days: number): GcProject => {
    const acts = project.schedule?.activities ?? []
    const lastFinish = acts.reduce((m, a) => (a.finish > m ? a.finish : m), '')
    const moved = (iso: string) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10)
    return project.schedule
      ? { ...project, schedule: { ...project.schedule, activities: acts.map((a) => (a.finish === lastFinish ? { ...a, finish: moved(a.finish) } : a)) } }
      : project
  }

  it('Fair Oaks D finishes on the contract day at today’s pace: three days behind, none to spare', () => {
    const state = initialGcState()
    const f = ownerFinishRisk(state, fairOaks(state))
    expect([f.contract?.on, f.schedule?.on, f.schedule?.from, f.schedule?.behind, f.past, f.atRisk]).toEqual(['2026-12-11', '2026-12-11', 'pace', 3, 0, 0])
  })

  it('a signed change order with days gives days to spare', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'fairoaksd', description: 'A second drive-through lane', reason: 'owner', schedule: '', packageId: 'fsite', cost: 12_000, price: 0, days: 5 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    expect(ownerFinishRisk(state, fairOaks(state)).past).toBe(-5)
  })

  it('a plan past the contract day costs the contract’s late fee a day', () => {
    const state = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: 500 })
    const f = ownerFinishRisk(state, pushedOut(fairOaks(state), 9))
    expect([f.schedule?.on, f.schedule?.from, f.past, f.perDay, f.atRisk]).toEqual(['2026-12-17', 'plan', 6, 500, 3_000])
  })

  it('the fee is ours to enter: whole dollars above zero, or none, on a job that is ours', () => {
    const fresh = initialGcState()
    for (const bad of [
      { projectId: 'fairoaksd', perDay: 0 },
      { projectId: 'boerne', perDay: 500 },
      { projectId: 'fairoaksd', perDay: null },
    ]) {
      expect(gcReducer(fresh, { type: 'setOwnerLateFinish', ...bad })).toBe(fresh)
    }
    const state = gcReducer(gcReducer(fresh, { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: 499.6 }), { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: null })
    expect(fairOaks(state).ownerLateFinish).toBeUndefined()
    expect(fairOaks(gcReducer(fresh, { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: 499.6 })).ownerLateFinish).toEqual({ perDay: 500 })
  })
})

describe('what we expect, beside what is on the books', () => {
  const r = (n: number) => Math.round(n)

  it('counts the bills we send Oct 25 on each customer’s usual pay day, and the trades’ next draws ten days after', () => {
    // Every bar at what it reported (G-140): the same rule as the schedule's, giving the numbers from before it.
    const a = cashAhead(initialGcState(), { bars: 'reported' })
    expect([r(a.expected.in), r(a.expected.out)]).toEqual([145_868, 78_408])
    const draws = a.weeks.flatMap((w) => w.moves).filter((m) => m.why === 'nextDraw')
    expect(draws.map((m) => [m.who, r(m.amount), m.on])).toEqual([
      ['Hill Country Interiors', 14_688, '2026-11-04'],
      ['Summit Roofing', 54_000, '2026-11-04'],
      ['Cool Breeze Mechanical', 9_720, '2026-11-04'],
    ])
    expect(a.later.filter((m) => m.why === 'nextBill').map((m) => [m.who, r(m.amount), m.on])).toEqual([
      ['Dr. Priya Raman', 47_301, '2026-11-15'],
      ['Cibolo Creek Partners', 98_566, '2026-12-02'],
    ])
    // We pay the trades before the customers pay us: the low point moves to the week of Nov 2.
    expect([a.lowest?.start, r(a.lowest?.standing ?? 0)]).toEqual(['2026-11-02', -117_680])
  })

  it('a pay application we sent back counts what we see, as our bill does', () => {
    const summit = cashAhead(initialGcState(), { bars: 'reported' }).weeks.flatMap((w) => w.moves).find((m) => m.who === 'Summit Roofing' && m.expected)
    // They reported 70% of $132,000. On the lines we doubt we see less (the membrane at 50%, they say
    // 100%): $60,000 done, the same our bill uses for them, nothing drawn yet, less the 10% held.
    expect(r(summit?.amount ?? 0)).toBe(r(60_000 * 0.9))
  })

  it('leaves them out when the box is unticked, and never counts a draw already asked for twice', () => {
    const off = cashAhead(initialGcState(), { countExpected: false })
    expect(off.weeks.flatMap((w) => w.moves).some((m) => m.expected)).toBe(false)
    expect(off.later.some((m) => m.expected)).toBe(false)
    const on = cashAhead(initialGcState(), { bars: 'reported' })
    expect(on.weeks.flatMap((w) => w.moves).filter((m) => m.who === 'Iron Horse Fabrication' && m.expected)).toEqual([])
  })
})

describe('reminding a customer to pay a late bill', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject
  const cibolo = (state: GcState) => state.customers.find((c) => c.name === 'Cibolo Creek Partners')
  const r = (n: number) => Math.round(n)

  it('lists the bills that can be reminded: certified, not paid, past their due day', () => {
    const state = initialGcState()
    expect(latePayApps(state, fairOaks(state)).map((b) => [b.number, b.due, b.daysLate, r(b.open)])).toEqual([[3, '2026-09-30', 2, 288_879]])
    const step = payReminderStep(state, fairOaks(state), 3)
    expect(step).toMatchObject({
      docKey: 'payapp-fairoaksd-3',
      title: 'Remind them to pay pay application 3',
      history: 'Due Sep 30, 2 days late. This is the first reminder.',
      dayWord: 'Pay by',
      by: '2026-10-07',
    })
    expect(payReminderStep(state, fairOaks(state), 2)).toBeNull()
    // Waiting on the architect: nothing to pay yet.
    const sent = gcReducer(state, { type: 'sendOwnerPayApp', projectId: 'helotes' })
    const helotes = sent.projects.find((p) => p.id === 'helotes') as GcProject
    expect(payReminderStep({ ...sent, today: '2026-12-31' }, helotes, 1)).toBeNull()
  })

  it('says what is open, since when, and how to pay; interest only when we charge it', () => {
    let state = initialGcState()
    let mail = payReminderEmail(state, cibolo(state), fairOaks(state), 3, '2026-10-07', 'Elena, a call this week would help.')
    expect(mail.subject).toBe('Reminder: pay application 3 for Fair Oaks Shops, Building D, $288,879')
    expect(mail.lines).toEqual([
      'Hello Elena,',
      'Pay application 3 for Fair Oaks Shops, Building D has $288,879 still open. It was due Wed Sep 30, the day you gave.',
      'Please pay it by Wed Oct 7.',
      'Elena, a call this week would help.',
      'Pay it in your portal, by card or bank transfer.',
      'Our unconditional lien waiver for it comes to you the day it is paid.',
    ])
    state = gcReducer(state, { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: 1.5 })
    state = gcReducer(state, { type: 'ownerPayPart', projectId: 'fairoaksd', number: 3, amount: 88_878.51 })
    mail = payReminderEmail(state, cibolo(state), fairOaks(state), 3, '2026-10-07', '')
    expect(mail.lines.slice(1, 4)).toEqual([
      'Pay application 3 for Fair Oaks Shops, Building D has $200,000 still open. It was due Wed Sep 30, the day you gave.',
      'Thank you for the $88,879 you paid Oct 2.',
      'Interest of 1.5% a month runs on it from Sep 30. $285 has built up so far.',
    ])
  })

  it('keeps the reminder on the bill, never as a promise', () => {
    const before = initialGcState()
    const state = gcReducer(before, { type: 'remindCustomerToPay', projectId: 'fairoaksd', number: 3, by: '2026-10-07', note: '' })
    const app = fairOaks(state).ownerBilling?.payApps?.[2]
    expect(app?.reminders).toMatchObject([{ on: '2026-10-02', by: '2026-10-07', note: '' }])
    expect(app?.reminders?.[0]?.lines?.[1]).toBe('Pay application 3 for Fair Oaks Shops, Building D has $288,879 still open. It was due Wed Sep 30, the day you gave.')
    expect(app?.promises).toEqual(fairOaks(before).ownerBilling?.payApps?.[2]?.promises)
    expect(latePayApps(state, fairOaks(state)).map((b) => b.daysLate)).toEqual([2])
    expect(payReminderSentWords(state, fairOaks(state), 3)).toBe('Reminded today · pay by Wed Oct 7.')
    expect(payReminderStep(state, fairOaks(state), 3)?.history).toBe('Due Sep 30, 2 days late. Reminded once, last Oct 2.')
    // Not on a bill that is not late, nor for a day already gone.
    expect(gcReducer(before, { type: 'remindCustomerToPay', projectId: 'fairoaksd', number: 2, by: '2026-10-07', note: '' })).toBe(before)
    expect(gcReducer(before, { type: 'remindCustomerToPay', projectId: 'fairoaksd', number: 3, by: '2026-10-01', note: '' })).toBe(before)
  })
})

describe('the customer’s messages, written out', () => {
  const job = (state: GcState, id: string) => state.projects.find((p) => p.id === id) as GcProject
  const kinds = (state: GcState, id: string) => customerMessages(state, job(state, id)).map((m) => [m.on, m.kind])

  it('lists every email on Fair Oaks D, newest first: three bills and two thank-yous', () => {
    const state = initialGcState()
    expect(kinds(state, 'fairoaksd')).toEqual([
      ['2026-10-01', 'paid'],
      ['2026-09-25', 'payApp'],
      ['2026-09-01', 'paid'],
      ['2026-08-25', 'payApp'],
      ['2026-07-25', 'payApp'],
    ])
    const bill = customerMessages(state, job(state, 'fairoaksd')).find((m) => m.key === 'payapp-3')
    expect(bill?.subject).toBe('Pay application 3 for Fair Oaks Shops, Building D, $288,879')
    expect(bill?.lines).toContain('Marsh & Vale Architects certifies it first. We will tell you when they do.')
  })

  it('follows a bill from sent to certified less, paid in part, reminded and charged interest', () => {
    let state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'helotes' })
    state = gcReducer(state, { type: 'architectCertify', projectId: 'helotes', number: 1, amount: 40_000, note: 'Ceilings are not hung yet' })
    state = gcReducer(state, { type: 'ownerPayPart', projectId: 'helotes', number: 1, amount: 15_000 })
    const msgs = customerMessages(state, job(state, 'helotes'))
    expect(msgs.map((m) => m.kind)).toEqual(['paid', 'certified', 'payApp'])
    expect(msgs[0]?.lines.slice(1, 3)).toEqual(['We received $15,000 for pay application 1 on Helotes Dental Office.', '$25,000 is still open on it.'])
    expect(msgs[1]?.lines[2]).toMatch(/^That is \$[\d,]+ less than we asked\./)
    // The reminder shows as it went; the interest bill and its thank-you too.
    let late = gcReducer(initialGcState(), { type: 'remindCustomerToPay', projectId: 'fairoaksd', number: 3, by: '2026-10-07', note: 'Call me' })
    late = gcReducer(late, { type: 'setOwnerLateInterest', projectId: 'fairoaksd', pctPerMonth: 1.5 })
    late = gcReducer(late, { type: 'sendOwnerInterestBill', projectId: 'fairoaksd' })
    late = gcReducer(late, { type: 'ownerPaidInterest', projectId: 'fairoaksd', number: 1 })
    const top = customerMessages(late, job(late, 'fairoaksd')).slice(0, 3)
    expect(top.map((m) => m.kind)).toEqual(['interestPaid', 'interest', 'reminder'])
    expect(top[2]?.lines).toContain('Call me')
    expect(top[1]?.lines[2]).toBe('The interest on them comes to $285, at 1.5% a month.')
  })

  it('a change order to sign, with its price and days', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'fairoaksd', description: 'A second drive-through lane.', reason: 'owner', schedule: '', packageId: 'fsite', cost: 12_000, price: 0, days: 5 })
    expect(customerMessages(state, job(state, 'fairoaksd')).some((m) => m.kind === 'changeOrder')).toBe(false)
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    const co = customerMessages(state, job(state, 'fairoaksd')).find((m) => m.kind === 'changeOrder')
    expect(co?.subject).toBe('Change order 1 for Fair Oaks Shops, Building D, +$13,200')
    expect(co?.lines.slice(1)).toEqual([
      'Change order 1 for Fair Oaks Shops, Building D is ready for your signature: A second drive-through lane.',
      'It adds $13,200 to your price. It adds 5 days to the job.',
      'Sign it or decline it in your portal.',
    ])
  })

  it('carries the Building lane’s weekly reports, as each went', () => {
    const state = initialGcState()
    const p = job(state, 'fairoaksd')
    const withReport = { ...p, weeklyReports: [{ weekOf: '2026-09-28', sentOn: '2026-10-02', from: 'me' as const, by: 'Dana', to: 'Elena Marchetti', copiedArchitect: false, subject: 'Fair Oaks D: the week of Sep 28', body: 'Hello Elena,\n\nThe slab is done.\nNext week: roofing.' }] }
    const top = customerMessages(state, withReport)[0]
    expect([top?.kind, top?.subject, top?.lines]).toEqual(['weekly', 'Fair Oaks D: the week of Sep 28', ['Hello Elena,', 'The slab is done.', 'Next week: roofing.']])
  })

  it('Stone Oak: every line billed asks them to accept the work, then thanks them', () => {
    let state = initialGcState()
    expect(kinds(state, 'stoneoak').slice(0, 2)).toEqual([
      ['2026-10-01', 'paid'],
      ['2026-09-25', 'acceptAsk'],
    ])
    state = gcReducer(state, { type: 'ownerAcceptsWork', projectId: 'stoneoak' })
    const top = customerMessages(state, job(state, 'stoneoak'))[0]
    expect([top?.on, top?.kind, top?.lines[1]]).toEqual(['2026-10-02', 'accepted', 'You accepted the work on Stone Oak Pharmacy.'])
  })
})

describe('a trade’s ask for a change, on Bill the customer', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject

  it('becomes a draft change order: their ask is our cost, the price adds our fee, the days carry', () => {
    const state = initialGcState()
    const ask = openChangeRequests(fairOaks(state))[0]
    if (!ask) throw new Error('no ask on Fair Oaks D')
    const next = gcReducer(state, { type: 'draftChangeOrderFromRequest', projectId: 'fairoaksd', requestId: ask.id, description: ask.description, cost: ask.amount, price: 0, days: ask.days })
    const co = fairOaks(next).changeOrders?.[0]
    expect([co?.cost, co?.price, co?.days, co?.status, co?.packageId]).toEqual([14_820, changeOrderPrice(fairOaks(state), 14_820), 2, 'draft', ask.packageId])
    expect(openChangeRequests(fairOaks(next))).toEqual([])
  })
})

describe('what each job makes us', () => {
  const job = (state: GcState, id: string) => state.projects.find((p) => p.id === id) as GcProject
  const r = (n: number) => Math.round(n)

  it('makes its fee on the made-up jobs, earned as billed; contingency apart', () => {
    const state = initialGcState()
    const all = allJobsMargin(state)
    expect(all.jobs.map((j) => [j.project.id, r(j.margin), r(j.earned)])).toEqual([
      ['helotes', 30_797, 0],
      ['fairoaksd', 135_342, r(135_342 * (956_327.9 / 1_488_762))],
      ['stoneoak', 16_583, 16_583],
    ])
    expect([r(all.margin), r(all.contingency)]).toEqual([182_722, 53_220])
  })

  it('counts what buying out saved, and a trade not bought out yet at what we carry', () => {
    const state = initialGcState()
    const p = job(state, 'fairoaksd')
    const cheaper = { ...p, packages: p.packages.map((k) => (k.id === 'froof' && k.sow ? { ...k, sow: { ...k.sow, price: 120_000 } } : k)) }
    const m = jobMargin(state, cheaper)
    expect([r(m.buyout), r(m.margin)]).toEqual([12_000, 135_342 + 12_000])
    const helotes = jobMargin(state, job(state, 'helotes'))
    expect(helotes.trades.filter((t) => !t.boughtOut && !t.ownCrew).map((t) => t.trade)).toEqual(['Electrical', 'HVAC', 'Millwork'])
  })

  it('adds a signed change order’s margin: its price less its cost', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: 'fairoaksd', description: 'A second drive-through lane', reason: 'owner', schedule: '', packageId: 'fsite', cost: 12_000, price: 0 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    expect(jobMargin(state, job(state, 'fairoaksd')).changeOrders.count).toBe(0)
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'fairoaksd', changeOrderId: 'co-1' })
    const m = jobMargin(state, job(state, 'fairoaksd'))
    expect([m.changeOrders.margin, r(m.margin), r(m.price)]).toEqual([1_200, 135_342 + 1_200, 1_488_762 + 13_200])
  })
})

describe('bill day across every job', () => {
  const r = (n: number) => Math.round(n)

  it('gathers each job’s bill for the 25th, with what to know before it goes', () => {
    const day = billDay(initialGcState())
    expect([day.on, r(day.readyTotal)]).toEqual(['2026-10-25', 145_868])
    expect(day.jobs.map((j) => [j.project.id, j.ready, r(j.app.due), j.allBilled])).toEqual([
      ['helotes', true, 47_301, false],
      ['fairoaksd', true, 98_566, false],
      ['stoneoak', false, 0, true],
    ])
    expect(day.jobs[1]?.notes.map((n) => n.words)).toEqual([
      'Summit Roofing has not given a waiver for $60,000 of their work on this bill.',
      'Cool Breeze Mechanical has not given a waiver for $10,800 of their work on this bill.',
      'Pecan Valley Electric still owes the unconditional waiver for draw 1.',
      "We sent Summit Roofing's pay application back, so Roofing bills what we see.",
    ])
    expect(day.jobs[0]?.notes[0]?.words).toBe('We have not pressed Start on this job yet.')
  })

  it('a bill sent for the day shows as sent, and the next one waits for the next bill day', () => {
    const state = gcReducer(initialGcState(), { type: 'sendOwnerPayApp', projectId: 'fairoaksd' })
    const j = billDay(state).jobs.find((x) => x.project.id === 'fairoaksd')
    expect([j?.ready, j?.sent?.number, j?.sent?.periodTo]).toEqual([false, 4, '2026-10-25'])
    // The last one waits on the architect: the next bill day says so.
    const next = billDay({ ...state, today: '2026-11-02' }).jobs.find((x) => x.project.id === 'fairoaksd')
    expect(next?.sent).toBeNull()
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
