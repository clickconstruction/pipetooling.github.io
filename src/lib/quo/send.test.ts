/**
 * A text as it goes out through Quo, over the Messages prototype's made-up people: Robert texting Greg from Click
 * Construction's one number, a first text to Dr. Priya Raman, Bill after a quiet spell, and the app's own answers.
 * The prototype's clock is Fri Oct 2, 2026, 11:45 AM.
 */
import { describe, expect, it } from 'vitest'
import { optoutLine, type ComposeCompany } from '../messages/compose'
import { plainWordsFailures } from '../plainWords'
import { planQuoEvent, readQuoEvent, type QuoLine, type QuoPlanContext, type QuoReading } from './events'
import { QUO_MAX_CHARACTERS, planSend, refusalWords, sendOver, sentQuoId, sentWho, type QuoSendInput, type SendRefusal } from './send'

const at = (month: number, day: number, hour = 9, minute = 0) => Date.UTC(2026, month - 1, day, hour, minute)
const NOW = at(10, 2, 11, 45)
const CLICK: ComposeCompany = { name: 'Click Construction', phone: '(210) 555-0100', mailbox: 'bids@clickconstruction.example' }
const ROBERT = { userId: 'u-robert', quoUserId: 'US-robert', name: 'Robert' }

const toGreg = (over: Partial<QuoSendInput> = {}): QuoSendInput => ({
  purpose: 'reply',
  contactId: 'c-greg',
  channelId: 'ch-greg',
  to: '(210) 555-0113',
  optedOut: false,
  body: 'Greg, checking on the Boerne sitework number. Still good for today?',
  lastOurTextAt: at(9, 30, 9, 40),
  now: NOW,
  company: CLICK,
  fromNumberId: 'PN-click',
  sender: ROBERT,
  jobId: 'job-boerne',
  ...over,
})

function sent(input: QuoSendInput) {
  const plan = planSend(input)
  if (!plan.ok) throw new Error(plan.words)
  return plan
}

describe('a text out', () => {
  it('goes from the company number as Robert, to Greg’s number as Quo takes it', () => {
    expect(planSend(toGreg())).toEqual({
      ok: true,
      request: {
        content: 'Greg, checking on the Boerne sitework number. Still good for today?',
        from: 'PN-click',
        to: ['+12105550113'],
        userId: 'US-robert',
      },
      line: {
        contactId: 'c-greg',
        channelId: 'ch-greg',
        jobId: 'job-boerne',
        channel: 'text',
        direction: 'out',
        at: '2026-10-02T11:45:00.000Z',
        who: 'Robert · from the company number',
        whoUserId: 'u-robert',
        body: 'Greg, checking on the Boerne sitework number. Still good for today?',
        optoutLine: null,
      },
      segments: 1,
      characters: 67,
    })
  })

  it('carries the opt-out line on the first text to a number, and records why', () => {
    const plan = sent(toGreg({ contactId: 'c-priya', to: '+12105550144', lastOurTextAt: null, body: 'Dr. Raman, the start date is Monday, Oct 12.' }))
    expect(plan.request.content).toBe(`Dr. Raman, the start date is Monday, Oct 12.\n\n${optoutLine(CLICK)}`)
    expect(plan.line.optoutLine).toBe('first')
    expect(plan.line.body).toBe(plan.request.content)
  })

  it('carries it after 30 quiet days, unless a person held it back on this one text', () => {
    const bill = { contactId: 'c-bill', to: '(210) 555-0121', lastOurTextAt: at(8, 31, 16), body: 'Bill, are you free for the Stone Oak walk Monday?' }
    expect(sent(toGreg(bill)).line.optoutLine).toBe('silence')
    const held = sent(toGreg({ ...bill, held: true }))
    expect(held.line.optoutLine).toBe('held')
    expect(held.request.content).toBe('Bill, are you free for the Stone Oak walk Monday?')
  })

  it('puts the link lines under the words, before the opt-out line', () => {
    const plan = sent(toGreg({ lastOurTextAt: null, links: [{ text: 'The plans are in your portal: ', link: 'click.co/t/7Hq2#plans' }], body: 'Greg, Addendum 2 is up.' }))
    expect(plan.request.content).toBe(`Greg, Addendum 2 is up.\nThe plans are in your portal: click.co/t/7Hq2#plans\n\n${optoutLine(CLICK)}`)
  })

  it('sends the app’s own answers with no line of the app’s, as the app', () => {
    const help = sent(
      toGreg({ purpose: 'answer', sender: null, lastOurTextAt: null, body: 'Click Construction. For help, call or text (210) 555-0100. Reply STOP to opt out.' }),
    )
    expect(help.request).toEqual({
      content: 'Click Construction. For help, call or text (210) 555-0100. Reply STOP to opt out.',
      from: 'PN-click',
      to: ['+12105550113'],
    })
    expect(help.line).toMatchObject({ who: 'The app · from the company number', whoUserId: null, optoutLine: null })
  })

  it('sends a person without a Quo seat from the number’s owner', () => {
    const plan = sent(toGreg({ sender: { userId: 'u-wendi', quoUserId: null, name: 'Wendi' } }))
    expect(plan.request).not.toHaveProperty('userId')
    expect(plan.line).toMatchObject({ who: 'Wendi · from the company number', whoUserId: 'u-wendi' })
  })
})

describe('what it refuses', () => {
  it('refuses a number that sent STOP, all but the one confirmation of a stop', () => {
    expect(planSend(toGreg({ optedOut: true }))).toEqual({ ok: false, refused: 'stopped', words: 'They sent STOP. The app will not send this text.' })
    expect(planSend(toGreg({ optedOut: true, purpose: 'nudge' })).ok).toBe(false)
    expect(planSend(toGreg({ optedOut: true, purpose: 'answer' })).ok).toBe(false)
    expect(planSend(toGreg({ optedOut: true, purpose: 'confirm', sender: null, body: 'Click Construction. You will get no more texts from us.' })).ok).toBe(true)
  })

  it('refuses an empty text, a missing number and one that is not a number', () => {
    expect(planSend(toGreg({ body: '  ' }))).toMatchObject({ ok: false, refused: 'empty', words: 'Write the message first.' })
    expect(planSend(toGreg({ to: null }))).toMatchObject({ ok: false, refused: 'no-number' })
    expect(planSend(toGreg({ to: ' ' }))).toMatchObject({ ok: false, refused: 'no-number' })
    expect(planSend(toGreg({ to: '555-0113' }))).toMatchObject({ ok: false, refused: 'not-a-number' })
  })

  it('refuses a text past what Quo’s API carries, counting the opt-out line', () => {
    expect(QUO_MAX_CHARACTERS).toBe(1600)
    expect(planSend(toGreg({ body: 'a'.repeat(1600) })).ok).toBe(true)
    expect(planSend(toGreg({ body: 'a'.repeat(1601) }))).toMatchObject({
      ok: false,
      refused: 'too-long',
      words: '1601 characters is more than a text can carry. Send it as an email, or make it shorter.',
    })
    // With the line it rides over.
    expect(planSend(toGreg({ body: 'a'.repeat(1580), lastOurTextAt: null }))).toMatchObject({ ok: false, refused: 'too-long' })
  })
})

describe('Quo’s answer', () => {
  it('gives the line its Quo id', () => {
    expect(sentQuoId({ data: { id: 'MS-9', status: 'queued' } })).toBe('MS-9')
    expect(sentQuoId({ id: 'MS-9' })).toBe('MS-9')
    expect(sentQuoId({ data: { status: 'queued' } })).toBeNull()
    expect(sentQuoId(null)).toBeNull()
    expect(sentQuoId('accepted')).toBeNull()
  })

  it('names who sent it', () => {
    expect(sentWho(ROBERT)).toBe('Robert · from the company number')
    expect(sentWho(null)).toBe('The app · from the company number')
  })
})

describe('plain words', () => {
  it('holds every refusal', () => {
    const all: SendRefusal[] = ['empty', 'no-number', 'not-a-number', 'stopped', 'too-long']
    expect(all.flatMap((r) => plainWordsFailures(refusalWords(r, 1601)))).toEqual([])
  })
})

describe('the race between our own write and Quo’s delivery event', () => {
  // Robert's first text to Greg, tied in the box to Pad B, not to Greg's default job.
  const plan = sent(toGreg({ lastOurTextAt: null, jobId: 'job-padb', body: 'Greg, the walk moved to 8.' }))
  const QUO_ID = 'MS-77'
  const event = (type: string, extra: Record<string, unknown> = {}): QuoReading => {
    const r = readQuoEvent({
      id: 'EV-77',
      apiVersion: '2026-03-30',
      createdAt: '2026-10-02T11:45:03.000Z',
      type,
      data: {
        resource: { id: QUO_ID, direction: 'outgoing', text: plan.request.content, media: [], status: 'delivered', createdAt: '2026-10-02T11:45:01.000Z', ...extra },
        context: { orgId: 'OR-click', phoneNumberId: 'PN-click', userId: 'US-robert', senderIdentifier: '+12105550100', recipientIdentifiers: ['+12105550113'] },
        links: { quo: null },
      },
    })
    if (!r.ok) throw new Error(r.why)
    return r.reading
  }
  const ctx = (existing: QuoLine | null): QuoPlanContext => ({
    contactId: 'c-greg',
    contactWords: 'Greg',
    channelId: 'ch-greg',
    optedOut: false,
    defaultJobId: 'job-boerne',
    users: { 'US-robert': { userId: 'u-robert', name: 'Robert' } },
    company: CLICK,
    existing,
  })
  const ours = (prev: QuoLine | null) => sendOver(prev, plan.line, QUO_ID)
  const theirs = (prev: QuoLine | null, type: string, extra?: Record<string, unknown>) => {
    const line = planQuoEvent(event(type, extra), ctx(prev)).line
    if (!line) throw new Error('no line')
    return line
  }

  it('ends on the same line whichever writes first, our send’s fields winning', () => {
    const sendFirst = theirs(ours(null), 'message.delivered')
    const eventFirst = ours(theirs(null, 'message.delivered'))
    expect(sendFirst).toEqual(eventFirst)
    expect(sendFirst).toEqual({
      quoId: 'MS-77',
      contactId: 'c-greg',
      channelId: 'ch-greg',
      jobId: 'job-padb',
      channel: 'text',
      direction: 'out',
      at: '2026-10-02T11:45:00.000Z',
      who: 'Robert · from the company number',
      whoUserId: 'u-robert',
      body: `Greg, the walk moved to 8.\n\n${optoutLine(CLICK)}`,
      recordingUrl: null,
      transcript: null,
      summary: null,
      durationSeconds: null,
      media: [],
      optoutLine: 'first',
      delivery: 'delivered',
    })
  })

  it('ends the same both ways when the text failed', () => {
    const sendFirst = theirs(ours(null), 'message.failed', { errorCode: '30007' })
    const eventFirst = ours(theirs(null, 'message.failed', { errorCode: '30007' }))
    expect(sendFirst).toEqual(eventFirst)
    expect(sendFirst).toMatchObject({ delivery: 'failed', optoutLine: 'first', jobId: 'job-padb' })
  })

  it('keeps the event’s media when our write lands second', () => {
    const photo = { url: 'https://files.example/walk.jpg', type: 'image/jpeg' }
    expect(ours(theirs(null, 'message.delivered', { media: [photo] })).media).toEqual([photo])
    expect(ours(null)).toMatchObject({ media: [], delivery: null })
  })
})
