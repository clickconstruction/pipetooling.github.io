import { describe, expect, it } from 'vitest'
import { formatPortalDate, formatPortalUsd, parsePortalPayload } from './portalPayload'

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

  it('unknown audience falls back to customer', () => {
    expect(parsePortalPayload({ ...good, audience: 'martian' })!.audience).toBe('customer')
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
})
