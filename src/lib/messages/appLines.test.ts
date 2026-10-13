import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import { APP_WHO, foldAppLines, foldWords, isAppLine, sentCopyFacts, type AppFoldRow, type SentCopyStamps } from './appLines'
import { sentLineFacts, sentLines, type SentCopyWithJobs } from './sentLines'
import type { ThreadMessage } from './thread'

/** A Chicago wall time in October 2026 (CDT, five hours behind UTC). */
const cdt = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00-05:00`).toISOString()

// Dana Whitfield on the sewer line (1312), the integrations mockups' card 1. Made-up rows.
const DANA: Contact = {
  id: 'dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [{ id: 'dana-email', kind: 'email', value: 'dana.whitfield@example.com', optedOutAt: null }],
  jobIds: ['pipeline:j1312'],
  defaultJobId: 'pipeline:j1312',
}

const copy = (id: string, ymd: string, hm: string, subject: string, sentByName: string): SentCopyWithJobs => ({
  id,
  kind: 'bill',
  title: subject,
  how: 'email',
  recipientEmails: ['Dana.Whitfield@example.com'],
  subject,
  sentAt: cdt(ymd, hm),
  sentByName,
  jobIds: ['j1312'],
})

const ESTIMATE = copy('sd-estimate', '2026-10-06', '14:20', 'Your estimate for Oakridge sewer line', 'Rosa')
const SCHEDULED = copy('sd-scheduled', '2026-10-08', '09:00', 'Your work is scheduled for Thu, Oct 8', '')
const INVOICE = copy('sd-invoice', '2026-10-09', '10:03', 'Invoice 1312 · $4,850', '')
const PAID = copy('sd-paid', '2026-10-10', '19:00', 'Paid, thank you', '')

/** A line of Dana's or the team's between the copies. */
const line = (id: string, ymd: string, hm: string, who: string, channel: ThreadMessage['channel'] = 'text'): ThreadMessage => ({
  id,
  contactId: 'dana',
  jobId: 'pipeline:j1312',
  channel,
  direction: who === 'Dana' ? 'in' : 'out',
  at: cdt(ymd, hm),
  who,
  body: id,
})

const byTime = (a: ThreadMessage, b: ThreadMessage) => Date.parse(a.at) - Date.parse(b.at)

/** A fold row in one word: the line's id, or the fold's words and the ids inside it. */
const label = (r: AppFoldRow) => (r.kind === 'line' ? r.message.id : `${r.words} [${r.lines.map((m) => m.id).join(', ')}]`)

describe('the app’s lines', () => {
  it('reads a pressed send as its sender and an automatic one as the app', () => {
    const lines = sentLines([ESTIMATE, SCHEDULED, INVOICE, PAID], [DANA])
    expect(lines.map((m) => [m.id, m.who, m.subject, m.jobId])).toEqual([
      ['sent:sd-estimate', 'Rosa', 'Your estimate for Oakridge sewer line', 'pipeline:j1312'],
      ['sent:sd-scheduled', APP_WHO, 'Your work is scheduled for Thu, Oct 8', 'pipeline:j1312'],
      ['sent:sd-invoice', APP_WHO, 'Invoice 1312 · $4,850', 'pipeline:j1312'],
      ['sent:sd-paid', APP_WHO, 'Paid, thank you', 'pipeline:j1312'],
    ])
    expect(lines.map(isAppLine)).toEqual([false, true, true, true])
  })
})

describe('foldAppLines', () => {
  it('folds the three in a row and leaves the lone one and every line of a person’s', () => {
    const lines = [
      ...sentLines([ESTIMATE, SCHEDULED, INVOICE, PAID], [DANA]),
      line('can you do Thursday', '2026-10-06', '16:05', 'Dana'),
      { ...line('estimate reminder', '2026-10-07', '08:00', APP_WHO, 'email') },
      line('called Dana', '2026-10-07', '12:00', 'Rosa', 'note'),
    ].sort(byTime)
    const rows = foldAppLines(lines)
    expect(rows.map(label)).toEqual([
      'sent:sd-estimate',
      'can you do Thursday',
      'estimate reminder',
      'called Dana',
      '3 emails, Oct 8 to Oct 10 [sent:sd-scheduled, sent:sd-invoice, sent:sd-paid]',
    ])
    expect(rows[4]).toMatchObject({ kind: 'fold', id: 'fold:sent:sd-scheduled', who: APP_WHO })
  })

  it('breaks a run at a line of a person’s, so a lone app line on either side stays a line', () => {
    const rows = foldAppLines([
      line('a', '2026-10-08', '09:00', APP_WHO, 'email'),
      line('gate code', '2026-10-08', '09:04', 'Dana'),
      line('b', '2026-10-09', '09:00', APP_WHO, 'email'),
    ])
    expect(rows.map(label)).toEqual(['a', 'gate code', 'b'])
    expect(rows.every((r) => r.kind === 'line')).toBe(true)
  })

  it('says one day once, and messages when the run mixes texts and emails', () => {
    expect(foldWords([line('a', '2026-10-08', '09:00', APP_WHO, 'text'), line('b', '2026-10-08', '17:00', APP_WHO, 'text')])).toBe(
      '2 texts, Oct 8',
    )
    expect(foldWords([line('a', '2026-10-08', '09:00', APP_WHO, 'text'), line('b', '2026-10-09', '09:00', APP_WHO, 'email')])).toBe(
      '2 messages, Oct 8 to Oct 9',
    )
  })

  it('reads the day in Chicago, not UTC', () => {
    // 11:30 PM in Chicago on Oct 9 is Oct 10 in UTC.
    expect(foldWords([line('a', '2026-10-08', '09:00', APP_WHO, 'email'), line('b', '2026-10-09', '23:30', APP_WHO, 'email')])).toBe(
      '2 emails, Oct 8 to Oct 9',
    )
  })

  it('returns no rows for no lines', () => {
    expect(foldAppLines([])).toEqual([])
  })
})

describe('sentCopyFacts', () => {
  const stamps = (set: Partial<SentCopyStamps>): SentCopyStamps => ({ id: 'sd-invoice', fromEmail: null, openedAt: null, paid: null, ...set })

  it('words the from, the open and the payment, each only when the row has it', () => {
    const invoice = stamps({
      fromEmail: 'office@clickplumbing.example',
      openedAt: cdt('2026-10-10', '18:12'),
      paid: { at: cdt('2026-10-10', '18:40'), how: 'card' },
    })
    expect(sentCopyFacts(invoice)).toEqual(['from office@clickplumbing.example', 'opened Oct 10, 6:12 PM', 'paid Oct 10 by card'])
    expect(sentCopyFacts(stamps({ openedAt: cdt('2026-10-10', '18:12') }))).toEqual(['opened Oct 10, 6:12 PM'])
    expect(sentCopyFacts(stamps({ paid: { at: cdt('2026-10-11', '09:00'), how: ' ' } }))).toEqual(['paid Oct 11'])
    expect(sentCopyFacts(stamps({ fromEmail: '  ' }))).toEqual([])
  })

  it('says nothing about an open it does not know', () => {
    expect(sentCopyFacts(stamps({ fromEmail: 'office@clickplumbing.example' })).some((f) => f.includes('open'))).toBe(false)
  })

  it('passes the plain words rules', () => {
    const facts = sentCopyFacts(
      stamps({ fromEmail: 'office@clickplumbing.example', openedAt: cdt('2026-10-10', '18:12'), paid: { at: cdt('2026-10-11', '09:00'), how: 'card' } }),
    )
    const words = [...facts, foldWords(sentLines([SCHEDULED, INVOICE, PAID], [DANA]))]
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })

  it('keys each copy’s facts by its line’s id, and leaves out a copy with none', () => {
    const facts = sentLineFacts([
      stamps({ id: 'sd-invoice', openedAt: cdt('2026-10-10', '18:12'), paid: { at: cdt('2026-10-10', '18:40'), how: 'card' } }),
      stamps({ id: 'sd-scheduled' }),
    ])
    expect([...facts.entries()]).toEqual([['sent:sd-invoice', ['opened Oct 10, 6:12 PM', 'paid Oct 10 by card']]])
    const invoiceLine = sentLines([INVOICE], [DANA])[0]!
    expect(facts.get(invoiceLine.id)).toHaveLength(2)
  })
})
