import { describe, expect, it } from 'vitest'
import type { NameAnswerRow } from './nameAnswers'
import type { BuilderRow } from './permitBuilders'
import { ourBidsWords, neverBid } from './permitBuilders'
import {
  answerBook,
  answeredBids,
  byWordWords,
  customerGroups,
  mayTie,
  notTiedWords,
  openLookAlikes,
  searchCustomers,
  sheetAsks,
  sheetTiePress,
  sheetTies,
  throughWords,
  tiedCustomerIds,
  withAnsweredBids,
  type CountedBid,
  type CustomerName,
} from './builderAnswers'

// Every name here is made up.
const CUSTOMERS: CustomerName[] = [
  { id: 'c1', name: 'Ridgeway Builders' },
  { id: 'c2', name: 'Ridgeway Builders, LLC' },
  { id: 'c3', name: 'Hartwell Interiors' },
  { id: 'c4', name: 'Tall Pine Development' },
]
const names: Record<string, string> = { u1: 'Eve', u2: 'Sam' }
const nameOf = (id: string) => names[id] ?? null
const ME = 'u1'
const TEXAS = 'ridgewaybuildersoftexas'

let n = 0
function answer(over: Partial<NameAnswerRow> = {}): NameAnswerRow {
  n += 1
  return { id: `a${n}`, builder_key: TEXAS, customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: null, name: 'Ridgeway Builders of Texas LLC', answered_by: 'u2', answered_at: `2026-11-10T${String(10 + (n % 10)).padStart(2, '0')}:00:00Z`, ...over }
}
function builder(over: Partial<BuilderRow> = {}): BuilderRow {
  return { key: TEXAS, name: null, sample_contact: 'Ridgeway Builders of Texas LLC', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 7, open: 2, last_permit_on: '2026-11-03', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}
let b = 0
function bid(over: Partial<CountedBid> = {}): CountedBid {
  b += 1
  return { id: `b${b}`, customerId: 'c1', outcome: null, bidOn: '2026-06-01', projectName: 'Mill Street Lofts', legacyGcName: null, ...over }
}

describe('customerGroups', () => {
  it('reads every customer row of one keyed name as one customer, in its first spelling', () => {
    const groups = customerGroups(CUSTOMERS)
    expect(groups.map((g) => g.name)).toEqual(['Ridgeway Builders', 'Hartwell Interiors', 'Tall Pine Development'])
    expect(groups[0]).toEqual({ key: 'ridgewaybuilders', ids: ['c1', 'c2'], name: 'Ridgeway Builders' })
  })

  it('lets a name with nothing to key stand alone', () => {
    expect(customerGroups([{ id: 'c9', name: 'LLC' }, { id: 'c8', name: 'Inc.' }]).map((g) => g.key)).toEqual(['id:c9', 'id:c8'])
  })
})

describe('answerBook', () => {
  it('folds each customer’s answers through the bid side’s fold, and turns the ties to face the names', () => {
    const book = answerBook([answer(), answer({ builder_key: 'danawhitlow', name: 'Dana Whitlow', customer_id: 'c3', scope: 'this_permit', permit_id: 'p1' })], CUSTOMERS)
    expect(book.states.get('ridgewaybuilders')?.get(TEXAS)).toMatchObject({ all: true, by: 'u2' })
    expect(book.tied.get(TEXAS)?.map((g) => g.name)).toEqual(['Ridgeway Builders'])
    // A tie to one permit ties no bids: only a tie to every permit counts a customer's bids.
    expect(book.tied.has('danawhitlow')).toBe(false)
    expect(tiedCustomerIds(book).sort()).toEqual(['c1', 'c2'])
  })

  it('reads one GC under two customer rows as one: a take-back on the other row unties it', () => {
    const rows = [answer({ answered_at: '2026-11-01T15:00:00Z' }), answer({ customer_id: 'c2', answer: 'taken_back', scope: null, answered_at: '2026-11-02T15:00:00Z' })]
    const book = answerBook(rows, CUSTOMERS)
    expect(book.tied.size).toBe(0)
    expect(tiedCustomerIds(book)).toEqual([])
  })

  it('keeps the customer row the answer that stands was written on', () => {
    const book = answerBook([answer({ customer_id: 'c1', answered_at: '2026-11-01T15:00:00Z' }), answer({ customer_id: 'c2', answer: 'someone_else', scope: null, answered_at: '2026-11-02T15:00:00Z' })], CUSTOMERS)
    expect(book.rowOf.get(`ridgewaybuilders|${TEXAS}`)).toBe('c2')
  })

  it('lets a customer the list does not hold stand alone, unnamed', () => {
    const book = answerBook([answer({ customer_id: 'gone' })], CUSTOMERS)
    expect(book.groupOf.get('gone')).toEqual({ key: 'id:gone', ids: ['gone'], name: 'a customer' })
    expect(book.tied.get(TEXAS)?.[0]?.ids).toEqual(['gone'])
  })

  it('lists the customers a name is tied to, the newest tie first', () => {
    const book = answerBook([answer({ customer_id: 'c3', answered_at: '2026-11-01T15:00:00Z' }), answer({ customer_id: 'c4', answered_at: '2026-11-05T15:00:00Z' })], CUSTOMERS)
    expect(book.tied.get(TEXAS)?.map((g) => g.name)).toEqual(['Tall Pine Development', 'Hartwell Interiors'])
  })
})

describe('our bids with a tied name', () => {
  const book = answerBook([answer()], CUSTOMERS)

  it('counts the tied customer’s bids, on every row of that customer, with the wins and the newest day', () => {
    const bids = [bid({ outcome: 'won', bidOn: '2026-03-01' }), bid({ customerId: 'c2', outcome: 'started_or_complete', bidOn: '2026-09-14' }), bid({ outcome: 'lost' }), bid({ customerId: 'c3', outcome: 'won' })]
    expect(answeredBids(TEXAS, book, bids)).toEqual({ bids: 3, won: 2, lastBidOn: '2026-09-14', customers: ['Ridgeway Builders'] })
  })

  it('leaves out a robot’s copy, and a bid the same-name hint already counts through the old builders list', () => {
    const bids = [bid(), bid({ projectName: 'ZZ Shadow MILL STREET LOFTS' }), bid({ projectName: 'ZZ Twin Mill Street Lofts' }), bid({ legacyGcName: 'Ridgeway Builders of Texas, LLC' }), bid({ legacyGcName: 'Some Other Builder' })]
    expect(answeredBids(TEXAS, book, bids)).toMatchObject({ bids: 2 })
  })

  it('counts a bid once, and nothing for a name tied to nobody', () => {
    const twice = bid()
    expect(answeredBids(TEXAS, book, [twice, twice])).toMatchObject({ bids: 1 })
    expect(answeredBids('copperlinemechanical', book, [bid()])).toEqual({ bids: 0, won: 0, lastBidOn: null, customers: [] })
  })

  it('does not count a customer of the name itself twice: the hint has every bid with it', () => {
    // Someone tied "Ridgeway Builders" on permits to the customer Ridgeway Builders.
    const own = answerBook([answer({ builder_key: 'ridgewaybuilders', name: 'Ridgeway Builders' })], CUSTOMERS)
    expect(answeredBids('ridgewaybuilders', own, [bid(), bid()])).toMatchObject({ bids: 0 })
  })

  it('adds the answers to the same-name count on the row, and says through whom', () => {
    const rows = [builder({ bids: 2, won: 1, last_bid_on: '2026-10-02' }), builder({ key: 'copperlinemechanical', sample_contact: 'Copperline Mechanical', bids: 4, won: 0, last_bid_on: '2026-01-05' })]
    const out = withAnsweredBids(rows, book, [bid({ outcome: 'won', bidOn: '2026-03-01' }), bid({ bidOn: '2026-11-02' })])
    expect(out[0]).toMatchObject({ bids: 4, won: 2, last_bid_on: '2026-11-02', by_word: { bids: 2, won: 1, customers: ['Ridgeway Builders'] } })
    expect(ourBidsWords(out[0] as BuilderRow)).toBe('4 priced, 2 won')
    expect(throughWords(out[0] as BuilderRow)).toBe('through Ridgeway Builders')
    expect(byWordWords(out[0] as BuilderRow)).toBe('2 of them are with Ridgeway Builders, tied to this name by a person’s word.')
    // A row no answer touches is the row the read gave.
    expect(out[1]).toBe(rows[1])
    expect(throughWords(out[1] as BuilderRow)).toBeNull()
    expect(byWordWords(out[1] as BuilderRow)).toBeNull()
  })

  it('keeps the read’s own newest day when it is the later one', () => {
    const out = withAnsweredBids([builder({ bids: 1, last_bid_on: '2026-12-01' })], book, [bid({ bidOn: '2026-03-01' })])
    expect(out[0]).toMatchObject({ bids: 2, last_bid_on: '2026-12-01' })
  })

  it('takes a tied name off the list of who to get to know', () => {
    const before = builder()
    expect(neverBid(before)).toBe(true)
    const [after] = withAnsweredBids([before], book, [bid()])
    expect(neverBid(after as BuilderRow)).toBe(false)
    expect(ourBidsWords(after as BuilderRow)).toBe('1 priced, none won')
    expect(byWordWords(after as BuilderRow)).toBe('1 of them is with Ridgeway Builders, tied to this name by a person’s word.')
  })

  it('stops counting once the tie is taken back, or the answer is someone else', () => {
    const taken = answerBook([answer({ answered_at: '2026-11-01T15:00:00Z' }), answer({ answer: 'taken_back', scope: null, answered_at: '2026-11-02T15:00:00Z' })], CUSTOMERS)
    expect(withAnsweredBids([builder()], taken, [bid()])[0]).toMatchObject({ bids: 0 })
    const no = answerBook([answer({ answer: 'someone_else', scope: null })], CUSTOMERS)
    expect(withAnsweredBids([builder()], no, [bid()])[0]).toMatchObject({ bids: 0 })
    const one = answerBook([answer({ scope: 'this_permit', permit_id: 'p1' })], CUSTOMERS)
    expect(withAnsweredBids([builder()], one, [bid()])[0]).toMatchObject({ bids: 0 })
  })

  it('names two customers, and counts past two', () => {
    const two = answerBook([answer({ customer_id: 'c3', answered_at: '2026-11-01T15:00:00Z' }), answer({ customer_id: 'c4', answered_at: '2026-11-05T15:00:00Z' })], CUSTOMERS)
    const [row] = withAnsweredBids([builder()], two, [bid({ customerId: 'c3' }), bid({ customerId: 'c4' })])
    expect(throughWords(row as BuilderRow)).toBe('through Tall Pine Development and Hartwell Interiors')
    expect(throughWords({ by_word: { bids: 3, won: 0, customers: ['A', 'B', 'C'] } })).toBe('through 3 customers tied to it')
  })
})

describe('the builder’s sheet', () => {
  it('lists each customer the name is tied to with whose word it is, the newest first, then the Nos', () => {
    const book = answerBook(
      [
        answer({ customer_id: 'c1', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z' }),
        answer({ customer_id: 'c3', answer: 'someone_else', scope: null, answered_by: 'u1', answered_at: '2026-11-10T18:00:00Z' }),
        answer({ customer_id: 'c4', scope: 'this_permit', permit_id: 'p4', answered_by: 'u1', answered_at: '2026-11-08T18:00:00Z' }),
      ],
      CUSTOMERS,
    )
    expect(sheetTies(builder(), book, ME, nameOf)).toEqual([
      { kind: 'tied', customerKey: 'ridgewaybuilders', customer: 'Ridgeway Builders', customerId: 'c1', how: 'Same company · Sam’s word, Nov 9' },
      { kind: 'tied', customerKey: 'tallpinedevelopment', customer: 'Tall Pine Development', customerId: 'c4', how: 'Tied on 1 permit · your word, Nov 8' },
      { kind: 'not_them', customerKey: 'hartwellinteriors', customer: 'Hartwell Interiors', customerId: 'c3', how: 'Not them · your word, Nov 10' },
    ])
  })

  it('says a person works for them, and takes a tie back on the row it was written on', () => {
    const dana = builder({ key: 'danawhitlow', sample_contact: 'Dana Whitlow' })
    const book = answerBook([answer({ builder_key: 'danawhitlow', name: 'Dana Whitlow', customer_id: 'c2', answered_at: '2026-11-09T18:00:00Z' })], CUSTOMERS)
    expect(sheetTies(dana, book, ME, nameOf)).toEqual([{ kind: 'tied', customerKey: 'ridgewaybuilders', customer: 'Ridgeway Builders', customerId: 'c2', how: 'Works for them · Sam’s word, Nov 9' }])
    expect(sheetTiePress(dana)).toBe('Works for them')
    expect(sheetTiePress(builder())).toBe('Same company')
  })

  it('shows a customer of the exact same name as joined by name, with nothing to take back', () => {
    const same = builder({ key: 'ridgewaybuilders', sample_contact: 'Paula Kemp, Ridgeway Builders' })
    const book = answerBook([], CUSTOMERS)
    expect(sheetTies(same, book, ME, nameOf)).toEqual([{ kind: 'own', customerKey: 'ridgewaybuilders', customer: 'Ridgeway Builders', customerId: null, how: 'The same name' }])
    expect(notTiedWords(sheetTies(same, book, ME, nameOf), null)).toBeNull()
  })

  it('says so where the name is not tied, with the press that ties one', () => {
    const book = answerBook([], CUSTOMERS)
    const copper = builder({ key: 'copperlinemechanical', sample_contact: 'Copperline Mechanical' })
    expect(notTiedWords(sheetTies(copper, book, ME, nameOf), null)).toEqual({ main: 'No customer is tied to this name. Our bids count the exact same name only.', next: 'Tie to a customer', tail: 'finds one of ours.' })
    // A No alone ties nobody.
    const no = answerBook([answer({ builder_key: 'copperlinemechanical', answer: 'someone_else', scope: null })], CUSTOMERS)
    expect(notTiedWords(sheetTies(copper, no, ME, nameOf), null)?.next).toBe('Tie to a customer')
    // A name that files for others is never tied to one customer.
    expect(notTiedWords([], 'files_for_others')).toEqual({ main: 'No customer is tied to this name. A name that files for others is never tied to one customer.', next: '', tail: '' })
    expect(mayTie('files_for_others')).toBe(false)
    expect(mayTie('gc')).toBe(true)
    expect(mayTie(null)).toBe(true)
  })

  it('asks Same company? of a customer whose name begins this one, once', () => {
    const book = answerBook([], CUSTOMERS)
    expect(sheetAsks(builder(), book, ME)).toEqual([{ customerKey: 'ridgewaybuilders', customer: 'Ridgeway Builders', customerId: 'c1', lead: 'Your customer is Ridgeway Builders.', ask: 'Same company?', why: 'Asked because one name begins the other. Asked once.' }])
    // A shared word is not the likely grade: that is the worklist's to offer.
    expect(sheetAsks(builder({ key: 'ridgewayroofing', sample_contact: 'Ridgeway Roofing Co' }), book, ME)).toEqual([])
    // The exact same name is joined already.
    expect(sheetAsks(builder({ key: 'ridgewaybuilders', sample_contact: 'Ridgeway Builders' }), book, ME)).toEqual([])
  })

  it('stops asking once anyone ties it or says no, once this person passes, and of a name that files for others', () => {
    expect(sheetAsks(builder(), answerBook([answer()], CUSTOMERS), ME)).toEqual([])
    expect(sheetAsks(builder(), answerBook([answer({ answer: 'someone_else', scope: null })], CUSTOMERS), ME)).toEqual([])
    const passed = answerBook([answer({ answer: 'not_sure', scope: null, answered_by: 'u1' })], CUSTOMERS)
    expect(sheetAsks(builder(), passed, 'u1')).toEqual([])
    expect(sheetAsks(builder(), passed, 'u2')).toHaveLength(1)
    expect(sheetAsks(builder({ kind: 'files_for_others' }), answerBook([], CUSTOMERS), ME)).toEqual([])
    // Taken back, the question comes back.
    const back = answerBook([answer({ answered_at: '2026-11-01T15:00:00Z' }), answer({ answer: 'taken_back', scope: null, answered_at: '2026-11-02T15:00:00Z' })], CUSTOMERS)
    expect(sheetAsks(builder(), back, ME)).toHaveLength(1)
  })

  it('searches our customers by the start of a word, and leaves out one already answered for the name', () => {
    const book = answerBook([answer({ customer_id: 'c3', answer: 'someone_else', scope: null })], CUSTOMERS)
    expect(searchCustomers('tall', builder(), book).map((g) => g.name)).toEqual(['Tall Pine Development'])
    expect(searchCustomers('pine dev', builder(), book).map((g) => g.name)).toEqual(['Tall Pine Development'])
    expect(searchCustomers('hart', builder(), book)).toEqual([])
    expect(searchCustomers('ine', builder(), book)).toEqual([])
    expect(searchCustomers('  ', builder(), book)).toEqual([])
  })
})

describe('openLookAlikes', () => {
  const pair = (customerId: string, key: string) => ({ customerId, customerName: 'x', suggestion: { key } })

  it('drops a pair someone has since tied or refused, on any row of that customer', () => {
    const book = answerBook([answer({ customer_id: 'c2' }), answer({ builder_key: 'hartwellinterior', customer_id: 'c3', answer: 'someone_else', scope: null })], CUSTOMERS)
    const pairs = [pair('c1', TEXAS), pair('c3', 'hartwellinterior'), pair('c4', 'tallpinedevelopmentgroup'), pair('c1', 'ridgewayroofing')]
    expect(openLookAlikes(pairs, book)).toEqual([pairs[2], pairs[3]])
  })

  it('keeps a pair that was only passed, or tied on one permit', () => {
    const book = answerBook([answer({ answer: 'not_sure', scope: null }), answer({ builder_key: 'danawhitlow', scope: 'this_permit', permit_id: 'p1' })], CUSTOMERS)
    const pairs = [pair('c1', TEXAS), pair('c1', 'danawhitlow')]
    expect(openLookAlikes(pairs, book)).toEqual(pairs)
  })
})
