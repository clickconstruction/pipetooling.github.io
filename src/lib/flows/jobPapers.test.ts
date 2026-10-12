import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { BoardCompany } from './board'
import { ARCH_FLOW, ARCHITECTS, CUSTOMER_FLOW, CUSTOMERS, FIRST_NAMES, JOBS, TODAY, TRADE_FLOW, TRADES, USUAL } from './boardFixtures'
import type { FlowKind, PaperId } from './facts'
import { gridColumns, jobPaperCounts, jobPaperGrid, jobPaperPills, jobStrip, paperCell, type GridColumn, type JobPaperCompany, type JobPapersInput, type PaperCell } from './jobPapers'
import type { PaperReading, StepPlace, StepState } from './state'

const read = (paper: PaperId, stepId: string, stepState: StepState, mark: PaperReading['mark'], on: string | null = null, expires: string | null = null): PaperReading => ({ paper, stepId, stepState, mark, on, expires })

const on = (c: BoardCompany | undefined, kind: FlowKind, reads: PaperReading[]): JobPaperCompany => {
  if (!c) throw new Error('no company')
  return { ...c, kind, reads: Object.fromEntries(reads.map((r) => [r.paper, r])) }
}
const byId = (cs: BoardCompany[], id: string) => cs.find((c) => c.contactId === id)

/** Who is on Boerne Retail Shell, a bid due Thu Oct 8, and how each paper stands for that job at Fri Oct 2. */
const BOERNE: JobPaperCompany[] = [
  on(byId(TRADES, 'greg'), 'trade', [
    read('invitation', 'invited', 'done', 'ok', '2026-09-08'),
    read('w9', 'papers', 'lapsed', 'ok', '2026-09-12'),
    read('coi', 'papers', 'lapsed', 'bad', '2026-09-12', '2026-09-30'),
    read('msa', 'msa', 'done', 'ok', '2026-09-14'),
    read('quote', 'ask', 'now', 'wait'),
    read('sow', 'sow', 'later', 'no'),
    read('waiver', 'draws', 'later', 'no'),
    read('final_waiver', 'closeout', 'later', 'no'),
  ]),
  on(byId(TRADES, 'bill'), 'trade', [
    read('invitation', 'invited', 'done', 'ok', '2026-09-08'),
    read('w9', 'papers', 'done', 'ok', '2026-09-09'),
    read('coi', 'papers', 'done', 'ok', '2026-09-09', '2027-03-01'),
    read('msa', 'msa', 'done', 'ok', '2026-09-10'),
    read('quote', 'ask', 'done', 'ok', '2026-09-29'),
    read('sow', 'sow', 'next', 'no'),
    read('waiver', 'draws', 'later', 'no'),
    read('final_waiver', 'closeout', 'later', 'no'),
  ]),
  on(byId(TRADES, 'tom'), 'trade', [
    read('invitation', 'invited', 'done', 'ok', '2026-09-25'),
    read('w9', 'papers', 'now', 'ok', '2026-09-29'),
    read('coi', 'papers', 'now', 'no'),
    read('msa', 'msa', 'next', 'no'),
    read('quote', 'ask', 'later', 'no'),
  ]),
  on(byId(TRADES, 'g3'), 'trade', [
    read('invitation', 'invited', 'done', 'ok', '2026-09-22'),
    read('w9', 'papers', 'now', 'no'),
    read('coi', 'papers', 'now', 'no'),
    read('msa', 'msa', 'next', 'no'),
    read('quote', 'ask', 'now', 'wait'),
  ]),
  on(byId(TRADES, 'g5'), 'trade', [
    read('invitation', 'invited', 'done', 'ok', '2026-09-20'),
    read('w9', 'papers', 'done', 'ok', '2026-09-24'),
    read('coi', 'papers', 'done', 'ok', '2026-09-24', '2026-10-20'),
    read('msa', 'msa', 'now', 'wait', '2026-09-29'),
    read('quote', 'ask', 'now', 'wait'),
  ]),
  on(byId(CUSTOMERS, 'elena'), 'customer', [read('msa', 'agreement', 'done', 'ok', '2026-08-04'), read('bid', 'bid', 'now', 'no'), read('contract', 'contract', 'later', 'no')]),
  on(byId(ARCHITECTS, 'jonah'), 'arch', [read('plans', 'plans', 'done', 'ok', '2026-09-15'), read('addendum', 'addenda', 'now', 'ok', '2026-10-02'), read('certificate', 'certify', 'later', 'no')]),
]

const FLOWS = { trade: TRADE_FLOW, customer: CUSTOMER_FLOW, arch: ARCH_FLOW }
const input = (jobId: string, companies: JobPaperCompany[]): JobPapersInput => ({ jobId, flows: FLOWS, companies, today: TODAY, usual: USUAL, firstNames: FIRST_NAMES, jobs: JOBS })
const boerne = input('boerne', BOERNE)
const col = (paper: PaperId, flow = TRADE_FLOW): GridColumn => {
  const c = gridColumns(flow).find((x) => x.paper === paper)
  if (!c) throw new Error(`no column ${paper}`)
  return c
}
const place = (p: Partial<StepPlace>): StepPlace => ({ stepId: 'ask', jobId: 'boerne', state: 'now', since: null, due: null, lateDays: null, waitingOn: null, lapsedPaper: null, ...p })
const cellWords = (c: PaperCell) => [c.mark, c.words, c.press]

describe('gridColumns', () => {
  it('reads every paper of the flow in its steps’ order, the trade’s final waiver included', () => {
    expect(gridColumns(TRADE_FLOW).map((c) => [c.label, c.stepId, c.ours])).toEqual([
      ['Invitation', 'invited', true],
      ['W-9', 'papers', false],
      ['Insurance', 'papers', false],
      ['MSA', 'msa', true],
      ['Quote', 'ask', false],
      ['SOW', 'sow', true],
      ['Waivers', 'draws', false],
      ['Final waiver', 'closeout', false],
    ])
    expect(gridColumns(CUSTOMER_FLOW).map((c) => c.label)).toEqual(['Agreement', 'Bid', 'Contract', 'Schedule', 'Pay apps', 'Changes'])
    expect(gridColumns(ARCH_FLOW).map((c) => c.label)).toEqual(['Plans', 'Addenda', 'Submittals', 'Certificates'])
  })
})

describe('paperCell', () => {
  it('reads a paper that ran out as lapsed, and asks for a new one', () => {
    expect(paperCell(col('coi'), read('coi', 'papers', 'lapsed', 'bad', '2026-09-12', '2026-09-30'), null, TODAY)).toMatchObject({ mark: 'lapsed', words: 'ran out', tip: 'ran out Wed Sep 30', press: 'ask' })
  })

  it('reads a paper on file with its day, or as running out soon within 30 days', () => {
    expect(cellWords(paperCell(col('w9'), read('w9', 'papers', 'done', 'ok', '2026-09-12'), null, TODAY))).toEqual(['done', 'Sep 12', 'open'])
    expect(cellWords(paperCell(col('coi'), read('coi', 'papers', 'done', 'ok', '2026-09-24', '2026-10-20'), null, TODAY))).toEqual(['soon', 'runs out Oct 20', 'ask'])
    expect(cellWords(paperCell(col('coi'), read('coi', 'papers', 'done', 'ok', '2026-09-09', '2027-03-01'), null, TODAY))).toEqual(['done', 'Sep 9', 'open'])
    expect(cellWords(paperCell(col('msa'), read('msa', 'msa', 'done', 'ok'), null, TODAY))).toEqual(['done', 'done', 'open'])
  })

  it('takes a paper’s own days for running out soon when it has a setting', () => {
    expect(paperCell(col('coi'), read('coi', 'papers', 'done', 'ok', '2026-09-24', '2026-10-20'), null, TODAY, 10).mark).toBe('done')
  })

  it('reads a paper that went as waiting, with how long, its day, or late', () => {
    expect(cellWords(paperCell(col('msa'), read('msa', 'msa', 'now', 'wait', '2026-09-29'), null, TODAY))).toEqual(['waiting', '3 d', 'remind'])
    expect(cellWords(paperCell(col('quote'), read('quote', 'ask', 'now', 'wait'), place({ due: '2026-10-08', lateDays: -6 }), TODAY))).toEqual(['waiting', 'due Thu', 'remind'])
    // Asked Sep 24 and due Thu: the day ahead says more than the 8 days since it was asked.
    expect(cellWords(paperCell(col('quote'), read('quote', 'ask', 'now', 'wait', '2026-09-24'), place({ due: '2026-10-08', lateDays: -6 }), TODAY))).toEqual(['waiting', 'due Thu', 'remind'])
    expect(cellWords(paperCell(col('quote'), read('quote', 'ask', 'now', 'wait'), null, TODAY))).toEqual(['waiting', 'waiting', 'remind'])
    expect(paperCell(col('quote'), read('quote', 'ask', 'now', 'wait'), place({ due: '2026-09-30', lateDays: 2 }), TODAY)).toMatchObject({ mark: 'late', words: 'late 2 days', lateDays: 2, press: 'remind' })
  })

  it('reads a step on now with nothing on file as their move, or ours to send', () => {
    expect(cellWords(paperCell(col('coi'), read('coi', 'papers', 'now', 'no'), null, TODAY))).toEqual(['waiting', 'their move', 'remind'])
    expect(cellWords(paperCell(col('bid', CUSTOMER_FLOW), read('bid', 'bid', 'now', 'no'), null, TODAY))).toEqual(['waiting', 'ours', 'send'])
    expect(paperCell(col('coi'), read('coi', 'papers', 'now', 'no'), place({ stepId: 'papers', jobId: null, due: '2026-09-29', lateDays: 3 }), TODAY)).toMatchObject({ mark: 'late', words: 'late 3 days' })
  })

  it('reads the next step’s paper as none yet, and a step not reached as later', () => {
    expect(cellWords(paperCell(col('sow'), read('sow', 'sow', 'next', 'no'), null, TODAY))).toEqual(['none', 'none yet', 'send'])
    expect(cellWords(paperCell(col('msa'), read('msa', 'msa', 'next', 'no'), null, TODAY))).toEqual(['none', 'none yet', 'send'])
    expect(cellWords(paperCell(col('final_waiver'), read('final_waiver', 'closeout', 'later', 'no'), null, TODAY))).toEqual(['later', '', null])
    expect(paperCell(col('sow'), read('sow', 'sow', 'skipped', 'no'), null, TODAY)).toMatchObject({ mark: 'later', tip: 'skipped' })
    expect(paperCell(col('sow'), null, null, TODAY)).toMatchObject({ mark: 'later', stepId: null, press: null })
  })
})

describe('the counts and the pills', () => {
  it('counts the cells and words the pills, late and runs out soon on one orange pill', () => {
    const g = jobPaperGrid(boerne)
    expect(g.counts).toEqual({ lapsed: 1, late: 1, soon: 1, waiting: 7, done: 16 })
    expect(g.pills.map((p) => [p.key, p.words, p.tone])).toEqual([
      ['lapsed', '1 lapsed', 'bad'],
      ['lateOrSoon', '2 late or runs out soon', 'warn'],
      ['waiting', '7 waiting', ''],
      ['done', '16 done', 'ok'],
    ])
  })

  it('names the orange pill for what it holds, says all in when every paper is in, and nothing with no papers', () => {
    const n = { lapsed: 0, late: 0, soon: 0, waiting: 0, done: 0 }
    expect(jobPaperPills({ ...n, late: 2 }).map((p) => p.words)).toEqual(['2 late'])
    expect(jobPaperPills({ ...n, soon: 1, done: 3 }).map((p) => p.words)).toEqual(['1 runs out soon', '3 done'])
    expect(jobPaperPills({ ...n, done: 9 })).toEqual([{ key: null, words: 'all in', tone: 'ok' }])
    expect(jobPaperPills(n)).toEqual([])
    expect(jobPaperCounts([])).toEqual(n)
  })
})

describe('jobPaperGrid', () => {
  it('reads a section per kind, companies with something wrong first, then A to Z', () => {
    const g = jobPaperGrid(boerne)
    expect(g.sections.map((s) => [s.title, s.rows.map((r) => r.name)])).toEqual([
      ['Trade partner', ['Hillside Excavation', 'Kerr Electric', 'Bexar Steel Erectors', 'Lone Star Mechanical', 'Tejas Power']],
      ['Customer', ['Cibolo Creek Partners']],
      ['Architect', ['Marsh & Vale Architects']],
    ])
  })

  it('reads a row’s cells in the columns’ order, with the company’s trade and person under its name', () => {
    const greg = jobPaperGrid(boerne).sections[0]?.rows[0]
    expect(greg?.sub).toBe('Sitework · Greg Paulk')
    expect(greg?.cells.map((c) => [c.mark, c.words])).toEqual([
      ['done', 'Sep 8'],
      ['done', 'Sep 12'],
      ['lapsed', 'ran out'],
      ['done', 'Sep 14'],
      ['late', 'late 2 days'],
      ['later', ''],
      ['later', ''],
      ['later', ''],
    ])
    expect(jobPaperGrid(boerne).sections[1]?.rows[0]?.sub).toBe('Elena Marchetti')
  })

  it('keeps only the rows with a cell the pill names, and dims the other cells', () => {
    const g = jobPaperGrid(boerne, 'lateOrSoon')
    expect(g.sections.map((s) => [s.kind, s.rows.map((r) => r.contactId)])).toEqual([['trade', ['greg', 'g5']]])
    expect(g.sections[0]?.rows[1]?.cells.filter((c) => !c.dim).map((c) => [c.paper, c.words])).toEqual([['coi', 'runs out Oct 20']])
    expect(g.counts.done).toBe(16)
  })

  it('leaves out a company off the flow', () => {
    const off = BOERNE.map((c) => (c.contactId === 'tom' ? { ...c, off: { since: '2026-10-01', why: 'Went with another steel erector.' } } : c))
    expect(jobPaperGrid(input('boerne', off)).sections[0]?.rows.map((r) => r.contactId)).not.toContain('tom')
  })
})

describe('jobStrip', () => {
  const bid = { kind: 'bid' as const, due: '2026-10-08' }

  it('reads Before bid day: the insurance that ran out, the late quote, the compare over its usual, and the quotes due', () => {
    const s = jobStrip(boerne, bid)
    expect(s && { title: s.title, day: s.day, daysLeft: s.daysLeft }).toEqual({ title: 'Before bid day', day: '2026-10-08', daysLeft: 6 })
    expect(s?.lines.map((l) => [l.tone, l.text, l.press])).toEqual([
      ['r', "Hillside Excavation's insurance ran out Sep 30. No statement of work can go to them until a new one is in.", { kind: 'ask', contactId: 'greg', stepId: 'papers', paper: 'coi' }],
      ['o', "Hillside Excavation's quote is late 2 days.", { kind: 'remind', contactId: 'greg', stepId: 'ask', label: 'Remind Greg' }],
      ['o', "Tejas Power's quote is in. The compare has sat 3 days, over the usual 2.", { kind: 'compare' }],
      ['g', '2 quotes due Thu Oct 8: Lone Star Mechanical, Kerr Electric. On time so far.', { kind: 'remind-many', contactIds: ['g3', 'g5'], stepId: 'ask', label: 'Remind all 2' }],
    ])
  })

  it('says nothing once our bid went, after its day, or with nothing to say', () => {
    expect(jobStrip(boerne, { ...bid, sent: true })).toBeNull()
    expect(jobStrip(boerne, { ...bid, due: '2026-10-01' })).toBeNull()
    expect(jobStrip(input('boerne', BOERNE.filter((c) => c.kind !== 'trade')), bid)).toBeNull()
  })

  it('reads Before bill day: the gates still open, the first red', () => {
    const gates = [
      { ok: false, text: 'Every trade is in, or said nothing this period.', small: '2 not in: Hillside Excavation, Kerr Electric. Due Mon Oct 19.' },
      { ok: true, text: 'Nothing is sent back.', small: 'Nothing is out for a fix.' },
      { ok: false, text: 'The conditional waivers for this period are in.', small: 'Come with each draw. 3 of 6 so far.' },
    ]
    const s = jobStrip(input('stoneoak', []), { kind: 'project' }, { day: '2026-10-25', gates })
    expect(s && { title: s.title, daysLeft: s.daysLeft }).toEqual({ title: 'Before bill day', daysLeft: 23 })
    expect(s?.lines.map((l) => [l.tone, l.text, l.press])).toEqual([
      ['r', 'Every trade is in, or said nothing this period.', { kind: 'gate', index: 0 }],
      ['o', 'The conditional waivers for this period are in.', { kind: 'gate', index: 2 }],
    ])
    expect(jobStrip(input('stoneoak', []), { kind: 'project' }, { day: '2026-10-25', gates: gates.map((g) => ({ ...g, ok: true })) })).toBeNull()
    expect(jobStrip(input('fairoaks', []), { kind: 'pipeline' })).toBeNull()
  })

  it('names three companies at most on the quotes due, so the line stays short', () => {
    const many = [...BOERNE, ...['x1', 'x2', 'x3'].map((id, i) => ({ ...BOERNE[3]!, contactId: id, name: `Company ${i + 1}` }))]
    const due = jobStrip(input('boerne', many), bid)?.lines.find((l) => l.tone === 'g')
    expect(due?.text).toBe('5 quotes due Thu Oct 8: Lone Star Mechanical, Kerr Electric, Company 1 and 2 more. On time so far.')
    expect(due && plainWordsFailures(due.text)).toEqual([])
  })

  it('writes every line of the strip in plain words', () => {
    const texts = jobStrip(boerne, bid)?.lines.map((l) => l.text) ?? []
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
