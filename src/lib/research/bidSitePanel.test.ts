import { describe, expect, it } from 'vitest'
import { gcJobsView, numbersToAsk, siteCountWords, sitePermitLine, sitePermitLines, siteTiles, stageChip, type GcBid, type SitePermitRow } from './bidSitePanel'

// Every name, address and number here is made up.
const READ = ['San Antonio']

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: '2026-09-11', issued_on: null, contact: 'Dana Whitlow', declared_value: 6_400_000, area_sf: 38_000, builder_key: 'danawhitlow', ...over,
  }
}
const remodel = permit({ id: 'p2', permit_type: 'Comm Remodel Permit', work_type: 'Commercial remodel', stage: 'issued', issued_on: '2026-06-03', project_name: 'HARTWELL COFFEE TI', contact: 'Hartwell Interiors', declared_value: 180_000, area_sf: null })
const irrigation = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', work_type: 'Plumbing Irrigation', stage: 'issued', issued_on: '2026-10-02', project_name: null, contact: 'Greenline Irrigation', declared_value: null, area_sf: null })
const general = permit({ id: 'p4', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', issued_on: '2026-11-05', project_name: null, contact: 'Lone Oak Plumbing', declared_value: null, area_sf: null })

function bid(over: Partial<GcBid> = {}): GcBid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, ...over }
}

describe('the site’s list', () => {
  it('says when a permit was applied for or issued', () => {
    expect(stageChip(permit())).toEqual({ words: 'Applied Sep 11', tone: 'amber' })
    expect(stageChip(remodel)).toEqual({ words: 'Issued Jun 3', tone: 'green' })
    expect(stageChip(irrigation)).toEqual({ words: 'Issued Oct 2', tone: 'grey' })
  })

  it('draws a building permit with what the feed says of it and the name the city lists', () => {
    expect(sitePermitLine(permit(), 'Mill Street Lofts, Building C')).toEqual({
      id: 'p1',
      title: 'Commercial project',
      chips: [{ words: 'Looks like this job', tone: 'green' }, { words: 'Applied Sep 11', tone: 'amber' }],
      detail: 'MILL STREET LOFTS BLDG C · $6.4M declared · 38,000 sq ft · the city lists Dana Whitlow',
      looksLike: true,
    })
    expect(sitePermitLine(remodel, 'Mill Street Lofts, Building C').chips).toEqual([{ words: 'Issued Jun 3', tone: 'green' }])
  })

  it('names the plumbing type, and says when it is not a general plumbing permit', () => {
    expect(sitePermitLine(irrigation, 'Mill Street Lofts')).toMatchObject({ title: 'Plumbing, irrigation', detail: 'the city lists Greenline Irrigation · not a general plumbing permit', looksLike: false })
    expect(sitePermitLine(general, 'Mill Street Lofts')).toMatchObject({ title: 'Plumbing, general', detail: 'the city lists Lone Oak Plumbing' })
  })

  it('puts the permit that looks like this job first, then the newest', () => {
    expect(sitePermitLines([remodel, irrigation, permit(), general], 'Mill Street Lofts, Building C').map((l) => l.id)).toEqual(['p1', 'p4', 'p3', 'p2'])
  })

  it('counts what we can see on the street', () => {
    expect(siteCountWords(3, '4120 Mill Street')).toBe('3 permits we can see on 4120 Mill Street')
    expect(siteCountWords(1, '4120 Mill Street')).toBe('1 permit we can see on 4120 Mill Street')
  })
})

describe('the city’s numbers beside ours', () => {
  it('shows the declared value, the area and the bid as a share of the declared value', () => {
    expect(siteTiles([permit(), irrigation], 'Mill Street Lofts', 412_000)).toEqual([
      { label: 'Declared value, by the applicant', value: '$6,400,000', note: null },
      { label: 'Area on the permit', value: '38,000 sq ft', note: null },
      { label: 'Your bid', value: '$412,000', note: '6.4% of the declared value' },
    ])
  })

  it('leaves the bid off when it has no value, and the share off when nothing is declared', () => {
    expect(siteTiles([permit()], 'Mill Street Lofts', null).map((t) => t.label)).toEqual(['Declared value, by the applicant', 'Area on the permit'])
    expect(siteTiles([permit({ declared_value: null })], 'Mill Street Lofts', 412_000)).toEqual([
      { label: 'Area on the permit', value: '38,000 sq ft', note: null },
      { label: 'Your bid', value: '$412,000', note: null },
    ])
  })

  it('draws nothing when the permit declares neither, or no building permit is on the address', () => {
    expect(siteTiles([permit({ declared_value: 0, area_sf: null })], 'Mill Street Lofts', 412_000)).toEqual([])
    expect(siteTiles([irrigation], 'Mill Street Lofts', 412_000)).toEqual([])
    expect(siteTiles([], 'Mill Street Lofts', 412_000)).toEqual([])
  })
})

describe('the jobs we priced for a GC', () => {
  const bids: GcBid[] = [
    bid(),
    bid({ id: 'b2', bid_number: '501', project_name: 'Pecan Grove Pharmacy', address: '88 Harbor St, San Antonio, TX 78205', bid_date_sent: '2026-10-14' }),
    bid({ id: 'b3', bid_number: '488', project_name: 'Harbor Street Offices', address: '310 Alder Row, San Antonio, TX', bid_date_sent: '2026-09-30' }),
    bid({ id: 'b4', bid_number: '470', project_name: 'Juniper Court Retail', address: '2210 Larkspur Dr, San Antonio, TX', outcome: 'lost', bid_date_sent: '2026-08-01' }),
    bid({ id: 'b5', bid_number: '455', project_name: 'Cedar Bend Clinic', address: '3798 Kyle Crossing Kyle, TX 78640', outcome: 'won', bid_date_sent: '2026-07-01' }),
    bid({ id: 'b6', bid_number: '450', project_name: 'Oak Hollow Retail', address: 'Loop 1604 at Oak Hollow', bid_date_sent: '2026-06-01' }),
    bid({ id: 'b7', bid_number: '449', project_name: 'ZZ Shadow MILL STREET LOFTS', address: '4120 Mill Street, San Antonio, TX 78215' }),
    bid({ id: 'b8', bid_number: '440', project_name: 'Larkspur Dental', address: '709 Laurel St, Bastrop TX 78602', bid_date_sent: '2026-05-01' }),
  ]
  const permits = new Map([
    ['San Antonio', [permit(), permit({ ...general, id: 'p5', address: '88 HARBOR ST' }), permit({ id: 'p6', address: '310 ALDER ROW', stage: 'issued', permit_type: 'Comm New Building Permit', work_type: 'New commercial', issued_on: '2026-11-03', project_name: 'HARBOR OFFICES' })]],
  ])

  it('asks each read city for the house numbers of the bids that are sites, and never for a robot’s copy', () => {
    expect(numbersToAsk(bids, READ)).toEqual(new Map([['San Antonio', ['4120', '88', '310', '2210']]]))
    expect(numbersToAsk([bids[6]!], READ)).toEqual(new Map())
  })

  it('reads each site, counts what it is out of, and names the towns it cannot see', () => {
    const view = gcJobsView(bids, permits, READ, 'b1')
    expect(view.lines).toEqual([
      { bidId: 'b1', title: '512 · Mill Street Lofts, Building C', chip: { words: 'Applied Sep 11', tone: 'amber' }, detail: 'This bid · no general plumbing permit seen', current: true },
      { bidId: 'b2', title: '501 · Pecan Grove Pharmacy', chip: { words: 'Plumbing permit · another name', tone: 'red' }, detail: 'Sent Oct 14 · a general plumbing permit, Nov 5, lists Lone Oak Plumbing', current: false },
      { bidId: 'b3', title: '488 · Harbor Street Offices', chip: { words: 'Issued Nov 3', tone: 'green' }, detail: 'Sent Sep 30 · no general plumbing permit seen', current: false },
      { bidId: 'b4', title: '470 · Juniper Court Retail', chip: { words: 'None seen', tone: 'grey' }, detail: 'Lost · no permit seen on the address', current: false },
    ])
    expect(view.verdict).toBe('Of the 4 sites we can see, 3 have a permit. A general plumbing permit lists another name on 1.')
    expect(view.coverage).toBe('4 of your 7 bids with them')
    expect(view.elsewhere).toBe('2 more bids with them are in Bastrop and Kyle. No permit records are read there.')
    expect(view.unreadable).toBe('1 more has no street address we can look up.')
  })

  it('counts two bids on one address as one site', () => {
    const twice = [bid(), bid({ id: 'b9', bid_number: '530', project_name: 'Mill Street Lofts, Building D', address: '4120 Mill St San Antonio TX' })]
    const view = gcJobsView(twice, permits, READ, null)
    expect(view.lines).toHaveLength(2)
    expect(view.verdict).toBe('Of the 1 site we can see, 1 has a permit. No general plumbing permit under another name seen.')
  })

  it('does not take a plumbing permit under the building permit’s own name for another plumber', () => {
    const own = new Map([['San Antonio', [permit(), permit({ ...general, id: 'p7', contact: 'Dana Whitlow' })]]])
    const view = gcJobsView([bid()], own, READ, null)
    expect(view.lines[0]).toMatchObject({ chip: { words: 'Applied Sep 11', tone: 'amber' }, detail: 'Unsent · a general plumbing permit, Nov 5, is under the building permit’s own name' })
    expect(view.verdict).toBe('Of the 1 site we can see, 1 has a permit. No general plumbing permit under another name seen.')
  })

  it('says so when none of the bids can be seen', () => {
    const view = gcJobsView([bids[4]!, bids[5]!], permits, READ, null)
    expect(view.lines).toEqual([])
    expect(view.verdict).toBeNull()
    expect(view.coverage).toBe('0 of your 2 bids with them')
    expect(view.elsewhere).toBe('1 more bid with them is in Kyle. No permit records are read there.')
  })
})
