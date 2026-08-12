import { describe, expect, it } from 'vitest'
import {
  groupJobAccountLedger,
  shareContactDisplay,
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
