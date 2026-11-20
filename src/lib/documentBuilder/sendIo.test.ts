import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { contactsOf, pageFromLinks, sendRecordFromRow } from './sendIo'
import { DOCUMENT_BUILDER_SEND_REFUSALS, parseSheetSend, sheetSendEmail, sheetSendMessageKey } from './sendWords'
import { plainWordsFailures } from '../plainWords'

describe('where a party’s own page stands', () => {
  it('is on with a link that is on, none with no link ever, and off once every link was turned off', () => {
    expect(pageFromLinks([{ revoked_at: '2026-10-03T15:00:00Z' }, { revoked_at: null }])).toEqual({ state: 'on' })
    expect(pageFromLinks([])).toEqual({ state: 'none' })
    expect(pageFromLinks([{ revoked_at: '2026-09-01T15:00:00Z' }, { revoked_at: '2026-10-03T15:00:00Z' }])).toEqual({ state: 'off', offOn: '2026-10-03' })
  })
})

describe('who a send can go to', () => {
  it('is the main contact, then the company’s people, each with an email and none twice', () => {
    expect(
      contactsOf({ contact_name: 'Ana Pruitt', email: 'ana@cedarfork.test' }, [
        { name: 'Ana Pruitt', email: 'ANA@cedarfork.test', role: 'owner' },
        { name: 'Bo Reyes', email: 'bo@cedarfork.test', role: ' office ' },
        { name: 'No Email', email: '', role: null },
      ]),
    ).toEqual([
      { name: 'Ana Pruitt', email: 'ana@cedarfork.test' },
      { name: 'Bo Reyes', email: 'bo@cedarfork.test', role: 'office' },
    ])
    expect(contactsOf({ contact_name: null, email: null }, [])).toEqual([])
    expect(contactsOf({ contact_name: '', email: 'desk@cedarfork.test' }, [])).toEqual([{ name: 'desk@cedarfork.test', email: 'desk@cedarfork.test' }])
  })
})

describe('a send as the table keeps it', () => {
  it('reads its days in the company’s own zone', () => {
    expect(sendRecordFromRow({ id: 's1', contact_name: 'Ana Pruitt', sent_at: '2026-11-13T03:30:00Z', sent_revision: 1, times_sent: 2, opened_at: null, opened_revision: null })).toEqual({ id: 's1', contactName: 'Ana Pruitt', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 2, openedOn: null, openedRevision: null })
  })
})

describe('the send’s shared rules', () => {
  const ask = { builderKey: 'insurance', sheetId: '00000000-0000-0000-0000-0000004043a0', companyId: '00000000-0000-0000-0000-0000004043e1', contactEmail: ' Ana@CedarFork.test ', note: ' A made-up note. ', why: 'first' }

  it('reads a whole ask, trimmed, and nothing from one that is not whole', () => {
    expect(parseSheetSend(ask)).toEqual({ builderKey: 'insurance', sheetId: ask.sheetId, companyId: ask.companyId, contactEmail: 'ana@cedarfork.test', note: 'A made-up note.', why: 'first', anyway: false, test: false })
    expect(parseSheetSend({ ...ask, anyway: true, test: true })).toMatchObject({ anyway: true, test: true })
    for (const bad of [null, {}, { ...ask, sheetId: 'nope' }, { ...ask, contactEmail: 'not an email' }, { ...ask, why: 'whenever' }, { ...ask, builderKey: 'Insurance' }, { ...ask, note: 'x'.repeat(2001) }]) expect(parseSheetSend(bad)).toBeNull()
  })

  it('words the email by why it goes, with the note first and the sheet’s own link when it has one', () => {
    const first = sheetSendEmail({ job: 'Cedar Park Medical Office', note: 'A made-up note.', why: 'first', sheetUrl: 'https://app.example/d/abcdefgh23456789' })
    expect(first.subject).toBe('Insurance requirements for Cedar Park Medical Office')
    expect(first.lines).toEqual([
      'A made-up note.',
      'The sheet says what your certificate of insurance must show on Cedar Park Medical Office. It is on your page.',
      'Your insurance agent can open the sheet with this link. It needs no login: https://app.example/d/abcdefgh23456789',
      'Send us the certificate from your page. You can also reply to this email with it.',
    ])
    expect(sheetSendEmail({ job: 'Cedar Park Medical Office', note: '', why: 'again', sheetUrl: null }).subject).toBe('A reminder: insurance requirements for Cedar Park Medical Office')
    const changed = sheetSendEmail({ job: 'Cedar Park Medical Office', note: '', why: 'changed', sheetUrl: null })
    expect(changed.subject).toBe('The insurance requirements for Cedar Park Medical Office changed')
    expect(changed.lines[0]).toBe('The insurance requirements for Cedar Park Medical Office changed since you opened them. The new sheet is on your page.')
    expect(changed.lines).toHaveLength(2)
  })

  it('keys the message on the company’s thread by the send and the time it went', () => {
    expect(sheetSendMessageKey('s1', 2)).toBe('builder-send:s1:2')
  })

  it('reads in plain words', () => {
    const texts = [...Object.values(DOCUMENT_BUILDER_SEND_REFUSALS).map((r) => r.words), ...sheetSendEmail({ job: 'a job', note: '', why: 'first', sheetUrl: 'a link' }).lines, ...sheetSendEmail({ job: 'a job', note: '', why: 'changed', sheetUrl: null }).lines]
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
