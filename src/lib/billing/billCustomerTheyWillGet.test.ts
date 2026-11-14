import { describe, expect, it } from 'vitest'
import { customerJourneys } from '../customerJourneys'
import { BILL_CHANNEL_CAPTION, MAKE_BILL_SEND_LATER_PRESS, billSampleHref, theyWillGet } from './billCustomerTheyWillGet'

const dana = { name: 'Dana Whitfield', email: 'dana@example.com' }

describe('theyWillGet · the Stripe bill tab (punch list #343)', () => {
  it('the main press makes the bill and emails it, and the box says so (PR 3)', () => {
    const w = theyWillGet({ channel: 'stripe', ...dana, phone: '5125550142', copyEmails: [] })
    expect(w.press).toBe('Make the bill and email Dana')
    expect(w.pressTitle).toBe('When you press Make the bill and email Dana')
    expect(w.pressLines).toEqual(['The bill is made and marked billed.', 'The bill email goes now to dana@example.com.', 'A text is your choice on the next screen.', 'Every send is kept in Bills sent.'])
    expect(w.caption).toBe(BILL_CHANNEL_CAPTION.stripe)
    expect(w.who).toBe('Dana Whitfield')
  })

  it('the quiet press keeps the old way: the bill is made and nothing goes', () => {
    const w = theyWillGet({ channel: 'stripe', ...dana, copyEmails: [] })
    expect(w.later).toEqual({ press: 'Make the bill, send later', line: 'Make the bill, send later makes the bill and sends nothing. Use it for a bill you hand over or text.' })
    expect(w.later?.press).toBe(MAKE_BILL_SEND_LATER_PRESS)
    expect(theyWillGet({ channel: 'physical', ...dana, copyEmails: [] }).later).toBeNull()
  })

  it('with copies the press counts every address and the box says each copy is their own', () => {
    const one = theyWillGet({ channel: 'stripe', ...dana, copyEmails: ['ap@ridgeway.example'] })
    expect(one.press).toBe('Make the bill and email 2 people')
    expect(one.pressLines).toContain('1 more person gets a copy of their own.')
    const two = theyWillGet({ channel: 'stripe', ...dana, copyEmails: ['a@x.example', 'b@x.example'] })
    expect(two.press).toBe('Make the bill and email 3 people')
    expect(two.pressLines).toContain('2 more people get a copy of their own.')
  })

  it('test mode says the email comes to the sender', () => {
    const w = theyWillGet({ channel: 'stripe', ...dana, copyEmails: ['ap@ridgeway.example'], testMode: true })
    expect(w.pressLines[1]).toBe('Test mode: the bill email comes to you, not to dana@example.com.')
    expect(w.pressLines[2]).toBe('One copy comes to you too. Nobody ticked gets one.')
  })

  it('no email: the box says what is missing, and a job with no name still gets a press that names its act', () => {
    expect(theyWillGet({ channel: 'stripe', name: 'Dana Whitfield', email: '', copyEmails: [] }).pressLines).toEqual(['A Stripe bill goes by email. Add an email above first.'])
    expect(theyWillGet({ channel: 'stripe', name: null, email: 'x@example.com', copyEmails: [] }).press).toBe('Make the bill and email it')
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

  it('reads no name when the job has none', () => {
    expect(theyWillGet({ channel: 'stripe', name: ' ', email: 'x@example.com', phone: null, copyEmails: [] }).who).toBeNull()
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
