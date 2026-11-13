import { describe, expect, it } from 'vitest'
import { customerJourneys } from '../customerJourneys'
import { BILL_CHANNEL_CAPTION, MAKE_STRIPE_BILL_PRESS, billSampleHref, theyWillGet } from './billCustomerTheyWillGet'

const dana = { name: 'Dana Whitfield', email: 'dana@example.com' }

describe('theyWillGet · the Stripe bill tab (punch list #343)', () => {
  it('names the press for its act and says nothing goes yet', () => {
    const w = theyWillGet({ channel: 'stripe', ...dana, phone: '5125550142', copyEmails: [] })
    expect(w.press).toBe('Make the Stripe bill')
    expect(w.press).toBe(MAKE_STRIPE_BILL_PRESS)
    expect(w.pressTitle).toBe('When you press Make the Stripe bill')
    expect(w.pressLines).toEqual([
      'The bill is made and marked billed.',
      'Nothing goes to Dana Whitfield yet. The next screen sends it by email or by text.',
      'Every send is kept in Bills sent.',
    ])
    expect(w.caption).toBe(BILL_CHANNEL_CAPTION.stripe)
    expect(w.who).toBe('Dana Whitfield')
  })

  it('shows the phone on the job, formatted, and what it allows', () => {
    expect(theyWillGet({ channel: 'stripe', ...dana, phone: '5125550142', copyEmails: [] }).phoneLine).toBe('Phone (512) 555-0142. A text can follow on the next screen.')
  })

  it('says so when the job has no phone', () => {
    expect(theyWillGet({ channel: 'stripe', ...dana, phone: null, copyEmails: [] }).phoneLine).toBe('No phone on this job. A text needs a number on the customer.')
    expect(theyWillGet({ channel: 'stripe', ...dana, phone: '  ', copyEmails: [] }).phoneLine).toBe('No phone on this job. A text needs a number on the customer.')
  })

  it('promises nothing about a text when the window passes no phone (a GC pays, or a typed bill-to)', () => {
    expect(theyWillGet({ channel: 'stripe', ...dana, copyEmails: [] }).phoneLine).toBeNull()
  })

  it('reads the customer when the job has no name', () => {
    const w = theyWillGet({ channel: 'stripe', name: ' ', email: 'x@example.com', phone: null, copyEmails: [] })
    expect(w.who).toBeNull()
    expect(w.pressLines[1]).toBe('Nothing goes to the customer yet. The next screen sends it by email or by text.')
  })

  it('the helper says what a copy is and names no press', () => {
    const w = theyWillGet({ channel: 'stripe', ...dana, copyEmails: ['ap@ridgeway.example'] })
    expect(w.copyHelp).toContain('a copy of their own')
    expect(w.copyHelp).not.toContain('Send Email invoice')
  })
})

describe('theyWillGet · the Physical invoice tab', () => {
  it('one address: the press names the person and the box names the address', () => {
    const w = theyWillGet({ channel: 'physical', ...dana, copyEmails: [] })
    expect(w.press).toBe('Email the invoice to Dana')
    expect(w.pressTitle).toBe('When you press Email the invoice to Dana')
    expect(w.pressLines).toEqual(['One email goes now to dana@example.com. The invoice PDF is attached.', 'The bill is marked billed. No text goes with it.', 'The copy is kept in Bills sent.'])
    expect(w.caption).toBe('An email with the invoice PDF attached. It has no pay link.')
    expect(w.phoneLine).toBeNull()
  })

  it('with copies the press counts every address and the box says each sees the others', () => {
    const w = theyWillGet({ channel: 'physical', ...dana, copyEmails: ['ap@ridgeway.example'] })
    expect(w.press).toBe('Email the invoice to 2 people')
    expect(w.pressLines[0]).toBe('One email goes now to 2 addresses. Each one sees the others.')
    expect(theyWillGet({ channel: 'physical', ...dana, copyEmails: ['a@x.example', 'b@x.example'] }).press).toBe('Email the invoice to 3 people')
  })

  it('a company is called by its first word, as the text offer calls it', () => {
    expect(theyWillGet({ channel: 'physical', name: 'Ridgeway Builders, Inc.', email: 'ap@ridgeway.example', copyEmails: [] }).press).toBe('Email the invoice to Ridgeway')
  })

  it('no name: the press still names its act', () => {
    expect(theyWillGet({ channel: 'physical', name: null, email: 'x@example.com', copyEmails: [] }).press).toBe('Email the invoice')
  })

  it('no email: the box says what is missing and nothing else', () => {
    expect(theyWillGet({ channel: 'physical', name: 'Dana Whitfield', email: '', copyEmails: [] }).pressLines).toEqual(['This invoice goes by email. Add an email above first.'])
  })
})

describe('billSampleHref', () => {
  it('opens a step What customers see really has', () => {
    const homeowner = customerJourneys().find((j) => j.id === 'homeowner')
    const stepIds = new Set((homeowner?.steps ?? []).map((s) => s.id))
    for (const channel of ['stripe', 'physical'] as const) {
      const href = billSampleHref(channel)
      const step = href.split('step=homeowner/')[1]
      expect(href.startsWith('/settings?tab=settings-what-customers-see&step=homeowner/')).toBe(true)
      expect(stepIds.has(step ?? '')).toBe(true)
    }
  })
})
