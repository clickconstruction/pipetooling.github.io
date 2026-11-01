import { describe, expect, it } from 'vitest'
import { FIRM_INBOX_WORDS, firmInboxCaption, firmSampleInbox } from './legalFirmSampleWeek'
import { plainWordsFailures } from '../plainWords'

const base = { companyName: 'Click Plumbing and Electrical', firmName: 'Marlowe & Tate, PLLC', otherHandling: 'Ann Sample', name: 'Lena Okafor', preparedOn: '2026-11-01' }

describe('the sample inbox · punch list #233 · what the card shows is what the builders send', () => {
  it('Each event on every matter: nine lines, the digest-only acts dim, and they open nothing', () => {
    const inbox = firmSampleInbox({ ...base, rule: { mode: 'now', scope: 'all', digestWeekday: 1 } })
    expect(inbox.lines.map((l) => l.subject)).toEqual([
      'New account referred: Ridgeway Builders',
      'Click Plumbing and Electrical asks you about Ridgeway Builders',
      'Click Plumbing and Electrical answered on Cedar Bend Homes',
      'Step by the office: Cedar Bend Homes',
      'A note from Click Plumbing and Electrical on Northline Builders',
      'Paper added: Ridgeway Builders',
      'Payment applied on Cedar Bend Homes',
      'Referral withdrawn: Northline Builders',
      'Click Plumbing and Electrical saw your fee on Ridgeway Builders',
    ])
    expect(inbox.lines.map((l) => l.dim)).toEqual([false, false, false, true, false, true, false, false, true])
    expect(inbox.lines.map((l) => l.day)).toEqual(['Mon', 'Tue', 'Wed', 'Wed', 'Thu', 'Thu', 'Fri', 'Fri', 'Fri'])
    expect(inbox.firstKey).toBe('referred:Ridgeway Builders')
    expect(inbox.email('fee_seen:Ridgeway Builders')).toBeNull()
    expect(inbox.email('step:Cedar Bend Homes')).toBeNull()
    expect(inbox.email('paper:Ridgeway Builders')).toBeNull()
    expect(inbox.email('nope')).toBeNull()
  })

  it('the opened email is the real one: the frame, the handling line with the typed name, the stop link', () => {
    const inbox = firmSampleInbox({ ...base, rule: { mode: 'now', scope: 'all', digestWeekday: 1 } })
    const mail = inbox.email('referred:Ridgeway Builders')
    expect(mail?.html).toContain('Collections referred to counsel')
    expect(mail?.html).toContain('handling: Lena Okafor')
    expect(mail?.html).toContain('Stop these emails to you')
    expect(inbox.email('note:Northline Builders')?.html).toContain('The GC called.')
    // The other accounts are handled by the firm's own handling name, never the person being added.
    expect(inbox.email('answer:Cedar Bend Homes')?.html).not.toContain('Lena')
  })

  it('Only theirs narrows to the account handled by the person being added', () => {
    const inbox = firmSampleInbox({ ...base, rule: { mode: 'now', scope: 'mine', digestWeekday: 1 } })
    expect(inbox.lines.map((l) => l.key)).toEqual(['referred:Ridgeway Builders', 'ask:Ridgeway Builders', 'paper:Ridgeway Builders', 'fee_seen:Ridgeway Builders'])
  })

  it('Weekly digest: one line on the picked day, the digest opened with every open matter and the fee among the week’s lines', () => {
    const inbox = firmSampleInbox({ ...base, rule: { mode: 'digest', scope: 'all', digestWeekday: 3 } })
    expect(inbox.lines).toEqual([{ key: 'digest', day: 'Wed', subject: 'Weekly digest — 3 open matters at Click Plumbing and Electrical', dim: false }])
    const html = inbox.email('digest')?.html ?? ''
    expect(html).toContain('Your weekly digest, Lena Okafor.')
    for (const payer of ['Ridgeway Builders', 'Cedar Bend Homes', 'Northline Builders']) expect(html).toContain(payer)
    expect(html).toContain('Fee seen by the office')
    expect(html).toContain('Step by the office — Stage moved from referred to demand by the office')
    expect(html).toContain('Paper added — Signed subcontract, 14 pages')
    expect(html).toContain('$4,200.00')
    const mine = firmSampleInbox({ ...base, rule: { mode: 'digest', scope: 'mine', digestWeekday: 9 } })
    expect(mine.lines[0]).toMatchObject({ day: 'Mon', subject: 'Weekly digest — 1 open matter at Click Plumbing and Electrical' })
    expect(mine.email('digest')?.html).not.toContain('Cedar Bend Homes')
  })

  it('no name yet: the caption says their, the digest greets you, and the handling line says you', () => {
    expect(firmInboxCaption('')).toBe('What lands in their inbox')
    expect(firmInboxCaption('  Dana Whitlock')).toBe("What lands in Dana's inbox")
    const inbox = firmSampleInbox({ ...base, name: '', rule: { mode: 'now', scope: 'all', digestWeekday: 1 } })
    expect(inbox.email('referred:Ridgeway Builders')?.html).toContain('handling: you')
  })

  it('every word the firm reads passes plain words', () => {
    for (const w of Object.values(FIRM_INBOX_WORDS)) expect(plainWordsFailures(w)).toEqual([])
    expect(plainWordsFailures(firmInboxCaption('Dana Whitlock'))).toEqual([])
  })
})
