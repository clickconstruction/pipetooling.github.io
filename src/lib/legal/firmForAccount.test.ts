import { describe, expect, it } from 'vitest'
import { cityOfAddress, firmForAccount, firmOf, firmSegmentWords, releaseHoldWords, switchWords, venueCounties, venueLineWords, type VenueJob } from './firmForAccount'

const FIRMS = [
  { id: 'snell', name: 'Snell Law Firm, PLLC', active: true },
  { id: 'austin', name: 'Austin Legal, PLLC', active: true },
  { id: 'old', name: 'Barnes & Holt', active: false },
]
const ASSIGN = new Map([['Bexar', 'snell'], ['Comal', 'snell'], ['Travis', 'austin'], ['Hays', 'austin']])
const job = (jobId: string, county: string, from: VenueJob['from'], balance: number): VenueJob => ({ jobId, label: jobId, county, from, balance })

describe('cityOfAddress', () => {
  it('reads the city before TX', () => {
    expect(cityOfAddress('15054 State Hwy 71, Bee Cave, TX 78738')).toBe('Bee Cave')
    expect(cityOfAddress('11730 TX-29, Liberty Hill, TX 78642')).toBe('Liberty Hill')
    expect(cityOfAddress('100 Oak, Seguin, Texas')).toBe('Seguin')
    expect(cityOfAddress("Zack'S House")).toBe('')
    expect(cityOfAddress(null)).toBe('')
  })
})

describe('venueCounties', () => {
  it('groups jobs by county, largest balance first, the strongest source kept, no-county last', () => {
    const groups = venueCounties([job('a', 'Travis', 'point', 100), job('b', 'Travis', 'record', 50), job('c', 'Bexar', 'record', 500), job('d', '', 'none', 10)], ASSIGN)
    expect(groups.map((g) => [g.county, g.from, g.balance, g.jobLabels, g.firmId])).toEqual([
      ['Bexar', 'record', 500, ['c'], 'snell'],
      ['Travis', 'record', 150, ['a', 'b'], 'austin'],
      ['', 'none', 10, ['d'], null],
    ])
  })
})

describe('firmForAccount', () => {
  it('a released matter keeps its firm, even a retired one', () => {
    const r = firmForAccount({ jobs: [job('717', 'Travis', 'record', 15781.82)], matterFirmId: 'old', assignments: ASSIGN, firms: FIRMS })
    expect(r.kind).toBe('with')
    expect(firmOf(r)?.name).toBe('Barnes & Holt')
    expect(venueLineWords(r)).toBeNull()
    expect(firmSegmentWords(r)).toEqual({ main: 'Barnes & Holt', tail: '', amber: false })
    expect(firmForAccount({ jobs: [], matterFirmId: 'gone', assignments: ASSIGN, firms: FIRMS })).toMatchObject({ kind: 'with', firm: null, firmName: 'the firm' })
  })
  it('the venue county picks the firm; the segment and the line say which county and where it came from', () => {
    const r = firmForAccount({ jobs: [job('717', 'Travis', 'record', 15781.82)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(r.kind).toBe('covered')
    expect(firmOf(r)?.id).toBe('austin')
    expect(firmSegmentWords(r)).toEqual({ main: 'Austin Legal, PLLC', tail: '· Travis County', amber: false })
    expect(venueLineWords(r)).toBe('Venue · Travis County, from the property record · Austin Legal, PLLC covers it')
    expect(releaseHoldWords(r)).toBeNull()
  })
  it('a county guessed from the city says so', () => {
    const r = firmForAccount({ jobs: [job('717', 'Travis', 'address', 100)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(firmSegmentWords(r).tail).toBe('· Travis County, by the address')
    expect(venueLineWords(r)).toBe('Venue · Travis County, by the job address, a guess from its city · Austin Legal, PLLC covers it')
  })
  it('a county nobody covers yields no firm, amber words and a hold on the release — never a default', () => {
    const r = firmForAccount({ jobs: [job('891', 'Williamson', 'record', 2028.04)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(r.kind).toBe('uncovered')
    expect(firmOf(r)).toBeNull()
    expect(firmSegmentWords(r)).toEqual({ main: 'No firm covers Williamson County', tail: '', amber: true })
    expect(venueLineWords(r)).toBe('Venue · Williamson County, from the property record · no firm covers it')
    expect(releaseHoldWords(r)).toBe('No firm covers Williamson County. Color the county for a firm under Firms, then release.')
  })
  it('no county at all, and no firm at all', () => {
    const none = firmForAccount({ jobs: [job('1', '', 'none', 5)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(none.kind).toBe('unknown')
    expect(firmSegmentWords(none).main).toBe('County unknown')
    expect(releaseHoldWords(none)).toMatch(/property record/)
    const bare = firmForAccount({ jobs: [job('1', 'Travis', 'record', 5)], matterFirmId: null, assignments: new Map(), firms: [] })
    expect(bare.kind).toBe('no_firms')
    expect(firmSegmentWords(bare).main).toBe('No firm yet')
    expect(venueLineWords(bare)).toBe('Venue · Travis County, from the property record. No firm is set up yet.')
    // No firm rows yet (the hook still loading) and no county: the line must not throw (the crash seen live on 2026-10-23).
    expect(venueLineWords(firmForAccount({ jobs: [job('1', '', 'none', 5)], matterFirmId: null, assignments: new Map(), firms: [] }))).toBe('Venue · county unknown. No firm is set up yet.')
  })
  it('two firms with a claim: the largest open balance decides, the other is a switch, and the switch is honored', () => {
    const jobs = [job('717', 'Travis', 'record', 15781.82), job('790', 'Comal', 'point', 2000)]
    const r = firmForAccount({ jobs, matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(r.kind).toBe('covered')
    if (r.kind !== 'covered') return
    expect(r.firm.id).toBe('austin')
    expect(r.others.map((o) => o.firm.id)).toEqual(['snell'])
    expect(switchWords(r.others[0]!)).toBe('⇄ Snell Law Firm, PLLC instead')
    expect(venueLineWords(r)).toBe('Venue · Travis County ($15,781.82) and Comal County ($2,000.00) · Travis County holds the largest open balance, so Austin Legal, PLLC takes it')
    const s = firmForAccount({ jobs, matterFirmId: null, assignments: ASSIGN, firms: FIRMS, override: 'snell' })
    expect(s.kind === 'covered' && s.firm.id).toBe('snell')
    expect(s.kind === 'covered' && s.switched).toBe(true)
    expect(s.kind === 'covered' && s.others.map((o) => o.firm.id)).toEqual(['austin'])
    expect(venueLineWords(s)).toBe('Venue · Travis County ($15,781.82) and Comal County ($2,000.00) · Snell Law Firm, PLLC picked by hand for Comal County')
    // An override naming a firm with no claim is ignored.
    const ignored = firmForAccount({ jobs, matterFirmId: null, assignments: ASSIGN, firms: FIRMS, override: 'old' })
    expect(ignored.kind === 'covered' && ignored.firm.id).toBe('austin')
  })
  it('the bridge: no county colored and one firm standing, that firm takes every account and says so; a second firm or a colored county ends it', () => {
    const one = [FIRMS[0]!]
    const r = firmForAccount({ jobs: [job('717', 'Travis', 'record', 100)], matterFirmId: null, assignments: new Map(), firms: one })
    expect(r.kind).toBe('only_firm')
    expect(firmOf(r)?.id).toBe('snell')
    expect(firmSegmentWords(r)).toEqual({ main: 'Snell Law Firm, PLLC', tail: '· no counties colored yet', amber: false })
    expect(venueLineWords(r)).toBe('Venue · Travis County, from the property record · no counties are colored yet, so Snell Law Firm, PLLC takes every account')
    expect(releaseHoldWords(r)).toBeNull()
    expect(venueLineWords(firmForAccount({ jobs: [job('1', '', 'none', 5)], matterFirmId: null, assignments: new Map(), firms: one }))).toBe('Venue · county unknown · no counties are colored yet, so Snell Law Firm, PLLC takes every account')
    expect(firmForAccount({ jobs: [job('717', 'Travis', 'record', 100)], matterFirmId: null, assignments: new Map([['Bexar', 'snell']]), firms: one }).kind).toBe('uncovered')
    expect(firmForAccount({ jobs: [job('717', 'Travis', 'record', 100)], matterFirmId: null, assignments: new Map(), firms: FIRMS }).kind).toBe('uncovered')
  })
  it('two counties of one firm are no switch; an uncovered county beside a covered one is still covered', () => {
    const r = firmForAccount({ jobs: [job('a', 'Bexar', 'record', 100), job('b', 'Comal', 'record', 900), job('c', 'Williamson', 'record', 5)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS })
    expect(r.kind === 'covered' && r.others).toEqual([])
    expect(r.kind === 'covered' && r.county.county).toBe('Comal')
  })
})

describe('a county two firms cover (v2.6227, punch list #222)', () => {
  const ALSO = new Map([['Comal', ['austin']]])
  it('the first call takes it, the chip says who also covers, and the other firm is a switch', () => {
    const r = firmForAccount({ jobs: [job('891', 'Comal', 'record', 2976.34)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS, also: ALSO })
    expect(r.kind).toBe('covered')
    expect(firmOf(r)?.id).toBe('snell')
    expect(r.kind === 'covered' && r.others.map((o) => [o.firm.id, o.county.county, o.shared])).toEqual([['austin', 'Comal', true]])
    expect(firmSegmentWords(r)).toEqual({ main: 'Snell Law Firm, PLLC', tail: '· Comal County · Austin Legal, PLLC also covers', amber: false })
    expect(venueLineWords(r)).toBe('Venue · Comal County, from the property record · Snell Law Firm, PLLC is first call · Austin Legal, PLLC also covers it')
    expect(r.kind === 'covered' && switchWords(r.others[0]!)).toBe('⇄ Austin Legal, PLLC instead')
  })
  it('switched to the firm that also covers, the words name the first call', () => {
    const r = firmForAccount({ jobs: [job('891', 'Comal', 'record', 2976.34)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS, also: ALSO, override: 'austin' })
    expect(firmOf(r)?.id).toBe('austin')
    expect(r.kind === 'covered' && r.switched).toBe(true)
    expect(firmSegmentWords(r).tail).toBe('· Comal County · Snell Law Firm, PLLC is first call')
    expect(venueLineWords(r)).toBe('Venue · Comal County, from the property record · Austin Legal, PLLC picked by hand · Snell Law Firm, PLLC is first call')
  })
  it('a retired firm that still has a row is no switch', () => {
    const r = firmForAccount({ jobs: [job('891', 'Comal', 'record', 2976.34)], matterFirmId: null, assignments: ASSIGN, firms: FIRMS, also: new Map([['Comal', ['old']]]) })
    expect(r.kind === 'covered' && r.others).toEqual([])
    expect(firmSegmentWords(r).tail).toBe('· Comal County')
  })
})
