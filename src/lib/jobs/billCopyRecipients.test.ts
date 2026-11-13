import { describe, expect, it } from 'vitest'
import {
  BILL_COPY_MAX,
  billsAlsoGoToSummary,
  buildCopyEmails,
  defaultCopyContactIds,
  defaultCopyOtherParty,
  parseCopyEmails,
  type BillCopyContact,
} from './billCopyRecipients'

const dlf: BillCopyContact = { id: 'c1', name: 'DLF', email: 'AP@dlfbuilders.example', getsBillCopies: true }
const lisa: BillCopyContact = { id: 'c2', name: 'Lisa Pettlow', email: 'lisa.p@gmail.com', getsBillCopies: false }
const noEmail: BillCopyContact = { id: 'c3', name: 'Site super', email: '', getsBillCopies: true }
const gc = { name: 'Dead Level Foundation', email: 'deadlevelfoundation@example.com', role: 'gc' as const }

describe('defaultCopyContactIds', () => {
  it('ticks flagged contacts that have an email, and nobody else', () => {
    expect([...defaultCopyContactIds([dlf, lisa, noEmail])]).toEqual(['c1'])
  })
})

describe('defaultCopyOtherParty', () => {
  it('starts ticked only when the job says so and the party has an address', () => {
    expect(defaultCopyOtherParty({ bill_copy_other_party: true }, gc)).toBe(true)
    expect(defaultCopyOtherParty({ bill_copy_other_party: false }, gc)).toBe(false)
    expect(defaultCopyOtherParty({ bill_copy_other_party: true }, null)).toBe(false)
    expect(defaultCopyOtherParty({ bill_copy_other_party: true }, { ...gc, email: '' })).toBe(false)
    expect(defaultCopyOtherParty(null, gc)).toBe(false)
  })
})

describe('buildCopyEmails', () => {
  const base = {
    primaryEmail: 'jdpettlow76@example.com',
    contacts: [dlf, lisa],
    tickedContactIds: new Set(['c1']),
    otherParty: gc,
    copyOtherParty: true,
    oneOffEmail: '',
    billToOverride: false,
  }
  it('lowercases, keeps the tick order, then the other party', () => {
    expect(buildCopyEmails(base)).toEqual(['ap@dlfbuilders.example', 'deadlevelfoundation@example.com'])
  })
  it('never repeats the primary address or a duplicate', () => {
    expect(buildCopyEmails({ ...base, oneOffEmail: 'JDPettlow76@example.com' })).toEqual(['ap@dlfbuilders.example', 'deadlevelfoundation@example.com'])
    expect(buildCopyEmails({ ...base, oneOffEmail: 'ap@dlfbuilders.example' })).toHaveLength(2)
  })
  it('drops an implausible one-off and an unticked contact', () => {
    expect(buildCopyEmails({ ...base, tickedContactIds: new Set(), copyOtherParty: false, oneOffEmail: 'not an email' })).toEqual([])
  })
  it('a typed bill-to recipient carries only the one-off, never the customer people', () => {
    expect(buildCopyEmails({ ...base, billToOverride: true, oneOffEmail: 'tenant-cc@example.com' })).toEqual(['tenant-cc@example.com'])
  })
  it('caps at the edge function limit', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `x${i}`, name: `P${i}`, email: `p${i}@example.com`, getsBillCopies: true }))
    const out = buildCopyEmails({ ...base, contacts: many, tickedContactIds: new Set(many.map((c) => c.id)), copyOtherParty: false })
    expect(out).toHaveLength(BILL_COPY_MAX)
  })
})

describe('billsAlsoGoToSummary', () => {
  it('names the flagged contacts and the other party', () => {
    expect(billsAlsoGoToSummary({ contacts: [dlf, lisa], otherParty: gc, copyOtherParty: true })).toBe('DLF · Dead Level Foundation (GC)')
  })
  it('is null when nobody is copied', () => {
    expect(billsAlsoGoToSummary({ contacts: [lisa, noEmail], otherParty: gc, copyOtherParty: false })).toBeNull()
  })
  it('names the customer plainly when the customer is the other party', () => {
    expect(billsAlsoGoToSummary({ contacts: [], otherParty: { name: 'Laura Shellan', role: 'customer' }, copyOtherParty: true })).toBe('Laura Shellan')
  })
})

describe('parseCopyEmails', () => {
  it('cleans a text[] column and ignores junk', () => {
    expect(parseCopyEmails(['A@b.co', 'a@b.co', 7, 'nope', ' c@d.io '])).toEqual(['a@b.co', 'c@d.io'])
    expect(parseCopyEmails(null)).toEqual([])
  })
})
