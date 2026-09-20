import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { handoffBlocker, handoffPatch, isAwaitingPaperCopy, isHandedAwaitingPaper, jobContractSentChannel } from './jobContractHandoff'

describe('jobContractSentChannel', () => {
  it('reads every send before the column as a signing link', () => {
    expect(jobContractSentChannel(null)).toBe('link')
    expect(jobContractSentChannel({ sent_channel: null })).toBe('link')
    expect(jobContractSentChannel({ sent_channel: 'carrier pigeon' })).toBe('link')
    expect(jobContractSentChannel({ sent_channel: 'handed' })).toBe('handed')
    expect(jobContractSentChannel({ sent_channel: 'pdf_email' })).toBe('pdf_email')
  })
})

describe('isHandedAwaitingPaper', () => {
  it('is a live sent row that went out on paper', () => {
    expect(isHandedAwaitingPaper({ status: 'sent', sent_channel: 'handed' })).toBe(true)
    expect(isHandedAwaitingPaper({ status: 'sent', sent_channel: null })).toBe(false)
    expect(isHandedAwaitingPaper({ status: 'signed', sent_channel: 'handed' })).toBe(false)
    expect(isHandedAwaitingPaper({ status: 'sent', sent_channel: 'handed', voided_at: '2026-09-19T00:00:00Z' })).toBe(false)
    expect(isHandedAwaitingPaper(null)).toBe(false)
  })
})

describe('isAwaitingPaperCopy (v2.3631)', () => {
  it('covers both paper ways, and never a signing-link send', () => {
    expect(isAwaitingPaperCopy({ status: 'sent', sent_channel: 'handed' })).toBe(true)
    expect(isAwaitingPaperCopy({ status: 'sent', sent_channel: 'pdf_email' })).toBe(true)
    expect(isAwaitingPaperCopy({ status: 'sent', sent_channel: 'link' })).toBe(false)
    expect(isAwaitingPaperCopy({ status: 'sent', sent_channel: null })).toBe(false)
    expect(isAwaitingPaperCopy({ status: 'draft', sent_channel: 'pdf_email' })).toBe(false)
  })
})

describe('handoffBlocker', () => {
  const draft = { status: 'draft', voided_at: null, body_html: 'Terms…' }
  it('lets a draft with terms through', () => {
    expect(handoffBlocker(draft)).toBeNull()
  })
  it('names what is in the way', () => {
    expect(handoffBlocker(null)).toMatch(/Save the agreement/)
    expect(handoffBlocker({ ...draft, body_html: '  ' })).toMatch(/terms/)
    expect(handoffBlocker({ ...draft, status: 'sent' })).toMatch(/already out/)
    expect(handoffBlocker({ ...draft, status: 'signed' })).toMatch(/already signed/)
    expect(handoffBlocker({ ...draft, voided_at: '2026-09-19T00:00:00Z' })).toMatch(/voided/)
  })
})

describe('handoffPatch', () => {
  it('stamps sent without a link: no reminders, the count moves, the first sent_at stays', () => {
    expect(handoffPatch({ sent_at: null, send_count: 0 }, '2026-09-20T01:00:00Z')).toEqual({
      status: 'sent', sent_channel: 'handed', sent_at: '2026-09-20T01:00:00Z', last_sent_at: '2026-09-20T01:00:00Z', send_count: 1, next_reminder_at: null,
    })
    const again = handoffPatch({ sent_at: '2026-09-03T00:00:00Z', send_count: 2 }, '2026-09-20T01:00:00Z')
    expect(again.sent_at).toBe('2026-09-03T00:00:00Z')
    expect(again.send_count).toBe(3)
  })
})
