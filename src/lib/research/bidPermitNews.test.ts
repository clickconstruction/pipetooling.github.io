import { describe, expect, it } from 'vitest'
import { BEFORE_BID_DAYS, bidPermitNews, newsForReader, permitInbox, permitRefOf, permitShortWords, type NewsBid } from './bidPermitNews'
import { foldPermitAnswers, type PermitAnswerRow } from './bidPermitAnswers'
import type { SitePermitRow } from './bidSitePanel'

// Every name, address and number here is made up.
const READ = ['San Antonio']
const TODAY = '2026-11-10'

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: '2026-10-20', issued_on: null, contact: 'Dana Whitlow', declared_value: 6_400_000, area_sf: 38_000, builder_key: 'danawhitlow', ...over,
  }
}
function bid(over: Partial<NewsBid> = {}): NewsBid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, last_contact: null, ...over }
}
const run = (bids: NewsBid[], permits: SitePermitRow[]) => bidPermitNews(bids, new Map([['San Antonio', permits]]), READ, TODAY)

describe('bidPermitNews', () => {
  it('says an application was filed, with what it declares', () => {
    const { chips, news } = run([bid()], [permit()])
    expect(chips.get('b1')).toEqual({ words: 'Applied Oct 20', tone: 'amber' })
    expect(news).toEqual([{ bidId: 'b1', kind: 'applied', title: '512 · Mill Street Lofts, Building C', day: '2026-10-20', markLost: false, words: 'A permit application was filed on this address Oct 20: $6.4M declared, 38,000 sq ft.', city: 'San Antonio', permit: permit(), beside: null, answered: null }])
  })

  it('says a building permit was issued, with how long since the last contact on a sent bid', () => {
    const issued = permit({ stage: 'issued', permit_type: 'Comm New Building Permit', issued_on: '2026-11-03' })
    const sent = run([bid({ bid_date_sent: '2026-09-30', last_contact: '2026-10-22T15:00:00Z' })], [issued])
    expect(sent.chips.get('b1')).toEqual({ words: 'Issued Nov 3', tone: 'green' })
    expect(sent.news[0]?.words).toBe('The building permit on this address was issued Nov 3. Last contact 19 days ago.')
    expect(run([bid()], [issued]).news[0]?.words).toBe('The building permit on this address was issued Nov 3. The bid is not sent yet.')
    expect(run([bid({ bid_date_sent: '2026-09-30' })], [issued]).news[0]?.words).toBe('The building permit on this address was issued Nov 3.')
  })

  it('keeps the chip and drops the news once a permit is older than thirty days', () => {
    const old = permit({ submitted_on: '2026-09-11' })
    const { chips, news } = run([bid()], [old])
    expect(chips.get('b1')).toEqual({ words: 'Applied Sep 11', tone: 'amber' })
    expect(news).toEqual([])
  })

  it('leads with a general plumbing permit that lists another name, however old, and marks nothing', () => {
    const plumbing = permit({ id: 'p2', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-08-30', project_name: null, contact: 'Lone Oak Plumbing' })
    const { chips, news } = run([bid({ bid_date_sent: '2026-08-01' }), bid({ id: 'b2', bid_number: '488', project_name: 'Harbor Street Offices', address: '88 Harbor St, San Antonio, TX' })], [permit({ submitted_on: '2026-07-01' }), plumbing, permit({ id: 'p3', address: '88 HARBOR ST', stage: 'issued', issued_on: '2026-11-05', project_name: 'HARBOR OFFICES' })])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · another name', tone: 'red' })
    expect(news.map((n) => n.kind)).toEqual(['plumbing', 'issued'])
    expect(news[0]?.words).toBe('A general plumbing permit was issued on this address Aug 30. It lists Lone Oak Plumbing. The bid is not yet won or lost.')
    expect(run([bid()], [permit(), plumbing]).news[0]?.words).toBe('A general plumbing permit was issued on this address Aug 30. It lists Lone Oak Plumbing. The bid is not sent yet.')
  })

  it('offers Mark lost… on another plumber’s permit once the bid is sent, and on no other line', () => {
    const plumbing = permit({ id: 'p2', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-08-30', project_name: null, contact: 'Lone Oak Plumbing' })
    const issued = permit({ stage: 'issued', permit_type: 'Comm New Building Permit', issued_on: '2026-11-03' })
    // A sent bid: the press. The same permit on a bid not sent yet: no press, since there is no offer out to lose.
    expect(run([bid({ bid_date_sent: '2026-08-01' })], [permit(), plumbing]).news.map((n) => [n.kind, n.markLost])).toEqual([['plumbing', true]])
    expect(run([bid()], [permit(), plumbing]).news.map((n) => [n.kind, n.markLost])).toEqual([['plumbing', false]])
    // A building permit issued or applied for is the day to call, never a loss.
    expect(run([bid({ bid_date_sent: '2026-09-30' })], [issued]).news.map((n) => [n.kind, n.markLost])).toEqual([['issued', false]])
    expect(run([bid({ bid_date_sent: '2026-09-30' })], [permit()]).news.map((n) => [n.kind, n.markLost])).toEqual([['applied', false]])
    // A plumbing permit under the building permit's own name is not another plumber: no plumbing line, no press.
    const own = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-11-01', project_name: null, contact: 'Dana Whitlow' })
    expect(run([bid({ bid_date_sent: '2026-08-01' })], [permit(), own]).news.some((n) => n.markLost)).toBe(false)
  })

  it('does not take a plumbing permit under the building permit’s own name for another plumber', () => {
    const own = permit({ id: 'p2', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-11-01', project_name: null, contact: 'Dana Whitlow' })
    const { chips, news } = run([bid()], [permit(), own])
    expect(chips.get('b1')).toEqual({ words: 'Applied Oct 20', tone: 'amber' })
    expect(news.map((n) => n.kind)).toEqual(['applied'])
  })

  it('gives a decided bid, a robot’s copy, a town not read and a site with nothing on it neither chip nor news', () => {
    const { chips, news } = run(
      [
        bid({ outcome: 'lost' }),
        bid({ id: 'b2', project_name: 'ZZ Shadow MILL STREET LOFTS' }),
        bid({ id: 'b3', address: '3798 Kyle Crossing Kyle, TX 78640' }),
        bid({ id: 'b4', address: '2210 Larkspur Dr, San Antonio, TX' }),
        bid({ id: 'b5', address: 'Loop 1604 at Oak Hollow' }),
      ],
      [permit()],
    )
    expect(chips.size).toBe(0)
    expect(news).toEqual([])
  })

  it('gives a site with only an irrigation permit no chip', () => {
    const irrigation = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', stage: 'issued', issued_on: '2026-11-02', project_name: null })
    expect(run([bid()], [irrigation]).chips.size).toBe(0)
  })
})

// Punch list #401: the lines the records can rule out. The shapes are the ones the live strip held; every row is made up.
describe('a line that is not true of the bid', () => {
  const PLUMBING = 'st-plumbing'
  const plumbingPermit = (over: Partial<SitePermitRow> = {}) => permit({ id: 'p2', permit_number: 'PLB-2', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-10-25', project_name: 'Building No: 1; Unit No: N/A', contact: 'Lone Oak Plumbing', ...over })
  const sentBid = (over: Partial<NewsBid> = {}) => bid({ bid_date_sent: '2026-08-01', created_at: '2026-07-20T15:00:00Z', service_type_id: PLUMBING, ...over })
  const read = (bids: NewsBid[], permits: SitePermitRow[]) => bidPermitNews(bids, new Map([['San Antonio', permits]]), READ, TODAY, undefined, PLUMBING)

  it('keeps the line when a plumber’s permit is issued after the bid was started, on the bid’s own suite or on none', () => {
    expect(read([sentBid()], [plumbingPermit()]).news.map((n) => [n.kind, n.markLost])).toEqual([['plumbing', true]])
    const suite = sentBid({ address: '4120 Mill Street, Suite 255, San Antonio, TX 78215' })
    expect(read([suite], [plumbingPermit({ project_name: 'Building No: 1; Unit No: 255' })]).news.map((n) => n.kind)).toEqual(['plumbing'])
    expect(read([suite], [plumbingPermit()]).news.map((n) => n.kind)).toEqual(['plumbing'])
  })

  it('another suite: a grease trap, an architect’s filing or a finish-out next door is no line and no chip', () => {
    const suite = sentBid({ address: '4120 Mill Street, Suite 255, San Antonio, TX 78215' })
    for (const nextDoor of [plumbingPermit({ project_name: 'Building No: 1; Unit No: 130' }), plumbingPermit({ address: '4120 MILL ST STE 130' }), plumbingPermit({ address: '4120 MILL ST BLDG 2 UNIT 130', issued_on: '2025-02-11' })]) {
      const { chips, news } = read([suite], [nextDoor])
      expect(news).toEqual([])
      expect(chips.size).toBe(0)
    }
    // The building permit on the whole address is still this bid's news.
    const { chips, news } = read([suite], [permit(), plumbingPermit({ project_name: 'Building No: 1; Unit No: 130' })])
    expect(news.map((n) => n.kind)).toEqual(['applied'])
    expect(chips.get('b1')).toEqual({ words: 'Applied Oct 20', tone: 'amber' })
  })

  it('there before the bid: inside six months it is a quiet chip, with no line and no Mark lost…', () => {
    // Site utility work issued nine days before the bid was started.
    const { chips, news } = read([sentBid()], [plumbingPermit({ issued_on: '2026-07-11' })])
    expect(news).toEqual([])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit here since Jul 11', tone: 'grey' })
    // A bid not sent yet reads the same way.
    expect(read([sentBid({ bid_date_sent: null })], [plumbingPermit({ issued_on: '2026-07-11' })]).news).toEqual([])
  })

  it('there before the bid: older than six months it is the address’s history, off the board', () => {
    // A shower install nine months before the bid was started.
    const old = plumbingPermit({ issued_on: '2025-10-18' })
    expect(read([sentBid()], [old])).toEqual({ chips: new Map(), news: [], takenOff: [] })
    // The cut-off is a day count, and the day it turns is the first day past it.
    const started = '2026-07-20'
    const dayBefore = (n: number) => new Date(Date.parse(`${started}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
    expect(read([sentBid()], [plumbingPermit({ issued_on: dayBefore(BEFORE_BID_DAYS) })]).chips.get('b1')?.tone).toBe('grey')
    expect(read([sentBid()], [plumbingPermit({ issued_on: dayBefore(BEFORE_BID_DAYS + 1) })]).chips.size).toBe(0)
  })

  it('there before the bid: a building permit that is news takes the row’s chip, and an old one leaves it to the quiet chip', () => {
    const before = plumbingPermit({ issued_on: '2026-07-11' })
    const fresh = read([sentBid()], [permit(), before])
    expect(fresh.news.map((n) => n.kind)).toEqual(['applied'])
    expect(fresh.chips.get('b1')).toEqual({ words: 'Applied Oct 20', tone: 'amber' })
    const stale = read([sentBid()], [permit({ submitted_on: '2026-09-11' }), before])
    expect(stale.news).toEqual([])
    expect(stale.chips.get('b1')).toEqual({ words: 'Plumbing permit here since Jul 11', tone: 'grey' })
  })

  it('there before the bid: a permit on the day the bid was started, or a bid with no start day, keeps its line', () => {
    expect(read([sentBid()], [plumbingPermit({ issued_on: '2026-07-20' })]).news.map((n) => n.kind)).toEqual(['plumbing'])
    expect(read([sentBid({ created_at: null })], [plumbingPermit({ issued_on: '2025-10-18' })]).news.map((n) => n.kind)).toEqual(['plumbing'])
  })

  it('the bid’s trade: a plumbing permit is no news on an electrical bid, and the building permit still is', () => {
    const electrical = sentBid({ service_type_id: 'st-electrical' })
    expect(read([electrical], [plumbingPermit()])).toEqual({ chips: new Map(), news: [], takenOff: [] })
    const both = read([electrical], [permit(), plumbingPermit()])
    expect(both.news.map((n) => [n.kind, n.markLost])).toEqual([['applied', false]])
    // Until the trades load, the trade is not checked.
    expect(bidPermitNews([electrical], new Map([['San Antonio', [plumbingPermit()]]]), READ, TODAY).news.map((n) => n.kind)).toEqual(['plumbing'])
  })

  it('splits the news by reader: your own bids’ lines, and everyone else’s apart', () => {
    const mineBid = sentBid()
    const theirs = sentBid({ id: 'b2', bid_number: '488', project_name: 'Harbor Street Offices', address: '88 Harbor St, San Antonio, TX' })
    const { news } = read([mineBid, theirs], [plumbingPermit(), plumbingPermit({ id: 'p9', permit_number: 'PLB-9', address: '88 HARBOR ST' })])
    const split = newsForReader(news, (id) => id === 'b1')
    expect(split.mine.map((n) => n.bidId)).toEqual(['b1'])
    expect(split.others.map((n) => n.bidId)).toEqual(['b2'])
    expect(newsForReader(news, () => false)).toEqual({ mine: [], others: news })
  })
})

// Punch list #401, PR 2: what a person said of a permit on a bid.
describe('an answer on a line', () => {
  const plumbing = permit({ id: 'p2', permit_number: 'PLB-2', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-10-25', project_name: null, contact: 'Lone Oak Plumbing' })
  const sent = bid({ bid_date_sent: '2026-08-01' })
  const said = (over: Partial<PermitAnswerRow>): PermitAnswerRow => ({ id: 'a1', bid_id: 'b1', ...permitRefOf('San Antonio', plumbing), answer: 'this_job', answered_by: 'u-marcus', answered_at: '2026-11-08T15:00:00Z', ...over })
  const read = (bids: NewsBid[], permits: SitePermitRow[], rows: PermitAnswerRow[]) => bidPermitNews(bids, new Map([['San Antonio', permits]]), READ, TODAY, undefined, null, foldPermitAnswers(rows))

  it('names the permit a line is about, and the building permit beside a plumber’s', () => {
    const { news } = read([sent], [permit(), plumbing], [])
    expect(news).toHaveLength(1)
    expect(news[0]).toMatchObject({ kind: 'plumbing', city: 'San Antonio', permit: { permit_number: 'PLB-2' }, beside: { permit_number: 'COM-1' }, answered: null })
    expect(read([sent], [permit()], []).news[0]).toMatchObject({ kind: 'applied', permit: { permit_number: 'COM-1' }, beside: null })
  })

  it('this job: the line stays, with its chip, and carries who answered and when', () => {
    const { chips, news, takenOff } = read([sent], [permit(), plumbing], [said({})])
    expect(news.map((n) => [n.kind, n.markLost, n.answered])).toEqual([['plumbing', true, { answer: 'this_job', by: 'u-marcus', at: '2026-11-08T15:00:00Z' }]])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · another name', tone: 'red' })
    expect(takenOff).toEqual([])
  })

  it('not this job: the permit is off the bid, and what is left of the address stands', () => {
    const { chips, news, takenOff } = read([sent], [permit(), plumbing], [said({ answer: 'not_this_job', answered_by: 'u-priya' })])
    // The building permit's own line and chip, as if the plumber's permit were not there.
    expect(news.map((n) => n.kind)).toEqual(['applied'])
    expect(chips.get('b1')).toEqual({ words: 'Applied Oct 20', tone: 'amber' })
    expect(takenOff).toEqual([{ bidId: 'b1', title: '512 · Mill Street Lofts, Building C', city: 'San Antonio', permit: plumbing, words: 'Plumbing permit listing Lone Oak Plumbing, Oct 25', by: 'u-priya', at: '2026-11-08T15:00:00Z' }])
    // With nothing else on the address the bid has no chip and no line.
    const alone = read([sent], [plumbing], [said({ answer: 'not_this_job' })])
    expect(alone.chips.size).toBe(0)
    expect(alone.news).toEqual([])
    expect(alone.takenOff).toHaveLength(1)
  })

  it('a take-back makes the line new again, and an answer on another bid touches nothing', () => {
    const back = read([sent], [plumbing], [said({ answer: 'not_this_job' }), said({ id: 'a2', answer: 'taken_back', answered_at: '2026-11-09T15:00:00Z' })])
    expect(back.news.map((n) => [n.kind, n.answered])).toEqual([['plumbing', null]])
    expect(back.takenOff).toEqual([])
    expect(read([sent], [plumbing], [said({ bid_id: 'b9', answer: 'not_this_job' })]).news).toHaveLength(1)
  })

  it('takes a decided bid’s answers off every list', () => {
    expect(read([bid({ outcome: 'lost' })], [plumbing], [said({ answer: 'not_this_job' })])).toEqual({ chips: new Map(), news: [], takenOff: [] })
  })

  it('says a permit in a few words', () => {
    expect(permitShortWords(plumbing, TODAY)).toBe('Plumbing permit listing Lone Oak Plumbing, Oct 25')
    expect(permitShortWords(permit({ ...plumbing, contact: null, issued_on: '2025-02-11' }), TODAY)).toBe('Plumbing permit, Feb 11, 2025')
    expect(permitShortWords(permit(), TODAY)).toBe('Permit application filed Oct 20')
    expect(permitShortWords(permit({ stage: 'issued', issued_on: '2026-11-03' }), TODAY)).toBe('Building permit issued Nov 3')
    expect(permitShortWords(permit({ kind: 'other', permit_type: 'Electrical General Permit', work_type: null, stage: 'issued', issued_on: '2026-11-03' }), TODAY)).toBe('Electrical General, Nov 3')
  })

  it('sorts the news into an inbox: yours and everyone else’s, new apart from answered', () => {
    const theirs = bid({ id: 'b2', bid_number: '488', project_name: 'Harbor Street Offices', address: '88 Harbor St, San Antonio, TX', bid_date_sent: '2026-08-01' })
    const harbor = permit({ ...plumbing, id: 'p9', permit_number: 'PLB-9', address: '88 HARBOR ST' })
    const harborGas = permit({ ...plumbing, id: 'p8', permit_number: 'PLB-8', address: '88 HARBOR ST', issued_on: '2026-10-01', contact: 'Quill & Sons Plumbing' })
    const result = read([sent, theirs], [permit(), plumbing, harbor, harborGas], [said({}), said({ id: 'a2', bid_id: 'b2', ...permitRefOf('San Antonio', harbor), answer: 'not_this_job' })])
    const inbox = permitInbox(result, (id) => id === 'b1')
    // Yours: the plumber's permit you answered stands, and nothing is new.
    expect(inbox.mine.fresh).toEqual([])
    expect(inbox.mine.standing.map((n) => n.bidId)).toEqual(['b1'])
    expect(inbox.mine.takenOff).toEqual([])
    // Theirs: the newest plumber's permit was taken off, so the one before it is the line, and it is new.
    expect(inbox.others.fresh.map((n) => [n.bidId, n.permit.permit_number])).toEqual([['b2', 'PLB-8']])
    expect(inbox.others.takenOff.map((t) => t.permit.permit_number)).toEqual(['PLB-9'])
  })
})
