/** GC mode design spike: the owner's pay application, read off the made-up Helotes Dental Office. */
import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  missingTradeWaivers,
  changeOrderPrice,
  nextOwnerBillDay,
  ourOwnerWaivers,
  owedDrawWords,
  ownerAllBilled,
  ownerCloseout,
  ownerReleasedRetainage,
  ownerAccount,
  ownerPayApp,
  ownerPayAppHasWork,
  proposalTotals,
  markupOnTop,
  sentPayAppLines,
  spreadMarkup,
  tradesOwingUnconditional,
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

describe('nextOwnerBillDay', () => {
  it('is the 25th of this month until it passes, then next month’s', () => {
    expect(nextOwnerBillDay('2026-10-02')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-30')).toBe('2027-01-25')
  })
})
