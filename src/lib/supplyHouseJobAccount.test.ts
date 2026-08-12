import { describe, expect, it } from 'vitest'
import {
  composeJobAccountEmail,
  jobAccountGaps,
  prefillJobAccountInfo,
  type JobAccountInfo,
} from './supplyHouseJobAccount'

const base = {
  jobName: 'Pondhill demo',
  jobAddress: '4114 Pond Hill Rd, San Antonio, TX',
  customerName: 'Hank Ibarra',
  customerPhone: '(210) 889-1901',
  customerEmail: 'hank@example.com',
  customerType: null as string | null,
  gcName: null as string | null,
}

describe('prefillJobAccountInfo', () => {
  it('homeowner by default: owner = the job customer', () => {
    const info = prefillJobAccountInfo(base)
    expect(info.ownerMode).toBe('homeowner')
    expect(info.ownerName).toBe('Hank Ibarra')
    expect(info.sitePhone).toBe('(210) 889-1901')
    expect(info.companyName).toBe('')
  })

  it('a GC on the job → building owner with the GC as company', () => {
    const info = prefillJobAccountInfo({ ...base, gcName: 'H & I Construction' })
    expect(info.ownerMode).toBe('building_owner')
    expect(info.companyName).toBe('H & I Construction')
    expect(info.ownerName).toBe('Hank Ibarra')
  })

  it('commercial customer without a GC → building owner, customer is the company', () => {
    const info = prefillJobAccountInfo({ ...base, customerType: 'commercial' })
    expect(info.ownerMode).toBe('building_owner')
    expect(info.companyName).toBe('Hank Ibarra')
  })

  it('trims and null-safes every field', () => {
    const info = prefillJobAccountInfo({
      jobName: '  X  ',
      jobAddress: null,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerType: null,
      gcName: null,
    })
    expect(info.propertyName).toBe('X')
    expect(info.address).toBe('')
    expect(info.ownerName).toBe('')
  })
})

describe('jobAccountGaps', () => {
  const full: JobAccountInfo = {
    propertyName: 'P',
    address: 'A',
    sitePhone: '1',
    ownerMode: 'homeowner',
    ownerName: 'O',
    ownerPhone: '2',
    ownerEmail: '',
    companyName: '',
  }

  it('no gaps when the homeowner packet is complete (email optional)', () => {
    expect(jobAccountGaps(full)).toEqual([])
  })

  it('company only counts for building owners', () => {
    expect(jobAccountGaps({ ...full, ownerMode: 'building_owner' })).toEqual(['Company name'])
    expect(jobAccountGaps({ ...full, companyName: 'Acme', ownerMode: 'building_owner' })).toEqual([])
  })

  it('lists every blank field by label', () => {
    expect(jobAccountGaps({ ...full, sitePhone: '', ownerPhone: ' ' })).toEqual(['Site phone', 'Owner phone'])
  })
})

describe('composeJobAccountEmail', () => {
  it('homeowner email: subject, rows, no company line, sender in intro', () => {
    const { subject, text, html } = composeJobAccountEmail(
      { propertyName: 'P', address: 'A', sitePhone: '1', ownerMode: 'homeowner', ownerName: 'O', ownerPhone: '2', ownerEmail: '', companyName: '' },
      '964 · Pondhill demo',
      'Taunya'
    )
    expect(subject).toBe('Job account setup — 964 · Pondhill demo')
    expect(text).toContain('Homeowner: O')
    expect(text).not.toContain('company)')
    expect(text).toContain('— Taunya')
    expect(html).toContain('<strong>O</strong>')
  })

  it('names the asking company and offers the office number (v2.1608)', () => {
    const { text } = composeJobAccountEmail(
      { propertyName: 'P', address: 'A', sitePhone: '1', ownerMode: 'homeowner', ownerName: 'O', ownerPhone: '2', ownerEmail: '', companyName: '' },
      'J1',
      'Taunya',
      { companyName: 'Click Plumbing', officePhone: '(830) 555-0100' }
    )
    expect(text).toContain('set up a job account for Click Plumbing for the property below')
    expect(text).toContain('or call the office at (830) 555-0100')
  })

  it('missing org settings fall back to "our office" with no phone clause', () => {
    const { text } = composeJobAccountEmail(
      { propertyName: 'P', address: 'A', sitePhone: '1', ownerMode: 'homeowner', ownerName: 'O', ownerPhone: '2', ownerEmail: '', companyName: '' },
      'J1',
      ''
    )
    expect(text).toContain('set up a job account for our office for the property below')
    expect(text).not.toContain('call the office')
  })

  it('building owner email carries the company row and escapes HTML', () => {
    const { text, html } = composeJobAccountEmail(
      { propertyName: 'P', address: 'A', sitePhone: '1', ownerMode: 'building_owner', ownerName: 'O', ownerPhone: '2', ownerEmail: 'e@x.com', companyName: 'H & I <Construction>' },
      'J1',
      ''
    )
    expect(text).toContain('Building owner (company): H & I <Construction>')
    expect(text).toContain('Owner email: e@x.com')
    expect(html).toContain('H &amp; I &lt;Construction&gt;')
  })

  it('blank fields render as em dashes, never dropped (except optional email)', () => {
    const { text } = composeJobAccountEmail(
      { propertyName: '', address: '', sitePhone: '', ownerMode: 'homeowner', ownerName: '', ownerPhone: '', ownerEmail: '', companyName: '' },
      'J1',
      ''
    )
    expect(text).toContain('Property: —')
    expect(text).toContain('Owner phone: —')
    expect(text).not.toContain('Owner email')
  })
})
