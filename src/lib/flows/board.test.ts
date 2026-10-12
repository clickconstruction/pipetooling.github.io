import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  NO_FILTER,
  boardFilterOptions,
  boardLines,
  boardPasses,
  boardRows,
  boardSummary,
  byTrade,
  companyTable,
  dueWords,
  lineDayWords,
  landsWords,
  NO_TRADE,
  onStep,
  rowHeadParts,
  rowPress,
  tileJobWords,
  type BoardCompany,
  type BoardRow,
} from './board'
import { ARCH_FLOW, ARCHITECTS, contextFor, CUSTOMER_FLOW, CUSTOMERS, TODAY, TRADE_FLOW, TRADES } from './boardFixtures'
import { flat, type FlowDef, type FlowStep } from './state'

const trade = contextFor(TRADE_FLOW)
const customer = contextFor(CUSTOMER_FLOW)
const arch = contextFor(ARCH_FLOW)
const stepOf = (flow: FlowDef, id: string): FlowStep => {
  const s = flat(flow).find((x) => x.id === id)
  if (!s) throw new Error(`no step ${id}`)
  return s
}
const stepRow = (rows: BoardRow[], id: string) => {
  const r = rows.find((x) => x.kind === 'step' && x.step.id === id)
  if (!r || r.kind !== 'step') throw new Error(`no row for ${id}`)
  return r
}
const rowsOf = (ctx: typeof trade, companies: BoardCompany[], f = NO_FILTER) => boardRows(ctx, companies, f).lanes.flatMap((l) => l.rows)

describe('boardLines', () => {
  it('lists everyone on a step, the longest on it first, and leaves out a company off the flow', () => {
    const lines = boardLines(trade, TRADES, stepOf(TRADE_FLOW, 'papers'))
    expect(lines.map((l) => [l.name, l.days, l.tone])).toEqual([
      ['Cibolo Fence', 6, 'over'],
      ['Bexar Steel Erectors', 4, 'over'],
      ['Hillside Excavation', 2, 'lapsed'],
      ['Lone Star Mechanical', 2, ''],
    ])
  })

  it('reads one line per job in the per-job lane, late first', () => {
    const lines = boardLines(trade, TRADES, stepOf(TRADE_FLOW, 'ask'))
    expect(lines.map((l) => [l.contactId, l.jobId, l.lateDays])).toEqual([
      ['greg', 'boerne', 2],
      ['greg', 'padb', 0],
      ['g3', 'boerne', 0],
      ['g5', 'boerne', 0],
      ['g4', 'padb', 0],
    ])
  })

  it('never reads a line with its day still ahead as over usual, however long it has been on', () => {
    // Lone Star Mechanical has been asked 8 days, over the usual 6, but its quote is due Thu Oct 8.
    const g3 = boardLines(trade, TRADES, stepOf(TRADE_FLOW, 'ask')).find((l) => l.contactId === 'g3')
    expect(g3).toMatchObject({ days: 8, usual: 6, due: '2026-10-08', overUsual: false, tone: '' })
  })

  it('reads a line with no day past its usual as over usual', () => {
    const [bill] = boardLines(trade, TRADES, stepOf(TRADE_FLOW, 'compare'))
    expect(bill).toMatchObject({ name: 'Tejas Power', days: 3, usual: 2, overUsual: true, tone: 'over' })
  })

  it('has no usual and so nothing over it when the step has none yet', () => {
    const [bill] = boardLines({ ...trade, usual: {} }, TRADES, stepOf(TRADE_FLOW, 'compare'))
    expect(bill).toMatchObject({ usual: null, overUsual: false, tone: '' })
  })
})

describe('lineDayWords', () => {
  const words = (ctx: typeof trade, companies: BoardCompany[], stepId: string) => boardLines(ctx, companies, stepOf(ctx.flow, stepId)).map((l) => [l.contactId, lineDayWords(l, ctx)])

  it('reads late, lapsed, how long and over usual', () => {
    expect(words(trade, TRADES, 'papers')).toEqual([
      ['g4', '6 d · over usual'],
      ['tom', '4 d · over usual'],
      ['greg', 'insurance expired'],
      ['g3', '2 d'],
    ])
    expect(words(trade, TRADES, 'ask')[0]).toEqual(['greg', 'late 2 days'])
  })

  it('reads the day while it is ahead: the weekday within the week, the date past it', () => {
    expect(words(trade, TRADES, 'ask').slice(1)).toEqual([
      ['greg', 'due Oct 22'],
      ['g3', 'due Thu'],
      ['g5', 'due Thu'],
      ['g4', 'due Oct 22'],
    ])
  })

  it('names the person a step waits on', () => {
    expect(words(customer, CUSTOMERS, 'payapp')).toEqual([['elena', 'waiting on Jonah']])
  })

  it('reads a step that came on today as today, and says nothing when the app has no day', () => {
    expect(words(arch, ARCHITECTS, 'addenda')).toEqual([['jonah', 'today']])
    expect(words(trade, TRADES, 'draws')).toEqual([
      ['g5', '3 d'],
      ['greg', ''],
    ])
  })
})

describe('dueWords', () => {
  it('reads today, a weekday within six days, and the date after that', () => {
    expect(dueWords(TODAY, TODAY)).toBe('today')
    expect(dueWords('2026-10-08', TODAY)).toBe('Thu')
    expect(dueWords('2026-10-09', TODAY)).toBe('Oct 9')
  })
})

describe('boardSummary', () => {
  it('counts companies on the tiles, never lines: a company with two asks is one company and one dot, colored by its worst line', () => {
    const s = boardSummary(trade, TRADES)
    expect(s.tiles.map((t) => [t.words, t.companies, t.dots.map((d) => `${d.contactId}:${d.tone}`)])).toEqual([
      ['Getting set up', 5, ['g4:warn', 'tom:warn', 'greg:warn', 'g3:', 'g5:']],
      ['Quoting', 5, ['greg:bad', 'g3:', 'g5:', 'g4:', 'bill:warn']],
      ['Building', 4, ['g1:', 'g2:', 'g5:', 'greg:']],
    ])
    expect(s.tiles.map((t) => tileJobWords(trade, t))).toEqual(['', 'on 2 bids', 'on Stone Oak Pharmacy'])
    expect(s.off.map((o) => o.name)).toEqual(['Hill Country Paving', 'Medina Drywall'])
  })

  it('counts the late and the lapsed as needing a hand, each company once by its worst line, and over usual only as a watch', () => {
    // Greg is late on Boerne and lapsed on his insurance: one company, counted once, as late.
    expect(boardSummary(trade, TRADES).hand).toEqual({ count: 1, late: 1, lapsed: 0, over: 3, waiting: 0 })
    expect(boardSummary(customer, CUSTOMERS).hand).toEqual({ count: 0, late: 0, lapsed: 0, over: 2, waiting: 1 })
  })

  it('puts the customer’s change orders under building, the phase the seed gives them', () => {
    const changesOnly = CUSTOMERS.map((c) => (c.contactId === 'priya' ? { ...c, places: c.places.filter((p) => p.stepId === 'co') } : c))
    const building = boardSummary(customer, changesOnly).tiles.find((t) => t.phase === 'building')
    expect(building?.dots.map((d) => d.contactId)).toContain('priya')
  })

  it('reads each step’s phase from the step, so a phase the flow editor sets moves its companies', () => {
    const moved: FlowDef = { ...CUSTOMER_FLOW, lanes: CUSTOMER_FLOW.lanes.map((l) => ({ ...l, steps: l.steps.map((s) => (s.id === 'yes' ? { ...s, phase: 'building' as const } : s)) })) }
    const tiles = boardSummary(contextFor(moved), CUSTOMERS).tiles
    expect(tiles.map((t) => [t.words, t.dots.map((d) => d.contactId)])).toEqual([
      ['Setting up', []],
      ['Bidding', ['g8']],
      ['Building', ['g9', 'priya', 'elena']],
    ])
  })

  it('reads the customers in their own words, and the architect on one tile', () => {
    expect(boardSummary(customer, CUSTOMERS).tiles.map((t) => [t.words, t.companies, tileJobWords(customer, t)])).toEqual([
      ['Setting up', 0, ''],
      ['Bidding', 2, 'on 2 jobs'],
      ['Building', 2, 'on 2 jobs'],
    ])
    expect(boardSummary(arch, ARCHITECTS).tiles.map((t) => [t.words, t.companies])).toEqual([['On the job', 1]])
  })

  it('narrows to one job: the per-job lines on it and the companies on it', () => {
    const s = boardSummary(trade, TRADES, { jobId: 'padb', seat: null })
    expect(s.tiles.map((t) => t.dots.map((d) => d.contactId))).toEqual([['g4', 'greg'], ['greg', 'g4'], []])
    expect(s.off).toEqual([])
  })
})

describe('boardRows', () => {
  it('folds a run of empty steps to one row with what lands there and the run’s first press', () => {
    const [once] = boardRows(trade, TRADES).lanes
    expect(once?.words).toBe('Once')
    expect(once?.rows[0]).toEqual({ kind: 'folded', steps: [stepOf(TRADE_FLOW, 'invited'), stepOf(TRADE_FLOW, 'portal')], lands: 'A new invitation lands here.', press: { kind: 'invite', label: 'Invite a company' } })
  })

  it('keeps a lane’s last step on its own row when nobody is on it', () => {
    const closeout = stepRow(rowsOf(trade, TRADES), 'closeout')
    expect(closeout).toMatchObject({ groups: [], press: null, lands: "A trade's final waiver lands here." })
    expect(rowHeadParts(closeout.head)).toEqual(['nobody'])
  })

  it('heads a row with the count, late, lapsed, over usual and waiting, and the step’s usual', () => {
    const rows = rowsOf(trade, TRADES)
    expect(rowHeadParts(stepRow(rows, 'papers').head)).toEqual(['4', '1 lapsed', '2 over usual', 'usually 3 d'])
    expect(rowHeadParts(stepRow(rows, 'ask').head)).toEqual(['5 asks', '1 late', 'usually 6 d'])
    expect(rowHeadParts(stepRow(rows, 'compare').head)).toEqual(['1', 'ours', '1 over usual', 'usually 2 d'])
  })

  it('counts a loop by its thing, never by the calendar', () => {
    expect(rowHeadParts(stepRow(rowsOf(customer, CUSTOMERS), 'payapp').head)).toEqual(['1', '1 waiting', 'usually 21 d'])
    expect(rowHeadParts(stepRow(rowsOf(customer, CUSTOMERS), 'co').head)).toEqual(['1 change', 'usually 4 d'])
    const twoAddenda = [...ARCHITECTS, { ...ARCHITECTS[0]!, contactId: 'x', name: 'Other Architects', places: [{ ...ARCHITECTS[0]!.places[1]! }] }]
    expect(rowHeadParts(stepRow(rowsOf(arch, twoAddenda), 'addenda').head)).toEqual(['2 addenda', 'usually 1 d'])
  })

  it('groups the per-job chips by job, the job named once with the day they share', () => {
    const ask = stepRow(rowsOf(trade, TRADES), 'ask')
    expect(ask.groups.map((g) => [g.label, g.sharedDue, g.chips.map((c) => [c.line.contactId, c.words])])).toEqual([
      ['Boerne Retail Shell', '2026-10-08', [['greg', 'late 2 days'], ['g3', ''], ['g5', '']]],
      ['Boerne Retail Pad B', '2026-10-22', [['greg', ''], ['g4', '']]],
    ])
  })

  it('leaves the job unnamed for a customer whose job carries its own name', () => {
    const start = stepRow(rowsOf(customer, CUSTOMERS), 'start')
    expect(start.groups.map((g) => [g.label, g.chips.map((c) => c.words)])).toEqual([[null, ['13 d · over usual']]])
  })

  it('gives each row the step’s own press, keyed off its facts', () => {
    const rows = rowsOf(trade, TRADES)
    expect(stepRow(rows, 'papers').press).toEqual({ kind: 'nudge', label: 'Ask the 4 for papers', contactIds: ['g4', 'tom', 'greg', 'g3'], late: false })
    expect(stepRow(rows, 'msa').press).toEqual({ kind: 'nudge', label: 'Remind Kerr Electric', contactIds: ['g5'], late: false })
    expect(stepRow(rows, 'ask').press).toEqual({ kind: 'nudge', label: 'Remind the 1 late', contactIds: ['greg'], late: true })
    expect(stepRow(rows, 'compare').press).toEqual({ kind: 'compare', label: 'Open the compare' })
    expect(stepRow(rows, 'sow').press).toEqual({ kind: 'nudge', label: 'Remind the 2', contactIds: ['g1', 'g2'], late: false })
    expect(stepRow(rows, 'draws').press).toEqual({ kind: 'bill-day', label: 'Bill day' })
  })

  it('names the person when there is one, and leaves an our-move step and a company waiting on someone else without a nudge', () => {
    const rows = rowsOf(customer, CUSTOMERS)
    expect(stepRow(rows, 'co').press).toMatchObject({ label: 'Remind Priya' })
    expect(stepRow(rows, 'bid').press).toBeNull()
    expect(stepRow(rows, 'payapp').press).toBeNull()
    expect(rowPress(stepOf(CUSTOMER_FLOW, 'yes'), boardLines(customer, CUSTOMERS, stepOf(CUSTOMER_FLOW, 'yes')))).toMatchObject({ label: 'Remind Leon Valley Bakery' })
  })

  it('reads the customer flow’s lanes: a lone empty step keeps its row, and the end of the job folds', () => {
    const rows = rowsOf(customer, CUSTOMERS)
    expect(rows.map((r) => (r.kind === 'folded' ? r.steps.map((s) => s.id).join('+') : r.step.id))).toEqual(['agreement', 'asked', 'bid', 'yes', 'contract', 'start', 'onsite', 'payapp', 'close+warranty', 'co'])
    expect(stepRow(rows, 'contract').lands).toBe('A yes lands here.')
    expect(rows.find((r) => r.kind === 'folded')).toMatchObject({ lands: 'A finished job lands here.', press: null })
  })

  it('lists the companies off the flow apart', () => {
    expect(boardRows(customer, CUSTOMERS).off).toEqual([
      { contactId: 'marcus', name: 'Bell Family Dental', since: '2026-09-29', why: 'Declined our bid, went with another plumber.' },
      { contactId: 'g10', name: 'Castle Hills HOA', since: '2026-09-18', why: 'Declined: price.' },
    ])
  })
})

describe('the pickers', () => {
  it('narrows the per-job lane to the job, and a Once step to the companies on it', () => {
    const rows = rowsOf(trade, TRADES, { jobId: 'padb', seat: null })
    expect(stepRow(rows, 'papers').groups[0]?.chips.map((c) => c.line.contactId)).toEqual(['g4', 'greg'])
    expect(stepRow(rows, 'ask').groups.map((g) => g.label)).toEqual(['Boerne Retail Pad B'])
  })

  it('narrows to one seat: the steps in it, and their-move steps with no seat', () => {
    const lines = flat(CUSTOMER_FLOW).flatMap((s) => boardLines(customer, CUSTOMERS, s)).filter((l) => boardPasses(l, { jobId: null, seat: 'Robert' }))
    expect(lines.map((l) => l.step.id)).toEqual(['yes', 'payapp', 'co'])
  })

  it('offers every job a company on the board is on, and every seat a step sits in', () => {
    expect(boardFilterOptions(trade, TRADES)).toEqual({
      jobs: [
        { id: 'boerne', name: 'Boerne Retail Shell' },
        { id: 'padb', name: 'Boerne Retail Pad B' },
        { id: 'stoneoak', name: 'Stone Oak Pharmacy' },
      ],
      seats: ['Robert'],
    })
  })
})

describe('byTrade', () => {
  const rows = byTrade(trade, TRADES)

  it('reads one row per trade, A to Z, and a company under each trade on its record', () => {
    expect(rows.map((r) => [r.trade, r.chips.map((c) => c.name)])).toEqual([
      ['Drywall', ['Medina Drywall']],
      ['Electrical', ['Kerr Electric', 'Tejas Power']],
      ['Fencing', ['Cibolo Fence']],
      ['Low voltage', ['Tejas Power']],
      ['Mechanical', ['Lone Star Mechanical']],
      ['Paving', ['Rio Paving', 'Hill Country Paving']],
      ['Sitework', ['Hillside Excavation']],
      ['Structural steel', ['Alamo Steel', 'Bexar Steel Erectors']],
    ])
  })

  it('shows each company once with the step it is on, its job and its day, late before lapsed', () => {
    const chip = (name: string) => rows.flatMap((r) => r.chips).find((c) => c.name === name)
    expect(chip('Hillside Excavation')).toMatchObject({ step: { id: 'ask' }, jobId: 'boerne', words: 'late 2 days', tone: 'late' })
    expect(chip('Bexar Steel Erectors')).toMatchObject({ step: { id: 'papers' }, jobId: null, words: '4 d · over usual', tone: 'over' })
    expect(chip('Lone Star Mechanical')).toMatchObject({ step: { id: 'papers' }, words: '2 d', tone: '' })
    expect(chip('Medina Drywall')).toMatchObject({ step: null, words: 'off the flow', off: { since: '2026-09-02' } })
  })

  it('shows a late step before the step a company is setting up on', () => {
    const lateAsk = TRADES.map((c) => (c.contactId === 'g3' ? { ...c, places: c.places.map((p) => (p.stepId === 'ask' ? { ...p, due: '2026-09-30', lateDays: 2 } : p)) } : c))
    const g3 = byTrade(trade, lateAsk).flatMap((r) => r.chips).find((c) => c.contactId === 'g3')
    expect(g3).toMatchObject({ step: { id: 'ask' }, jobId: 'boerne', words: 'late 2 days', tone: 'late' })
  })

  it('reads a lapsed paper on a company not late on its step', () => {
    const notLate: BoardCompany[] = TRADES.map((c) => (c.contactId === 'greg' ? { ...c, places: c.places.filter((p) => !(p.stepId === 'ask' && p.jobId === 'boerne')) } : c))
    const greg = byTrade(trade, notLate).flatMap((r) => r.chips).find((c) => c.contactId === 'greg')
    expect(greg).toMatchObject({ step: { id: 'ask' }, jobId: 'padb', words: 'insurance expired', tone: 'lapsed' })
  })

  it('counts each trade: its companies, those on a job, late, lapsed and off the flow', () => {
    const counts = (t: string) => {
      const r = rows.find((x) => x.trade === t)
      return r && [r.companies, r.onAJob, r.late, r.lapsed, r.off]
    }
    expect(counts('Sitework')).toEqual([1, 1, 1, 1, 0])
    expect(counts('Paving')).toEqual([2, 1, 0, 0, 1])
  })

  it('puts a company with no trade on its record under No trade yet, last', () => {
    const none = [...TRADES, { ...TRADES[3]!, contactId: 'x', name: 'Aardvark Supply', trades: [] }]
    expect(byTrade(trade, none).slice(-1)[0]).toMatchObject({ trade: NO_TRADE, chips: [{ name: 'Aardvark Supply' }] })
  })
})

describe('companyTable', () => {
  const rows = companyTable(trade, TRADES)
  const row = (id: string) => rows.find((r) => r.contactId === id)

  it('reads one row per company on the flow', () => {
    expect(rows.map((r) => r.contactId)).toEqual(['greg', 'bill', 'tom', 'g1', 'g2', 'g3', 'g4', 'g5'])
  })

  it('draws the Once lane as a track and reads a lapsed step first', () => {
    expect(row('greg')?.track.map((t) => t.mark)).toEqual(['done', 'done', 'lapsed', 'done'])
    expect(row('tom')?.track.map((t) => t.mark)).toEqual(['done', 'done', 'now', ''])
    expect(row('greg')?.now).toEqual({ stepId: 'papers', name: 'Papers in', small: ['insurance expired'], tone: 'lapsed' })
  })

  it('reads the step on now with whose move, how long and the usual, and one line per job', () => {
    expect(row('bill')?.now).toEqual({ stepId: 'compare', name: 'Compared', small: ['ours', '3 d', 'over usual'], tone: 'over' })
    expect(row('g5')?.now).toEqual({ stepId: 'msa', name: 'MSA signed', small: ['their move', '3 d', 'usually 4'], tone: '' })
    expect(row('greg')?.jobs).toEqual([
      { jobId: 'boerne', name: 'Boerne Retail Shell', words: 'Asked to quote · late 2 days', lateDays: 2 },
      { jobId: 'padb', name: 'Boerne Retail Pad B', words: 'Asked to quote · due Oct 22', lateDays: 0 },
      { jobId: 'stoneoak', name: 'Stone Oak Pharmacy', words: 'Draws', lateDays: 0 },
    ])
    expect(row('bill')?.jobs.map((j) => j.words)).toEqual(['Compared · 3 d', 'not started'])
    expect(row('greg')?.sub).toBe('Sitework · Greg Paulk')
  })

  it('reads a job whose lane is finished as done', () => {
    const done = companyTable(trade, [{ ...TRADES[1]!, jobsDone: ['stoneoak'] }])
    expect(done[0]?.jobs.map((j) => j.words)).toEqual(['Compared · 3 d', 'done'])
  })

  it('reads waiting on someone, and draws no track for a flow with no Once lane', () => {
    expect(companyTable(customer, CUSTOMERS).find((r) => r.contactId === 'elena')?.now.small).toEqual(['waiting on Jonah', '4 d', 'usually 21'])
    expect(companyTable(arch, ARCHITECTS)[0]?.track).toEqual([])
  })
})

describe('onStep', () => {
  it('reads a company on a step now or lapsed on it', () => {
    const greg = TRADES[0]!
    expect(['papers', 'ask', 'msa'].map((s) => onStep(greg, s))).toEqual([true, true, false])
  })
})

describe('the words', () => {
  it('writes every sentence of what lands on an empty step in plain words', () => {
    const ids = [TRADE_FLOW, CUSTOMER_FLOW, ARCH_FLOW].flatMap(flat).map((s) => s.id)
    const sentences = [...ids.map((id) => landsWords(id)), landsWords('x1'), landsWords('x1', true)]
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
