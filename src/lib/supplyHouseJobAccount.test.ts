import { describe, expect, it } from 'vitest'
import {
  buildJobAccountClipboardText,
  buildJobAccountMailtoUrl,
  composeJobAccountEmail,
  JOB_ACCOUNT_MAILTO_MAX_CHARS,
  jobAccountMailtoTooLong,
  jobAccountOwnerGaps,
  jobAccountSendBlocked,
  jobAccountSoftGaps,
  prefillJobAccountInfo,
  type JobAccountInfo,
} from './supplyHouseJobAccount'

const args = {
  jobName: 'Pondhill demo',
  jobAddress: '4114 Pond Hill Rd, San Antonio, TX',
  customerName: 'Hank Ibarra',
  customerPhone: '(210) 889-1901',
  customerEmail: 'hank@example.com',
  customerAddress: '99 Mailing Ln, San Antonio, TX',
  customerType: null as string | null,
  gc: null as { name: string | null; phone: string | null; email: string | null } | null,
  savedOwner: null as {
    owner_mode: string
    owner_name: string
    company_name: string
    mailing_address: string
    owner_email: string
  } | null,
}

describe('prefillJobAccountInfo (v2.1609 owner rules)', () => {
  it('residential, no GC: customer is the homeowner — name + mailing address prefill', () => {
    const info = prefillJobAccountInfo(args)
    expect(info.ownerMode).toBe('homeowner')
    expect(info.ownerName).toBe('Hank Ibarra')
    expect(info.mailingAddress).toBe('99 Mailing Ln, San Antonio, TX')
    expect(info.gcCompany).toBe('')
  })

  it('GC-routed job: GC block fills, owner section starts BLANK (the GC is not the owner)', () => {
    const info = prefillJobAccountInfo({
      ...args,
      gc: { name: 'H & I Construction', phone: '(210) 111-2222', email: 'gc@hi.com' },
    })
    expect(info.gcCompany).toBe('H & I Construction')
    expect(info.gcPhone).toBe('(210) 111-2222')
    expect(info.ownerMode).toBe('building_owner')
    expect(info.companyName).toBe('')
    expect(info.ownerName).toBe('')
    expect(info.mailingAddress).toBe('')
  })

  it('commercial customer, no GC: the customer IS the building owner', () => {
    const info = prefillJobAccountInfo({ ...args, customerType: 'commercial' })
    expect(info.ownerMode).toBe('building_owner')
    expect(info.companyName).toBe('Hank Ibarra')
    expect(info.mailingAddress).toBe('99 Mailing Ln, San Antonio, TX')
  })

  it('a saved job_property_owners row always wins, GC or not', () => {
    const info = prefillJobAccountInfo({
      ...args,
      gc: { name: 'H & I Construction', phone: null, email: null },
      savedOwner: {
        owner_mode: 'building_owner',
        owner_name: 'Pat Owner',
        company_name: 'Pondhill Property LLC',
        mailing_address: 'PO Box 12, Austin, TX',
        owner_email: 'pat@pondhill.com',
      },
    })
    expect(info.companyName).toBe('Pondhill Property LLC')
    expect(info.ownerName).toBe('Pat Owner')
    expect(info.mailingAddress).toBe('PO Box 12, Austin, TX')
  })
})

const full: JobAccountInfo = {
  propertyName: 'P',
  address: 'A',
  sitePhone: '1',
  gcCompany: 'GC Co',
  gcPhone: '2',
  gcEmail: 'g@x.com',
  ownerMode: 'building_owner',
  ownerName: 'Pat',
  companyName: 'Owner LLC',
  mailingAddress: 'PO Box 1',
  ownerEmail: '',
}

describe('send gate (v2.1609 — hard block until the owner is known)', () => {
  it('complete building owner: not blocked', () => {
    expect(jobAccountSendBlocked(full)).toBe(false)
    expect(jobAccountOwnerGaps(full)).toEqual([])
  })

  it('building owner missing company or mailing address blocks', () => {
    expect(jobAccountOwnerGaps({ ...full, companyName: '' })).toEqual(['Owner company'])
    expect(jobAccountOwnerGaps({ ...full, mailingAddress: ' ' })).toEqual(['Owner mailing address'])
    expect(jobAccountSendBlocked({ ...full, companyName: '', mailingAddress: '' })).toBe(true)
  })

  it('homeowner requires name + mailing address; contact optional for building owners', () => {
    expect(jobAccountOwnerGaps({ ...full, ownerMode: 'homeowner', ownerName: '' })).toEqual(['Owner name'])
    expect(jobAccountOwnerGaps({ ...full, ownerName: '' })).toEqual([])
  })

  it('soft gaps never block', () => {
    const info = { ...full, sitePhone: '', propertyName: '' }
    expect(jobAccountSoftGaps(info)).toEqual(['Property name', 'Site phone'])
    expect(jobAccountSendBlocked(info)).toBe(false)
  })
})

describe('composeJobAccountEmail (sectioned, v2.1609)', () => {
  it('renders Property / General contractor / Property owner sections with mailing address', () => {
    const { text, html } = composeJobAccountEmail(full, 'J1', 'Taunya', { companyName: 'Click', officePhone: '555' })
    expect(text).toContain('Property:')
    expect(text).toContain('General contractor:')
    expect(text).toContain('  Company: GC Co')
    expect(text).toContain('Property owner:')
    expect(text).toContain('  Building owner (company): Owner LLC')
    expect(text).toContain('  Mailing address: PO Box 1')
    expect(text).not.toContain('Owner phone')
    expect(html).toContain('General contractor')
    expect(text).toContain('job account for Click for the property below')
    expect(text).toContain('call the office at 555')
  })

  it('no GC → the contractor section is omitted; homeowner labels apply', () => {
    const { text } = composeJobAccountEmail(
      { ...full, gcCompany: '', gcPhone: '', gcEmail: '', ownerMode: 'homeowner' },
      'J1',
      ''
    )
    expect(text).not.toContain('General contractor')
    expect(text).toContain('  Homeowner: Pat')
    expect(text).toContain('job account for our office')
  })
})

describe('user-send builders (v2.1820)', () => {
  const recipients = [
    { label: 'Reece', email: 'reece@morsco.com' },
    { label: 'Ferguson — Central desk', email: 'orders@ferguson.com' },
  ]

  it('mailto URL joins recipients, encodes subject and body', () => {
    const url = buildJobAccountMailtoUrl(recipients, 'Job account setup — J1', 'Line one\nLine two & three')
    expect(url.startsWith('mailto:reece%40morsco.com%2Corders%40ferguson.com?')).toBe(true)
    expect(url).toContain('subject=Job%20account%20setup%20%E2%80%94%20J1')
    expect(url).toContain('body=Line%20one%0ALine%20two%20%26%20three')
    expect(jobAccountMailtoTooLong(url)).toBe(false)
  })

  it('mailto skips blank recipient emails', () => {
    const url = buildJobAccountMailtoUrl([{ label: 'X', email: '  ' }, { label: 'Y', email: 'y@z.com' }], 's', 'b')
    expect(url.startsWith('mailto:y%40z.com?')).toBe(true)
  })

  it('too-long guard trips past the limit', () => {
    expect(jobAccountMailtoTooLong('m'.repeat(JOB_ACCOUNT_MAILTO_MAX_CHARS + 1))).toBe(true)
  })

  it('clipboard packet carries To/Subject headers then the body', () => {
    const out = buildJobAccountClipboardText(recipients, 'Subj', 'Body text')
    expect(out).toBe('To: Reece <reece@morsco.com>, Ferguson — Central desk <orders@ferguson.com>\nSubject: Subj\n\nBody text')
  })

  it('clipboard falls back to bare email when the label is blank', () => {
    const out = buildJobAccountClipboardText([{ label: ' ', email: 'a@b.com' }], 'S', 'B')
    expect(out).toContain('To: a@b.com\n')
  })
})
