import { describe, expect, it } from 'vitest'
import { buildNewJobAccountsPlan, reuseNote, samePropertyOffers } from './jobAccountsNewJob'
import type { JobAccountStripEntry } from './jobAccountStrip'

function entry(houseId: string, houseName: string, state: JobAccountStripEntry['state'], extra: Partial<JobAccountStripEntry> = {}): JobAccountStripEntry {
  return {
    houseId,
    houseName,
    policy: 'expects',
    state,
    accountId: null,
    accountRef: '',
    openedVia: null,
    openedAt: null,
    requestedAt: null,
    requestedFromCounter: false,
    note: '',
    rep: null,
    ...extra,
  }
}

const newJobEntries = [entry('ferguson', 'Ferguson', 'none'), entry('reece', 'Reece', 'none'), entry('moore', 'Moore Supply', 'requested')]

describe('samePropertyOffers', () => {
  const j964 = {
    id: 'j964',
    label: '964 · Pondhill demo',
    address: '4114 Pond Hill Rd, Building #2, San Antonio, TX',
    entries: [entry('ferguson', 'Ferguson', 'open', { accountRef: 'JA-4114', openedVia: 'phone', rep: { id: 'c1', name: 'Curly', phone: null } }), entry('reece', 'Reece', 'none')],
  }
  const elsewhere = { id: 'j1', label: '1 · Elsewhere', address: '1 Other St, Austin, TX', entries: [entry('reece', 'Reece', 'open', { accountRef: 'R-1' })] }

  it('offers the open account from a job at the same address, exact or by street line', () => {
    const exact = samePropertyOffers('4114 pond hill rd, building #2, san antonio, tx', newJobEntries, [elsewhere, j964])
    expect(exact).toEqual([{ houseId: 'ferguson', houseName: 'Ferguson', fromJobId: 'j964', fromJobLabel: '964 · Pondhill demo', accountRef: 'JA-4114', openedVia: 'phone', repContactId: 'c1' }])
    const street = samePropertyOffers('4114 Pond Hill Rd, Bldg 3, San Antonio, TX 78231', newJobEntries, [j964])
    expect(street.map((o) => o.houseId)).toEqual(['ferguson'])
  })

  it('offers nothing without an address, for a different street, or for a house the new job already has', () => {
    expect(samePropertyOffers('', newJobEntries, [j964])).toEqual([])
    expect(samePropertyOffers('9 Nowhere Ln, Austin, TX', newJobEntries, [j964])).toEqual([])
    const already = [entry('ferguson', 'Ferguson', 'open'), entry('reece', 'Reece', 'none')]
    expect(samePropertyOffers(j964.address, already, [j964])).toEqual([])
  })
})

describe('buildNewJobAccountsPlan', () => {
  const offers = samePropertyOffers('4114 Pond Hill Rd, Building #2, San Antonio, TX', newJobEntries, [
    { id: 'j964', label: '964', address: '4114 Pond Hill Rd, Building #2, San Antonio, TX', entries: [entry('ferguson', 'Ferguson', 'open', { accountRef: 'JA-4114' })] },
  ])

  it('splits picks into reuse and ask, never both, and ignores non-none houses', () => {
    const plan = buildNewJobAccountsPlan(newJobEntries, offers, new Map([['ferguson', 'reuse'], ['reece', 'ask'], ['moore', 'ask']]))
    expect(plan.reuse.map((o) => o.houseId)).toEqual(['ferguson'])
    expect(plan.ask.map((e) => e.houseId)).toEqual(['reece'])
  })

  it('falls back to asking when reuse is picked for a house with no offer, and skips by default', () => {
    const plan = buildNewJobAccountsPlan(newJobEntries, offers, new Map([['reece', 'reuse']]))
    expect(plan.reuse).toEqual([])
    expect(plan.ask.map((e) => e.houseId)).toEqual(['reece'])
    expect(buildNewJobAccountsPlan(newJobEntries, offers, new Map())).toEqual({ ask: [], reuse: [] })
  })

  it('words the reuse note', () => {
    expect(reuseNote('964 · Pondhill demo')).toBe('Same property as 964 · Pondhill demo')
  })
})
