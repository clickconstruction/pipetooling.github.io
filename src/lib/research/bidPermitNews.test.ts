import { describe, expect, it } from 'vitest'
import { bidPermitNews, type NewsBid } from './bidPermitNews'
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
    expect(news).toEqual([{ bidId: 'b1', kind: 'applied', title: 'B512 · Mill Street Lofts, Building C', day: '2026-10-20', words: 'A permit application was filed on this address Oct 20: $6.4M declared, 38,000 sq ft.' }])
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
