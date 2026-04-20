import { describe, expect, it } from 'vitest'
import { formatCollectPaymentInvoiceEmailLastSentLabel } from './formatCollectPaymentInvoiceEmailLastSentLabel'

describe('formatCollectPaymentInvoiceEmailLastSentLabel', () => {
  it('returns null when missing or invalid', () => {
    expect(formatCollectPaymentInvoiceEmailLastSentLabel(1_700_000_000_000, null)).toBeNull()
    expect(formatCollectPaymentInvoiceEmailLastSentLabel(1_700_000_000_000, '')).toBeNull()
    expect(formatCollectPaymentInvoiceEmailLastSentLabel(1_700_000_000_000, '   ')).toBeNull()
    expect(formatCollectPaymentInvoiceEmailLastSentLabel(1_700_000_000_000, 'not-a-date')).toBeNull()
  })

  it('returns relative copy under one minute', () => {
    const now = Date.parse('2026-04-19T15:00:00.000Z')
    const sent = Date.parse('2026-04-19T14:59:30.000Z')
    expect(formatCollectPaymentInvoiceEmailLastSentLabel(now, new Date(sent).toISOString())).toBe(
      'Less than one minute ago',
    )
  })

  it('returns time only between one minute and 24 hours', () => {
    const sent = Date.parse('2026-04-19T18:00:00.000Z')
    const now = sent + 2 * 60 * 60 * 1000
    const label = formatCollectPaymentInvoiceEmailLastSentLabel(now, new Date(sent).toISOString())
    expect(label).toMatch(/^Last emailed at /)
    expect(label).not.toMatch(/2026/)
    expect(label).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns date and time at or after 24 hours', () => {
    const sent = Date.parse('2026-04-19T12:00:00.000Z')
    const now = sent + 25 * 60 * 60 * 1000
    const label = formatCollectPaymentInvoiceEmailLastSentLabel(now, new Date(sent).toISOString())
    expect(label).toMatch(/^Last emailed at /)
    expect(label).toMatch(/2026/)
    expect(label).toMatch(/Apr/)
    expect(label).toMatch(/\d{1,2}:\d{2}/)
  })
})
