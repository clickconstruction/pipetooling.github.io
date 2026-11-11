import { describe, expect, it } from 'vitest'
import { bidPermitNews, type NewsBid } from './bidPermitNews'
import type { SitePermitRow } from './bidSitePanel'
import { ourNameKeys } from './ourNames'

// Punch list #307: a general plumbing permit under one of our own names on the Bid Board.
// Every name, address and number here is made up.
const READ = ['San Antonio']
const TODAY = '2026-11-10'
const OURS = ourNameKeys({ names: ['Marco Vale'], companyName: 'Blue Heron Plumbing, LLC' })

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: '2026-10-20', issued_on: null, contact: 'Dana Whitlow', declared_value: 6_400_000, area_sf: 38_000, builder_key: 'danawhitlow', ...over,
  }
}
function plumbing(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return permit({ id: 'p2', permit_number: 'PLB-1', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', issued_on: '2026-11-05', project_name: null, contact: 'BLUE HERON PLUMBING', declared_value: null, area_sf: null, builder_key: 'blueheronplumbing', ...over })
}
function bid(over: Partial<NewsBid> = {}): NewsBid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, last_contact: null, ...over }
}
const run = (bids: NewsBid[], permits: SitePermitRow[], ourKeys = OURS) => bidPermitNews(bids, new Map([['San Antonio', permits]]), READ, TODAY, ourKeys)

describe('bidPermitNews: a plumbing permit that is ours', () => {
  it('reads ours, with its own chip and its own news line, and never as another name', () => {
    const { chips, news } = run([bid({ bid_date_sent: '2026-10-01' })], [permit(), plumbing()])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · ours', tone: 'green' })
    expect(news).toEqual([{ bidId: 'b1', kind: 'ours', title: '512 · Mill Street Lofts, Building C', day: '2026-11-05', words: 'A general plumbing permit that lists us was issued on this address Nov 5, as BLUE HERON PLUMBING. The bid is not yet won or lost.' }])
    expect(news.some((n) => n.kind === 'plumbing')).toBe(false)
  })

  it('says applied for, and that an unsent bid is not sent', () => {
    const { news } = run([bid()], [plumbing({ stage: 'applied', issued_on: null, submitted_on: '2026-11-02', contact: 'Marco Vale' })])
    expect(news[0]?.words).toBe('A general plumbing permit that lists us was applied for on this address Nov 2, as Marco Vale. The bid is not sent yet.')
  })

  it('marks no bid: the outcome is the bid’s own, and a decided bid gets neither chip nor news', () => {
    const undecided = bid()
    run([undecided], [permit(), plumbing()])
    expect(undecided.outcome).toBeNull()
    const { chips, news } = run([bid({ outcome: 'won' })], [permit(), plumbing()])
    expect(chips.size).toBe(0)
    expect(news).toEqual([])
  })

  it('keeps the chip on an older permit of ours and lets the building permit’s news through', () => {
    const old = plumbing({ issued_on: '2026-06-02' })
    const { chips, news } = run([bid()], [permit(), old])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · ours', tone: 'green' })
    expect(news.map((n) => n.kind)).toEqual(['applied'])
    // With no building permit on the address the chip stands alone.
    const alone = run([bid()], [old])
    expect(alone.chips.get('b1')).toEqual({ words: 'Plumbing permit · ours', tone: 'green' })
    expect(alone.news).toEqual([])
  })

  it('goes by the newest general plumbing permit: another name after ours still reads another name', () => {
    const { chips, news } = run([bid()], [permit(), plumbing({ issued_on: '2026-06-02' }), plumbing({ id: 'p3', permit_number: 'PLB-2', issued_on: '2026-11-04', contact: 'Lone Oak Plumbing' })])
    expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · another name', tone: 'red' })
    expect(news.map((n) => n.kind)).toEqual(['plumbing'])
  })

  it('sorts ours after another name and before a building permit’s news', () => {
    const bids = [
      bid(),
      bid({ id: 'b2', bid_number: '488', project_name: 'Harbor Street Offices', address: '88 Harbor St, San Antonio, TX' }),
      bid({ id: 'b3', bid_number: '470', project_name: 'Juniper Court Retail', address: '2210 Larkspur Dr, San Antonio, TX' }),
    ]
    const { news } = run(bids, [
      permit(),
      plumbing({ address: '88 HARBOR ST' }),
      plumbing({ id: 'p4', permit_number: 'PLB-9', address: '2210 LARKSPUR DR', contact: 'Lone Oak Plumbing' }),
    ])
    expect(news.map((n) => [n.bidId, n.kind])).toEqual([['b3', 'plumbing'], ['b2', 'ours'], ['b1', 'applied']])
  })

  it('reads exactly as before when no name is ours', () => {
    const none = ourNameKeys({ names: [], companyName: null })
    for (const keys of [none, undefined]) {
      const { chips, news } = keys ? run([bid()], [permit(), plumbing()], keys) : bidPermitNews([bid()], new Map([['San Antonio', [permit(), plumbing()]]]), READ, TODAY)
      expect(chips.get('b1')).toEqual({ words: 'Plumbing permit · another name', tone: 'red' })
      expect(news[0]).toMatchObject({ kind: 'plumbing', words: 'A general plumbing permit was issued on this address Nov 5. It lists BLUE HERON PLUMBING. The bid is not sent yet.' })
    }
  })
})
