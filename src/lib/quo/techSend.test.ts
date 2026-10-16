/**
 * quo-send's tech path over the residential prototype's phone lines (v0.8, branch spike/gc-mode): Luis on Dana's job,
 * On our way with its minutes, What we found with its words, and lines that never reach the phone.
 */
import { describe, expect, it } from 'vitest'
import { jobModeFills } from '../jobModeText'
import { plainWordsFailures } from '../plainWords'
import type { BioLine } from '../bio/bio'
import { LINE_IDS_MAX, TECH_SEND_WORDS, TYPED_MAX, composeBioText, composeTechText, isJobModeSend, parseTechSendBody, pickPhone, type PhoneLineRecord } from './techSend'

const line = (set: Partial<PhoneLineRecord>): PhoneLineRecord => ({
  text: '{first}, this is {me} with Click Plumbing. We are on our way to {address}, about {minutes} minutes out.',
  textEs: '{first}, le habla {me} de Click Plumbing. Vamos en camino a {address}, llegamos en unos {minutes} minutos.',
  forKind: 'customer',
  scope: 'team',
  phoneOrder: 1,
  removed: false,
  ...set,
})

const APP = jobModeFills({
  customerName: 'Dana Whitfield',
  me: 'Luis Ortega',
  jobName: 'Oakridge sewer line',
  jobAddress: '1418 Oakridge Dr',
  blocks: [{ workDate: '2026-10-13', timeStart: '09:30:00', timeEnd: '11:00:00' }],
  today: '2026-10-13',
})

const REQUEST = { from: 'job_mode', customerId: 'cust-dana', contactId: null, jobId: 'job-1312', quickReplyId: 'r2', fills: { minutes: ' 15 ' } }

describe('the tech path’s request', () => {
  it('is Job Mode’s by its from, and reads the ids and the typed blanks, never a body', () => {
    expect(isJobModeSend(REQUEST)).toBe(true)
    expect(isJobModeSend({ ...REQUEST, from: 'box' })).toBe(false)
    expect(parseTechSendBody({ ...REQUEST, body: 'Anything at all' })).toEqual({
      ok: true,
      body: { kind: 'line', customerId: 'cust-dana', contactId: null, jobId: 'job-1312', quickReplyId: 'r2', fills: { minutes: '15' }, lineIds: [] },
    })
    expect(parseTechSendBody({ ...REQUEST, contactId: ' c-dana ', fills: undefined })).toMatchObject({ ok: true, body: { contactId: 'c-dana', fills: {} } })
  })

  it('refuses a missing id, and a typed blank that is long, broken over lines, or not a blank', () => {
    expect(parseTechSendBody({ ...REQUEST, jobId: ' ' })).toEqual({ ok: false, words: TECH_SEND_WORDS.badRequest })
    expect(parseTechSendBody({ ...REQUEST, fills: { minutes: 'x'.repeat(TYPED_MAX + 1) } })).toEqual({ ok: false, words: TECH_SEND_WORDS.badFill })
    expect(parseTechSendBody({ ...REQUEST, fills: { found: 'a cracked\nclean-out' } })).toEqual({ ok: false, words: TECH_SEND_WORDS.badFill })
    expect(parseTechSendBody({ ...REQUEST, fills: { 'BODY!': 'x' } })).toEqual({ ok: false, words: TECH_SEND_WORDS.badFill })
    expect(parseTechSendBody({ ...REQUEST, fills: { minutes: 15 } })).toEqual({ ok: false, words: TECH_SEND_WORDS.badFill })
    expect(parseTechSendBody({ ...REQUEST, fills: { found: 'x'.repeat(TYPED_MAX) } })).toMatchObject({ ok: true })
  })
})

describe('the text the server makes', () => {
  it('fills the line from the record and the tech’s minutes', () => {
    expect(composeTechText(line({}), APP, { minutes: '15' }, 'en')).toEqual({
      ok: true,
      text: 'Dana, this is Luis with Click Plumbing. We are on our way to 1418 Oakridge Dr, about 15 minutes out.',
    })
    expect(composeTechText(line({}), APP, { minutes: '15' }, 'es')).toEqual({
      ok: true,
      text: 'Dana, le habla Luis de Click Plumbing. Vamos en camino a 1418 Oakridge Dr, llegamos en unos 15 minutos.',
    })
  })

  it('never lets a typed word stand in for what the record holds', () => {
    expect(composeTechText(line({}), APP, { minutes: '15', first: 'Call 555-0100 now', address: 'anywhere' }, 'en')).toMatchObject({
      text: 'Dana, this is Luis with Click Plumbing. We are on our way to 1418 Oakridge Dr, about 15 minutes out.',
    })
  })

  it('refuses while a blank is open', () => {
    expect(composeTechText(line({}), APP, {}, 'en')).toEqual({ ok: false, refused: 'blankOpen', words: 'Fill {minutes} first. The app does not know it.' })
    expect(composeTechText(line({ text: '{first}, here is what we found: {found}.', textEs: null }), APP, {}, 'en')).toMatchObject({ refused: 'blankOpen' })
  })

  it('refuses a line that is not on the phone, or needs money or the page link', () => {
    for (const set of [{ phoneOrder: null }, { removed: true }, { scope: 'mine' }, { forKind: 'trade' }]) {
      expect(composeTechText(line(set), APP, { minutes: '15' }, 'en'), JSON.stringify(set)).toEqual({ ok: false, refused: 'notOnPhone', words: TECH_SEND_WORDS.notOnPhone })
    }
    expect(composeTechText(line({ text: '{first}, your bill is {amount}.', textEs: null }), APP, {}, 'en')).toMatchObject({ refused: 'offPhone' })
    expect(composeTechText(line({ text: '{first}, see it here: {link}.', textEs: null }), APP, {}, 'en')).toMatchObject({ refused: 'offPhone' })
    expect(composeTechText(line({ textEs: 'Pague aquí: {link}.' }), APP, { minutes: '15' }, 'en')).toMatchObject({ refused: 'offPhone' })
  })
})

describe('the number it goes to', () => {
  const phones = [
    { id: 'p2', kind: 'phone', value: '512-555-0177', createdAt: '2026-10-02T15:00:00.000Z' },
    { id: 'e1', kind: 'email', value: 'dana@example.com', createdAt: '2026-09-01T15:00:00.000Z' },
    { id: 'p1', kind: 'phone', value: '512-555-0144', createdAt: '2026-09-30T15:00:00.000Z' },
  ]

  it('is the one they last texted from, else their first phone, else none', () => {
    expect(pickPhone(phones, 'p2')?.id).toBe('p2')
    expect(pickPhone(phones, null)?.id).toBe('p1')
    expect(pickPhone(phones, 'e1')?.id).toBe('p1')
    expect(pickPhone(phones.filter((c) => c.kind === 'email'), null)).toBeNull()
    expect(pickPhone([{ id: 'p3', kind: 'phone', value: ' ', createdAt: '2026-10-01T00:00:00.000Z' }], null)).toBeNull()
  })
})

describe('plain words', () => {
  it('holds every refusal the sheet shows', () => {
    expect(Object.values(TECH_SEND_WORDS).flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})

describe('the bio kind (v2.5590)', () => {
  const BIO_REQUEST = { from: 'job_mode', kind: 'bio', customerId: 'cust-dana', contactId: 'contact-dana', jobId: 'job-512', lineIds: ['b1', 'b1', ' b2 '] }

  it('reads a bio request: the ids once each, trimmed, with no line and no fills', () => {
    expect(parseTechSendBody({ ...BIO_REQUEST, body: 'Anything at all', fills: { minutes: '9' } })).toEqual({
      ok: true,
      body: { kind: 'bio', customerId: 'cust-dana', contactId: 'contact-dana', jobId: 'job-512', quickReplyId: null, fills: {}, lineIds: ['b1', 'b2'] },
    })
    expect(parseTechSendBody({ ...BIO_REQUEST, lineIds: undefined })).toMatchObject({ ok: true, body: { kind: 'bio', lineIds: [] } })
    expect(parseTechSendBody({ ...BIO_REQUEST, contactId: null })).toMatchObject({ ok: true, body: { contactId: null } })
  })

  it('refuses a pick that is not a list of ids, too many ids, and a bio with no job', () => {
    expect(parseTechSendBody({ ...BIO_REQUEST, lineIds: 'b1' })).toEqual({ ok: false, words: TECH_SEND_WORDS.badPick })
    expect(parseTechSendBody({ ...BIO_REQUEST, lineIds: ['b1', 7] })).toEqual({ ok: false, words: TECH_SEND_WORDS.badPick })
    expect(parseTechSendBody({ ...BIO_REQUEST, lineIds: ['not an id!'] })).toEqual({ ok: false, words: TECH_SEND_WORDS.badPick })
    expect(parseTechSendBody({ ...BIO_REQUEST, lineIds: Array.from({ length: LINE_IDS_MAX + 1 }, (_, i) => `b${i}`) })).toEqual({ ok: false, words: TECH_SEND_WORDS.badPick })
    expect(parseTechSendBody({ ...BIO_REQUEST, jobId: '' })).toEqual({ ok: false, words: TECH_SEND_WORDS.badRequest })
    // A line request still needs its line.
    expect(parseTechSendBody({ from: 'job_mode', customerId: 'c', jobId: 'j' })).toEqual({ ok: false, words: TECH_SEND_WORDS.badRequest })
  })

  const bioLine = (id: string, text: string, set: Partial<BioLine> = {}): BioLine => ({ id, text, textEs: null, position: 1, addedAt: 0, removed: false, offByUser: false, ...set })
  const LUIS: BioLine[] = [
    bioLine('b1', 'Luis has been a plumber for twelve years.', { position: 1, textEs: 'Luis es plomero desde hace doce años.' }),
    bioLine('b2', 'Water heaters are his specialty.', { position: 2, textEs: 'Su especialidad son los calentadores.' }),
    bioLine('b3', 'Off the clock he coaches Little League.', { position: 3 }),
    bioLine('b4', 'He is an Astros fan.', { position: 4, textEs: 'Es aficionado de los Astros.', offByUser: true }),
    bioLine('b0', 'He drove a white van.', { position: 5, removed: true }),
  ]

  it('composes the bio from the pick, in the office’s order, in the customer’s language', () => {
    expect(composeBioText(LUIS, ['b4', 'b1'], 'Luis', 'en')).toEqual({ ok: true, text: 'A little about Luis: Luis has been a plumber for twelve years. He is an Astros fan.', lineIds: ['b1', 'b4'] })
    expect(composeBioText(LUIS, ['b1', 'b2', 'b3'], 'Luis', 'es')).toEqual({ ok: true, text: 'Un poco sobre Luis: Luis es plomero desde hace doce años. Su especialidad son los calentadores.', lineIds: ['b1', 'b2'] })
  })

  it('refuses an id that is not the sender’s live line, and a pick with nothing to say', () => {
    expect(composeBioText(LUIS, ['b1', 'zz'], 'Luis', 'en')).toEqual({ ok: false, refused: 'notYourLine', words: TECH_SEND_WORDS.notYourLine })
    expect(composeBioText(LUIS, ['b0'], 'Luis', 'en')).toEqual({ ok: false, refused: 'notYourLine', words: TECH_SEND_WORDS.notYourLine })
    expect(composeBioText(LUIS, [], 'Luis', 'en')).toEqual({ ok: false, refused: 'nothingToSay', words: TECH_SEND_WORDS.nothingToSay })
    expect(composeBioText(LUIS, ['b3'], 'Luis', 'es')).toEqual({ ok: false, refused: 'nothingToSay', words: TECH_SEND_WORDS.nothingToSay })
    expect(composeBioText([], [], 'Luis', 'en')).toMatchObject({ ok: false, refused: 'nothingToSay' })
  })

  it('the bio’s words are plain', () => {
    for (const words of [TECH_SEND_WORDS.badPick, TECH_SEND_WORDS.nothingToSay, TECH_SEND_WORDS.notYourLine, TECH_SEND_WORDS.alreadyIntroduced]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})
