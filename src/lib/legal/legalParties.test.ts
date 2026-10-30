import { describe, expect, it } from 'vitest'
import type { JobContractCoverage } from '../jobs/jobContractCoverage'
import { contractStateWords, mailsToWords, partiesStrip, payerRoleWords, precinctWords, venueBlock, type PartiesInput, type PartiesProperty } from './legalParties'

const signed = (names: string[]): JobContractCoverage => ({ kind: 'signed', source: 'contract', signedAt: '2026-05-27', signerName: names.join(' and '), signerNames: names, contractId: 'c1', estimateNumber: null } as JobContractCoverage)

function property(over: Partial<PartiesProperty> = {}): PartiesProperty {
  return {
    address: '2208 Whitestone Blvd, Cedar Park, TX 78613',
    county: 'Williamson',
    precinct: '',
    precinctNote: '',
    owner: 'CP RETAIL HOLDINGS LLC',
    ownerMailingAddress: '100 Main St Suite 4, Denver, CO 80202',
    ownerSource: 'property_record',
    propertyKind: 'non_residential',
    homestead: false,
    source: 'linked',
    jobLabels: ['742'],
    ...over,
  }
}

function gcInput(over: Partial<PartiesInput> = {}): PartiesInput {
  return {
    payer: { name: 'Northline Builders', viaGc: true, customerId: 'c-gc' },
    customerType: 'commercial',
    customerAddress: '1900 Mesa Drive, Ste 4, Lubbock, TX 79424',
    customerCounty: 'Lubbock',
    customerPrecinct: '',
    agreements: [{ jobLabel: '742', coverage: signed(['R. Vance']) }],
    properties: [property()],
    jobs: [{ label: '742', address: '2208 Whitestone Blvd, Cedar Park, TX 78613' }],
    counties: [{ county: 'Williamson', balance: 3140 }],
    balance: 3140,
    ...over,
  }
}

describe('partiesStrip', () => {
  it('a subcontract account: the GC with its signer and city, the owner of record as the record spells it, the venue with both counties', () => {
    const s = partiesStrip(gcInput())
    expect(s.cells.map((c) => c.key)).toEqual(['contract', 'owner', 'venue'])
    expect(s.cells[0]).toMatchObject({ label: 'Contract with', main: 'Northline Builders', quiet: 'general contractor · subcontract signed by R. Vance · Lubbock, TX', amber: false, door: 'edit_customer' })
    expect(s.cells[1]).toMatchObject({ label: 'Owns the building', main: 'CP RETAIL HOLDINGS LLC', quiet: 'owner of record · mails to Denver, CO · commercial', amber: false, door: 'property_record' })
    expect(s.cells[2]).toMatchObject({ label: 'Venue', main: 'Williamson County · justice precinct not yet', quiet: 'where the work was done · or Lubbock County, where Northline Builders is · within $20,000', amber: false, door: 'venue' })
    // The line under the name is the building, never the payer's office.
    expect(s.addressLine).toBe('742 · 2208 Whitestone Blvd, Cedar Park, TX 78613')
  })

  it('a direct job whose customer is the owner of record merges the first two cells, and one county reads as both places', () => {
    const s = partiesStrip(gcInput({
      payer: { name: 'Dana Okafor', viaGc: false, customerId: 'c-dana' },
      customerType: 'residential',
      customerAddress: '14 Pecan Ct, Seguin, TX 78155',
      customerCounty: 'Guadalupe',
      agreements: [],
      properties: [property({ county: 'Guadalupe', owner: 'Dana Okafor', ownerMailingAddress: '14 Pecan Ct, Seguin, TX 78155', propertyKind: 'residential', homestead: true, address: '14 Pecan Ct, Seguin, TX 78155' })],
      jobs: [{ label: '801', address: '14 Pecan Ct, Seguin, TX 78155' }],
      counties: [{ county: 'Guadalupe', balance: 1310 }],
      balance: 1310,
    }))
    expect(s.cells.map((c) => c.key)).toEqual(['contract_owner', 'venue'])
    expect(s.cells[0]).toMatchObject({ label: 'Contract with · owns the building', main: 'Dana Okafor', quiet: 'homeowner · owner of record · homestead · no signed agreement · Seguin, TX', door: 'edit_customer' })
    expect(s.cells[1]!.quiet).toBe('where the work was done and where they live · within $20,000')
    expect(s.cells[1]!.main).toBe('Guadalupe County · justice precinct not yet')
  })

  it('an owner not on the record is an amber cell whose door is the property record', () => {
    const s = partiesStrip(gcInput({ properties: [property({ owner: '', ownerMailingAddress: '', ownerSource: 'none' })] }))
    expect(s.cells[1]).toMatchObject({ main: 'Not on the record', quiet: 'Add the owner to the property record.', amber: true, door: 'property_record' })
  })

  it('no property record at all: the owner cell says so, and with no county the venue cell is amber on the same door', () => {
    const s = partiesStrip(gcInput({ properties: [property({ source: 'job_address', owner: '', county: '', ownerSource: 'none' })], counties: [{ county: '', balance: 3140 }] }))
    expect(s.cells[1]).toMatchObject({ main: 'No property record', amber: true, door: 'property_record' })
    expect(s.cells[2]).toMatchObject({ main: 'County unknown', quiet: 'The same record names it.', amber: true, door: 'property_record' })
  })

  it('two buildings with two owners count, and the venue lists both counties with their balances', () => {
    const s = partiesStrip(gcInput({
      properties: [property({ jobLabels: ['742'] }), property({ address: '9 Loop 360, Austin, TX 78746', county: 'Travis', owner: 'LOOP 360 HOLDINGS LLC', jobLabels: ['743'] })],
      jobs: [{ label: '742', address: '2208 Whitestone Blvd, Cedar Park, TX 78613' }, { label: '743', address: '9 Loop 360, Austin, TX 78746' }],
      counties: [{ county: 'Travis', balance: 9120 }, { county: 'Williamson', balance: 2400 }],
      balance: 11520,
    }))
    expect(s.cells[1]).toMatchObject({ label: 'Owns the buildings', main: '2 buildings · 2 owners', quiet: 'CP RETAIL HOLDINGS LLC · LOOP 360 HOLDINGS LLC' })
    expect(s.cells[2]!.main).toBe('Travis County ($9,120) · Williamson County ($2,400)')
    expect(s.addressLine).toBe('742 · 743 · 2208 Whitestone Blvd, Cedar Park, TX 78613 · 1 more')
  })

  it('a payer that is a name only is an amber contract cell whose door links a customer', () => {
    const s = partiesStrip(gcInput({ payer: { name: 'Bluebonnet Pools', viaGc: false, customerId: null } }))
    expect(s.cells[0]).toMatchObject({ main: 'Bluebonnet Pools', quiet: 'name only, no customer record. Link a customer.', amber: true, door: 'link_customer' })
  })

  it('over the justice court limit the venue cell says county court', () => {
    const s = partiesStrip(gcInput({ balance: 24000 }))
    expect(s.cells[2]!.quiet).toContain('over $20,000 · county court')
  })

  it('a precinct on the record reads as the court', () => {
    const s = partiesStrip(gcInput({ properties: [property({ precinct: '2' })] }))
    expect(s.cells[2]!.main).toBe('Williamson County · Justice Court, Precinct 2')
    expect(precinctWords({ precinct: '', precinctNote: '2 or 3 — on the line' })).toBe('Justice Court, Precinct 2 or 3 — on the line')
  })
})

describe('venueBlock', () => {
  it('the county card block: the two places, the cap, the foreclosure line and the source', () => {
    const b = venueBlock(gcInput())
    expect(b.title).toBe('Venue for job 742')
    expect(b.places.map((p) => [p.label, p.main, p.quiet])).toEqual([
      ['Where the work was done', 'Williamson County · justice precinct not yet', '2208 Whitestone Blvd, Cedar Park, TX 78613 · the county from the property record'],
      ['Where the defendant is', 'Lubbock County · justice precinct not yet', 'Northline Builders, 1900 Mesa Drive, Ste 4, Lubbock, TX 79424 · the county from their own record'],
    ])
    expect(b.rules[0]).toMatch(/^\$3,140\.00 is within the justice court limit/)
    expect(b.rules[1]).toBe('A lien foreclosure goes to district court in Williamson County — a justice court cannot foreclose a lien on land (Gov\'t Code § 27.031(b)).')
    expect(b.source).toContain('TRCP 502.4')
  })
  it('a payer with no county says so, and two jobs name both', () => {
    const b = venueBlock(gcInput({ customerCounty: '', jobs: [{ label: '742', address: 'a' }, { label: '743', address: 'b' }] }))
    expect(b.title).toBe('Venue for jobs 742 and 743')
    expect(b.places[1]!.main).toBe('county not on the record')
    expect(b.places[1]!.quiet).toContain('no county on their record')
  })
})

describe('the words', () => {
  it('payer roles', () => {
    expect(payerRoleWords({ viaGc: true }, 'residential')).toBe('general contractor')
    expect(payerRoleWords({ viaGc: false }, 'residential')).toBe('homeowner')
    expect(payerRoleWords({ viaGc: false }, 'Commercial')).toBe('commercial customer')
    expect(payerRoleWords({ viaGc: false }, '')).toBe('customer')
  })
  it('contract states', () => {
    expect(contractStateWords([], true)).toBe('no signed subcontract')
    expect(contractStateWords([{ coverage: signed(['Sam Owner', 'Alex Owner']) }], false)).toBe('agreement signed by Sam Owner and Alex Owner')
    expect(contractStateWords([{ coverage: signed([]) }], false)).toBe('agreement signed')
    expect(contractStateWords([{ coverage: signed(['R. Vance']) }, { coverage: signed(['R. Vance']) }], true)).toBe('2 subcontracts signed by R. Vance')
    expect(contractStateWords([{ coverage: signed(['R. Vance']) }, { coverage: { kind: 'draft', contractId: 'c2' } }], true)).toBe('1 of 2 signed')
    expect(contractStateWords([{ coverage: { kind: 'not_needed', at: '2026-01-01', reason: null } }], true)).toBe('no agreement of ours needed')
    expect(contractStateWords([{ coverage: { kind: 'sent', contractId: 'c', revision: 1, sentAt: '2026-01-01', viewCount: 0, recipientEmail: null } }], false)).toBe('agreement sent, not signed')
  })
  it('where an owner mails', () => {
    expect(mailsToWords('100 Main St Suite 4, Denver, CO 80202')).toBe('Denver, CO')
    expect(mailsToWords('PO Box 9, Lubbock, TX 79424')).toBe('Lubbock, TX')
    expect(mailsToWords('')).toBe('')
  })
})
