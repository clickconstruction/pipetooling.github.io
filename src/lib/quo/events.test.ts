/**
 * Quo's webhook events read into the thread, over made-up deliveries in Quo's 2026-03-30 shape (never a real event)
 * and the Messages prototype's made-up people: Greg Paulk at Hillside Excavation, Elena Marchetti, an unknown number,
 * Robert and Rosa answering on Click Construction's one number.
 */
import { describe, expect, it } from 'vitest'
import type { ComposeCompany } from '../messages/compose'
import { plainWordsFailures } from '../plainWords'
import {
  QUO_API_VERSION,
  callWho,
  deliveryWords,
  helpAnswer,
  keywordOf,
  mayAskToStop,
  mergeCall,
  phoneWords,
  planQuoEvent,
  quoSentWho,
  readQuoEvent,
  sentKey,
  stopAnswer,
  strongerDelivery,
  summaryWords,
  toE164,
  transcriptWords,
  unknownContact,
  type CallReading,
  type QuoLine,
  type QuoPlanContext,
  type QuoReading,
} from './events'

const CLICK: ComposeCompany = { name: 'Click Construction', phone: '(210) 555-0100', mailbox: 'bids@clickconstruction.example' }
const GREG = '+12105550113'
const STRANGER = '+18305550172'
const USERS = { 'US-robert': { userId: 'u-robert', name: 'Robert' }, 'US-rosa': { userId: 'u-rosa', name: 'Rosa' } }

const delivery = (type: string, resource: Record<string, unknown>, context: Record<string, unknown> = {}) => ({
  id: 'EV-1',
  apiVersion: QUO_API_VERSION,
  createdAt: '2026-10-02T16:45:00.000Z',
  type,
  data: { resource, context: { orgId: 'OR-click', phoneNumberId: 'PN-click', ...context }, links: { quo: null } },
})
const callContext = (external = GREG, userId: string | null = 'US-robert') => ({
  userId,
  participants: { workspace: userId ? [userId] : [], external: [external], resolution: 'available' },
})

function read(body: unknown): QuoReading {
  const r = readQuoEvent(body)
  if (!r.ok) throw new Error(r.why)
  return r.reading
}

const ctx = (over: Partial<QuoPlanContext> = {}): QuoPlanContext => ({
  contactId: 'c-greg',
  contactWords: 'Greg',
  channelId: 'ch-greg',
  optedOut: false,
  defaultJobId: 'job-boerne',
  users: USERS,
  company: CLICK,
  existing: null,
  ...over,
})

const text = (body: string, extra: Record<string, unknown> = {}) =>
  read(
    delivery(
      'message.received',
      { id: 'MS-1', direction: 'incoming', text: body, media: [], status: 'received', createdAt: '2026-10-02T13:44:00.000Z', ...extra },
      { senderIdentifier: GREG, recipientIdentifiers: ['+12105550100'], userId: null },
    ),
  )

// One answered call from Greg that Robert took, as its four events.
const ANSWERED = {
  completed: read(
    delivery(
      'call.completed',
      { id: 'CA-1', direction: 'incoming', status: 'answered', createdAt: '2026-09-26T14:00:00.000Z', answeredAt: '2026-09-26T14:00:05.000Z', completedAt: '2026-09-26T14:04:17.000Z', duration: 252, hasVoicemail: false },
      callContext(),
    ),
  ),
  recording: read(
    delivery(
      'call.recording.completed',
      { id: 'CA-1', direction: 'incoming', createdAt: '2026-09-26T14:00:00.000Z', duration: 252, recordings: [{ id: 'RE-1', duration: 252, startTime: '2026-09-26T14:00:05.000Z', type: 'audio/mpeg', url: 'https://files.example/RE-1.mp3' }] },
      callContext(),
    ),
  ),
  transcript: read(
    delivery(
      'call.transcript.completed',
      {
        callId: 'CA-1',
        createdAt: '2026-09-26T14:05:00.000Z',
        duration: 252,
        processingStatus: 'completed',
        dialogue: [
          { userId: null, identifier: GREG, content: 'I will price the Boerne sitework by Wednesday.', start: 1, end: 4 },
          { userId: 'US-robert', identifier: '+12105550100', content: 'Striping is listed under Sitework.', start: 5, end: 8 },
        ],
      },
      callContext(),
    ),
  ),
  summary: read(
    delivery(
      'call.summary.completed',
      {
        callId: 'CA-1',
        processingStatus: 'completed',
        summary: ['Greg is busy on a subdivision', 'He will price the Boerne sitework by Wednesday, Sep 30.'],
        nextSteps: ['Watch for his number Wednesday'],
        fromPhoneNumber: GREG,
        handledByAiAgent: false,
        answeredByUserId: 'US-robert',
        jobs: [],
      },
      callContext(),
    ),
  ),
}

// One call from Elena that went to voicemail, as its three events.
const VOICEMAIL = {
  completed: read(
    delivery(
      'call.completed',
      { id: 'CA-2', direction: 'incoming', status: 'unanswered', createdAt: '2026-10-02T14:50:00.000Z', answeredAt: null, completedAt: '2026-10-02T14:50:40.000Z', duration: 40, hasVoicemail: true },
      callContext('+12105550188', 'US-rosa'),
    ),
  ),
  missed: read(delivery('call.missed', { id: 'CA-2', createdAt: '2026-10-02T14:50:00.000Z', updatedAt: '2026-10-02T14:50:40.000Z' }, callContext('+12105550188', null))),
  voicemail: read(
    delivery(
      'call.voicemail.completed',
      {
        id: 'VM-1',
        voicemailId: 'VM-1',
        callId: 'CA-2',
        direction: 'incoming',
        duration: 24,
        from: '+12105550188',
        to: '+12105550100',
        transcript: 'Rosa, it is Elena. The check for pay application 3 goes out Friday the 9th.',
        recordingUrl: 'https://files.example/VM-1.mp3',
        createdAt: '2026-10-02T14:50:16.000Z',
        updatedAt: '2026-10-02T14:51:00.000Z',
      },
      { phoneNumberId: 'PN-click' },
    ),
  ),
}

function fold(events: readonly QuoReading[], c: QuoPlanContext): QuoLine | null {
  let line: QuoLine | null = null
  for (const e of events) {
    if (e.kind === 'text' || e.kind === 'sent') throw new Error('a call only')
    line = mergeCall(line, e, { ...c, existing: line }) ?? line
  }
  return line
}

function orders<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()]
  return items.flatMap((x, i) => orders([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

describe('reading a delivery', () => {
  it('reads a text from Greg', () => {
    expect(text('Also is the detention pond in sitework or concrete?')).toEqual({
      kind: 'text',
      quoId: 'MS-1',
      at: '2026-10-02T13:44:00.000Z',
      external: GREG,
      ourNumberId: 'PN-click',
      userId: null,
      body: 'Also is the detention pond in sitework or concrete?',
      media: [],
    })
  })

  it('reads a call’s end, its voicemail, recording, transcript and summary', () => {
    expect(ANSWERED.completed).toMatchObject({ kind: 'call', quoId: 'CA-1', direction: 'in', status: 'answered', durationSeconds: 252, hasVoicemail: false, external: GREG, userId: 'US-robert' })
    expect(ANSWERED.recording).toMatchObject({ kind: 'recording', quoId: 'CA-1', recordingUrl: 'https://files.example/RE-1.mp3', durationSeconds: 252 })
    expect(ANSWERED.transcript).toMatchObject({ kind: 'transcript', quoId: 'CA-1', done: true })
    expect(ANSWERED.summary).toMatchObject({ kind: 'summary', quoId: 'CA-1', done: true, answeredByUserId: 'US-robert', nextSteps: ['Watch for his number Wednesday'] })
    // A voicemail is keyed by its call, and names the caller from its own from when the context does not.
    expect(VOICEMAIL.voicemail).toMatchObject({ kind: 'voicemail', quoId: 'CA-2', external: '+12105550188', durationSeconds: 24 })
    expect(VOICEMAIL.missed).toMatchObject({ kind: 'missed', quoId: 'CA-2' })
  })

  it('reads a status it does not know as unknown', () => {
    expect(read(delivery('call.completed', { id: 'CA-9', direction: 'incoming', status: 'parked', createdAt: '2026-10-02T15:00:00.000Z' }, callContext()))).toMatchObject({
      status: 'unknown',
      durationSeconds: null,
    })
  })

  it('reads anything else as nothing to do, with the reason', () => {
    expect(readQuoEvent('hello')).toEqual({ ok: false, why: 'not a Quo delivery' })
    expect(readQuoEvent({ id: 'EV-2', type: 'message.received' })).toEqual({ ok: false, why: 'not a Quo delivery' })
    expect(readQuoEvent({ id: 'EV-3', apiVersion: 'v3', type: 'message.received', data: { object: { id: 'MS-3' } } })).toEqual({
      ok: false,
      why: 'API version v3, not 2026-03-30',
    })
    expect(readQuoEvent(delivery('call.ringing', { id: 'CA-3' }))).toEqual({ ok: false, why: 'call.ringing is not an event the webhook takes' })
    expect(readQuoEvent(delivery('message.received', { text: 'Hi' }, { senderIdentifier: GREG }))).toEqual({
      ok: false,
      why: 'message.received without the id it needs',
    })
  })
})

describe('numbers', () => {
  it('writes a US or Canadian number as Quo takes it', () => {
    expect(toE164('(210) 555-0113')).toBe(GREG)
    expect(toE164('1-210-555-0113')).toBe(GREG)
    expect(toE164(GREG)).toBe(GREG)
    expect(toE164('555-0113')).toBeNull()
    expect(toE164('+44 20 7946 0958')).toBeNull()
  })

  it('shows a number the way a line reads it', () => {
    expect(phoneWords(STRANGER)).toBe('(830) 555-0172')
    expect(phoneWords(' +44 20 7946 0958 ')).toBe('+44 20 7946 0958')
  })

  it('makes a number nobody knows an unknown contact, its Who is this? row', () => {
    expect(unknownContact(STRANGER)).toEqual({ kind: 'unknown', name: '(830) 555-0172', channel: { kind: 'phone', value: STRANGER } })
  })
})

describe('STOP, START and HELP', () => {
  it('knows Quo’s stop words alone, in any case, and whether Quo answers them', () => {
    for (const word of ['STOP', 'stop', 'StopAll', 'Unsubscribe', 'cancel', 'END', 'quit', ' STOP ']) {
      expect(keywordOf(word)).toEqual({ kind: 'stop', word: word.trim().toUpperCase(), quoAnswers: true })
    }
    // Quo catches its words only exactly; the app catches the rest and answers itself.
    expect(keywordOf('Stop.')).toEqual({ kind: 'stop', word: 'STOP', quoAnswers: false })
    expect(keywordOf('REVOKE')).toEqual({ kind: 'stop', word: 'REVOKE', quoAnswers: false })
    expect(keywordOf('opt out')).toEqual({ kind: 'stop', word: 'OPT OUT', quoAnswers: false })
    expect(keywordOf('Opt-out')).toEqual({ kind: 'stop', word: 'OPT OUT', quoAnswers: false })
  })

  it('knows START and HELP', () => {
    expect(keywordOf('start')).toEqual({ kind: 'start', word: 'START', quoAnswers: true })
    expect(keywordOf('UNSTOP')).toEqual({ kind: 'start', word: 'UNSTOP', quoAnswers: true })
    expect(keywordOf('Help')).toEqual({ kind: 'help', word: 'HELP', quoAnswers: false })
    expect(keywordOf('info')).toEqual({ kind: 'help', word: 'INFO', quoAnswers: false })
  })

  it('takes no longer text as a word', () => {
    expect(keywordOf('STOP PLEASE')).toBeNull()
    expect(keywordOf('Stop by the site at 7')).toBeNull()
    expect(keywordOf('')).toBeNull()
  })

  it('notices a longer text that may ask for no more texts, without stopping the number', () => {
    expect(mayAskToStop('stop please')).toBe(true)
    expect(mayAskToStop('Please stop texting me about this job.')).toBe(true)
    expect(mayAskToStop('Don’t text me anymore')).toBe(true)
    expect(mayAskToStop('Remove me from your list')).toBe(true)
    expect(mayAskToStop('Stop by the site at 7 tomorrow')).toBe(false)
    expect(mayAskToStop('End of day works')).toBe(false)
    expect(mayAskToStop('STOP')).toBe(false)
  })
})

describe('a text into the thread', () => {
  it('writes Greg’s text on his default job, named for him', () => {
    expect(planQuoEvent(text('Also is the detention pond in sitework or concrete?'), ctx())).toEqual({
      line: {
        quoId: 'MS-1',
        contactId: 'c-greg',
        channelId: 'ch-greg',
        jobId: 'job-boerne',
        channel: 'text',
        direction: 'in',
        at: '2026-10-02T13:44:00.000Z',
        who: 'Greg',
        whoUserId: null,
        body: 'Also is the detention pond in sitework or concrete?',
        recordingUrl: null,
        transcript: null,
        summary: null,
        durationSeconds: null,
        media: [],
        optoutLine: null,
        delivery: null,
      },
      optout: null,
      answer: null,
      event: null,
    })
  })

  it('names an unknown number by the number, on no job', () => {
    const plan = planQuoEvent(text('Hi this is Dee at Alamo Concrete, new cell.'), ctx({ contactId: 'c-unk', contactWords: '(830) 555-0172', defaultJobId: null }))
    expect(plan.line).toMatchObject({ who: '(830) 555-0172', jobId: null, contactId: 'c-unk' })
  })

  it('says what came when a text is only pictures or files', () => {
    const photo = { url: 'https://files.example/1.jpg', type: 'image/jpeg' }
    expect(planQuoEvent(text('', { media: [photo] }), ctx()).line?.body).toBe('A picture.')
    expect(planQuoEvent(text('', { media: [photo, photo] }), ctx()).line?.body).toBe('2 pictures.')
    expect(planQuoEvent(text('', { media: [{ url: 'https://files.example/a.pdf', type: 'application/pdf' }] }), ctx()).line?.body).toBe('A file.')
    expect(planQuoEvent(text('The pond', { media: [photo] }), ctx()).line).toMatchObject({ body: 'The pond', media: [photo] })
  })

  it('stops the number on STOP, leaving the answer to Quo', () => {
    expect(planQuoEvent(text('STOP'), ctx())).toMatchObject({
      optout: 'out',
      answer: null,
      event: 'Greg asked for no more texts. The app will not text this number.',
    })
  })

  it('answers a stop Quo does not catch, once', () => {
    expect(planQuoEvent(text('Stop.'), ctx())).toMatchObject({
      optout: 'out',
      answer: { body: 'Click Construction. You will get no more texts from us. Reply START to get them again.', purpose: 'confirm' },
    })
    expect(planQuoEvent(text('revoke'), ctx()).answer?.purpose).toBe('confirm')
    // A second stop from a number already stopped writes the line and nothing more.
    expect(planQuoEvent(text('Stop.'), ctx({ optedOut: true }))).toMatchObject({ optout: 'out', answer: null, event: null })
  })

  it('brings a stopped number back on START', () => {
    expect(planQuoEvent(text('START'), ctx({ optedOut: true }))).toMatchObject({
      optout: 'in',
      answer: null,
      event: 'Greg asked for texts again. The app can text this number again.',
    })
    expect(planQuoEvent(text('START'), ctx())).toMatchObject({ optout: null, answer: null, event: null })
  })

  it('answers HELP with who we are, or tells the team when the number is stopped', () => {
    expect(planQuoEvent(text('help'), ctx())).toMatchObject({
      optout: null,
      answer: {
        body: 'Click Construction. For help, call or text (210) 555-0100, or email bids@clickconstruction.example. Reply STOP to opt out. Message and data rates may apply.',
        purpose: 'answer',
      },
      event: null,
    })
    expect(planQuoEvent(text('HELP'), ctx({ optedOut: true }))).toMatchObject({
      answer: null,
      event: 'Greg asked for help but has opted out of texts. Call them if it matters.',
    })
  })

  it('leaves a may-be stop to a person', () => {
    expect(planQuoEvent(text('stop please'), ctx())).toMatchObject({ optout: null, answer: null, event: 'Greg may be asking for no more texts. If so, use Mark STOP.' })
  })
})

describe('a call, merged from its events', () => {
  it('writes Robert’s answered call with its summary, transcript and recording', () => {
    const line = fold([ANSWERED.completed, ANSWERED.recording, ANSWERED.transcript, ANSWERED.summary], ctx())
    expect(line).toEqual({
      quoId: 'CA-1',
      contactId: 'c-greg',
      channelId: 'ch-greg',
      jobId: 'job-boerne',
      channel: 'call',
      direction: 'in',
      at: '2026-09-26T14:00:00.000Z',
      who: 'Robert answered',
      whoUserId: 'u-robert',
      body: 'Greg is busy on a subdivision. He will price the Boerne sitework by Wednesday, Sep 30.\nNext: Watch for his number Wednesday.',
      recordingUrl: 'https://files.example/RE-1.mp3',
      transcript: 'Greg: I will price the Boerne sitework by Wednesday.\nRobert: Striping is listed under Sitework.',
      summary: 'Greg is busy on a subdivision. He will price the Boerne sitework by Wednesday, Sep 30.\nNext: Watch for his number Wednesday.',
      durationSeconds: 252,
      media: [],
      optoutLine: null,
      delivery: null,
    })
  })

  it('ends on the same line whatever order the four events came in', () => {
    const first = fold([ANSWERED.completed, ANSWERED.recording, ANSWERED.transcript, ANSWERED.summary], ctx())
    const all = orders([ANSWERED.completed, ANSWERED.recording, ANSWERED.transcript, ANSWERED.summary])
    expect(all).toHaveLength(24)
    for (const order of all) expect(fold(order, ctx())).toEqual(first)
  })

  it('reads the call as plain until its summary comes', () => {
    expect(fold([ANSWERED.completed], ctx())).toMatchObject({ body: 'Call.', who: 'Robert answered', summary: null })
  })

  it('writes Elena’s voicemail whatever order its events came in, with nobody of ours on it', () => {
    const lines = orders([VOICEMAIL.completed, VOICEMAIL.missed, VOICEMAIL.voicemail]).map((o) => fold(o, ctx({ contactId: 'c-elena', contactWords: 'Elena', channelId: 'ch-elena', defaultJobId: 'job-fairoaks' })))
    for (const line of lines) {
      expect(line).toEqual({
        quoId: 'CA-2',
        contactId: 'c-elena',
        channelId: 'ch-elena',
        jobId: 'job-fairoaks',
        channel: 'voicemail',
        direction: 'in',
        at: '2026-10-02T14:50:00.000Z',
        who: 'rang everyone on the company number',
        whoUserId: null,
        body: '"Rosa, it is Elena. The check for pay application 3 goes out Friday the 9th."',
        recordingUrl: 'https://files.example/VM-1.mp3',
        transcript: 'Rosa, it is Elena. The check for pay application 3 goes out Friday the 9th.',
        summary: null,
        durationSeconds: 24,
        media: [],
        optoutLine: null,
        delivery: null,
      })
    }
  })

  it('writes a missed call with no voicemail', () => {
    const unanswered = read(
      delivery('call.completed', { id: 'CA-3', direction: 'incoming', status: 'unanswered', createdAt: '2026-10-02T15:05:00.000Z', duration: 0, hasVoicemail: false }, callContext('+12105550188', null)),
    )
    const missed = read(delivery('call.missed', { id: 'CA-3', createdAt: '2026-10-02T15:05:00.000Z' }, callContext('+12105550188', null)))
    for (const order of [[unanswered, missed], [missed, unanswered]]) {
      expect(fold(order, ctx())).toMatchObject({ channel: 'missed', who: 'rang everyone · no voicemail', body: 'Missed call.', whoUserId: null })
    }
  })

  it('names our call out, and says when nobody picked up', () => {
    const out = (status: string) =>
      read(delivery('call.completed', { id: `CA-${status}`, direction: 'outgoing', status, createdAt: '2026-10-02T15:10:00.000Z', duration: 30, hasVoicemail: false }, callContext()))
    expect(fold([out('answered')], ctx())).toMatchObject({ channel: 'call', direction: 'out', who: 'Robert called', body: 'Call.', whoUserId: 'u-robert' })
    expect(fold([out('unanswered')], ctx())).toMatchObject({ who: 'Robert called · no answer', body: 'No answer.' })
    expect(fold([out('failed')], ctx())).toMatchObject({ who: 'Robert called · it did not go through', body: 'No answer.' })
  })

  it('names who answered by what Quo says', () => {
    expect(callWho('call', 'in', null, 'ai-handled')).toBe('Quo’s assistant answered')
    expect(callWho('call', 'in', 'Rosa', 'forwarded')).toBe('forwarded from the company number')
    expect(callWho('call', 'in', null, 'answered')).toBe('answered on the company number')
    expect(callWho('call', 'out', null, 'answered')).toBe('called from the company number')
  })

  it('lets the summary name who answered when the call’s end named nobody', () => {
    const noUser = read(
      delivery('call.completed', { id: 'CA-1', direction: 'incoming', status: 'answered', createdAt: '2026-09-26T14:00:00.000Z', duration: 252, hasVoicemail: false }, callContext(GREG, null)),
    )
    expect(fold([noUser], ctx())).toMatchObject({ who: 'answered on the company number', whoUserId: null })
    expect(fold([noUser, ANSWERED.summary], ctx())).toMatchObject({ who: 'Robert answered', whoUserId: 'u-robert' })
  })

  it('writes nothing for a transcript still in progress', () => {
    const working = read(delivery('call.transcript.completed', { callId: 'CA-1', createdAt: '2026-09-26T14:05:00.000Z', duration: 252, processingStatus: 'in-progress', dialogue: null }, callContext()))
    expect(planQuoEvent(working, ctx())).toEqual({ line: null, optout: null, answer: null, event: null })
  })

  it('keeps the job a person tied the call to', () => {
    const first = fold([ANSWERED.completed], ctx())
    const retied = first ? { ...first, jobId: 'job-padb' } : null
    expect(mergeCall(retied, ANSWERED.summary as CallReading, ctx({ existing: retied }))?.jobId).toBe('job-padb')
  })

  it('writes Quo’s summary as one paragraph and the transcript one turn a line', () => {
    expect(summaryWords(['One', 'Two!'], [])).toBe('One. Two!')
    expect(summaryWords([], ['Call back'])).toBe('Next: Call back.')
    expect(summaryWords([], [])).toBeNull()
    expect(transcriptWords([{ userId: 'US-nobody', identifier: GREG, content: 'Hello.' }], { users: USERS, contactWords: 'Greg' })).toBe('Greg: Hello.')
  })
})

// A text of ours as Quo reports it: Rosa's from Quo's own phone app, to Greg, delivered.
const ours = (type: string, extra: Record<string, unknown> = {}, recipients = [GREG], userId: string | null = 'US-rosa') =>
  read(
    delivery(
      type,
      { id: 'MS-50', direction: 'outgoing', text: 'Greg, the walk moved to 8.', media: [], status: 'delivered', createdAt: '2026-10-02T15:30:00.000Z', ...extra },
      { userId, senderIdentifier: '+12105550100', recipientIdentifiers: recipients },
    ),
  )
type Sent = Extract<QuoReading, { kind: 'sent' }>
const asSent = (r: QuoReading): Sent => {
  if (r.kind !== 'sent') throw new Error('a text of ours only')
  return r
}

describe('a text of ours, as Quo reports it', () => {
  it('reads delivered, failed and undelivered', () => {
    expect(ours('message.delivered')).toEqual({
      kind: 'sent',
      quoId: 'MS-50',
      at: '2026-10-02T15:30:00.000Z',
      external: GREG,
      ourNumberId: 'PN-click',
      outcome: 'delivered',
      recipients: [GREG],
      userId: 'US-rosa',
      body: 'Greg, the walk moved to 8.',
      media: [],
      errorCode: null,
    })
    expect(ours('message.failed', { status: 'failed', errorCode: '30007' })).toMatchObject({ outcome: 'failed', errorCode: '30007' })
    expect(ours('message.undelivered', { status: 'undelivered', errorCode: null })).toMatchObject({ outcome: 'undelivered', errorCode: null })
    expect(readQuoEvent(delivery('message.delivered', { id: 'MS-51', direction: 'outgoing', text: 'x' }, { recipientIdentifiers: [] }))).toEqual({
      ok: false,
      why: 'message.delivered without the id it needs',
    })
  })

  it('writes a text from Quo’s app as the person who sent it, on the default job', () => {
    expect(planQuoEvent(ours('message.delivered'), ctx())).toEqual({
      line: {
        quoId: 'MS-50',
        contactId: 'c-greg',
        channelId: 'ch-greg',
        jobId: 'job-boerne',
        channel: 'text',
        direction: 'out',
        at: '2026-10-02T15:30:00.000Z',
        who: 'Rosa · from the company number',
        whoUserId: 'u-rosa',
        body: 'Greg, the walk moved to 8.',
        recordingUrl: null,
        transcript: null,
        summary: null,
        durationSeconds: null,
        media: [],
        optoutLine: null,
        delivery: 'delivered',
      },
      optout: null,
      answer: null,
      event: null,
    })
    expect(planQuoEvent(ours('message.delivered', {}, [GREG], 'US-somebody'), ctx()).line).toMatchObject({
      who: 'Quo’s app · from the company number',
      whoUserId: null,
    })
    expect(quoSentWho(null, USERS)).toBe('Quo’s app · from the company number')
  })

  it('writes a group text from Quo’s app as one line a person, each under its own key', () => {
    const group = asSent(ours('message.delivered', {}, [GREG, '+12105550188']))
    expect(sentKey(group, GREG)).toBe('MS-50:+12105550113')
    expect(sentKey(group, '(210) 555-0188')).toBe('MS-50:+12105550188')
    expect(sentKey(asSent(ours('message.delivered')), GREG)).toBe('MS-50')
    const elena = planQuoEvent(group, ctx({ contactId: 'c-elena', contactWords: 'Elena', channelId: 'ch-elena', defaultJobId: 'job-fairoaks', recipient: '+12105550188' }))
    expect(elena.line).toMatchObject({ quoId: 'MS-50:+12105550188', contactId: 'c-elena', jobId: 'job-fairoaks' })
  })

  it('only fills what is missing on a line already written', () => {
    const written: QuoLine = {
      quoId: 'MS-50',
      contactId: 'c-greg',
      channelId: 'ch-greg',
      jobId: 'job-padb',
      channel: 'text',
      direction: 'out',
      at: '2026-10-02T15:29:58.000Z',
      who: 'Robert · from the company number',
      whoUserId: 'u-robert',
      body: 'Greg, the walk moved to 8.\n\nClick Construction. Reply STOP to opt out.',
      recordingUrl: null,
      transcript: null,
      summary: null,
      durationSeconds: null,
      media: [],
      optoutLine: 'first',
      delivery: null,
    }
    const photo = { url: 'https://files.example/walk.jpg', type: 'image/jpeg' }
    expect(planQuoEvent(ours('message.delivered', { media: [photo] }), ctx({ existing: written })).line).toEqual({ ...written, delivery: 'delivered', media: [photo] })
  })

  it('says a failure once, and keeps delivered once a carrier said so', () => {
    const failed = planQuoEvent(ours('message.failed', { errorCode: '30007' }), ctx())
    expect(failed).toMatchObject({ line: { delivery: 'failed' }, event: 'The text to Greg did not go out. Quo gave code 30007.' })
    expect(planQuoEvent(ours('message.failed', { errorCode: '30007' }), ctx({ existing: failed.line })).event).toBeNull()
    const lost = planQuoEvent(ours('message.undelivered'), ctx({ existing: failed.line }))
    expect(lost).toMatchObject({ line: { delivery: 'undelivered' }, event: 'The text to Greg did not reach their phone.' })
    const arrived = planQuoEvent(ours('message.delivered'), ctx({ existing: lost.line }))
    expect(arrived).toMatchObject({ line: { delivery: 'delivered' }, event: null })
    expect(planQuoEvent(ours('message.failed'), ctx({ existing: arrived.line }))).toMatchObject({ line: { delivery: 'delivered' }, event: null })
  })

  it('ranks the endings', () => {
    expect(strongerDelivery(null, 'failed')).toBe('failed')
    expect(strongerDelivery('failed', 'undelivered')).toBe('undelivered')
    expect(strongerDelivery('delivered', 'failed')).toBe('delivered')
    expect(deliveryWords('delivered', 'Greg', null)).toBeNull()
  })
})

describe('plain words', () => {
  it('holds every sentence the app writes or says', () => {
    // The phone number goes in without parentheses here: those are the number's own, not two ideas glued.
    const plain = { ...CLICK, phone: '210 555 0100' }
    const said = [
      helpAnswer(plain),
      stopAnswer(plain),
      ...['STOP', 'START', 'HELP', 'stop please'].flatMap((t) => {
        const plan = planQuoEvent(text(t), ctx({ optedOut: t === 'START' || t === 'HELP' }))
        return plan.event ? [plan.event] : []
      }),
    ]
    said.push(deliveryWords('failed', 'Greg', '30007') ?? '', deliveryWords('undelivered', 'Elena', null) ?? '')
    expect(said).toHaveLength(8)
    expect(said.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
