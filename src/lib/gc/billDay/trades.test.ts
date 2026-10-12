import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcProject, GcState } from '../types'
import { billDayDates, billDayGates, billGroups, canItGo, rowMove, scheduleSays, tradeBillDay, tradeDraws, tradesSums, walkDraws, type NothingThisPeriod } from './trades'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../../test/fixtures/billDayDemo'
import { claimsToCheck, type LineCheck } from './walk'

function stoneOak(today?: string) {
  const state = billDayState(today)
  const project = billDayJob(state, 'stoneoak')
  const dates = billDayDates(state, project)
  return { state, project, dates }
}

function gatesOf(state: GcState, project: GcProject, checks: LineCheck[] = [], nothing: NothingThisPeriod[] = []) {
  const dates = billDayDates(state, project)
  const rows = tradeDraws(state, project, dates, nothing)
  const items = claimsToCheck(walkDraws(rows), checks, (id) => WHERE_ON_SITE[id] ?? null)
  const superintendent = project.team?.find((t) => t.role === 'superintendent')?.name ?? null
  return billDayGates(project, rows, dates, state.today, items, superintendent)
}

/** The state with one job's project changed. */
function withJob(state: GcState, id: string, change: (p: GcProject) => GcProject): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id === id ? change(p) : p)) }
}

describe('billDayDates', () => {
  it('counts back from the 25th: trades by the cut-off, the walk two days before, the period from last cut-off', () => {
    const { dates } = stoneOak()
    expect(dates).toEqual({
      number: 4,
      billDay: '2026-10-25',
      // Oct 25, 2026 is a Sunday: it goes the Monday after.
      goesOn: '2026-10-26',
      cutoff: '2026-10-19',
      cutoffDays: 6,
      checkFrom: '2026-10-19',
      checkBy: '2026-10-23',
      periodFrom: '2026-09-20',
      // Cibolo Creek pays in 38 days.
      ownerPaysBy: '2026-12-02',
      tradesPaidWithin: 10,
    })
  })

  it('moves the cut-off and the period with the setting', () => {
    const { state, project } = stoneOak()
    const dates = billDayDates(state, project, 8)
    expect([dates.cutoff, dates.checkFrom, dates.periodFrom]).toEqual(['2026-10-17', '2026-10-17', '2026-09-18'])
  })
})

describe('tradeBillDay', () => {
  it('names the bill day a draw sent today goes on: this month’s until its cut-off, then next month’s', () => {
    expect(tradeBillDay('2026-10-02')).toEqual({ billDay: '2026-10-25', cutoff: '2026-10-19' })
    expect(tradeBillDay('2026-10-19')).toEqual({ billDay: '2026-10-25', cutoff: '2026-10-19' })
    expect(tradeBillDay('2026-10-20')).toEqual({ billDay: '2026-11-25', cutoff: '2026-11-19' })
    expect(tradeBillDay('2026-10-26')).toEqual({ billDay: '2026-11-25', cutoff: '2026-11-19' })
    expect(tradeBillDay('2026-12-22', 8)).toEqual({ billDay: '2027-01-25', cutoff: '2027-01-17' })
  })
})

describe('tradeDraws', () => {
  it('reads one row per trade with a signed statement of work, as the prototype has them', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    expect(rows.map((r) => [r.company, r.state, r.number, r.first, r.since])).toEqual([
      ['Rio Paving', 'back', 2, false, '2026-10-01'],
      ['Hillside Excavation', 'notin', 3, false, null],
      ['Kerr Electric', 'notin', 3, false, null],
      ['Alamo Steel', 'notin', 1, true, null],
      ['Lone Star Mechanical', 'waiting', 2, false, '2026-09-28'],
      ['Tejas Power', 'approved', 2, false, null],
    ])
    // Our own crew draws nothing: no row.
    expect(rows.some((r) => r.packageId === 'so-plumb')).toBe(false)
  })

  it('reads the money as the Draws window keeps it: asked before a back-charge, approved after it', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    const of = (company: string) => rows.find((r) => r.company === company)
    expect([of('Lone Star Mechanical')?.asked, of('Lone Star Mechanical')?.approved]).toEqual([35_010, null])
    expect([of('Tejas Power')?.asked, of('Tejas Power')?.approved]).toEqual([14_400, 13_500])
    expect([of('Rio Paving')?.asked, of('Hillside Excavation')?.asked]).toEqual([34_560, null])
  })

  it('expects what the schedule says by bill day, line by line, never below what was billed', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    const of = (company: string) => rows.find((r) => r.company === company)
    // Sitework's bar runs Jul 9 to Nov 13: 109 of its 128 days by Oct 25, against 60% billed, on $120,000, less 10%.
    expect(scheduleSays(project, 'hill-site', dates.billDay)).toBeCloseTo((109 / 128) * 100, 6)
    expect(of('Hillside Excavation')?.expected).toBeCloseTo((((109 / 128) * 100 - 60) / 100) * 120_000 * 0.9, 6)
    expect(of('Hillside Excavation')?.expectedWords).toBe('Sitework 85% by Oct 25')
    expect(of('Lone Star Mechanical')?.expectedWords).toBe('Rough-in, level 1 78% by Oct 25, Rough-in, level 2 12% by Oct 25')
    // No bar on low voltage: nothing expected, no words.
    expect([of('Tejas Power')?.expected, of('Tejas Power')?.expectedWords]).toEqual([0, ''])
  })

  it('names the unconditional waivers owed on paid draws, with the day we paid', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    expect(rows.filter((r) => r.owedUnconditional.length).map((r) => [r.company, r.owedUnconditional])).toEqual([
      ['Hillside Excavation', [{ draw: 2, amount: 21_600, final: false, paidOn: '2026-09-28' }]],
    ])
  })

  it('reads an approved draw from last period as not in for this one', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    // Hillside's draw 2 was asked for Aug 19, before the period opened Sep 20.
    expect(rows.find((r) => r.company === 'Hillside Excavation')?.last?.number).toBe(2)
    expect(rows.find((r) => r.company === 'Hillside Excavation')?.state).toBe('notin')
  })

  it('keeps a trade said to send nothing as not in, marked, and counts it as in at the gates', () => {
    const state = billDayState()
    const project = billDayJob(state, 'stoneoak')
    const nothing: NothingThisPeriod[] = [{ sowId: 'sow-kerr', periodTo: '2026-10-25', saidBy: 'Dana Kerr, by phone', at: '2026-10-02T15:00:00Z' }]
    const rows = tradeDraws(state, project, billDayDates(state, project), nothing)
    const kerr = rows.find((r) => r.company === 'Kerr Electric')
    expect([kerr?.state, kerr?.nothing?.saidBy]).toEqual(['notin', 'Dana Kerr, by phone'])
    const gates = gatesOf(state, project, [], nothing)
    expect(gates.find((g) => g.key === 'allIn')?.small).toBe('2 not in: Hillside Excavation, Alamo Steel. Due Mon Oct 19.')
    expect(gates.find((g) => g.key === 'conditional')?.small).toBe('They come with each draw. 3 of 5 are in so far.')
    // A row said for another bill day does not count.
    const other = tradeDraws(state, project, billDayDates(state, project), nothing.map((n) => ({ ...n, periodTo: '2026-09-25' })))
    expect(other.find((r) => r.company === 'Kerr Electric')?.nothing).toBeNull()
  })

  it('closes out a trade with its final pay application in, and leaves out one paid in full or with nothing left to draw', () => {
    const base = billDayState()
    const finalIn = withJob(base, 'stoneoak', (p) => ({
      ...p,
      packages: p.packages.map((k) =>
        k.id === 'so-lv' && k.sow
          ? { ...k, sow: { ...k.sow, draws: [...k.sow.draws, { id: 'tejas-f', number: 3, requestedOn: '2026-10-01', gross: 0, retainage: -3_600, net: 3_600, status: 'requested' as const, waiver: 'conditional' as const, lines: [], final: true }] } }
          : k,
      ),
    }))
    const p1 = billDayJob(finalIn, 'stoneoak')
    const tejas = tradeDraws(finalIn, p1, billDayDates(finalIn, p1)).find((r) => r.company === 'Tejas Power')
    expect([tejas?.state, tejas?.number, tejas?.draw?.final, tejas?.expected]).toEqual(['closing', 3, true, 0])

    const paidOut = withJob(finalIn, 'stoneoak', (p) => ({
      ...p,
      packages: p.packages.map((k) => (k.id === 'so-lv' && k.sow ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.final ? { ...d, status: 'paid' as const, paidOn: '2026-10-02' } : d)) } } : k)),
    }))
    const p2 = billDayJob(paidOut, 'stoneoak')
    expect(tradeDraws(paidOut, p2, billDayDates(paidOut, p2)).some((r) => r.company === 'Tejas Power')).toBe(false)

    const allBilled = withJob(base, 'stoneoak', (p) => ({
      ...p,
      packages: p.packages.map((k) => (k.id === 'so-site' && k.sow ? { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => ({ ...l, pctBilled: 100 })) } } : k)),
    }))
    const p3 = billDayJob(allBilled, 'stoneoak')
    expect(tradeDraws(allBilled, p3, billDayDates(allBilled, p3)).some((r) => r.company === 'Hillside Excavation')).toBe(false)
  })

  it('walks only the draws waiting on us: a draw sent back is out for a fix', () => {
    const { state, project, dates } = stoneOak()
    expect(walkDraws(tradeDraws(state, project, dates)).map((d) => d.draw.id)).toEqual(['ls-2'])
  })
})

describe('billDayGates', () => {
  it('opens five of seven on the prototype’s Friday, each with its words and its presses', () => {
    const { state, project } = stoneOak()
    const gates = gatesOf(state, project)
    expect(gates.map((g) => [g.key, g.ok])).toEqual([
      ['allIn', false],
      ['nothingBack', false],
      ['checked', false],
      ['conditional', false],
      ['unconditional', false],
      ['changeOrders', true],
      ['lastCertificate', true],
    ])
    expect(gates.map((g) => g.small)).toEqual([
      '3 not in: Hillside Excavation, Kerr Electric, Alamo Steel. Due Mon Oct 19.',
      "Rio Paving's draw 2 went back Thu Oct 1. Line 3, Base, lot, reads 80%. We see 50%. Send it again.",
      "Lone Star Mechanical's draw 2 has waited on us 4 days. 3 lines are not walked yet. Wendi walks them by Fri Oct 23.",
      'They come with each draw. 3 of 6 are in so far.',
      'Hillside Excavation still owes the unconditional waiver for draw 2.',
      "Kerr Electric's CO 3 for $3,400 is signed. Lone Star Mechanical's CO 1 for $2,600 waits on the customer's signature. It is held out until then.",
      'Pay application 3 was certified in full by Jonah Vale. It was paid Oct 1.',
    ])
    expect(gates.flatMap((g) => g.acts.map((a) => a.label))).toEqual(['Ask the 3 not in', 'Remind Rio Paving', 'Open the lines', 'Ask Wendi to walk it', 'Ask Hillside Excavation'])
    expect(gates.find((g) => g.key === 'checked')?.waiting).toBe(true)
    expect(canItGo(gates)).toEqual({ ok: 2, of: 7, yes: false, words: 'Can it go? Not yet.', openWords: '5 gates open' })
  })

  it('clears the checked gate once Wendi walks, with the photo or the note on the line under the claim', () => {
    const state = billDayState('2026-10-22')
    const project = billDayJob(state, 'stoneoak')
    const gates = gatesOf(state, project, WENDI_WALK)
    const checked = gates.find((g) => g.key === 'checked')
    expect([checked?.ok, checked?.small]).toEqual([
      true,
      "Lone Star Mechanical's draw 2 has waited on us 24 days. 1 line is under the claim, with the photo or the note. Wendi walked them Thu Oct 22.",
    ])
    // The prototype's pill: Bill day · 3 of 7.
    expect(canItGo(gates).ok).toBe(3)
  })

  it('keeps the checked gate open while a line under the claim has no photo and no note', () => {
    const state = billDayState('2026-10-22')
    const project = billDayJob(state, 'stoneoak')
    const bare = WENDI_WALK.map((c) => (c.sovId === 'ls-l1' ? { ...c, photo: false, note: '' } : c))
    const checked = gatesOf(state, project, bare).find((g) => g.key === 'checked')
    expect([checked?.ok, checked?.small]).toEqual([
      false,
      "Lone Star Mechanical's draw 2 has waited on us 24 days. 1 line under the claim needs a photo or a note. Wendi walks them by Fri Oct 23.",
    ])
  })

  it('counts a first pay application as clear on last period’s certificate', () => {
    const state = billDayState()
    const gates = gatesOf(state, billDayJob(state, 'helotes'))
    const last = gates.find((g) => g.key === 'lastCertificate')
    expect([last?.ok, last?.small]).toEqual([true, 'This is the first pay application on the job.'])
    expect(gates.find((g) => g.key === 'checked')?.acts).toEqual([])
  })

  it('waits on the architect’s certificate, then on the payment', () => {
    const uncertified = withJob(billDayState(), 'stoneoak', (p) => ({
      ...p,
      ownerBilling: p.ownerBilling && { ...p.ownerBilling, payApps: (p.ownerBilling.payApps ?? []).map((a) => (a.number === 3 ? { ...a, certified: null, paidOn: null } : a)) },
    }))
    const g1 = gatesOf(uncertified, billDayJob(uncertified, 'stoneoak')).find((g) => g.key === 'lastCertificate')
    expect([g1?.ok, g1?.small]).toEqual([false, 'Pay application 3 still waits on Jonah Vale to certify.'])

    const unpaid = withJob(billDayState(), 'stoneoak', (p) => ({
      ...p,
      ownerBilling: p.ownerBilling && { ...p.ownerBilling, payApps: (p.ownerBilling.payApps ?? []).map((a) => (a.number === 3 ? { ...a, paidOn: null } : a)) },
    }))
    const g2 = gatesOf(unpaid, billDayJob(unpaid, 'stoneoak')).find((g) => g.key === 'lastCertificate')
    expect([g2?.ok, g2?.small]).toEqual([false, 'Pay application 3 was certified in full by Jonah Vale. It is not paid yet.'])
  })

  it('opens the change order gate only when a draw claims a change order’s line not signed both ways', () => {
    const forged = withJob(billDayState(), 'stoneoak', (p) => ({
      ...p,
      changeOrders: (p.changeOrders ?? []).map((co) => (co.id === 'so-co3' && co.tradeChange ? { ...co, tradeChange: { ...co.tradeChange, status: 'sent' as const, signedOn: null } } : co)),
      packages: p.packages.map((k) =>
        k.id === 'so-elec' && k.sow
          ? { ...k, sow: { ...k.sow, draws: [...k.sow.draws, { id: 'kerr-3', number: 3, requestedOn: '2026-10-01', gross: 3_400, retainage: 340, net: 3_060, status: 'requested' as const, waiver: 'conditional' as const, lines: [{ sovId: 'kerr-co3', toPct: 100 }] }] } }
          : k,
      ),
    }))
    const gate = gatesOf(forged, billDayJob(forged, 'stoneoak')).find((g) => g.key === 'changeOrders')
    expect(gate?.ok).toBe(false)
    expect(gate?.small).toContain("Kerr Electric's CO 3 for $3,400 waits on the trade's signature. It is held out until then.")
  })

  it('writes every gate’s sentences in plain words', () => {
    for (const [today, checks] of [['2026-10-02', []], ['2026-10-22', WENDI_WALK]] as const) {
      const state = billDayState(today)
      for (const id of ['stoneoak', 'helotes'] as const) {
        for (const g of gatesOf(state, billDayJob(state, id), [...checks])) {
          expect(plainWordsFailures(g.text)).toEqual([])
          expect(plainWordsFailures(g.small)).toEqual([])
        }
      }
    }
  })
})

describe('billGroups and rowMove', () => {
  it('groups the rows in the page’s order with the prototype’s notes', () => {
    const { state, project, dates } = stoneOak()
    const groups = billGroups(tradeDraws(state, project, dates), dates)
    expect(groups.map((g) => [g.key, g.label, g.tone, g.note, g.rows.length])).toEqual([
      ['back', 'Sent back', 'warn', 'ours to re-check once it comes back', 1],
      ['notin', 'Not in', 'hot', 'due by Mon Oct 19', 3],
      ['waiting', 'In, waiting on us', '', '', 1],
      ['approved', 'Approved', '', '', 1],
      ['closing', 'Closing out', '', "a trade's final pay application and retainage release list here when they come", 0],
    ])
  })

  it('says whose move each row is', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates, [{ sowId: 'sow-alamo', periodTo: '2026-10-25', saidBy: 'Pat Alamo, by phone', at: '2026-10-02T15:00:00Z' }])
    expect(rows.map((r) => [r.company, rowMove(r, state.today)])).toEqual([
      ['Rio Paving', { side: 'theirs', words: 'their move · 1 d' }],
      ['Hillside Excavation', { side: 'theirs', words: 'their move' }],
      ['Kerr Electric', { side: 'theirs', words: 'their move' }],
      ['Alamo Steel', { side: 'none', words: 'nothing this period · Pat Alamo, by phone' }],
      ['Lone Star Mechanical', { side: 'ours', words: 'our move · 4 d' }],
      // Approved Sep 30: paid within 10 days of approval.
      ['Tejas Power', { side: 'paid', words: 'we pay by Oct 10' }],
    ])
  })

  it('sums the trades the way the river reads them, leaving out a trade said to send nothing', () => {
    const { state, project, dates } = stoneOak()
    const rows = tradeDraws(state, project, dates)
    const sums = tradesSums(rows)
    expect([sums.approved, sums.waiting, sums.back]).toEqual([13_500, 35_010, 34_560])
    expect(sums.notIn).toBeCloseTo(rows.filter((r) => r.state === 'notin').reduce((s, r) => s + r.expected, 0), 6)
    const withNothing = tradesSums(tradeDraws(state, project, dates, [{ sowId: 'sow-kerr', periodTo: '2026-10-25', saidBy: 'Dana Kerr', at: '2026-10-02T15:00:00Z' }]))
    expect(withNothing.notIn).toBeCloseTo(sums.notIn - (rows.find((r) => r.company === 'Kerr Electric')?.expected ?? 0), 6)
  })
})
