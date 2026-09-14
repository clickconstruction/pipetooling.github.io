import { describe, expect, it } from 'vitest'
import type { ParcelRecord } from '../customers/propertyRecord'
import {
  builderName,
  fixupCount,
  groupByProperty,
  isLandlord,
  normalizeOwnerName,
  ownerKind,
  parseOwnerToConfirmRows,
  readsAs,
  shortDay,
  eligibleForUseAll,
  type OwnerToConfirmRow,
} from './ownerConfirm'

const row = (over: Partial<OwnerToConfirmRow> = {}): OwnerToConfirmRow => ({
  jobId: 'j1',
  hcpNumber: '650',
  clickNumber: '',
  jobAddress: '5498 Cibolo Valley Dr 200, Schertz, TX 78108',
  status: 'billed',
  customerId: 'c-ati',
  customerName: 'ATI Schertz',
  gcCustomerId: 'c-loberg',
  gcName: 'Loberg Contracting',
  customerAddressId: null,
  hasOwner: false,
  ownerConfirmed: false,
  propertyKind: '',
  firstWorkMonth: '2026-06',
  firstDeadline: '2026-09-15',
  ...over,
})

const parcel = (over: Partial<ParcelRecord> = {}): ParcelRecord => ({
  propId: '12345',
  ownerName: 'SCHERTZ STATION LTD',
  nameCare: '',
  legalDescription: 'LOT 1 BLK 2',
  situsAddress: '5498 CIBOLO VALLEY DR, SCHERTZ, TX 78108',
  mailingAddress: '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209',
  county: 'Guadalupe',
  source: 'Guadalupe Appraisal District',
  taxYear: '2025',
  ...over,
})

describe('ownerKind', () => {
  it('names public bodies — a lien does not attach to their property', () => {
    for (const n of ['CITY OF ROUND ROCK', 'Comal County', 'NEW BRAUNFELS ISD', 'STATE OF TEXAS', 'Texas Department of Transportation', 'UNITED STATES OF AMERICA', 'USA', 'CIBOLO CREEK MUD', 'SAN ANTONIO HOUSING AUTHORITY', 'University of Texas System']) {
      expect(ownerKind(n), n).toBe('public')
    }
  })
  it('companies via ownerLooksLikeCompany; the rest are people; "USA Properties LLC" is a company', () => {
    expect(ownerKind('SCHERTZ STATION LTD')).toBe('company')
    expect(ownerKind('TC/JP SEGUIN 2019 LLC')).toBe('company')
    expect(ownerKind('USA PROPERTIES LLC')).toBe('company')
    expect(ownerKind('KHAN UMAR & BANGASH SHAZMEENA')).toBe('individual')
    expect(ownerKind('')).toBe('individual')
  })
})

describe('isLandlord', () => {
  it('true when a customer row (not the builder) does not match the roll owner', () => {
    expect(isLandlord({ ownerName: 'SCHERTZ STATION LTD', customerName: 'ATI Schertz', gcName: 'Loberg Contracting' })).toBe(true)
  })
  it('false when the customer is the owner (normalized), with no customer row, or when the customer is the builder', () => {
    expect(isLandlord({ ownerName: 'ATI SCHERTZ, LLC', customerName: 'ATI Schertz', gcName: 'Loberg Contracting' })).toBe(false)
    expect(isLandlord({ ownerName: 'SCHERTZ STATION LTD', customerName: '', gcName: 'Loberg Contracting' })).toBe(false)
    expect(isLandlord({ ownerName: 'SCHERTZ STATION LTD', customerName: 'Southern Post Construction', gcName: '' })).toBe(false)
    expect(isLandlord({ ownerName: 'SCHERTZ STATION LTD', customerName: 'Loberg Contracting', gcName: 'Loberg Contracting' })).toBe(false)
  })
  it('normalizeOwnerName drops punctuation and entity suffixes', () => {
    expect(normalizeOwnerName('ATI Schertz, LLC')).toBe('ati schertz')
    expect(normalizeOwnerName('The Loberg Contracting Co.')).toBe('loberg contracting')
  })
})

describe('readsAs', () => {
  it('a landlord: the owner is not the tenant customer; mail elsewhere rides along', () => {
    const chips = readsAs(row(), parcel())
    expect(chips.map((c) => [c.key, c.tone])).toEqual([
      ['landlord', 'amber'],
      ['mail-elsewhere', 'grey'],
    ])
    expect(chips[0]!.label).toBe('landlord · ATI Schertz is the tenant')
    expect(eligibleForUseAll(chips)).toBe(true)
  })
  it('a public owner reads red and is not Use-all eligible; no landlord chip stacks on it', () => {
    const chips = readsAs(row({ customerName: 'Knight Contracting', gcName: 'Knight Contracting', jobAddress: '1200 Kenney Fort Blvd, Round Rock' }), parcel({ ownerName: 'CITY OF ROUND ROCK', mailingAddress: '221 E MAIN ST, ROUND ROCK, TX 78664' }))
    expect(chips.map((c) => c.key)).toEqual(['public'])
    expect(chips[0]!.label).toBe('public owner — bond claim, not a lien')
    expect(eligibleForUseAll(chips)).toBe(false)
  })
  it('an individual who gets mail at the property is a likely homestead (red), with no mail-elsewhere chip', () => {
    const chips = readsAs(
      row({ jobAddress: '102 Jacob Roberts, Blanco, TX 78606', customerName: 'Michael Palmer', gcCustomerId: null, gcName: '' }),
      parcel({ ownerName: 'LAGAN JOEL C & SHANNON', mailingAddress: '102 JACOB ROBERTS, BLANCO, TX 78606' }),
    )
    expect(chips.map((c) => c.key)).toEqual(['homestead'])
    expect(chips[0]!.label).toBe('likely homestead')
  })
  it('no parcel or no owner → no chips', () => {
    expect(readsAs(row(), null)).toEqual([])
    expect(readsAs(row(), parcel({ ownerName: '' }))).toEqual([])
  })
})

describe('groupByProperty', () => {
  it('groups jobs at one street address, sorts by earliest first deadline, and flags a closed window', () => {
    const rows = [
      row({ jobId: 'a', hcpNumber: '883', jobAddress: '2100 Independence Dr, New Braunfels', firstWorkMonth: '2026-03', firstDeadline: '2026-06-15' }),
      row({ jobId: 'b', hcpNumber: '650', firstDeadline: '2026-09-15' }),
      row({ jobId: 'c', hcpNumber: '523', jobAddress: '2100 Independence Dr., New Braunfels TX', firstWorkMonth: '2026-05', firstDeadline: '2026-08-17' }),
      row({ jobId: 'd', hcpNumber: '900', jobAddress: '1 Nowhere Ln', firstWorkMonth: '', firstDeadline: null }),
    ]
    const props = groupByProperty(rows, '2026-09-14')
    expect(props.map((p) => p.key)).toEqual(['2100 independence', '5498 cibolo', '1 nowhere'])
    expect(props[0]!.jobs.map((j) => j.hcpNumber)).toEqual(['523', '883'])
    expect(props[0]!.firstDeadline).toBe('2026-06-15')
    expect(props[0]!.windowClosed).toBe(true)
    expect(props[0]!.noticeLabel).toBe("March's window closed · later months live")
    expect(props[1]!.windowClosed).toBe(false)
    expect(props[1]!.noticeLabel).toBe('due Sep 15')
    expect(props[2]!.noticeLabel).toBe('')
  })
  it('a deadline on today is still live', () => {
    expect(groupByProperty([row({ firstDeadline: '2026-09-15' })], '2026-09-15')[0]!.windowClosed).toBe(false)
  })
})

describe('parseOwnerToConfirmRows · builderName · fixupCount · shortDay', () => {
  it('folds the RPC payload and drops junk', () => {
    const rows = parseOwnerToConfirmRows([
      { job_id: 'j1', hcp_number: '650', click_number: '', job_address: ' 5498 Cibolo Valley Dr ', status: 'billed', customer_id: 'c1', customer_name: 'ATI Schertz', gc_customer_id: 'g1', gc_name: 'Loberg', customer_address_id: null, has_owner: false, owner_confirmed: false, property_kind: '', first_work_month: '2026-06', first_deadline: '2026-09-15' },
      { job_id: '' },
      null,
      'x',
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.jobAddress).toBe('5498 Cibolo Valley Dr')
    expect(rows[0]!.customerAddressId).toBeNull()
    expect(rows[0]!.firstDeadline).toBe('2026-09-15')
    expect(parseOwnerToConfirmRows(null)).toEqual([])
  })
  it('the builder is the GC, or the customer when the builder sits in the customer row', () => {
    expect(builderName(row())).toBe('Loberg Contracting')
    expect(builderName(row({ gcCustomerId: null, gcName: '', customerName: 'Southern Post Construction' }))).toBe('Southern Post Construction')
  })
  it('the chip counts jobs; shortDay reads the calendar string', () => {
    expect(fixupCount([row(), row({ jobId: 'j2' })])).toBe(2)
    expect(shortDay('2026-09-15')).toBe('Sep 15')
    expect(shortDay('2026-12-01')).toBe('Dec 1')
  })
})
