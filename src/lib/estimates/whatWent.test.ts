import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { atWords, whatWentRows, WHAT_WENT_WORDS, type WhatWentFacts } from './whatWent'

// 1:31 PM in Chicago on Tue Oct 20 (CDT); the text two minutes later.
const SENT = Date.parse('2026-10-20T18:31:00Z')
const TEXTED = Date.parse('2026-10-20T18:33:00Z')
const CONTACT = { contactId: 'contact-dana', hasPhone: true, stopped: false }
const facts = (set: Partial<WhatWentFacts> = {}): WhatWentFacts => ({ email: 'dana@example.com', sentAtMs: SENT, texts: [{ id: 'm1', atMs: TEXTED, to: '(830) 555-0121' }], contact: CONTACT, ...set })

describe('whatWentRows (v2.5683, punch list #133)', () => {
  it('the email with its time, then each text with the thread door', () => {
    expect(atWords(SENT)).toBe('Tue, Oct 20 at 1:31 PM')
    expect(whatWentRows(facts(), 'Dana Whitfield')).toEqual([
      { icon: '📧', words: 'Emailed to dana@example.com', when: 'Tue, Oct 20 at 1:31 PM', thread: false, hold: false },
      { icon: '💬', words: 'Texted the link to (830) 555-0121', when: 'Tue, Oct 20 at 1:33 PM', thread: true, hold: false },
    ])
  })
  it('a resend is its own row, and a number the thread lost reads their number', () => {
    const rows = whatWentRows(facts({ texts: [{ id: 'm1', atMs: TEXTED, to: '(830) 555-0121' }, { id: 'm2', atMs: TEXTED + 3600_000, to: null }] }), 'Dana Whitfield')
    expect(rows.map((r) => r.words)).toEqual(['Emailed to dana@example.com', 'Texted the link to (830) 555-0121', 'Texted the link to their number'])
  })
  it('no text says why: no thread or phone, STOP, or nothing stopped it', () => {
    expect(whatWentRows(facts({ texts: [], contact: null }), 'Dana Whitfield')[1]).toEqual({ icon: '💬', words: 'No text went. Dana has no phone number on file.', when: null, thread: false, hold: true })
    expect(whatWentRows(facts({ texts: [], contact: { ...CONTACT, hasPhone: false } }), null)[1]?.words).toBe('No text went. They have no phone number on file.')
    expect(whatWentRows(facts({ texts: [], contact: { ...CONTACT, stopped: true } }), 'Dana Whitfield')[1]).toMatchObject({ words: 'No text went. Their number sent STOP. The email carries the link.', thread: true, hold: true })
    expect(whatWentRows(facts({ texts: [] }), 'Dana Whitfield')[1]).toMatchObject({ words: 'No text went with the link. Send one from their thread.', thread: true })
  })
  it('an estimate with no stored email still reads its texts', () => {
    const rows = whatWentRows(facts({ email: null }), 'Dana Whitfield')
    expect(rows.map((r) => r.icon)).toEqual(['💬'])
  })
  it('the card’s words are plain (a phone number is the screen’s value, not prose, so the sweep reads the number-free rows)', () => {
    const read = [
      WHAT_WENT_WORDS.title,
      WHAT_WENT_WORDS.thread,
      WHAT_WENT_WORDS.reading,
      ...whatWentRows(facts({ texts: [{ id: 'm1', atMs: TEXTED, to: null }] }), 'Dana Whitfield').map((r) => r.words),
      ...whatWentRows(facts({ texts: [], contact: null }), 'Dana Whitfield').map((r) => r.words),
      ...whatWentRows(facts({ texts: [], contact: { ...CONTACT, stopped: true } }), 'Dana Whitfield').map((r) => r.words),
      ...whatWentRows(facts({ texts: [] }), 'Dana Whitfield').map((r) => r.words),
    ]
    for (const words of read) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('whatWentRows · the letters sent again (v2.5997)', () => {
  it('a resend and a remail each get their row after the email, saying which kept the link', () => {
    const rows = whatWentRows(
      {
        email: 'clerk@zz-test.example',
        sentAtMs: Date.parse('2026-09-24T18:31:00Z'),
        emailsAgain: [
          { id: 'c1', atMs: Date.parse('2026-10-08T15:00:00Z'), to: 'clerk@zz-test.example', kind: 'resent' },
          { id: 'c2', atMs: Date.parse('2026-10-27T19:20:00Z'), to: null, kind: 'remailed' },
        ],
        texts: [],
        contact: null,
      },
      'ZZ',
    )
    expect(rows.slice(0, 3).map((r) => r.words)).toEqual([
      'Emailed to clerk@zz-test.example',
      'Emailed again to clerk@zz-test.example, a fresh link',
      'Emailed again to clerk@zz-test.example, same link',
    ])
    expect(rows[2]!.when).toMatch(/Oct 27/)
  })
})
