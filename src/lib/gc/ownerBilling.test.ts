/**
 * The tests of `gcOwnerBilling.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (Owner Billing's O2a and O2b). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { proposalTotals } from './bids'
import { allJobsMoney, markupOnTop, missingTradeWaivers, nextOwnerBillDay, owedDrawWords, ownerAccount, ownerAllBilled, ownerCloseout, ownerContractPrice, ownerContractWorthNow, ownerPayApp, ownerPayAppForm, ownerPayAppHasWork, ownerRetainageOn, ownerRetainageWords, projectCash, sentPayAppLines, spreadMarkup, tradeWaiverChecks, tradesOwingUnconditional } from './ownerBilling'
import { cashAhead } from './ownerBillingAhead'
import { billDay } from './ownerBillingDay'
import { ownerFinishRisk } from './ownerBillingFinish'
import { ownerInterest } from './ownerBillingInterest'
import { allJobsMargin, jobMargin } from './ownerBillingMargin'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState } from './types'

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
})

describe('the retainage the owner holds, released at the end', () => {
  const stoneOakOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'stoneoak')
    if (!p) throw new Error('fixture has no stoneoak')
    return p
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
  const step = (way: 'after' | 'all') => ({ atPct: 50, toPct: 5, way })

  it('holds the full percent to the point, then the lower one on the rest or on all of it', () => {
    expect(ownerRetainageOn(10, undefined, 640_000, 1_000_000)).toBe(64_000)
    expect(ownerRetainageOn(10, step('after'), 640_000, 1_000_000)).toBe(57_000)
    expect(ownerRetainageOn(10, step('all'), 640_000, 1_000_000)).toBe(32_000)
    expect(ownerRetainageOn(10, step('all'), 400_000, 1_000_000)).toBe(40_000)
    expect(ownerRetainageWords(10, undefined)).toBe('10% of every bill until the end')
    expect(ownerRetainageWords(10, step('after'))).toBe('10% until the work is half done, then 5% on the rest')
    expect(ownerRetainageWords(10, { atPct: 75, toPct: 0, way: 'all' })).toBe('10% until the work is 75% done, then 0% on all of it')
  })
})

describe('interest on late bills, ours to choose per job', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject

  it('is off until we choose it', () => {
    const state = initialGcState()
    expect(ownerInterest(state, fairOaks(state))).toMatchObject({ pctPerMonth: null, bills: [], builtUp: 0, toBill: 0 })
  })
})

describe('finishing late against the owner contract', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject

  it('Fair Oaks D finishes on the contract day at today’s pace: three days behind, none to spare', () => {
    const state = initialGcState()
    const f = ownerFinishRisk(state, fairOaks(state))
    expect([f.contract?.on, f.schedule?.on, f.schedule?.from, f.schedule?.behind, f.past, f.atRisk]).toEqual(['2026-12-11', '2026-12-11', 'pace', 3, 0, 0])
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
})

describe('nextOwnerBillDay', () => {
  it('is the 25th of this month until it passes, then next month’s', () => {
    expect(nextOwnerBillDay('2026-10-02')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-30')).toBe('2027-01-25')
  })
})
