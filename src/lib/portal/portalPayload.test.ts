import { describe, expect, it } from 'vitest'
import { formatPortalDate, formatPortalUsd, parsePortalPayload, portalDaysSinceBilled, splitPortalAddress } from './portalPayload'

const good = {
  company: { name: 'Click Plumbing and Electrical', cityLine: 'San Antonio, Texas', licenseLine: '', phone: '', email: '' },
  customerName: 'Michael Hageman',
  audience: 'customer',
  bills: [
    { jobLabel: 'Water heater · Job 612', jobNumber: '612', jobAddress: '3827 Sage Ridge Dr', amount: 1450, billedOn: '2026-08-04', payUrl: 'https://invoice.stripe.com/x', checkRef: '612' },
    { jobLabel: 'Service call · Job 655', jobNumber: '655', jobAddress: null, amount: 250, billedOn: '2026-08-18', payUrl: null, checkRef: '655' },
  ],
  totalDue: 1700,
  requestableJobs: [{ id: 'j1', label: 'Service call · Job 655' }],
}

describe('parsePortalPayload', () => {
  it('parses a full payload', () => {
    const p = parsePortalPayload(good)!
    expect(p.customerName).toBe('Michael Hageman')
    expect(p.audience).toBe('customer')
    expect(p.bills).toHaveLength(2)
    expect(p.bills[0]!.payUrl).toBe('https://invoice.stripe.com/x')
    expect(p.totalDue).toBe(1700)
    expect(p.requestableJobs).toEqual([{ id: 'j1', label: 'Service call · Job 655' }])
  })

  it('rejects non-payloads and error bodies', () => {
    expect(parsePortalPayload(null)).toBeNull()
    expect(parsePortalPayload({ error: 'This link is no longer active.' })).toBeNull()
  })

  it('drops malformed bills, zero amounts, and non-https pay urls; recomputes a missing total', () => {
    const p = parsePortalPayload({
      ...good,
      totalDue: undefined,
      bills: [
        ...good.bills,
        { jobLabel: 'Free', amount: 0 },
        { jobLabel: 'Weird pay', amount: 50, payUrl: 'javascript:alert(1)' },
        'garbage',
      ],
    })!
    expect(p.bills).toHaveLength(3)
    expect(p.bills[2]!.payUrl).toBeNull()
    expect(p.totalDue).toBe(1750)
  })

  it('unknown audience falls back to customer; all passes through', () => {
    expect(parsePortalPayload({ ...good, audience: 'martian' })!.audience).toBe('customer')
    expect(parsePortalPayload({ ...good, audience: 'all' })!.audience).toBe('all')
  })

  it('parses asGc/ownerName on merged rows and defaults them safely', () => {
    const p = parsePortalPayload({
      ...good,
      audience: 'all',
      bills: [
        { ...good.bills[0], asGc: true, ownerName: 'Bexar Lofts LLC' },
        { ...good.bills[1] }, // legacy shape: no asGc/ownerName fields
        { jobLabel: 'Odd', amount: 10, asGc: 'yes', ownerName: '   ' },
      ],
    })!
    expect(p.bills[0]!.asGc).toBe(true)
    expect(p.bills[0]!.ownerName).toBe('Bexar Lofts LLC')
    expect(p.bills[1]!.asGc).toBe(false)
    expect(p.bills[1]!.ownerName).toBeNull()
    expect(p.bills[2]!.asGc).toBe(false)
    expect(p.bills[2]!.ownerName).toBeNull()
  })

  it('parses requestToken for slug-opened pages, null when absent or blank', () => {
    expect(parsePortalPayload(good)!.requestToken).toBeNull()
    expect(parsePortalPayload({ ...good, requestToken: '  ' })!.requestToken).toBeNull()
    expect(parsePortalPayload({ ...good, requestToken: 'abc123' })!.requestToken).toBe('abc123')
  })

  it('parses requestableProperties defensively; absent field means empty list', () => {
    expect(parsePortalPayload(good)!.requestableProperties).toEqual([])
    const p = parsePortalPayload({
      ...good,
      requestableProperties: [
        { jobId: 'j1', street: ' 415 Springtown Way ', city: 'San Marcos' },
        { jobId: 'j2', street: '10 Elm St', city: '   ' },
        { jobId: 'j3', street: '   ' }, // blank street → dropped
        { street: 'no id' },
        'garbage',
      ],
    })!
    expect(p.requestableProperties).toEqual([
      { jobId: 'j1', street: '415 Springtown Way', city: 'San Marcos' },
      { jobId: 'j2', street: '10 Elm St', city: null },
    ])
  })

  it('parses the short-address slug for the footer QR, null when absent or blank', () => {
    expect(parsePortalPayload(good)!.slug).toBeNull()
    expect(parsePortalPayload({ ...good, slug: '   ' })!.slug).toBeNull()
    expect(parsePortalPayload({ ...good, slug: 'knight-contracting' })!.slug).toBe('knight-contracting')
  })
})

describe('formatters', () => {
  it('formats statement dates TZ-safely', () => {
    expect(formatPortalDate('2026-08-04')).toBe('Aug 4, 2026')
    expect(formatPortalDate(null)).toBeNull()
    expect(formatPortalDate('soon')).toBeNull()
  })

  it('always shows cents', () => {
    expect(formatPortalUsd(1700)).toBe('$1,700.00')
    expect(formatPortalUsd(249.6)).toBe('$249.60')
  })

  it('splits addresses street-first for the trade-first job line', () => {
    expect(splitPortalAddress('415 Springtown Way, San Marcos, TX 78666')).toEqual({
      street: '415 Springtown Way',
      rest: 'San Marcos, TX 78666',
    })
    expect(splitPortalAddress('1200 Kenney Fort Blvd Round Rock, TX 78665')).toEqual({
      street: '1200 Kenney Fort Blvd Round Rock',
      rest: 'TX 78665',
    })
    expect(splitPortalAddress('415 Springtown Way')).toEqual({ street: '415 Springtown Way', rest: null })
    expect(splitPortalAddress('   ')).toBeNull()
    expect(splitPortalAddress(null)).toBeNull()
  })

  it('ages the Billed column: today/yesterday/N days, copper at 30', () => {
    expect(portalDaysSinceBilled('2026-08-21', '2026-08-21')).toEqual({ label: 'today', aging: false })
    expect(portalDaysSinceBilled('2026-08-20', '2026-08-21')).toEqual({ label: 'yesterday', aging: false })
    expect(portalDaysSinceBilled('2026-08-06', '2026-08-21')).toEqual({ label: '15 days ago', aging: false })
    expect(portalDaysSinceBilled('2026-07-06', '2026-08-21')).toEqual({ label: '46 days ago', aging: true })
    expect(portalDaysSinceBilled(null, '2026-08-21')).toBeNull()
    expect(portalDaysSinceBilled('2026-09-01', '2026-08-21')).toBeNull() // future dates stay silent
  })
})

describe('agreements (Contract Desk PR 5)', () => {
  it('parses signed and sent agreements, drops unknown statuses and non-http links', () => {
    const p = parsePortalPayload({
      customerName: 'Michael Palmer',
      bills: [],
      agreements: [
        { jobLabel: 'J922', jobAddress: '138 W Pat Dolan', status: 'signed', templateName: 'Terms', amountCents: 500000, signedAt: '2026-09-03T00:14:00Z', signerName: 'Michael Palmer', sentAt: null, signUrl: 'https://clicktooling.com/contract/sign?t=abc' },
        { jobLabel: 'J923', status: 'sent', signUrl: 'javascript:alert(1)' },
        { jobLabel: 'J924', status: 'draft' },
      ],
    })
    expect(p?.agreements).toHaveLength(2)
    expect(p?.agreements[0]).toMatchObject({ status: 'signed', amountCents: 500000, signerName: 'Michael Palmer' })
    expect(p?.agreements[1]).toMatchObject({ status: 'sent', signUrl: null, amountCents: null })
  })

  it('a payload without agreements parses to an empty list', () => {
    expect(parsePortalPayload({ customerName: 'X', bills: [] })?.agreements).toEqual([])
  })
})

