import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem, JobThreadNoteRow } from '../../components/JobThreadNotesPanel'
import { DANA, DANA_JOB_MESSAGES, HECTOR } from '../../test/fixtures/jobActivityMessagesDemo'
import { buildJobActivityLines, countJobActivityLines, filterJobActivityLines, isConversationalLine, type JobActivityLine } from './jobActivityLine'
import { jobActivityMessagesFromRows, jobTakesUntiedLines, MESSAGE_LINE_MAX, messageChannelWord, messageLineParts, messageTone, messageWho, noteReaders, type JobActivityMessage, type JobMessageRow } from './jobActivityMessages'

const byId = (id: string): JobActivityMessage => {
  const m = DANA_JOB_MESSAGES.find((x) => x.id === id)
  if (!m) throw new Error(`no ${id}`)
  return m
}
const note = (id: string, at: string, body: string): JobThreadActivityItem => ({
  kind: 'note',
  note: { id, created_at: at, body, author: { name: 'Rosa' } } as unknown as JobThreadNoteRow,
})
const lineOf = (lines: JobActivityLine[], key: string): JobActivityLine => {
  const line = lines.find((l) => l.key === key)
  if (!line) throw new Error(`no ${key}`)
  return line
}

describe('a message as a Job activity line (Messages cut 10)', () => {
  it('reads the customer’s side in orange, deeper when it came from her', () => {
    expect(messageTone(byId('m-dana-2'))).toBe('customerIn')
    expect(messageTone(byId('m-dana-1'))).toBe('customerOut')
    expect(messageTone(byId('m-dana-8'))).toBe('customerIn')
    expect(messageTone(byId('m-dana-5'))).toBe('teamNote')
    expect(messageTone(byId('m-dana-9'))).toBe('event')
    expect(messageTone(byId('m-hector-1'))).toBe('plain')
    expect(messageTone({ channel: 'text', direction: 'in', contact: { name: '(210) 555-0112', kind: 'unknown' } })).toBe('plain')
  })

  it('names who: her first name on hers, ours on ours, the app on one it sent by itself', () => {
    expect(messageWho(byId('m-dana-2'))).toBe('Dana')
    expect(messageWho(byId('m-dana-1'))).toBe('Luis')
    expect(messageWho(byId('m-dana-6'))).toBe('the app')
    expect(messageWho(byId('m-dana-5'))).toBe('Rosa')
    expect(messageWho(byId('m-hector-1'))).toBe('Hector')
    expect(messageWho({ direction: 'in', who: '', contact: { name: '(210) 555-0112', kind: 'unknown' } })).toBe('(210) 555-0112')
    expect(messageWho({ direction: 'in', who: '', contact: { name: 'Dana Whitfield', goesBy: 'Dee', kind: 'customer' } })).toBe('Dee')
  })

  it('says the channel in a small word, with a call’s length when Quo gave one', () => {
    expect(['m-dana-1', 'm-dana-3', 'm-dana-4', 'm-dana-5', 'm-dana-7', 'm-dana-8', 'm-dana-9', 'm-dana-10'].map((id) => messageChannelWord(byId(id)))).toEqual([
      'text',
      'email',
      'call · 3:12',
      'note in Messages',
      'missed call',
      'portal',
      '',
      'voicemail · 0:38',
    ])
    expect(messageChannelWord({ channel: 'call', durationSeconds: null })).toBe('call')
    expect(messageChannelWord({ channel: 'call', durationSeconds: 0 })).toBe('call')
  })

  it('shows an email’s subject apart and its words on one line, folding the rest into what opens', () => {
    const parts = messageLineParts(byId('m-dana-3'))
    expect(parts.message.subject).toBe('Your estimate for Oakridge sewer line')
    expect(parts.body).toBe('Hello Dana, your estimate is ready. Review and approve it here: click.co/e/8Kp4. Call or text us with any question.')
    expect(parts.detail).toEqual([])
    const long = messageLineParts({ ...byId('m-dana-1'), body: `${'Water is off at the house while we work on the line. '.repeat(6)}Back on by five.` })
    expect(long.body.length).toBeLessThanOrEqual(MESSAGE_LINE_MAX + 1)
    expect(long.body.endsWith('…')).toBe(true)
    expect(long.detail).toEqual([{ value: `${'Water is off at the house while we work on the line. '.repeat(6)}Back on by five.` }])
    expect(messageLineParts(byId('m-dana-1')).message.subject).toBeNull()
  })

  it('leads a call with Quo’s summary and opens to the summary and the transcript', () => {
    const parts = messageLineParts(byId('m-dana-4'))
    expect(parts.body).toBe('Asked if Thursday works and if the water heater quote still stands. Next: Rosa calls back today.')
    expect(parts.detail).toEqual([
      { label: 'Summary', value: 'Asked if Thursday works and if the water heater quote still stands.\nNext: Rosa calls back today.' },
      { label: 'Transcript', value: 'Dana: Hi, can you do Thursday?\nRosa: Let me check the board and call you back.' },
    ])
    expect(messageLineParts({ ...byId('m-dana-4'), summary: null, transcript: null }).body).toBe('')
  })

  it('says a missed call left no voicemail, and reads a voicemail’s words', () => {
    expect(messageLineParts(byId('m-dana-7')).body).toBe('No voicemail.')
    expect(messageLineParts(byId('m-dana-10')).body).toBe('Hi, it is Dana. The side gate is unlocked for Thursday. Thanks.')
    expect(messageLineParts({ ...byId('m-dana-10'), transcript: null }).body).toBe('Left a voicemail.')
  })

  it('marks her line tied to no job yet, and links to her thread at the line', () => {
    expect(messageLineParts(byId('m-dana-11')).message.notTiedYet).toBe(true)
    expect(messageLineParts(byId('m-dana-2')).message.notTiedYet).toBe(false)
    expect(messageLineParts(byId('m-dana-2')).message.threadHref).toBe('/messages?thread=c-dana&at=m-dana-2')
  })

  it('opens a trade partner’s or an architect’s thread on GC projects’ Messages, and anyone else’s on the Messages page', () => {
    const as = (kind: 'trade' | 'arch' | 'lead' | 'unknown') => messageLineParts({ ...byId('m-dana-2'), contactId: 'c-hector', contact: { name: 'Hector Ruiz', kind } }).message.threadHref
    expect(as('trade')).toBe('/gc?view=messages&thread=c-hector&at=m-dana-2')
    expect(as('arch')).toBe('/gc?view=messages&thread=c-hector&at=m-dana-2')
    expect(as('lead')).toBe('/messages?thread=c-hector&at=m-dana-2')
    expect(as('unknown')).toBe('/messages?thread=c-hector&at=m-dana-2')
  })

  it('says who reads a team note: the office alone when it is marked so, else the whole team, techs too', () => {
    expect(messageLineParts(byId('m-dana-5')).message.readersWord).toBe('only the team sees this')
    expect(messageLineParts({ ...byId('m-dana-5'), officeOnly: true }).message.readersWord).toBe('only the office sees this')
    expect(noteReaders({ channel: 'text', officeOnly: false })).toBe('')
    expect(messageLineParts(byId('m-dana-2')).message.readersWord).toBe('')
  })
})

describe('the job’s lines with its messages', () => {
  const items = [note('n-1', '2026-10-05T14:41:00Z', 'Arrived at job'), note('n-2', '2026-10-06T21:12:00Z', 'Called Dana back. Thursday works for her.')]
  const lines = buildJobActivityLines(items, { messages: DANA_JOB_MESSAGES })

  it('numbers every line oldest first across the notes and the messages', () => {
    expect(lines.map((l) => l.key)).toEqual([
      'm-m-dana-1',
      'm-m-dana-2',
      'n-n-1',
      'm-m-dana-3',
      'm-m-dana-4',
      'n-n-2',
      'm-m-dana-5',
      'm-m-dana-6',
      'm-m-dana-7',
      'm-m-dana-8',
      'm-m-dana-9',
      'm-m-hector-1',
      'm-m-dana-10',
      'm-m-dana-11',
    ])
    expect(lines.map((l) => l.number)).toEqual(lines.map((_, i) => i + 1))
    const first = lineOf(lines, 'm-m-dana-1')
    expect([first.kind, first.timeLabel, first.who, first.item]).toEqual(['message', '9:02a', 'Luis', null])
  })

  it('keeps a note before a message at the same minute', () => {
    const tie = buildJobActivityLines([note('n-3', '2026-10-05T14:02:00Z', 'On the way')], { messages: [byId('m-dana-1')] })
    expect(tie.map((l) => l.key)).toEqual(['n-n-3', 'm-m-dana-1'])
  })

  it('shows her side under Customer, a team note under Notes, and the rest under All only', () => {
    const customer = filterJobActivityLines(lines, 'customer')
    expect(customer.map((l) => l.key)).toEqual(['m-m-dana-1', 'm-m-dana-2', 'm-m-dana-3', 'm-m-dana-4', 'm-m-dana-6', 'm-m-dana-7', 'm-m-dana-8', 'm-m-dana-10', 'm-m-dana-11'])
    expect(customer.map((l) => l.number)).toEqual([1, 2, 4, 5, 8, 9, 10, 13, 14])
    expect(filterJobActivityLines(lines, 'notes').map((l) => l.key)).toEqual(['n-n-1', 'n-n-2', 'm-m-dana-5'])
    expect(filterJobActivityLines(lines, 'status')).toEqual([])
    expect(filterJobActivityLines(lines, 'all')).toHaveLength(14)
  })

  it('counts each bucket from the same lines the filter narrows', () => {
    expect(countJobActivityLines(lines)).toEqual({ all: 14, notes: 3, reports: 0, status: 0, billing: 0, crew: 0, customer: 9 })
    expect(countJobActivityLines(buildJobActivityLines(items))).toEqual({ all: 2, notes: 2, reports: 0, status: 0, billing: 0, crew: 0, customer: 0 })
  })

  it('treats a message as a person talking, an event as texture', () => {
    expect(isConversationalLine(lineOf(lines, 'm-m-dana-2'))).toBe(true)
    expect(isConversationalLine(lineOf(lines, 'm-m-hector-1'))).toBe(true)
    expect(isConversationalLine(lineOf(lines, 'm-m-dana-9'))).toBe(false)
    expect(isConversationalLine(lineOf(lines, 'n-n-1'))).toBe(true)
  })

  it('draws a trade’s line plain, and the same contact kinds the fixture names', () => {
    const hector = lineOf(lines, 'm-m-hector-1')
    expect(hector.kind === 'message' && hector.message.tone).toBe('plain')
    expect([DANA.kind, HECTOR.kind]).toEqual(['customer', 'trade'])
  })
})

describe('the read’s rows as Job activity’s lines (J2)', () => {
  const contacts = [
    { id: 'c-dana', name: 'Dana Whitfield', goesBy: null, kind: 'customer' as const },
    { id: 'c-hector', name: 'Hector Ruiz', goesBy: null, kind: 'trade' as const },
  ]
  const row = (id: string, over: Partial<JobMessageRow>): JobMessageRow => ({
    id,
    contact_id: 'c-dana',
    channel_id: null,
    bid_id: null,
    project_id: null,
    jobs_ledger_id: 'jl-1312',
    channel: 'text',
    direction: 'in',
    who_user_id: null,
    who_text: '',
    at: '2026-10-05T14:04:00Z',
    subject: null,
    body: 'Great. Gate code is 4471.',
    optout_line: null,
    back_on: null,
    back_by: null,
    ...over,
  })
  const job = { id: 'jl-1312', since: '2026-10-01T12:00:00Z' }

  it('keeps every line tied to the job, names ours from the team’s names, and reads the call columns', () => {
    const lines = jobActivityMessagesFromRows(
      [
        row('m2', {}),
        row('m1', { direction: 'out', who_user_id: 'u-luis', at: '2026-10-05T14:02:00Z', body: 'On our way.' }),
        row('m3', { channel: 'call', duration_seconds: 192, summary: 'Asked about Thursday.', transcript: 'Dana: Thursday?', at: '2026-10-06T21:05:00Z', body: '' }),
        row('m4', { contact_id: 'c-hector', at: '2026-10-07T15:30:00Z', body: 'The trencher is free Thursday.' }),
      ],
      contacts,
      { 'u-luis': 'Luis' },
      job,
    )
    expect(lines.map((m) => [m.id, m.who, m.tied])).toEqual([
      ['m1', 'Luis', true],
      ['m2', 'Dana', true],
      ['m3', 'Dana', true],
      ['m4', 'Hector', true],
    ])
    expect([lines[2]?.durationSeconds, lines[2]?.summary, lines[2]?.transcript]).toEqual([192, 'Asked about Thursday.', 'Dana: Thursday?'])
    expect(lines.every((m) => m.officeOnly === false)).toBe(true)
  })

  it('reads R5’s office-only mark on a team note', () => {
    const [kept] = jobActivityMessagesFromRows([row('n1', { channel: 'note', direction: 'team', who_text: 'Rosa', office_only: true })], contacts, {}, job)
    expect(kept?.officeOnly).toBe(true)
  })

  it('takes the customer’s lines tied to no job since the job began, and leaves out the rest', () => {
    const untied = { jobs_ledger_id: null }
    const lines = jobActivityMessagesFromRows(
      [
        row('ok', { ...untied, at: '2026-10-08T01:30:00Z' }),
        row('before-start', { ...untied, at: '2026-09-20T12:00:00Z' }),
        row('a-trade', { ...untied, contact_id: 'c-hector', at: '2026-10-08T02:00:00Z' }),
        row('a-note', { ...untied, channel: 'note', direction: 'team', who_text: 'Rosa', at: '2026-10-08T03:00:00Z' }),
        row('another-job', { jobs_ledger_id: 'jl-1298', at: '2026-10-08T04:00:00Z' }),
        row('nobody-read', { ...untied, contact_id: 'c-gone', at: '2026-10-08T05:00:00Z' }),
        row('odd', { ...untied, channel: 'fax', at: '2026-10-08T06:00:00Z' }),
      ],
      contacts,
      {},
      job,
    )
    expect(lines.map((m) => [m.id, m.tied])).toEqual([['ok', false]])
    expect(messageLineParts(lines[0] as JobActivityMessage).message.notTiedYet).toBe(true)
  })

  it('reads no start as no limit, and a job is open for untied lines until it is paid', () => {
    expect(jobActivityMessagesFromRows([row('old', { jobs_ledger_id: null, at: '2020-01-01T00:00:00Z' })], contacts, {}, { id: 'jl-1312', since: null })).toHaveLength(1)
    expect(['working', 'ready_to_bill', 'billed', 'paid'].map(jobTakesUntiedLines)).toEqual([true, true, true, false])
  })
})
