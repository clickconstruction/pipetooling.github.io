import { describe, expect, it } from 'vitest'
import { emailLogStatusChip, formatEmailLogRecipients, mapEmailSendLogRows } from './emailSendLog'

describe('emailLogStatusChip', () => {
  it('maps delivery outcomes to tones', () => {
    expect(emailLogStatusChip('delivered')).toEqual({ label: 'Delivered', tone: 'good' })
    expect(emailLogStatusChip('bounced')).toEqual({ label: 'Bounced', tone: 'bad' })
    expect(emailLogStatusChip('sent')).toEqual({ label: 'Sent', tone: 'neutral' })
    expect(emailLogStatusChip('delivery_delayed')).toEqual({ label: 'Delayed', tone: 'bad' })
  })

  it('strips an email. prefix if stored raw', () => {
    expect(emailLogStatusChip('email.delivered')).toEqual({ label: 'Delivered', tone: 'good' })
  })

  it('handles null/empty as a neutral dash', () => {
    expect(emailLogStatusChip(null)).toEqual({ label: '—', tone: 'neutral' })
    expect(emailLogStatusChip('')).toEqual({ label: '—', tone: 'neutral' })
  })

  it('passes unknown events through as neutral', () => {
    expect(emailLogStatusChip('something_new')).toEqual({ label: 'something_new', tone: 'neutral' })
  })
})

describe('formatEmailLogRecipients', () => {
  it('shows a single recipient plainly', () => {
    expect(formatEmailLogRecipients(['a@x.com'])).toBe('a@x.com')
  })
  it('collapses extras into +n', () => {
    expect(formatEmailLogRecipients(['a@x.com', 'b@x.com', 'c@x.com'])).toBe('a@x.com +2')
  })
  it('handles empty/null/blank', () => {
    expect(formatEmailLogRecipients([])).toBe('—')
    expect(formatEmailLogRecipients(null)).toBe('—')
    expect(formatEmailLogRecipients(['  '])).toBe('—')
  })
})

describe('mapEmailSendLogRows', () => {
  it('maps raw rows and defaults null to_emails to empty', () => {
    const out = mapEmailSendLogRows([
      { id: '1', sent_at: '2026-08-03T12:00:00Z', from_email: 'f@x.com', to_emails: null, subject: 's', last_event: 'sent' },
    ])
    expect(out).toEqual([
      { id: '1', sentAt: '2026-08-03T12:00:00Z', fromEmail: 'f@x.com', toEmails: [], subject: 's', lastEvent: 'sent' },
    ])
  })
  it('handles null input', () => {
    expect(mapEmailSendLogRows(null)).toEqual([])
  })
})
