import { describe, expect, it } from 'vitest'
import {
  billTabJobAccountNote,
  groupJobAccountLedger,
  jobAccountShareIconTitle,
  shareContactDisplay,
  shareSendMethodLabel,
  summarizeJobShares,
  type JobAccountShareRow,
} from './supplyHouseJobAccountsLedger'

const row = (over: Partial<JobAccountShareRow>): JobAccountShareRow => ({
  job_id: 'j1',
  contact_label: 'Ferguson — Central desk',
  contact_email: 'orders@ferguson.com',
  sent_by_name: 'Taunya',
  sent_at: '2026-08-12T15:00:00Z',
  ...over,
})

describe('shareContactDisplay', () => {
  it('prefers the label, falls back to the email, then a dash', () => {
    expect(shareContactDisplay(row({}))).toBe('Ferguson — Central desk')
    expect(shareContactDisplay(row({ contact_label: ' ' }))).toBe('orders@ferguson.com')
    expect(shareContactDisplay({ contact_label: '', contact_email: '' })).toBe('—')
  })
})

describe('groupJobAccountLedger', () => {
  it('one row per job with deduped contacts, newest send first', () => {
    const ledger = groupJobAccountLedger([
      row({ sent_at: '2026-08-10T10:00:00Z', sent_by_name: 'Robert' }),
      row({ contact_label: 'Morrison — Bree', contact_email: 'bree@morrison.com', sent_at: '2026-08-12T15:00:00Z' }),
      row({ job_id: 'j2', contact_label: 'Moore — counter', sent_at: '2026-08-11T09:00:00Z' }),
      row({ sent_at: '2026-08-12T15:00:00Z' }),
    ])
    expect(ledger.map((l) => l.jobId)).toEqual(['j1', 'j2'])
    const j1 = ledger[0]!
    expect(j1.contacts).toEqual(['Morrison — Bree', 'Ferguson — Central desk'])
    expect(j1.lastSentAt).toBe('2026-08-12T15:00:00Z')
    expect(j1.lastSentByName).toBe('Taunya')
  })

  it('empty input → empty ledger', () => {
    expect(groupJobAccountLedger([])).toEqual([])
  })
})

describe('summarizeJobShares', () => {
  const fmt = (iso: string) => iso.slice(5, 10)

  it('null when never shared', () => {
    expect(summarizeJobShares([], fmt)).toBeNull()
  })

  it('names the newest recipient and counts the rest', () => {
    expect(summarizeJobShares([row({})], fmt)).toBe('Already shared with Ferguson — Central desk · 08-12')
    expect(
      summarizeJobShares(
        [row({ sent_at: '2026-08-10T10:00:00Z' }), row({ contact_label: 'Morrison — Bree', sent_at: '2026-08-12T15:00:00Z' })],
        fmt
      )
    ).toBe('Already shared with Morrison — Bree · 08-12 · +1 more')
  })
})

describe('shareSendMethodLabel (v2.1820)', () => {
  it('names user-inbox sends, stays silent for app sends and legacy rows', () => {
    expect(shareSendMethodLabel({ send_method: 'user_email' })).toBe('from their inbox')
    expect(shareSendMethodLabel({ send_method: 'app' })).toBeNull()
    expect(shareSendMethodLabel({})).toBeNull()
  })
})

describe('jobAccountShareIconTitle', () => {
  const fmt = (iso: string) => iso.slice(0, 10)
  it('is the setup affordance when nothing was shared', () => {
    expect(jobAccountShareIconTitle([], fmt)).toBe('Share with supply house — set up a job account')
  })
  it('names the newest send and collapses the rest once a packet is on record', () => {
    expect(
      jobAccountShareIconTitle(
        [row({ sent_at: '2026-08-10T10:00:00Z', contact_label: 'Reece — Georgetown' }), row({ sent_at: '2026-08-12T15:00:00Z' })],
        fmt,
      ),
    ).toBe('Job account on file — shared with Ferguson — Central desk · 2026-08-12 · +1 more. Click for history or to resend.')
  })
})

describe('billTabJobAccountNote', () => {
  const fmt = (iso: string) => iso.slice(0, 10)
  it('is null with no packet on record', () => {
    expect(billTabJobAccountNote([], 3240.5, fmt)).toBeNull()
  })
  it('names the house from the newest send, drops the desk suffix, and adds the flagged line only when dollars exist', () => {
    const rows = [
      row({ sent_at: '2026-08-10T10:00:00Z', contact_label: 'Ferguson — Central desk' }),
      row({ sent_at: '2026-08-19T15:00:00Z', contact_label: 'Reece — Georgetown desk', sent_by_name: 'Taunya' }),
    ]
    expect(billTabJobAccountNote(rows, 3240.5, fmt)).toEqual({
      headline: 'Job account on file with Reece',
      sentLine: 'packet sent 2026-08-19 by Taunya',
      whatItMeans: 'If material invoices on this job go unpaid, Reece bills the property owner — not you.',
      flaggedLine: "$3,240.50 of this job's unpaid supplier invoices are on the account.",
    })
    expect(billTabJobAccountNote(rows, 0, fmt)!.flaggedLine).toBeNull()
  })
  it('falls back to the email and omits "by" when the sender is blank', () => {
    const note = billTabJobAccountNote([row({ contact_label: '', contact_email: 'orders@winn.com', sent_by_name: ' ' })], 0, fmt)!
    expect(note.headline).toBe('Job account on file with orders@winn.com')
    expect(note.sentLine).toBe('packet sent 2026-08-12')
  })
})
