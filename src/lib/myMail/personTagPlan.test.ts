/**
 * A mail conversation onto an HR file (punch list #289): what the seat's mail tag writes when its target is a person.
 * Made-up people only: Marisol Vega, whose box it is; Dale Okafor at a supplier; Rosa Diaz in the office.
 */
import { describe, expect, it } from 'vitest'
import type { EmailAddress, EmailFile, EmailIn } from '../emailIn/gmailMessage'
import { parseMyMailRequest, personTagPlanPreview } from './mineFunction'
import { MY_MAIL_ENTRY_BODY_MAX, fileSizeWords, mailEntryContent, mailEntryDate, mailSentWords, personEntryRow, planPersonTag, type MyMailPersonTagStep } from './personTagPlan'

const marisolAt: EmailAddress = { name: 'Marisol Vega', address: 'marisol@clickplumbing.example' }
const rosaAt: EmailAddress = { name: 'Rosa Diaz', address: 'rosa@clickplumbing.example' }
const daleAt: EmailAddress = { name: 'Dale Okafor', address: 'dale@ridgeway.example' }
const PERSON = '22222222-2222-4222-8222-222222222222'
const THREAD = 't-case'

const file = (over: Partial<EmailFile>): EmailFile => ({ partId: '1', name: 'signed-agreement.pdf', mime: 'application/pdf', size: 212_000, attachmentId: 'att-1', data: null, inline: false, ...over })

const email = (gmailId: string, over: Partial<EmailIn> = {}): EmailIn => ({
  gmailId,
  threadId: THREAD,
  labels: ['INBOX'],
  // 2026-11-01 15:12Z is 09:12 AM Central: daylight time ended at 2:00 that morning.
  at: '2026-11-01T15:12:00.000Z',
  from: daleAt,
  to: [marisolAt],
  cc: [],
  subject: 'Re: the October agreement',
  text: 'Please sign and return by Friday.\r\nThanks.',
  links: [],
  files: [],
  headers: {},
  html: null,
  ...over,
})

const dale1 = email('g-1', { files: [file({}), file({ partId: '2', name: 'logo.png', mime: 'image/png', size: 4_100, attachmentId: 'att-logo', inline: true })] })
// 2026-11-02 04:30Z is 10:30 PM Central on 2026-11-01 (daylight time ended that morning): the day is the Central one.
const marisol1 = email('g-2', { labels: ['SENT'], at: '2026-11-02T04:30:00.000Z', from: marisolAt, to: [daleAt], cc: [rosaAt], subject: 'Re: the October agreement', text: 'Signed and attached.' })
const dale2 = email('g-3', { at: '2026-11-03T14:00:00.000Z', text: 'Received, thank you.' })
const thread = { threadId: THREAD, messages: [dale1, marisol1, dale2] }

const kinds = (steps: MyMailPersonTagStep[]) => steps.map((s) => (s.kind === 'skip' ? `skip:${s.why}` : s.kind === 'already' ? `already:${s.entryId}` : `entry:${s.entryDate}`))

describe('planPersonTag: one dated entry per mail', () => {
  it('plans three entries on their own days, in the conversation’s order, with the files counted', () => {
    const plan = planPersonTag(thread, { byGmailId: {} }, '2026-11-08')
    expect(kinds(plan.steps)).toEqual(['entry:2026-11-01', 'entry:2026-11-01', 'entry:2026-11-03'])
    expect(plan.counts).toEqual({ entries: 3, already: 0, skipped: 0 })
    const first = plan.steps[0]
    if (first?.kind !== 'entry') throw new Error('an entry was expected')
    expect(first.files).toBe(1)
    expect(first.threadId).toBe(THREAD)
  })

  it('a PDF placed in the body counts as a file and is named on the entry; a signature’s logo is not (v2.6909)', () => {
    // Apple Mail places a PDF in the body, and marks a logo the same way: the first is a file, the second is not.
    const placed = email('g-9', { files: [file({ name: 'PO 371.pdf', inline: true }), file({ partId: '2', name: 'logo.png', mime: 'image/png', size: 4_100, attachmentId: 'att-logo', inline: true })] })
    const plan = planPersonTag({ threadId: THREAD, messages: [placed] }, { byGmailId: {} }, '2026-11-08')
    const step = plan.steps[0]
    if (step?.kind !== 'entry') throw new Error('an entry was expected')
    expect(step.files).toBe(1)
    expect(step.content).toContain('Files: PO 371.pdf (')
    expect(step.content).not.toContain('logo.png')
  })

  it('leaves a mail the file already holds, skips a draft, spam, a chat, a hidden label and a mail twice', () => {
    const plan = planPersonTag(
      { threadId: THREAD, messages: [dale1, marisol1, email('g-d', { labels: ['DRAFT'] }), email('g-s', { labels: ['SPAM'] }), email('g-c', { labels: ['CHAT'] }), email('g-h', { labels: ['INBOX', 'Label_7'] }), dale1] },
      { byGmailId: { 'g-2': 'entry-2' }, hidden: ['Label_7'] },
      '2026-11-08',
    )
    expect(kinds(plan.steps)).toEqual(['entry:2026-11-01', 'already:entry-2', 'skip:draft', 'skip:spamOrTrash', 'skip:chat', 'skip:hidden', 'skip:twice'])
    expect(plan.counts).toEqual({ entries: 1, already: 1, skipped: 5 })
  })

  it('lands a mail with no time on the day of the plan', () => {
    const plan = planPersonTag({ threadId: THREAD, messages: [email('g-0', { at: null })] }, { byGmailId: {} }, '2026-11-08')
    expect(kinds(plan.steps)).toEqual(['entry:2026-11-08'])
    expect(mailEntryDate(null, '2026-11-08')).toBe('2026-11-08')
    expect(mailEntryDate('not a time', '2026-11-08')).toBe('2026-11-08')
    expect(mailEntryDate('2026-11-02T04:30:00.000Z', '2026-11-08')).toBe('2026-11-01')
  })
})

describe('mailEntryContent: the fixed shape', () => {
  it('writes From, To, Cc, Subject, Sent and Files, then the body as plain text, a picture in the body left out', () => {
    expect(mailEntryContent(marisol1)).toBe(
      [
        'From: Marisol Vega <marisol@clickplumbing.example>',
        'To: Dale Okafor <dale@ridgeway.example>',
        'Cc: Rosa Diaz <rosa@clickplumbing.example>',
        'Subject: Re: the October agreement',
        'Sent: 2026-11-01 10:30 PM Central',
        '',
        'Signed and attached.',
      ].join('\n'),
    )
    const content = mailEntryContent(dale1)
    expect(content).toContain('Files: signed-agreement.pdf (207 KB)')
    expect(content).not.toContain('logo.png')
    expect(content).toContain('Sent: 2026-11-01 09:12 AM Central')
    expect(content.endsWith('Please sign and return by Friday.\nThanks.')).toBe(true)
  })

  it('names what is missing and cuts a very long body, saying how much stays in Gmail', () => {
    const bare = mailEntryContent(email('g-b', { from: null, to: [], subject: '  ', text: '', at: null }))
    expect(bare).toBe(['From: (unknown)', 'To: (none)', 'Subject: (no subject)', '', '(no words)'].join('\n'))
    const long = mailEntryContent(email('g-l', { text: 'x'.repeat(MY_MAIL_ENTRY_BODY_MAX + 500) }))
    expect(long).toContain(`[500 more characters stay in Gmail]`)
    expect(long.length).toBeLessThan(MY_MAIL_ENTRY_BODY_MAX + 300)
    expect(fileSizeWords(500)).toBe('1 KB')
    expect(fileSizeWords(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(mailSentWords(null)).toBe('')
  })

  it('shapes the row the function inserts, as the dev who tagged', () => {
    const plan = planPersonTag({ threadId: THREAD, messages: [dale2] }, { byGmailId: {} }, '2026-11-08')
    const step = plan.steps[0]
    if (step?.kind !== 'entry') throw new Error('an entry was expected')
    expect(personEntryRow(step, { personId: PERSON, createdBy: 'u-dev', authorLabel: 'Robert Douglas' })).toEqual({
      person_id: PERSON,
      entry_date: '2026-11-03',
      content: step.content,
      source: 'conversation',
      created_by: 'u-dev',
      author_label: 'Robert Douglas',
      gmail_message_id: 'g-3',
      gmail_thread_id: THREAD,
    })
  })
})

describe('the request and the preview', () => {
  it('takes a person in place of the job from the seat alone, with stop, and refuses the rest', () => {
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: PERSON.toUpperCase() }, as: 'Marisol@ClickPlumbing.example', plan: true })).toEqual({ action: 'tag', threadId: THREAD, person: { personId: PERSON }, as: 'marisol@clickplumbing.example', plan: true })
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: PERSON }, as: 'marisol@clickplumbing.example', stop: true })).toEqual({ action: 'tag', threadId: THREAD, person: { personId: PERSON }, as: 'marisol@clickplumbing.example', stop: true })
    // No `as`: a person's own press never carries a person.
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: PERSON } })).toBeNull()
    // Both targets, a bad id, a bad stop.
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: PERSON }, job: { kind: 'bid', id: PERSON }, as: 'marisol@clickplumbing.example' })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: 'nobody' }, as: 'marisol@clickplumbing.example' })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, person: { personId: PERSON }, as: 'marisol@clickplumbing.example', stop: 'yes' })).toBeNull()
    // The job form is as it was.
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, job: { kind: 'bid', id: PERSON } })).toEqual({ action: 'tag', threadId: THREAD, job: { kind: 'bid', id: PERSON } })
  })

  it('reads a plan back mail by mail, and a stop plan with no mail', () => {
    const plan = planPersonTag(thread, { byGmailId: { 'g-2': 'entry-2' } }, '2026-11-08')
    const who = { account: 'marisol@clickplumbing.example', person: { id: PERSON, name: 'ZZ Test Person' }, following: false, stop: false }
    const preview = personTagPlanPreview(plan, thread.messages, who)
    expect(preview.counts).toEqual({ entries: 2, already: 1, skipped: 0 })
    expect(preview.mails).toEqual([
      { gmailId: 'g-1', kind: 'entry', at: '2026-11-01T15:12:00.000Z', from: 'Dale Okafor <dale@ridgeway.example>', subject: 'Re: the October agreement', entryDate: '2026-11-01', files: 1 },
      { gmailId: 'g-2', kind: 'already', at: '2026-11-02T04:30:00.000Z', from: 'Marisol Vega <marisol@clickplumbing.example>', subject: 'Re: the October agreement', why: 'an entry on the file holds this mail' },
      { gmailId: 'g-3', kind: 'entry', at: '2026-11-03T14:00:00.000Z', from: 'Dale Okafor <dale@ridgeway.example>', subject: 'Re: the October agreement', entryDate: '2026-11-03', files: 0 },
    ])
    expect(preview.person).toEqual({ id: PERSON, name: 'ZZ Test Person' })
    const stop = personTagPlanPreview(plan, thread.messages, { ...who, following: true, stop: true })
    expect(stop.mails).toEqual([])
    expect(stop.counts).toEqual({ entries: 0, already: 1, skipped: 0 })
    expect(stop.following).toBe(true)
    expect(stop.stop).toBe(true)
  })
})
