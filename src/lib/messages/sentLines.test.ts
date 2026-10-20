import { describe, expect, it } from 'vitest'
import { APP_WHO } from './appLines'
import { DEMO_CONTACTS } from './messagesDemo'
import { isSentLine, sentLines, type SentCopyWithJobs } from './sentLines'

const copy = (set: Partial<SentCopyWithJobs>): SentCopyWithJobs => ({
  id: 'sd1',
  kind: 'gc-bid',
  title: 'Our bid, Bell Family Dental',
  how: 'email',
  recipientEmails: [],
  subject: 'Bell Family Dental: our bid',
  sentAt: '2026-09-21T15:15:00.000Z',
  sentByName: 'Rosa',
  ...set,
})

describe('the emails the app already sent, read into each thread', () => {
  it('lands a copy on each person it went to, matched by address, with the copy’s own job', () => {
    const lines = sentLines([copy({ recipientEmails: ['Marcus@BellFamilyDental.example'], bidId: 'b470' })], DEMO_CONTACTS)
    expect(lines).toEqual([
      {
        id: 'sent:sd1',
        contactId: 'marcus',
        jobId: 'bid:b470',
        channel: 'email',
        direction: 'out',
        at: '2026-09-21T15:15:00.000Z',
        who: 'Rosa',
        subject: 'Bell Family Dental: our bid',
        body: 'Our bid, Bell Family Dental',
        channelId: 'marcus-email',
      },
    ])
    expect(isSentLine(lines[0]!)).toBe(true)
    expect(isSentLine({ id: '17' })).toBe(false)
  })

  it('one line per person per copy, the first Pipeline job when there is no bid, and a print is no email', () => {
    const lines = sentLines(
      [
        copy({ id: 'sd2', recipientEmails: ['greg@hillside.example', 'GREG@hillside.example', 'elena@cibolocreek.example'], jobIds: ['j1077', 'j9'] }),
        copy({ id: 'sd3', how: 'print', recipientEmails: ['greg@hillside.example'] }),
        copy({ id: 'sd4', recipientEmails: ['nobody@else.example'] }),
      ],
      DEMO_CONTACTS,
    )
    expect(lines.map((l) => [l.id, l.contactId, l.jobId])).toEqual([
      ['sent:sd2', 'greg', 'pipeline:j1077'],
      ['sent:sd2', 'elena', 'pipeline:j1077'],
    ])
  })

  it('a copy with no subject reads its title, and with no sender reads the app', () => {
    const [line] = sentLines([copy({ subject: '', sentByName: '', recipientEmails: ['jonah@marshvale.example'] })], DEMO_CONTACTS)
    expect(line).toMatchObject({ subject: 'Our bid, Bell Family Dental', who: 'the app', jobId: null })
  })

  it('a pressed send reads its sender alone, and a blank name reads the app', () => {
    const lines = sentLines(
      [copy({ id: 'sd5', recipientEmails: ['jonah@marshvale.example'] }), copy({ id: 'sd6', sentByName: '  ', recipientEmails: ['jonah@marshvale.example'] })],
      DEMO_CONTACTS,
    )
    expect(lines.map((l) => l.who)).toEqual(['Rosa', APP_WHO])
  })

  it('skips the copy of an email from the reply box, whose line is in the thread already', () => {
    const lines = sentLines(
      [
        copy({ id: 'sd5', kind: 'messages_email', sourceTable: 'messages', recipientEmails: ['greg@hillside.example'] }),
        copy({ id: 'sd6', sourceTable: 'gc_trade_messages', recipientEmails: ['greg@hillside.example'] }),
      ],
      DEMO_CONTACTS,
    )
    expect(lines.map((l) => l.id)).toEqual(['sent:sd6'])
  })
})
