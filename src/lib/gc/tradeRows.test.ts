import { describe, expect, it } from 'vitest'
import type { HealthTile } from './stageHealth'
import { tradeRow, tradesWords, type TradeRowFacts } from './tradeRows'
import type { Invite, TradePackage } from './types'

const partners = [
  { id: 'hillside', company: 'Hillside Excavation', trades: ['Concrete'] },
  { id: 'alamo', company: 'Alamo Flatwork', trades: ['Concrete'] },
  { id: 'bexar', company: 'Bexar Concrete', trades: ['Concrete'] },
  { id: 'tejas', company: 'Tejas Power', trades: ['Electrical'] },
]

const invite = (id: string, partnerId: string, status: Invite['status'], amount?: number): Invite =>
  ({ id, partnerId, status, invitedOn: '2026-10-08', seenRev: null, bid: amount === undefined ? null : { amount, basedOnRev: 0, submittedOn: '2026-10-13', includes: {}, plugs: {}, note: '' } }) as Invite

const pkg = (over: Partial<TradePackage> = {}): TradePackage =>
  ({ id: 'k1', trade: 'Concrete', bidTab: null, scope: [], budget: 148000, selfPerform: null, invites: [], carried: null, awardedInviteId: null, sow: null, ...over }) as TradePackage

const trade = { id: 'k1', trade: 'Concrete', budget: 148000, ours: false, scope: [{ id: 's1', label: 'Footings', sheets: null, specs: null, addedInSetId: null }], excludes: [] }

const facts = (over: Partial<TradeRowFacts> = {}): TradeRowFacts => ({ stage: 'bidding', trade, pkg: pkg(), tile: null, partners, ...over })

describe('one row a trade: bidding', () => {
  it('says the scope, the budget, the quotes in over the companies asked, each company with its state, and what to do next', () => {
    const row = tradeRow(facts({ pkg: pkg({ invites: [invite('i1', 'hillside', 'invited'), invite('i2', 'alamo', 'opened')] }), tile: { packageId: 'k1', trade: 'Concrete', state: 'bad', main: 'No quote', note: '2 asked, none in' } }))
    expect(row.scope).toBe('1 line')
    expect(row.money).toEqual({ label: 'Budget', words: '$148,000' })
    expect(row.stripe).toBe('bad')
    expect(row.who).toBeNull()
    expect(row.standing).toEqual({ kind: 'quotes', words: '0 of 2 in', tone: 'bad' })
    expect(row.asked).toEqual([
      { company: 'Hillside Excavation', words: 'has not opened it', tone: 'red' },
      { company: 'Alamo Flatwork', words: 'looking', tone: 'blue' },
    ])
    expect(row.waiting).toBeNull()
    // Bexar Concrete has not been asked, so there is someone left to ask.
    expect(row.next).toEqual({ key: 'ask', words: 'Ask for quotes' })
  })

  it('a quote in reads with its amount, and Compare quotes is the press; a passed company still shows', () => {
    const row = tradeRow(facts({ pkg: pkg({ invites: [invite('i1', 'hillside', 'bid', 91200), invite('i2', 'alamo', 'declined')] }) }))
    expect(row.standing).toEqual({ kind: 'quotes', words: '1 of 1 in', tone: 'warn' })
    expect(row.asked).toEqual([
      { company: 'Hillside Excavation', words: 'quote in · $91,200', tone: 'green' },
      { company: 'Alamo Flatwork', words: 'passed', tone: 'grey' },
    ])
    expect(row.next).toEqual({ key: 'compare', words: 'Compare quotes (1)' })
  })

  it('two quotes in is good, and with every company asked and none to compare there is no press', () => {
    const two = tradeRow(facts({ pkg: pkg({ invites: [invite('i1', 'hillside', 'bid', 91200), invite('i2', 'alamo', 'bid', 95000)] }) }))
    expect(two.standing).toEqual({ kind: 'quotes', words: '2 of 2 in', tone: 'good' })
    const all = tradeRow(facts({ pkg: pkg({ invites: [invite('i1', 'hillside', 'invited'), invite('i2', 'alamo', 'invited'), invite('i3', 'bexar', 'invited')] }) }))
    expect(all.next).toBeNull()
  })

  it('no company asked yet is a hole; the scope says what a trade leaves out', () => {
    const row = tradeRow(facts({ trade: { ...trade, scope: [...trade.scope, { id: 's2', label: 'Slab', sheets: null, specs: null, addedInSetId: null }], excludes: [{ label: 'rebar supply' } as never] } }))
    expect(row.standing).toEqual({ kind: 'quotes', words: 'no company asked yet', tone: 'bad' })
    expect(row.scope).toBe('2 lines, leaves out 1')
    expect(row.next).toEqual({ key: 'ask', words: 'Ask for quotes' })
  })

  it('our own crew is ours: no quotes, no asks, no press, a violet stripe even before the ring reads it', () => {
    const row = tradeRow(facts({ trade: { ...trade, id: 'k4', trade: 'Plumbing', ours: true, budget: 0 }, pkg: pkg({ id: 'k4', trade: 'Plumbing', selfPerform: { ref: 'b398', value: 62300, note: '' } }) }))
    expect(row.ours).toBe(true)
    expect(row.who).toBe('our own crew')
    expect(row.stripe).toBe('ours')
    expect(row.standing).toBeNull()
    expect(row.asked).toEqual([])
    expect(row.next).toBeNull()
    expect(row.money).toBeNull()
  })

  it('with no board the row says the scope and the budget alone, with no stripe', () => {
    const row = tradeRow(facts({ pkg: null }))
    expect(row).toMatchObject({ stripe: 'none', who: null, scope: '1 line', money: { label: 'Budget', words: '$148,000' }, standing: null, asked: [], next: null, waiting: null })
  })
})

describe('one row a trade: buying out and building', () => {
  const awarded = pkg({ invites: [invite('i1', 'hillside', 'bid', 142500)], awardedInviteId: 'i1', carried: 'i1' })

  it('buying out: who has it, the carried number until the statement of work is signed, the five dots and what waits', () => {
    const tile: HealthTile = { packageId: 'k1', trade: 'Concrete', state: 'warn', main: '2 to go', note: 'Master agreement waits on them', dots: ['on', 'wait', 'off', 'off', 'off'] }
    const row = tradeRow(facts({ stage: 'buyout', pkg: awarded, tile }))
    expect(row.who).toBe('Hillside Excavation')
    expect(row.money).toEqual({ label: 'Contract', words: '$142,500 carried' })
    expect(row.standing).toEqual({ kind: 'dots', dots: ['on', 'wait', 'off', 'off', 'off'], words: '2 to go' })
    expect(row.waiting).toBe('Master agreement waits on them')
    expect(row.asked).toEqual([])
    expect(row.next).toBeNull()
  })

  it('building: the contract from the statement of work, the share done and what waits on us', () => {
    const sow = { status: 'signed', price: 142500, retainagePct: 10, basedOnRev: 0, sov: [], signedOn: '2026-09-02', draws: [] } as unknown as TradePackage['sow']
    const tile: HealthTile = { packageId: 'k1', trade: 'Concrete', state: 'bad', main: '45%', note: 'Draw 2 waits on our approval', pct: 45 }
    const row = tradeRow(facts({ stage: 'building', pkg: pkg({ ...awarded, sow }), tile }))
    expect(row.money).toEqual({ label: 'Contract', words: '$142,500' })
    expect(row.standing).toEqual({ kind: 'pct', pct: 45, words: '45%' })
    expect(row.waiting).toBe('Draw 2 waits on our approval')
    expect(row.stripe).toBe('bad')
  })

  it('building, our own crew: no contract line, its share from the tile', () => {
    const tile: HealthTile = { packageId: 'k4', trade: 'Plumbing', state: 'ours', main: '52%', note: 'Our own crew', pct: 52 }
    const row = tradeRow(facts({ stage: 'building', trade: { ...trade, id: 'k4', trade: 'Plumbing', ours: true }, pkg: pkg({ id: 'k4', trade: 'Plumbing', selfPerform: { ref: 'b398', value: 62300, note: '' } }), tile }))
    expect(row.who).toBe('our own crew')
    expect(row.money).toBeNull()
    expect(row.standing).toEqual({ kind: 'pct', pct: 52, words: '52%' })
  })
})

describe('the band words', () => {
  it('counts the trades and says how many are ours', () => {
    expect(tradesWords([{ ours: false }, { ours: false }])).toBe('2')
    expect(tradesWords([{ ours: false }, { ours: true }])).toBe('2, one ours')
    expect(tradesWords([{ ours: true }, { ours: true }, { ours: false }])).toBe('3, 2 ours')
  })
})

describe('one row a trade: building with no statement of work', () => {
  it('says not awarded, or no statement of work yet, in red, where the ring has nothing to count', () => {
    const base = { id: 'k1', trade: 'Concrete', bidTab: null, scope: [], budget: 0, selfPerform: null, invites: [], carried: null, awardedInviteId: null, sow: null } as unknown as TradePackage
    const none = tradeRow({ stage: 'building', trade, pkg: base, tile: null, partners })
    expect(none.standing).toEqual({ kind: 'words', words: 'not awarded', tone: 'bad' })
    const awarded = tradeRow({ stage: 'building', trade, pkg: { ...base, invites: [invite('i1', 'hillside', 'bid', 1000)], awardedInviteId: 'i1' }, tile: null, partners })
    expect(awarded.standing).toEqual({ kind: 'words', words: 'no statement of work yet', tone: 'bad' })
    expect(awarded.who).toBe('Hillside Excavation')
  })
})
