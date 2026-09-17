import { describe, expect, it } from 'vitest'
import { composeRepEmail, composeRepEmailForProperties, orderHousesForBid, repFirstName } from './jobAccountRepEmail'
import type { JobAccountStripEntry } from './jobAccountStrip'

const facts = {
  bidLabel: 'B398 · Pondhill Building 2',
  propertyName: 'Pondhill Building 2',
  address: '4114 Pond Hill Rd, Building #2, San Antonio, TX 78231',
  startDate: '2026-09-22',
  gc: { company: 'H & I Construction', contactName: 'Marco Reyes', phone: '210-555-0170', email: 'marco@hiconstruction.com' },
  owner: null,
}
const org = { companyName: 'Click Plumbing and Electrical', officePhone: '(512) 360-0599' }

describe('composeRepEmail', () => {
  it('names the company, the property, the GC, and the soft owner, in the estimator’s voice', () => {
    const { subject, text } = composeRepEmail({ repFirstName: 'Curly', houseName: 'Ferguson', facts, org, senderName: 'Tristen' })
    expect(subject).toBe('Job account — 4114 Pond Hill Rd, Building #2, San Antonio, TX 78231 (Click Plumbing and Electrical)')
    expect(text).toContain('Curly — we won this one. Please open a job account for Click Plumbing and Electrical at the property below; first parts run is around Sep 22.')
    expect(text).toContain('Property: 4114 Pond Hill Rd, Building #2, San Antonio, TX 78231')
    expect(text).toContain('Project: Pondhill Building 2')
    expect(text).toContain('General contractor: H & I Construction — Marco Reyes, 210-555-0170, marco@hiconstruction.com')
    expect(text).toContain('Owner of record: to follow from our office.')
    expect(text).toContain('Reply here or call the office at (512) 360-0599. — Tristen')
  })

  it('carries the owner when the office has it, and survives blanks', () => {
    const { subject, text } = composeRepEmail({
      repFirstName: '',
      houseName: 'Reece',
      facts: { ...facts, propertyName: null, startDate: null, gc: null, owner: { name: 'Jane Owner', mailingAddress: '1 Main St, Austin, TX' } },
      org: { companyName: '', officePhone: '' },
      senderName: '',
    })
    expect(subject).toContain('(our company)')
    expect(text.startsWith('Hi — we won this one. Please open a job account for our company at the property below.')).toBe(true)
    expect(text).toContain('Owner of record: Jane Owner, 1 Main St, Austin, TX')
    expect(text).not.toContain('General contractor')
    expect(text.endsWith('Reply here. — our company')).toBe(true)
  })

  it('takes the rep’s first name', () => {
    expect(repFirstName('Curly Conley')).toBe('Curly')
    expect(repFirstName('  ')).toBe('')
  })
})

describe('orderHousesForBid', () => {
  const e = (houseId: string, state: JobAccountStripEntry['state']): JobAccountStripEntry => ({
    houseId, houseName: houseId, policy: 'expects', state, accountId: null, accountRef: '', openedVia: null, openedAt: null, requestedAt: null, requestedFromCounter: false, note: '', rep: null,
  })
  it('puts quoting houses first and preselects the ones still askable', () => {
    const out = orderHousesForBid([e('ferguson', 'none'), e('moore', 'none'), e('reece', 'open')], new Set(['reece', 'moore']))
    expect(out.entries.map((x) => x.houseId)).toEqual(['moore', 'reece', 'ferguson'])
    expect([...out.preselected]).toEqual(['moore'])
  })
  it('keeps order and preselects nothing without quotes', () => {
    const out = orderHousesForBid([e('ferguson', 'none'), e('reece', 'none')], new Set())
    expect(out.entries.map((x) => x.houseId)).toEqual(['ferguson', 'reece'])
    expect(out.preselected.size).toBe(0)
  })
})

describe('composeRepEmailForProperties', () => {
  const second = {
    bidLabel: 'B412 · Vaughn residence',
    propertyName: 'Vaughn residence',
    address: '118 Vaughn Ln, Buda, TX 78610',
    startDate: '2026-09-24',
    gc: { company: 'Dudley Mason', contactName: null, phone: null, email: null },
    owner: { name: 'R. Vaughn', mailingAddress: '118 Vaughn Ln, Buda, TX 78610' },
  }
  it('lists each property as a numbered block with its own GC and owner line, the start weeks joined', () => {
    const { subject, text } = composeRepEmailForProperties({ repFirstName: 'Curly', houseName: 'Ferguson', properties: [facts, second], org, senderName: 'Tristen' })
    expect(subject).toBe('Job accounts — 2 properties (Click Plumbing and Electrical)')
    expect(text).toContain('Curly — we won these two. Please open a job account for Click Plumbing and Electrical at each property below; first parts runs are the week of Sep 21.')
    expect(text).toContain('1. 4114 Pond Hill Rd, Building #2, San Antonio, TX 78231\n   Project: Pondhill Building 2\n   General contractor: H & I Construction — Marco Reyes, 210-555-0170, marco@hiconstruction.com\n   Owner of record: to follow from our office.')
    expect(text).toContain('2. 118 Vaughn Ln, Buda, TX 78610\n   Project: Vaughn residence\n   General contractor: Dudley Mason\n   Owner of record: R. Vaughn, 118 Vaughn Ln, Buda, TX 78610')
    expect(text.endsWith('Reply here or call the office at (512) 360-0599. — Tristen')).toBe(true)
  })
  it('names two different weeks when the starts fall in different weeks, and skips the clause with no dates', () => {
    const later = { ...second, startDate: '2026-10-01' }
    expect(composeRepEmailForProperties({ repFirstName: 'Curly', houseName: 'Ferguson', properties: [facts, later], org, senderName: 'Tristen' }).text).toContain('first parts runs are the weeks of Sep 21 and Sep 28.')
    const none = composeRepEmailForProperties({ repFirstName: 'Curly', houseName: 'Ferguson', properties: [{ ...facts, startDate: null }, { ...second, startDate: null }], org, senderName: 'Tristen' }).text
    expect(none).toContain('at each property below.\n')
  })
  it('one property is the single note', () => {
    expect(composeRepEmailForProperties({ repFirstName: 'Curly', houseName: 'Ferguson', properties: [facts], org, senderName: 'Tristen' })).toEqual(composeRepEmail({ repFirstName: 'Curly', houseName: 'Ferguson', facts, org, senderName: 'Tristen' }))
  })
})
