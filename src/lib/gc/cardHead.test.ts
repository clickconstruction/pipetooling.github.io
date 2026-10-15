import { describe, expect, it } from 'vitest'
import { cardDoors, cardFactParts, doorWords, plansWords, stageWhen, type CardFacts, type DoorFacts } from './cardHead'

const facts = (over: Partial<CardFacts> = {}): CardFacts => ({
  address: '4400 Fair Oaks Pkwy, San Antonio',
  sqFt: 12400,
  sizeNote: 'retail shell',
  owner: 'Alamo Heights Holdings',
  architect: 'Studio Bexar',
  stage: 'bidding',
  bidDue: '2026-10-24',
  startDate: null,
  startedOn: null,
  lostOn: null,
  closedOn: null,
  today: '2026-10-14',
  ...over,
})

describe("a project's card: the facts line", () => {
  it('reads where, how big, for whom and when the bid is due, in that order', () => {
    expect(cardFactParts(facts())).toEqual(['4400 Fair Oaks Pkwy, San Antonio', '12,400 sq ft retail shell', 'for Alamo Heights Holdings, drawn by Studio Bexar', 'bid due Sat Oct 24, 10 days left'])
  })

  it('leaves out what it does not know: no size, no board, no due day', () => {
    expect(cardFactParts(facts({ sqFt: null, sizeNote: '', owner: null, architect: null, bidDue: null }))).toEqual(['4400 Fair Oaks Pkwy, San Antonio', 'no bid due day yet'])
    expect(cardFactParts(facts({ sqFt: null, owner: null }))).toEqual(['4400 Fair Oaks Pkwy, San Antonio', 'retail shell', 'drawn by Studio Bexar', 'bid due Sat Oct 24, 10 days left'])
  })

  it("says the bid's day as today, left or ago", () => {
    expect(stageWhen(facts({ today: '2026-10-24' }))).toBe('bid due Sat Oct 24, today')
    expect(stageWhen(facts({ today: '2026-10-23' }))).toBe('bid due Sat Oct 24, 1 day left')
    expect(stageWhen(facts({ today: '2026-10-27' }))).toBe('bid due Sat Oct 24, 3 days ago')
  })

  it('says the start while buying out, the start day once building, and lost or closed over either', () => {
    expect(stageWhen(facts({ stage: 'buyout', startDate: '2026-11-02' }))).toBe('start Mon Nov 2, in 19 days')
    expect(stageWhen(facts({ stage: 'buyout', startDate: '2026-10-14' }))).toBe('start Wed Oct 14, today')
    expect(stageWhen(facts({ stage: 'buyout', startDate: '2026-10-12' }))).toBe('start Mon Oct 12, 2 days ago')
    expect(stageWhen(facts({ stage: 'buyout' }))).toBe('no start date yet')
    expect(stageWhen(facts({ stage: 'building', startDate: '2026-09-14', startedOn: '2026-09-15' }))).toBe('started Tue Sep 15')
    expect(stageWhen(facts({ stage: 'building', startDate: '2026-09-14' }))).toBe('started Mon Sep 14')
    expect(stageWhen(facts({ stage: 'building' }))).toBe('started')
    expect(stageWhen(facts({ lostOn: '2026-10-03' }))).toBe('lost Oct 3')
    expect(stageWhen(facts({ stage: 'closed', closedOn: '2027-01-29' }))).toBe('closed Jan 29')
    expect(stageWhen(facts({ stage: 'closed' }))).toBe('closed')
  })
})

const doors = (over: Partial<DoorFacts> = {}, can: Partial<DoorFacts['can']> = {}, counts: Partial<DoorFacts['counts']> = {}): DoorFacts => ({
  stage: 'bidding',
  lost: false,
  can: { papers: true, schedule: true, start: true, log: true, punch: true, submittals: true, rfis: true, draws: true, changes: true, bill: true, billDay: false, closeout: true, number: true, tabs: true, ...can },
  counts: { questionsOpen: 0, logMissed: 0, changeOrders: 0, billDayOk: 0, billDayGates: 7, tabs: 0, ...counts },
  open: { number: false, tabs: false },
  ...over,
})

const words = (f: DoorFacts) => cardDoors(f).map((d) => `${d.group}:${doorWords(d)}`)

describe("a project's card: the doors", () => {
  it('a bidding job for a dev: the job set, then our number; the work set has nothing yet', () => {
    expect(words(doors({}, {}, { questionsOpen: 1, tabs: 2 }))).toEqual([
      'job:The plans',
      'job:Papers',
      'job:Questions about the plans · 1 open',
      'job:A new set of plans came in',
      'job:Schedule',
      'money:Our number',
      'money:Bid tabs · 2',
    ])
  })

  it('an estimator with no money and no schedule: the plans, the questions and a new set alone', () => {
    const f = doors({}, { papers: true, schedule: false, start: false, log: false, punch: false, submittals: false, rfis: false, draws: false, changes: false, bill: false, closeout: false, number: false, tabs: false })
    expect(words(f)).toEqual(['job:The plans', 'job:Papers', 'job:Questions about the plans', 'job:A new set of plans came in'])
  })

  it('a lost bid keeps the plans and the questions but offers no new set, no changes and no bill', () => {
    expect(words(doors({ lost: true }, {}, { questionsOpen: 2 }))).toEqual(['job:The plans', 'job:Papers', 'job:Questions about the plans · 2 open', 'job:Schedule', 'money:Our number'])
  })

  it('a job being bought out adds Get started, Change orders and Bill the customer', () => {
    expect(words(doors({ stage: 'buyout' }, {}, { changeOrders: 1 }))).toEqual([
      'job:The plans',
      'job:Papers',
      'job:Questions about the plans',
      'job:A new set of plans came in',
      'job:Schedule',
      'work:Get started',
      'money:Change orders · 1',
      'money:Bill the customer',
      'money:Our number',
    ])
  })

  it('a job being built fills the work set, with the daily log counting what it missed, and the money set with Bill day and Closeout', () => {
    const f = doors({ stage: 'building' }, { billDay: true }, { logMissed: 2, changeOrders: 2, billDayOk: 5, billDayGates: 7, tabs: 3 })
    expect(words(f)).toEqual([
      'job:The plans',
      'job:Papers',
      'job:Questions about the plans',
      'job:A new set of plans came in',
      'job:Schedule',
      'work:Get started',
      'work:Daily log · 2 missed',
      'work:Punch list',
      'work:Submittals',
      'work:RFIs',
      'work:Draws',
      'money:Change orders · 2',
      'money:Bill the customer',
      'money:Bill day · 5 of 7',
      'money:Closeout',
      'money:Our number',
      'money:Bid tabs · 3',
    ])
    const missed = cardDoors(f).find((d) => d.key === 'log')
    expect(missed?.tone).toBe('bad')
    expect(cardDoors(f).find((d) => d.key === 'billDay')?.title).toBe('Opens Money → Bill day → From the trades on this job.')
  })

  it('a closed job keeps Closeout and loses the work set', () => {
    expect(words(doors({ stage: 'closed' }))).toEqual([
      'job:The plans',
      'job:Papers',
      'job:Questions about the plans',
      'job:A new set of plans came in',
      'job:Schedule',
      'money:Change orders',
      'money:Bill the customer',
      'money:Closeout',
      'money:Our number',
    ])
  })

  it('the two panels say Hide once open, and the bid tabs drop their count then', () => {
    const f = doors({ open: { number: true, tabs: true } }, {}, { tabs: 2 })
    expect(words(f).filter((w) => w.startsWith('money:'))).toEqual(['money:Hide our number', 'money:Hide the bid tabs'])
  })

  it('carries the walkthrough anchors on the plans, a new set and the questions', () => {
    const f = cardDoors(doors())
    expect(f.find((d) => d.key === 'plans')?.tour).toBe('gc-plans')
    expect(f.find((d) => d.key === 'newSet')?.tour).toBe('gc-new-set')
    expect(f.find((d) => d.key === 'questions')?.tour).toBe('gc-questions')
    expect(f.find((d) => d.key === 'schedule')?.tour).toBeUndefined()
  })
})

describe("a project's card: the plans band's words", () => {
  it('names the newest set and its day, the sheets and sections, and the count of sets past one', () => {
    const sheets = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))
    expect(plansWords({ planSets: [{ label: 'Set 0', issuedOn: '2026-10-08' }], sheets: sheets(46), specs: sheets(3) })).toBe('Set 0 of Oct 8 · 46 sheets, 3 sections')
    expect(plansWords({ planSets: [{ label: 'Set 0', issuedOn: '2026-10-01' }, { label: 'Permit set', issuedOn: '2026-10-07' }], sheets: sheets(1), specs: [] })).toBe('Permit set of Oct 7 · 1 sheet · 2 sets in all')
    expect(plansWords({ planSets: [], sheets: [], specs: [] })).toBe('no set yet')
  })
})
