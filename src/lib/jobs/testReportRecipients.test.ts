import { describe, expect, it } from 'vitest'
import { contactInfoWithEmail, gcPickWrites, prefillTestReportTo, testReportRecipientLabel } from './testReportRecipients'

describe('prefillTestReportTo', () => {
  it('prefers the last send, then the GC, then the customer, then nothing', () => {
    expect(prefillTestReportTo({ previous: ['a@gc.com', 'b@gc.com'], gcEmail: 'gc@x.com', customerEmail: 'c@x.com' })).toEqual({ to: 'a@gc.com, b@gc.com', source: 'previous' })
    expect(prefillTestReportTo({ previous: [], gcEmail: ' gc@x.com ', customerEmail: 'c@x.com' })).toEqual({ to: 'gc@x.com', source: 'gc' })
    expect(prefillTestReportTo({ previous: [], gcEmail: null, customerEmail: 'c@x.com' })).toEqual({ to: 'c@x.com', source: 'customer' })
    expect(prefillTestReportTo({ previous: [], gcEmail: '', customerEmail: '' })).toEqual({ to: '', source: 'none' })
  })
})

describe('testReportRecipientLabel', () => {
  it('names the GC when its address is a recipient, else the customer, else nothing', () => {
    const base = { gcEmail: 'billing@doneright.com', gcName: 'Done Right Foundation Repair', customerEmail: 'anna@example.com', customerName: 'Anna & Jeffrey Johnson' }
    expect(testReportRecipientLabel({ ...base, toList: ['Billing@DoneRight.com'] })).toBe('Done Right Foundation Repair')
    expect(testReportRecipientLabel({ ...base, toList: ['anna@example.com'] })).toBe('Anna & Jeffrey Johnson')
    expect(testReportRecipientLabel({ ...base, toList: ['someone@else.com'] })).toBeNull()
    expect(testReportRecipientLabel({ ...base, gcEmail: null, toList: ['anna@example.com', 'x@y.z'] })).toBe('Anna & Jeffrey Johnson')
  })
})

describe('contactInfoWithEmail', () => {
  it('merges into an object blob and replaces anything else', () => {
    expect(contactInfoWithEmail({ phone: '512', email: 'old@x.com' }, ' new@x.com ')).toEqual({ phone: '512', email: 'new@x.com' })
    expect(contactInfoWithEmail(null, 'a@b.co')).toEqual({ email: 'a@b.co' })
    expect(contactInfoWithEmail('junk' as never, 'a@b.co')).toEqual({ email: 'a@b.co' })
  })
})

describe('gcPickWrites', () => {
  it('links a newly picked GC when asked, never re-links the same one', () => {
    expect(gcPickWrites({ pickedGcId: 'gc2', jobGcId: null, setAsGc: true, pickedGcEmail: 'g@x.com', firstTo: 'g@x.com', saveEmailOnCard: true })).toEqual({ linkGcToJob: 'gc2', saveEmailOnGc: null })
    expect(gcPickWrites({ pickedGcId: 'gc2', jobGcId: 'gc2', setAsGc: true, pickedGcEmail: 'g@x.com', firstTo: 'g@x.com', saveEmailOnCard: true })).toEqual({ linkGcToJob: null, saveEmailOnGc: null })
    expect(gcPickWrites({ pickedGcId: 'gc2', jobGcId: null, setAsGc: false, pickedGcEmail: null, firstTo: 't@x.com', saveEmailOnCard: false })).toEqual({ linkGcToJob: null, saveEmailOnGc: null })
  })

  it('saves the typed address on the GC card only when the card has none and the office said so', () => {
    expect(gcPickWrites({ pickedGcId: 'gc2', jobGcId: null, setAsGc: true, pickedGcEmail: '', firstTo: 'typed@x.com', saveEmailOnCard: true })).toEqual({ linkGcToJob: 'gc2', saveEmailOnGc: { customerId: 'gc2', email: 'typed@x.com' } })
    // The job's existing GC, no pick, no email on file: still savable.
    expect(gcPickWrites({ pickedGcId: null, jobGcId: 'gc1', setAsGc: true, pickedGcEmail: null, firstTo: 'typed@x.com', saveEmailOnCard: true })).toEqual({ linkGcToJob: null, saveEmailOnGc: { customerId: 'gc1', email: 'typed@x.com' } })
    expect(gcPickWrites({ pickedGcId: null, jobGcId: null, setAsGc: true, pickedGcEmail: null, firstTo: 'typed@x.com', saveEmailOnCard: true })).toEqual({ linkGcToJob: null, saveEmailOnGc: null })
  })
})
