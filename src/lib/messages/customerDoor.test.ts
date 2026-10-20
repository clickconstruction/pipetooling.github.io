import { describe, expect, it } from 'vitest'
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import { customerDoorRows, LAST_LINE_WORDS_MAX, lastLineMeta, lastLinesOnJob, lastWordOnJob, lastWordWords, NO_EMAIL_WORDS, NO_MOBILE_AT_ALL_WORDS, NO_MOBILE_WORDS, NO_NUMBER_WORDS } from './customerDoor'

const line = (over: Partial<JobActivityMessage>): JobActivityMessage => ({
  id: 'm',
  contactId: 'c-dana',
  contact: { name: 'Dana Whitfield', goesBy: 'Dana', kind: 'customer' },
  channel: 'text',
  direction: 'in',
  at: '2026-10-17T21:31:00.000Z',
  who: '',
  body: 'Great, I will leave the side gate open.',
  tied: true,
  ...over,
})

describe('customerDoorRows', () => {
  it('offers every door when the customer has a mobile and an email, the record where the page has the window', () => {
    const rows = customerDoorRows({ phone: '(210) 555-0188', email: 'dana@whitfield.example', canOpenRecord: true })
    expect(rows.map((r) => [r.kind, r.enabled, r.why])).toEqual([
      ['call', true, null],
      ['text', true, null],
      ['email', true, null],
      ['thread', true, null],
      ['record', true, null],
    ])
  })

  it('greys Call and Text with no mobile, pointing at Email while there is one', () => {
    const rows = customerDoorRows({ phone: '  ', email: 'dana@whitfield.example', canOpenRecord: false })
    expect(rows.find((r) => r.kind === 'call')).toMatchObject({ enabled: false, why: NO_NUMBER_WORDS })
    expect(rows.find((r) => r.kind === 'text')).toMatchObject({ enabled: false, why: NO_MOBILE_WORDS })
    expect(rows.find((r) => r.kind === 'email')).toMatchObject({ enabled: true, why: null })
    expect(rows.some((r) => r.kind === 'record')).toBe(false)
  })

  it('greys Email with no email, pointing at Text while there is a mobile, and says only what is missing when both are', () => {
    expect(customerDoorRows({ phone: '2105550188', email: null, canOpenRecord: false }).find((r) => r.kind === 'email')).toMatchObject({ enabled: false, why: NO_EMAIL_WORDS })
    const none = customerDoorRows({ phone: null, email: null, canOpenRecord: false })
    expect(none.find((r) => r.kind === 'text')?.why).toBe(NO_MOBILE_AT_ALL_WORDS)
    expect(none.find((r) => r.kind === 'thread')?.enabled).toBe(true)
  })
})

describe('lastWordOnJob', () => {
  it('takes the newest call, text, email or portal line, whichever side it came from', () => {
    const lines = [
      line({ id: 'a', at: '2026-10-17T20:20:00.000Z', direction: 'out' }),
      line({ id: 'b', at: '2026-10-17T21:31:00.000Z', direction: 'in' }),
      line({ id: 'c', at: '2026-10-17T19:00:00.000Z', channel: 'call', direction: 'in' }),
    ]
    expect(lastWordOnJob(lines)).toEqual({ who: 'them', at: '2026-10-17T21:31:00.000Z', name: 'Dana' })
    expect(lastWordOnJob([lines[0]!, lines[2]!])).toMatchObject({ who: 'us', at: '2026-10-17T20:20:00.000Z' })
  })

  it('ignores notes, events and team lines, and answers null with no word between us', () => {
    expect(lastWordOnJob([line({ channel: 'note', direction: 'team', at: '2026-10-18T00:00:00.000Z' })])).toBeNull()
    expect(lastWordOnJob([line({ channel: 'event', direction: 'out', at: '2026-10-18T00:00:00.000Z' }), line({ at: '2026-10-17T21:31:00.000Z' })])).toMatchObject({ who: 'them' })
    expect(lastWordOnJob([])).toBeNull()
  })

  it('falls back from the name they go by to their name', () => {
    expect(lastWordOnJob([line({ contact: { name: 'Dana Whitfield', goesBy: null, kind: 'customer' } })])?.name).toBe('Dana Whitfield')
  })
})

describe('lastWordWords', () => {
  const now = '2026-10-18T15:00:00.000Z'
  it('says who wrote last and when, marking their word as waiting on us', () => {
    expect(lastWordWords({ who: 'them', at: '2026-10-17T21:31:00.000Z', name: 'Dana' }, now)).toBe('Waiting on us: Dana wrote last, yesterday.')
    expect(lastWordWords({ who: 'us', at: '2026-10-18T13:44:00.000Z', name: 'Dana' }, now)).toMatch(/^You wrote last, today at \d{1,2}:\d{2} [AP]M\.$/)
    expect(lastWordWords(null, now)).toBeNull()
  })
})

describe('lastLinesOnJob', () => {
  const ours = line({ id: 'm-us', direction: 'out', who: 'Tanya', at: '2026-10-17T22:00:00.000Z', body: 'We will be there at 8.' })
  const older = line({ id: 'm-older', at: '2026-10-16T15:00:00.000Z', body: 'Is Friday still on?' })
  const oldest = line({ id: 'm-oldest', at: '2026-10-15T15:00:00.000Z', body: 'Hi, this is Dana.' })
  const note = line({ id: 'm-note', channel: 'note', direction: 'team', who: 'Rosa', at: '2026-10-18T09:00:00.000Z', body: 'Call her about the gate.' })

  it('takes the newest three words between us and them, oldest first, and leaves the notes out', () => {
    const got = lastLinesOnJob([note, oldest, line({ id: 'm-newest' }), older, ours])
    expect(got.map((l) => l.id)).toEqual(['m-older', 'm-newest', 'm-us'])
    expect(got.map((l) => l.who)).toEqual(['them', 'them', 'us'])
    expect(got[0]).toMatchObject({ name: 'Dana', channel: 'text', words: 'Is Friday still on?' })
    expect(got[2]).toMatchObject({ name: 'Tanya', channel: 'text', words: 'We will be there at 8.' })
  })

  it('names the app on a line it sent, an email by its subject, a missed call and a voicemail by their words', () => {
    const app = line({ id: 'm-app', direction: 'out', who: '', at: '2026-10-17T10:00:00.000Z', body: 'Your plumber is on the way.' })
    const email = line({ id: 'm-email', channel: 'email', at: '2026-10-17T11:00:00.000Z', subject: 'Invoice 2148', body: 'Hi Dana,\nAttached is your invoice.' })
    const missed = line({ id: 'm-missed', channel: 'missed', at: '2026-10-17T12:00:00.000Z', body: '' })
    const voicemail = line({ id: 'm-vm', channel: 'voicemail', at: '2026-10-17T13:00:00.000Z', body: '', transcript: 'Hey, it is Dana, call me back.', durationSeconds: 12 })
    const got = lastLinesOnJob([app, email, missed, voicemail], 4)
    expect(got.map((l) => [l.name, l.channel, l.words])).toEqual([
      ['the app', 'text', 'Your plumber is on the way.'],
      ['Dana', 'email', 'Invoice 2148'],
      ['Dana', 'missed call', 'No voicemail.'],
      ['Dana', 'voicemail · 0:12', 'Hey, it is Dana, call me back.'],
    ])
  })

  it('clips long words at a word and keeps an empty thread empty', () => {
    const long = line({ id: 'm-long', body: `${'word '.repeat(60)}end` })
    const got = lastLinesOnJob([long])[0]!
    expect(got.words.length).toBeLessThanOrEqual(LAST_LINE_WORDS_MAX + 1)
    expect(got.words.endsWith('…')).toBe(true)
    expect(got.words).not.toContain('  ')
    expect(lastLinesOnJob([note])).toEqual([])
  })

  it('writes the meta line as who, how and when', () => {
    expect(lastLineMeta({ name: 'Dana', channel: 'text', at: '2026-10-17T21:31:00.000Z' }, '2026-10-18T15:00:00.000Z')).toBe('Dana · text · yesterday')
    expect(lastLineMeta({ name: 'Tanya', channel: 'email', at: '2026-10-18T13:44:00.000Z' }, '2026-10-18T15:00:00.000Z')).toBe('Tanya · email · today at 8:44 AM')
  })
})
