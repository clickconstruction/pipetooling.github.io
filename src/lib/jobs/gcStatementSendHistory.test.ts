import { describe, expect, it } from 'vitest'
import type { RoundMarkRow } from './gcStatementRounds'
import {
  buildGcStatementSendHistory,
  formatStatementRecipient,
  laneForEmailType,
  statementLaneLabel,
  summarizeStatementLanes,
  type GcStatementAppSendRow,
} from './gcStatementSendHistory'

function mark(over: Partial<RoundMarkRow> = {}): RoundMarkRow {
  return {
    gc_customer_id: 'gc-knight',
    week_start: '2026-08-31',
    action: 'sent',
    acted_by: 'u-mal',
    acted_by_name: 'Malachi',
    acted_at: '2026-09-02T18:00:00Z',
    channel: 'text',
    note: null,
    temperature: null,
    expected_pay_by: null,
    ...over,
  } as RoundMarkRow
}
function email(over: Partial<GcStatementAppSendRow> = {}): GcStatementAppSendRow {
  return {
    id: 'e1',
    gc_name: 'Knight Contracting',
    group_by: 'gc',
    sent_to: 'ap@knight.com',
    subject: 'Click Plumbing open balances: Sep 3, 2026',
    total: 12345.5,
    job_count: 3,
    sent_by_name: 'Taunya',
    resend_email_id: 're-1',
    sent_at: '2026-09-03T12:02:00Z',
    cc_emails: null,
    ...over,
  }
}

describe('gcStatementSendHistory — one list across three lanes (journey-map #45)', () => {
  it('maps email_type to a lane; unknown/absent is the generic app lane', () => {
    expect(laneForEmailType('gc_statement_manual')).toBe('draft_message')
    expect(laneForEmailType('gc_statement_scheduled')).toBe('scheduled')
    expect(laneForEmailType(null)).toBe('app')
    expect(laneForEmailType('paid_job')).toBe('app')
    expect(statementLaneLabel('personal', 'text')).toBe('Personal · text')
    expect(statementLaneLabel('personal', null)).toBe('Personal · email')
    expect(statementLaneLabel('draft_message')).toBe('Draft Message')
    expect(statementLaneLabel('scheduled')).toBe('Scheduled send')
    expect(statementLaneLabel('app')).toBe('App email')
  })

  it('merges marks and app sends newest first, joining lane + status by resend id', () => {
    const rows = buildGcStatementSendHistory({
      marks: [mark(), mark({ action: 'contacted', channel: 'call', acted_at: '2026-08-27T15:00:00Z', temperature: 'warm', expected_pay_by: '2026-09-10', note: 'Dave says the 10th', week_start: '2026-08-24' })],
      emails: [email(), email({ id: 'e2', resend_email_id: 're-2', sent_at: '2026-08-20T12:02:00Z', sent_by_name: 'Robert', cc_emails: ['x@y.com', 'z@y.com'] })],
      log: [
        { resend_email_id: 're-1', email_type: 'gc_statement_scheduled', last_event: 'email.delivered' },
        { resend_email_id: 're-2', email_type: 'gc_statement_manual', last_event: 'bounced' },
      ],
    })
    expect(rows.map((r) => r.at)).toEqual(['2026-09-03T12:02:00Z', '2026-09-02T18:00:00Z', '2026-08-27T15:00:00Z', '2026-08-20T12:02:00Z'])
    expect(rows[0]).toMatchObject({ kind: 'statement', lane: 'scheduled', laneLabel: 'Scheduled send', who: 'Taunya', recipient: 'ap@knight.com', total: 12345.5, status: { label: 'Delivered', tone: 'good' } })
    expect(rows[1]).toMatchObject({ kind: 'statement', lane: 'personal', laneLabel: 'Personal · text', who: 'Malachi', recipient: null, total: null, status: null })
    expect(rows[2]).toMatchObject({ kind: 'spoke', lane: 'personal', laneLabel: 'Personal · call', temperature: 'warm', expectedPayBy: '2026-09-10', note: 'Dave says the 10th' })
    expect(rows[3]).toMatchObject({ lane: 'draft_message', who: 'Robert', recipient: 'ap@knight.com +2', status: { label: 'Bounced', tone: 'bad' } })
    expect(new Set(rows.map((r) => r.key)).size).toBe(4)
  })

  it('an app send with no log row (pre-stamp or ahead of the push) shows as App email with no status', () => {
    const [r] = buildGcStatementSendHistory({ marks: [], emails: [email({ resend_email_id: null })], log: [] })
    expect(r).toMatchObject({ lane: 'app', laneLabel: 'App email', status: null })
  })

  it('skipped marks never appear; the limit trims the newest-first list', () => {
    const rows = buildGcStatementSendHistory(
      { marks: [mark({ action: 'skipped' } as Partial<RoundMarkRow>), mark(), mark({ acted_at: '2026-08-26T18:00:00Z', week_start: '2026-08-24' })], emails: [email()], log: [] },
      2,
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.at)).toEqual(['2026-09-03T12:02:00Z', '2026-09-02T18:00:00Z'])
  })

  it('formats recipients and the lane summary', () => {
    expect(formatStatementRecipient('ap@knight.com', null)).toBe('ap@knight.com')
    expect(formatStatementRecipient('ap@knight.com', ['a@b.c', ' '])).toBe('ap@knight.com +1')
    const rows = buildGcStatementSendHistory({
      marks: [mark(), mark({ action: 'contacted', acted_at: '2026-08-27T15:00:00Z', week_start: '2026-08-24' })],
      emails: [email(), email({ id: 'e2', resend_email_id: 're-2', sent_at: '2026-08-20T12:02:00Z' }), email({ id: 'e3', resend_email_id: null, sent_at: '2026-08-13T12:02:00Z' })],
      log: [
        { resend_email_id: 're-1', email_type: 'gc_statement_scheduled', last_event: 'sent' },
        { resend_email_id: 're-2', email_type: 'gc_statement_manual', last_event: 'sent' },
      ],
    })
    expect(summarizeStatementLanes(rows)).toBe('1 personal · 1 by Draft Message · 1 scheduled · 1 app email')
    expect(summarizeStatementLanes([])).toBe('')
  })
})
