import { describe, expect, it } from 'vitest'
import { defaultShowOtherParty, otherPartyOf, parseShownToParty, shownToChipText, shownToPartyFor, statementRoleFor } from './billVisibility'

const OWNER = 'cust-owner'
const GC = 'cust-gc'

const ownerPays = { customer_id: OWNER, gc_customer_id: GC, bill_to_party: 'customer' }
const gcPays = { customer_id: OWNER, gc_customer_id: GC, bill_to_party: 'gc' }
const gcIsCustomer = { customer_id: GC, gc_customer_id: GC, bill_to_party: 'gc' }
const noGc = { customer_id: OWNER, gc_customer_id: null, bill_to_party: 'customer' }

describe('parseShownToParty', () => {
  it('accepts customer | gc only', () => {
    expect(parseShownToParty('gc')).toBe('gc')
    expect(parseShownToParty('customer')).toBe('customer')
    expect(parseShownToParty('split')).toBeNull()
    expect(parseShownToParty(null)).toBeNull()
  })
})

describe('otherPartyOf', () => {
  it('names the party that is not billed, only when the job has two distinct parties', () => {
    expect(otherPartyOf(ownerPays, 'customer')).toBe('gc')
    expect(otherPartyOf(gcPays, 'gc')).toBe('customer')
    expect(otherPartyOf(gcIsCustomer, 'gc')).toBeNull()
    expect(otherPartyOf(noGc, 'customer')).toBeNull()
  })
  it('a typed someone-else recipient has no default other party', () => {
    expect(otherPartyOf(ownerPays, 'other')).toBeNull()
  })
})

describe('shownToPartyFor', () => {
  it('an invoice answers with its stamp and nothing else', () => {
    expect(shownToPartyFor({ ...ownerPays, show_bills_to_other_party: true }, { shown_to_party: null })).toBeNull()
    expect(shownToPartyFor({ ...ownerPays, show_bills_to_other_party: false }, { shown_to_party: 'gc' })).toBe('gc')
  })
  it('a shell remainder follows the job memory, relative to the job rule', () => {
    expect(shownToPartyFor({ ...ownerPays, show_bills_to_other_party: true }, null)).toBe('gc')
    expect(shownToPartyFor({ ...gcPays, show_bills_to_other_party: true }, null)).toBe('customer')
    expect(shownToPartyFor({ ...ownerPays, show_bills_to_other_party: false }, null)).toBeNull()
    expect(shownToPartyFor({ ...gcIsCustomer, show_bills_to_other_party: true }, null)).toBeNull()
  })
})

describe('statementRoleFor', () => {
  it('the payer owes it', () => {
    expect(statementRoleFor(ownerPays, { shown_to_party: 'gc' }, OWNER)).toBe('owed')
    expect(statementRoleFor(gcPays, null, GC)).toBe('owed')
    expect(statementRoleFor(gcIsCustomer, null, GC)).toBe('owed')
  })
  it('the stamped other party sees it shared; an unstamped bill is hidden from them', () => {
    expect(statementRoleFor(ownerPays, { shown_to_party: 'gc' }, GC)).toBe('shared')
    expect(statementRoleFor(ownerPays, { shown_to_party: null }, GC)).toBe('hidden')
    expect(statementRoleFor(gcPays, { shown_to_party: 'customer' }, OWNER)).toBe('shared')
    expect(statementRoleFor(gcPays, { shown_to_party: null }, OWNER)).toBe('hidden')
  })
  it('a stamp for the wrong party shares nothing (a gc stamp on a job with no GC)', () => {
    expect(statementRoleFor(noGc, { shown_to_party: 'gc' }, GC)).toBe('hidden')
  })
  it('an invoice pick decides the payer before the stamp is read (split job)', () => {
    const split = { customer_id: OWNER, gc_customer_id: GC, bill_to_party: 'split' }
    expect(statementRoleFor(split, { bill_to_party: 'gc', shown_to_party: 'customer' }, GC)).toBe('owed')
    expect(statementRoleFor(split, { bill_to_party: 'gc', shown_to_party: 'customer' }, OWNER)).toBe('shared')
    expect(statementRoleFor(split, { bill_to_party: 'customer', shown_to_party: null }, GC)).toBe('hidden')
  })
  it('a typed someone-else bill is owed by nobody and shared only by its stamp', () => {
    const typed = { bill_to_email: 'tenant@x.com', shown_to_party: 'customer' }
    expect(statementRoleFor(ownerPays, typed, OWNER)).toBe('shared')
    expect(statementRoleFor(ownerPays, typed, GC)).toBe('hidden')
  })
})

describe('defaultShowOtherParty', () => {
  it('starts ticked only when the job remembers and there is someone to show', () => {
    expect(defaultShowOtherParty({ show_bills_to_other_party: true }, 'gc')).toBe(true)
    expect(defaultShowOtherParty({ show_bills_to_other_party: true }, null)).toBe(false)
    expect(defaultShowOtherParty({ show_bills_to_other_party: false }, 'gc')).toBe(false)
    expect(defaultShowOtherParty(null, 'gc')).toBe(false)
  })
})

describe('shownToChipText', () => {
  it('names who sees it, with a role fallback, and no chip when nobody does', () => {
    expect(shownToChipText('gc', { customer: 'Maria Delgado', gc: 'Done Right Foundation' })).toBe('👁 shown to Done Right Foundation')
    expect(shownToChipText('customer', { customer: null, gc: 'Done Right Foundation' })).toBe('👁 shown to the customer')
    expect(shownToChipText(null, { customer: 'x', gc: 'y' })).toBeNull()
  })
})
