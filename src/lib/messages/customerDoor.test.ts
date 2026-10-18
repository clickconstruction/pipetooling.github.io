import { describe, expect, it } from 'vitest'
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import { customerDoorRows, lastWordOnJob, lastWordWords, NO_EMAIL_WORDS, NO_MOBILE_AT_ALL_WORDS, NO_MOBILE_WORDS, NO_NUMBER_WORDS } from './customerDoor'

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
