/**
 * A `messages` row and the Quo kernels' line, both ways, over the Messages prototype's made-up people: Greg's call on
 * Boerne, a text to Dee's unknown number, Robert and Rosa's seats.
 */
import { describe, expect, it } from 'vitest'
import { MESSAGE_ROW_COLUMNS, contactKindOf, contactWords, defaultJob, jobOf, lineFromRow, parseQuoSendBody, quoSeatUserIds, quoSeats, rowFromLine, seatOf, seatsSource, type MessageRow } from './rows'

const ROW: MessageRow = {
  id: 'm-1',
  quo_id: 'CA-1',
  quo_rev: 2,
  contact_id: 'c-greg',
  channel_id: 'ch-greg',
  bid_id: null,
  project_id: 'job-boerne',
  jobs_ledger_id: null,
  channel: 'call',
  direction: 'in',
  who_user_id: 'u-robert',
  who_text: 'Robert answered',
  at: '2026-09-26T14:00:00.000Z',
  body: 'Greg will price the Boerne sitework by Wednesday.',
  optout_line: null,
  recording_url: 'https://files.example/RE-1.mp3',
  transcript: 'Greg: I will price it by Wednesday.',
  summary: 'Greg will price the Boerne sitework by Wednesday.',
  duration_seconds: 252,
  delivery: null,
  mailbox: 'team',
}

describe('a row and a line', () => {
  it('reads a row as the kernels’ line, with the revision read', () => {
    expect(lineFromRow(ROW)).toEqual({
      rev: 2,
      line: {
        quoId: 'CA-1',
        contactId: 'c-greg',
        channelId: 'ch-greg',
        jobId: 'job-boerne',
        channel: 'call',
        direction: 'in',
        at: '2026-09-26T14:00:00.000Z',
        who: 'Robert answered',
        whoUserId: 'u-robert',
        body: 'Greg will price the Boerne sitework by Wednesday.',
        recordingUrl: 'https://files.example/RE-1.mp3',
        transcript: 'Greg: I will price it by Wednesday.',
        summary: 'Greg will price the Boerne sitework by Wednesday.',
        durationSeconds: 252,
        media: [],
        optoutLine: null,
        delivery: null,
        mailbox: 'team',
      },
    })
  })

  it('reads no line from a row Quo did not write', () => {
    expect(lineFromRow({ ...ROW, quo_id: null })).toBeNull()
    expect(lineFromRow({ ...ROW, channel: 'note', direction: 'team' })).toBeNull()
    expect(lineFromRow({ ...ROW, channel: 'email', direction: 'out' })).toBeNull()
  })

  it('keeps only the values the columns allow', () => {
    expect(lineFromRow({ ...ROW, channel: 'text', direction: 'out', optout_line: 'held', delivery: 'failed' })?.line).toMatchObject({ optoutLine: 'held', delivery: 'failed' })
    expect(lineFromRow({ ...ROW, optout_line: 'maybe', delivery: 'lost' })?.line).toMatchObject({ optoutLine: null, delivery: null })
  })

  it('reads the box a line came through, and none from before two boxes (R6)', () => {
    expect(lineFromRow({ ...ROW, mailbox: 'bids' })?.line.mailbox).toBe('bids')
    expect(lineFromRow({ ...ROW, mailbox: null })?.line.mailbox).toBeNull()
    expect(lineFromRow({ ...ROW, mailbox: 'office' })?.line.mailbox).toBeNull()
  })

  it('writes a line back to the columns, its job in the column it is known by', () => {
    const read = lineFromRow(ROW)
    if (!read) throw new Error('no line')
    const jobs = [jobOf(ROW)].filter((j) => j !== null)
    expect(rowFromLine(read.line, jobs)).toEqual({
      ok: true,
      columns: {
        contact_id: 'c-greg',
        channel_id: 'ch-greg',
        bid_id: null,
        project_id: 'job-boerne',
        jobs_ledger_id: null,
        channel: 'call',
        direction: 'in',
        who_user_id: 'u-robert',
        who_text: 'Robert answered',
        at: '2026-09-26T14:00:00.000Z',
        body: 'Greg will price the Boerne sitework by Wednesday.',
        optout_line: null,
        recording_url: 'https://files.example/RE-1.mp3',
        transcript: 'Greg: I will price it by Wednesday.',
        summary: 'Greg will price the Boerne sitework by Wednesday.',
        duration_seconds: 252,
        delivery: null,
        mailbox: 'team',
      },
    })
    expect(rowFromLine({ ...read.line, jobId: null }, [])).toMatchObject({ ok: true, columns: { bid_id: null, project_id: null, jobs_ledger_id: null } })
  })

  it('refuses a job it cannot place', () => {
    const read = lineFromRow(ROW)
    if (!read) throw new Error('no line')
    expect(rowFromLine({ ...read.line, jobId: 'job-unknown' }, [])).toEqual({ ok: false, why: 'no column is known for job job-unknown' })
  })

  it('selects every column the line reads', () => {
    expect(MESSAGE_ROW_COLUMNS.split(', ').sort()).toEqual(Object.keys(ROW).sort())
  })
})

describe('the jobs', () => {
  it('reads the job a row is tied to, or none', () => {
    expect(jobOf({ bid_id: 'bid-padb', project_id: null, jobs_ledger_id: null })).toEqual({ jobId: 'bid-padb', column: 'bid_id' })
    expect(jobOf({ bid_id: null, project_id: null, jobs_ledger_id: 'ledger-1077' })).toEqual({ jobId: 'ledger-1077', column: 'jobs_ledger_id' })
    expect(jobOf({ bid_id: null, project_id: null, jobs_ledger_id: null })).toBeNull()
  })

  it('finds the star among a contact’s jobs', () => {
    const rows = [
      { bid_id: 'bid-padb', project_id: null, jobs_ledger_id: null, is_default: false },
      { bid_id: null, project_id: 'job-boerne', jobs_ledger_id: null, is_default: true },
    ]
    expect(defaultJob(rows)).toEqual({ jobId: 'job-boerne', column: 'project_id' })
    expect(defaultJob([rows[0]!])).toBeNull()
  })
})

describe('who', () => {
  it('reads every kind of contact the place answers with, and anything else as a number nobody named', () => {
    for (const k of ['customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown'] as const) expect(contactKindOf(k)).toBe(k)
    for (const k of ['', 'owner', 'toString', null, undefined]) expect(contactKindOf(k)).toBe('unknown')
    expect(contactWords({ name: 'Maria Lopez', goesBy: null, kind: contactKindOf('lead') }, '+12105550155')).toBe('Maria')
  })

  it('names a contact the spine’s way, or by their number', () => {
    expect(contactWords({ name: 'Greg Paulk', goesBy: null, kind: 'trade' }, '+12105550113')).toBe('Greg')
    expect(contactWords({ name: 'Dr. Priya Raman', goesBy: null, kind: 'customer' }, '+12105550144')).toBe('Dr. Raman')
    expect(contactWords({ name: 'Gregory Paulk', goesBy: 'Greg', kind: 'trade' }, '+12105550113')).toBe('Greg')
    expect(contactWords({ name: '(830) 555-0172', goesBy: null, kind: 'unknown' }, '+18305550172')).toBe('(830) 555-0172')
  })

  it('reads the seats from the secret and the users’ names', () => {
    const users = [
      { id: 'u-robert', name: 'Robert' },
      { id: 'u-rosa', name: 'Rosa' },
    ]
    const seats = quoSeats('{"US-robert": "u-robert", "US-rosa": "u-rosa", "US-gone": "u-gone"}', users)
    expect(seats).toEqual({ 'US-robert': { userId: 'u-robert', name: 'Robert' }, 'US-rosa': { userId: 'u-rosa', name: 'Rosa' } })
    expect(seatOf('u-rosa', seats)).toBe('US-rosa')
    expect(seatOf('u-wendi', seats)).toBeNull()
    expect(quoSeats(undefined, users)).toEqual({})
    expect(quoSeats('not json', users)).toEqual({})
    expect(quoSeats('["US-robert"]', users)).toEqual({})
  })

  it('names the users to read once', () => {
    expect(quoSeatUserIds('{"US-robert": "u-robert", "US-robert-2": "u-robert", "US-rosa": "u-rosa", "US-x": 3}')).toEqual(['u-robert', 'u-rosa'])
    expect(quoSeatUserIds(undefined)).toEqual([])
  })

  it('reads the seats from the Settings row once it names one, else from the secret', () => {
    const secret = '{"US-robert": "u-robert"}'
    expect(seatsSource('{"US-rosa": "u-rosa"}', secret)).toBe('{"US-rosa": "u-rosa"}')
    expect(seatsSource('{}', secret)).toBe(secret)
    expect(seatsSource(null, secret)).toBe(secret)
    expect(seatsSource('not json', secret)).toBe(secret)
    expect(seatsSource('{}', undefined)).toBeUndefined()
  })
})

describe('what the send window asks quo-send', () => {
  it('reads the contact, the number, the words, the links, the hold and the tie', () => {
    expect(
      parseQuoSendBody({
        contactId: ' c-greg ',
        channelId: 'ch-greg',
        body: 'Greg, Addendum 2 is up.',
        links: [{ text: 'The plans are in your portal: ', link: 'click.co/t/7Hq2#plans' }, { text: 'no link' }, 'junk'],
        held: true,
        tie: { jobId: 'bid-padb', column: 'bid_id' },
      }),
    ).toEqual({
      contactId: 'c-greg',
      channelId: 'ch-greg',
      body: 'Greg, Addendum 2 is up.',
      links: [{ text: 'The plans are in your portal: ', link: 'click.co/t/7Hq2#plans' }],
      held: true,
      tie: { jobId: 'bid-padb', column: 'bid_id' },
    })
    expect(parseQuoSendBody({ contactId: 'c', channelId: 'ch', body: '' })).toEqual({ contactId: 'c', channelId: 'ch', body: '', links: [], held: false, tie: null })
  })

  it('refuses a request missing something, or a tie it cannot place', () => {
    expect(parseQuoSendBody(null)).toBeNull()
    expect(parseQuoSendBody({ channelId: 'ch', body: 'x' })).toBeNull()
    expect(parseQuoSendBody({ contactId: 'c', channelId: 'ch' })).toBeNull()
    expect(parseQuoSendBody({ contactId: 'c', channelId: 'ch', body: 'x', tie: { jobId: 'j', column: 'job_id' } })).toBeNull()
    expect(parseQuoSendBody({ contactId: 'c', channelId: 'ch', body: 'x', tie: { column: 'bid_id' } })).toBeNull()
  })
})
