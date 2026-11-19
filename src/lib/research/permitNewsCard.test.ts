import { describe, expect, it } from 'vitest'
import { bidPermitNews, type NewsBid, type NewsItem } from './bidPermitNews'
import type { SitePermitRow } from './bidSitePanel'
import { answeredWords, CARD_ANSWER_LABEL, CARD_ANSWER_SAVES, permitNewsCard, receiptWords, type CardBid } from './permitNewsCard'

// Every bid, builder, plumber and permit here is made up.
const READ = ['San Antonio']
const TODAY = '2026-11-19'

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-26-118204', address: '4410 NORTHSIDE DR', kind: 'building', stage: 'issued', permit_type: 'Comm New Building Permit', work_type: 'Commercial new building',
    project_name: 'NORTHSIDE HIGH SCHOOL RESTROOMS', submitted_on: '2026-06-20', issued_on: '2026-07-30', contact: 'Ridgeway Builders LLC', declared_value: 2_100_000, area_sf: 14_200, builder_key: 'ridgewaybuilders', ...over,
  }
}
const plumbing = (over: Partial<SitePermitRow> = {}) => permit({ id: 'p2', permit_number: 'PLB-26-041877', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', issued_on: '2026-08-27', project_name: 'RESTROOM REMODEL 12 FIXTURES', contact: 'Copperline Plumbing', declared_value: null, area_sf: null, builder_key: 'copperlineplumbing', ...over })

type Bid = NewsBid & CardBid
function bid(over: Partial<Bid> = {}): Bid {
  return { id: 'b502', bid_number: '502', project_name: 'Northside High School restrooms', address: '4410 Northside Dr, San Antonio, TX 78230', outcome: null, bid_date_sent: '2026-06-04', created_at: '2026-05-20T15:00:00Z', last_contact: '2026-10-09T15:00:00Z', bid_value: 212_000, gcName: 'Ridgeway Builders', ...over }
}
function item(b: Bid, permits: SitePermitRow[]): NewsItem {
  const { news } = bidPermitNews([b], new Map([['San Antonio', permits]]), READ, TODAY)
  if (news.length !== 1) throw new Error(`expected one line, got ${news.length}`)
  return news[0] as NewsItem
}
const card = (b: Bid, permits: SitePermitRow[]) => permitNewsCard(item(b, permits), b, READ, TODAY)

describe('permitNewsCard', () => {
  it('a plumber under another name on a sent bid: the question is the loss, with three answers', () => {
    const c = card(bid(), [permit(), plumbing()])
    expect(c).toMatchObject({
      tone: 'red',
      kind: 'Another name on the plumbing permit',
      notSent: false,
      bidNumber: '502',
      bidName: 'Northside High School restrooms',
      bidMeta: 'Ridgeway Builders · $212k · sent Jun 4 · last contact 41 days ago',
      head: 'The city lists Copperline Plumbing on a plumbing permit here, issued Aug 27.',
      cityQuote: 'RESTROOM REMODEL 12 FIXTURES',
      cityFacts: 'Permit PLB-26-041877',
      question: 'Did we lose this bid?',
      answers: ['lost', 'waiting', 'not_ours'],
      callDoor: false,
    })
    // What matched first, then what the records do not say.
    expect(c.reasons).toEqual([
      { ok: true, words: 'Issued 84 days after you sent the bid' },
      { ok: true, words: 'The building permit lists Ridgeway Builders LLC, your GC' },
      { ok: true, words: 'The city’s project line looks like this job' },
      { ok: false, words: 'Neither the permit nor the bid names a suite' },
    ])
  })

  it('says the suite when both sides name it, and what is missing when one does not', () => {
    const suite = bid({ address: '2200 Tradewind Dr, Suite 100, San Antonio, TX', project_name: 'Suite 100, Tradewind Drive' })
    const own = card(suite, [plumbing({ address: '2200 TRADEWIND DR', project_name: 'Building No: 1; Unit No: 100' })])
    expect(own.reasons[0]).toEqual({ ok: true, words: 'Suite 100, the bid’s own suite' })
    // San Antonio's building and unit line is not the work in the city's words.
    expect(own.cityQuote).toBeNull()
    expect(card(suite, [plumbing({ address: '2200 TRADEWIND DR', project_name: null })]).reasons).toContainEqual({ ok: false, words: 'The permit names no suite' })
    expect(card(bid(), [plumbing({ address: '4410 NORTHSIDE DR STE 130' })]).reasons).toContainEqual({ ok: false, words: 'The permit names suite 130 and the bid names none' })
  })

  it('a building permit issued on a sent bid points at the Call queue, and says what it declares', () => {
    const c = card(bid(), [permit({ issued_on: '2026-10-29' })])
    expect(c).toMatchObject({ tone: 'green', kind: 'Building permit issued', head: 'The building permit here was issued Oct 29.', cityFacts: 'Permit COM-26-118204 · $2.1M declared · 14,200 sq ft', question: 'The job is moving.', answers: ['got_it', 'not_ours'], callDoor: true })
    expect(c.reasons).toContainEqual({ ok: true, words: 'The permit lists Ridgeway Builders LLC, your GC' })
    expect(c.reasons).toContainEqual({ ok: true, words: 'Issued 147 days after you sent the bid' })
  })

  it('a bid not sent yet never offers a loss, and counts its days from the day it was started', () => {
    const unsent = bid({ bid_date_sent: null, last_contact: null, created_at: '2026-11-06T15:00:00Z' })
    const applied = card(unsent, [permit({ stage: 'applied', permit_number: 'APP-1', submitted_on: '2026-11-12', issued_on: null })])
    expect(applied).toMatchObject({ tone: 'amber', kind: 'Application filed', notSent: true, head: 'A permit application was filed here Nov 12.', question: 'Plans are with the city.', answers: ['got_it', 'not_ours'], callDoor: false, bidMeta: 'Ridgeway Builders · $212k' })
    expect(applied.reasons).toContainEqual({ ok: true, words: 'Filed 6 days after the bid was started' })
    const plumber = card(unsent, [plumbing({ issued_on: '2026-11-10' })])
    expect(plumber).toMatchObject({ question: 'Worth knowing before you send.', answers: ['got_it', 'not_ours'] })
  })

  it('reads a permit that lists us as ours', () => {
    const { news } = bidPermitNews([bid()], new Map([['San Antonio', [plumbing({ issued_on: '2026-11-10', contact: 'BLUE HERON PLUMBING' })]]]), READ, TODAY, new Set(['blueheronplumbing']))
    const c = permitNewsCard(news[0] as NewsItem, bid(), READ, TODAY)
    expect(c).toMatchObject({ tone: 'green', kind: 'Our plumbing permit', head: 'A plumbing permit here lists us, as BLUE HERON PLUMBING. It was issued Nov 10.', question: 'This permit is ours.', answers: ['got_it', 'not_ours'] })
  })

  it('leaves out what the bid does not have', () => {
    const bare = bid({ gcName: null, bid_value: null, last_contact: null, bid_number: null })
    const c = card(bare, [permit(), plumbing({ contact: 'Copperline Plumbing', issued_on: null, submitted_on: null })])
    expect(c.bidNumber).toBeNull()
    expect(c.bidMeta).toBe('sent Jun 4')
    expect(c.head).toBe('The city lists Copperline Plumbing on a plumbing permit here.')
    expect(c.reasons.some((r) => /your GC|days/.test(r.words))).toBe(false)
  })
})

describe('the answers', () => {
  it('writes this job for the two answers that keep the permit, and not this job for the third', () => {
    expect(CARD_ANSWER_SAVES).toEqual({ waiting: 'this_job', got_it: 'this_job', not_ours: 'not_this_job' })
    expect(CARD_ANSWER_LABEL).toEqual({ lost: 'We lost it…', waiting: 'Still waiting', got_it: 'Got it', not_ours: 'Not our job' })
  })

  it('says back what was pressed, and who answered a line that stands', () => {
    expect(receiptWords('waiting')).toBe('You said still waiting. The permit stays on the bid as a chip.')
    expect(receiptWords('got_it')).toBe('Got it. The permit stays on the bid as a chip.')
    expect(receiptWords('not_ours')).toBe('You said it is not our job. It is off the bid for everyone.')
    expect(answeredWords({ answer: 'this_job', by: 'u1', at: '2026-11-12T18:00:00Z' }, 'Marcus', TODAY)).toBe('Marcus said it is this job, Nov 12')
    expect(answeredWords({ answer: 'not_this_job', by: 'u1', at: '2025-12-14T18:00:00Z' }, 'You', TODAY)).toBe('You said it is not this job, Dec 14, 2025')
  })
})
