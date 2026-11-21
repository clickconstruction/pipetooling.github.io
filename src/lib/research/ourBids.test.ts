import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { answerBook, answeredBids, type CountedBid } from './builderAnswers'
import type { NameAnswerRow } from './nameAnswers'
import { BID_PLATFORM_KEYS, OUR_BID_DAYS, bidCounts, bidPartyKey, bidWon, isBidPlatformBucket, ourBidsSince } from './ourBids'
import { bidCompanies, type MarketBid } from './permitMarket'

/** Every company, job and number here is made up. */
const TODAY = '2026-11-20'

describe('which of our bids count', () => {
  it('looks back two years, to the day', () => {
    expect(OUR_BID_DAYS).toBe(730)
    expect(ourBidsSince(TODAY)).toBe('2024-11-20')
    expect(bidCounts({ projectName: 'Mill Street Lofts', bidOn: '2024-11-20' }, TODAY)).toBe(true)
    expect(bidCounts({ projectName: 'Mill Street Lofts', bidOn: '2024-11-19' }, TODAY)).toBe(false)
    expect(bidCounts({ projectName: 'Mill Street Lofts', bidOn: TODAY }, TODAY)).toBe(true)
    // A day to come is no bid yet, and a bid with no day is still a bid.
    expect(bidCounts({ projectName: 'Mill Street Lofts', bidOn: '2026-11-21' }, TODAY)).toBe(false)
    expect(bidCounts({ projectName: 'Mill Street Lofts', bidOn: null }, TODAY)).toBe(true)
  })

  it('leaves out a practice bid: a project name that starts with the word ZZ', () => {
    for (const name of ['ZZ Shadow MILL STREET LOFTS', 'ZZ Twin Mill Street Lofts', 'zz test', '  ZZ walk of the bid form', 'ZZ']) expect(bidCounts({ projectName: name, bidOn: '2026-06-01' }, TODAY)).toBe(false)
    for (const name of ['ZZZ Corp Tower', 'Mill Street Lofts', '', null]) expect(bidCounts({ projectName: name, bidOn: '2026-06-01' }, TODAY)).toBe(true)
  })

  it('keys a name as permits are, and gives none to a name that is no company', () => {
    expect(bidPartyKey('Lime Build, Inc.')).toBe('limebuild')
    expect(bidPartyKey('  Lime Build LLC ')).toBe('limebuild')
    expect(bidPartyKey('ZZ Test Builders')).toBeNull()
    expect(bidPartyKey(' zz lime build')).toBeNull()
    expect(bidPartyKey('PlanHub - Subcontractor Prime Opportunity')).toBeNull()
    expect(bidPartyKey('BuildingConnected bids')).toBeNull()
    expect(bidPartyKey('The Plan Hubbard Group')).toBe('theplanhubbardgroup')
    expect(bidPartyKey('')).toBeNull()
    expect(bidPartyKey(null)).toBeNull()
    expect(isBidPlatformBucket('PlanHub')).toBe(true)
  })

  it('reads won and started as a win', () => {
    expect(['won', 'started_or_complete', 'lost', null, undefined].map(bidWon)).toEqual([true, true, false, false, false])
  })
})

describe('one name, one count', () => {
  /** The same nine bids the SQL bed gives one builder (`supabase/tests/permit_skim`). Six count. */
  const NINE: Array<{ projectName: string; customer: boolean; gc: boolean; outcome: string | null; bidOn: string }> = [
    { projectName: 'Mill Street Lofts', customer: true, gc: false, outcome: 'won', bidOn: '2026-11-10' },
    { projectName: 'Kiln Street Offices', customer: true, gc: false, outcome: 'lost', bidOn: '2026-08-12' },
    { projectName: 'ZZ Shadow MILL STREET LOFTS', customer: true, gc: false, outcome: null, bidOn: '2026-11-15' },
    { projectName: 'zz test', customer: true, gc: false, outcome: null, bidOn: '2026-11-16' },
    { projectName: 'Aster Ridge Clinic', customer: true, gc: false, outcome: 'won', bidOn: '2024-11-19' },
    { projectName: 'Larkspur Court Retail', customer: true, gc: false, outcome: 'lost', bidOn: '2024-11-20' },
    { projectName: 'Orchard Way Retail', customer: false, gc: true, outcome: null, bidOn: '2026-10-31' },
    { projectName: 'Tower Blvd Fitout', customer: true, gc: true, outcome: null, bidOn: '2026-10-21' },
    { projectName: 'ZZZ Corp Tower', customer: true, gc: false, outcome: 'lost', bidOn: '2026-10-11' },
  ]

  it('Market’s table counts six of the nine, as the database’s count does on its bed', () => {
    const bids: MarketBid[] = NINE.map((b, i) => ({ id: `b${i}`, customerId: b.customer ? 'c1' : null, customerName: b.customer ? 'Lime Build, Inc.' : null, gcName: b.gc ? 'Lime Build LLC' : null, outcome: b.outcome, bidOn: b.bidOn, projectName: b.projectName }))
    const [lime] = bidCompanies({ bids, builders: [], book: null, todayYmd: TODAY })
    expect(lime).toMatchObject({ key: 'limebuild', bids: 6, won: 1, lastBidOn: '2026-11-10' })
  })

  it('a name tied to that customer reads the count of the customer’s own row in the table', () => {
    // The permits carry "Lime Permits"; a person tied it to the customer Lime Build.
    const tie: NameAnswerRow = { id: 'a1', builder_key: 'limepermits', customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: null, name: 'Lime Permits', answered_by: 'u1', answered_at: '2026-11-10T15:00:00Z' }
    const book = answerBook([tie], [{ id: 'c1', name: 'Lime Build, Inc.' }])
    const own = NINE.filter((b) => b.customer)
    const counted: CountedBid[] = own.map((b, i) => ({ id: `b${i}`, customerId: 'c1', outcome: b.outcome, bidOn: b.bidOn, projectName: b.projectName, legacyGcName: b.gc ? 'Lime Build LLC' : null }))
    const market: MarketBid[] = own.map((b, i) => ({ id: `b${i}`, customerId: 'c1', customerName: 'Lime Build, Inc.', gcName: b.gc ? 'Lime Build LLC' : null, outcome: b.outcome, bidOn: b.bidOn, projectName: b.projectName }))
    const [row] = bidCompanies({ bids: market, builders: [], book, todayYmd: TODAY })
    const tied = answeredBids('limepermits', book, counted, TODAY)
    expect({ bids: tied.bids, won: tied.won, lastBidOn: tied.lastBidOn }).toEqual({ bids: row?.bids, won: row?.won, lastBidOn: row?.lastBidOn })
    expect(tied.bids).toBe(5)
  })
})

describe('the database’s copy of the rule', () => {
  const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')
  /** The newest migration that writes the rule's functions: a later one that rewrites them is held to the kernel too. */
  // Read once: only a migration that names the rule can hold one of its functions.
  const naming = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .filter((sql) => sql.includes('research_bid_counts'))
  const newest = (fn: string): string => {
    const holding = naming.filter((sql) => sql.includes(`CREATE OR REPLACE FUNCTION public.${fn}(`))
    const sql = holding[holding.length - 1] ?? ''
    const at = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`)
    return at < 0 ? '' : sql.slice(at, sql.indexOf('$$;', at))
  }

  it('research_bid_counts looks back the kernel’s days and reads a practice bid as the kernel does', () => {
    const body = newest('research_bid_counts')
    expect(body).toContain(`public.app_today() - ${OUR_BID_DAYS} AND public.app_today()`)
    expect(body).toContain("!~* '^\\s*zz\\M'")
  })

  it('research_bid_party_key drops the kernel’s platforms and a ZZ name', () => {
    const body = newest('research_bid_party_key')
    expect(body).toContain(`'^(${BID_PLATFORM_KEYS.join('|')})'`)
    expect(body).toContain("~* '^\\s*zz'")
  })

  it('research_builders counts by both', () => {
    const body = newest('research_builders')
    expect(body).toContain('public.research_bid_counts(b.project_name, b.created_at)')
    expect(body).toContain('public.research_bid_party_key(c.name)')
    expect(body).toContain('public.research_bid_party_key(g.name)')
  })

  it('research_contact_history, the skim card’s warm · cold · new name word, counts by both', () => {
    const body = newest('research_contact_history')
    expect(body).toContain('public.research_bid_counts(b.project_name, b.created_at)')
    expect(body).toContain('public.research_bid_party_key(c.name)')
    expect(body).toContain('public.research_bid_party_key(g.name)')
  })
})
