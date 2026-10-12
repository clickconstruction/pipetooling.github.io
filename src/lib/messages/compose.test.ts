/**
 * The reply box's words and rules, over the Messages prototype's made-up people (v1.178, branch spike/gc-mode):
 * Click Construction's one number and mailbox, Robert and Rosa sending, Greg, Tom, Elena, Dr. Priya Raman and an
 * unknown number receiving. The prototype's clock is Fri Oct 2, 2026, 11:45 AM.
 */
import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import { DEMO_CONTACTS } from './messagesDemo'
import {
  EMAIL_SOURCES_NOTE,
  GSM7_BASIC_SIZE,
  NOTE_ASIDE,
  OPTOUT_HOLD_TIP,
  OPTOUT_SILENCE_DAYS,
  REPLY_KINDS,
  SIGNATURE_REPLY_LINE,
  SUBJECT_BLANK,
  SUBJECT_MAX,
  TEXT_FROM_NOTE,
  boxPlaceholder,
  canHoldOptout,
  canSend,
  countLine,
  daysSinceOurLastText,
  defaultReplyKind,
  emailDraft,
  emailFooter,
  emailGreeting,
  fromHeader,
  fromLine,
  goesOut,
  optoutBubble,
  optoutHoldNote,
  optoutLine,
  optoutReason,
  optoutRecord,
  replyRecipient,
  sendWarnings,
  sentCopyNote,
  sentWords,
  signatureLines,
  subjectFor,
  textBoxBlocked,
  textSegments,
  textToSend,
  type ComposeCompany,
  type ReplyRecipient,
} from './compose'

const at = (month: number, day: number, hour = 9, minute = 0) => Date.UTC(2026, month - 1, day, hour, minute)
const NOW = at(10, 2, 11, 45)

const CLICK: ComposeCompany = {
  name: 'Click Construction',
  phone: '(210) 555-0100',
  mailbox: 'bids@clickconstruction.example',
  address: 'San Antonio, Texas',
}
const ROBERT = { name: 'Robert', title: 'Estimator', cell: '(210) 555-0199' }
const ROSA = { name: 'Rosa', title: 'Office', cell: null }

const GREG: ReplyRecipient = { name: 'Greg Paulk', number: '(210) 555-0113', numberOptedOut: false, email: 'greg@hillside.example' }
const TOM: ReplyRecipient = { name: 'Tom Riddle', number: '(210) 555-0130', numberOptedOut: false, email: null }
const ELENA: ReplyRecipient = { name: 'Elena Marchetti', number: '(210) 555-0188', numberOptedOut: false, email: 'elena@cibolocreek.example' }
const UNKNOWN: ReplyRecipient = { name: '(830) 555-0172', number: '(830) 555-0172', numberOptedOut: false, email: null }
const GREG_STOPPED: ReplyRecipient = { ...GREG, numberOptedOut: true }

// Our last texts, from the prototype's thread: Robert texted Greg Wed Sep 30 at 9:40, Rosa texted Bill this morning.
// Priya, Elena and the unknown number have never had a text from us. Bill's quiet spell is made up for the silence rule.
const GREG_LAST = at(9, 30, 9, 40)
const BILL_LAST_IN_AUGUST = at(8, 31, 16, 0)

describe('the kinds row', () => {
  it('runs Text, Email, Note, each with its own Send', () => {
    expect(REPLY_KINDS.map((k) => `${k.label}: ${k.send}`)).toEqual(['Text: Send text…', 'Email: Send email…', 'Note: Add the note'])
    expect(NOTE_ASIDE).toEqual(['only the team sees it', 'closes the row'])
  })

  it('shows the outside pieces only for a text or an email', () => {
    expect(goesOut('text')).toBe(true)
    expect(goesOut('email')).toBe(true)
    expect(goesOut('note')).toBe(false)
  })

  it('asks for the words by the person, or for the team', () => {
    expect(boxPlaceholder('text', 'Greg Paulk')).toBe('Write to Greg Paulk…')
    expect(boxPlaceholder('email', 'Elena Marchetti')).toBe('Write to Elena Marchetti…')
    expect(boxPlaceholder('note', 'Greg Paulk')).toBe('A note only the team sees…')
  })

  it('starts as a text when the number can take one, else as an email', () => {
    expect(defaultReplyKind(GREG)).toBe('text')
    expect(defaultReplyKind(TOM)).toBe('text')
    expect(defaultReplyKind(GREG_STOPPED)).toBe('email')
    expect(defaultReplyKind({ ...ELENA, number: null })).toBe('email')
    // No way through at all: a text, whose box says why.
    expect(defaultReplyKind({ ...TOM, numberOptedOut: true })).toBe('text')
  })

  it('holds the box shut only on a text to a number that sent STOP', () => {
    expect(textBoxBlocked('text', GREG_STOPPED)).toBe('They sent STOP. The app will not text this number.')
    expect(textBoxBlocked('email', GREG_STOPPED)).toBeNull()
    expect(textBoxBlocked('note', GREG_STOPPED)).toBeNull()
    expect(textBoxBlocked('text', GREG)).toBeNull()
  })
})

describe('the recipient, from the spine’s contact', () => {
  const demo = (id: string): Contact => {
    const c = DEMO_CONTACTS.find((x) => x.id === id)
    if (!c) throw new Error(`no ${id}`)
    return c
  }

  it('takes their name, their number and their address', () => {
    expect(replyRecipient(demo('greg'))).toEqual({
      name: 'Greg Paulk',
      number: '(210) 555-0113',
      numberOptedOut: false,
      email: 'greg@hillside.example',
      numberChannelId: 'greg-phone',
      emailChannelId: 'greg-email',
    })
    expect(replyRecipient(demo('tom'))).toMatchObject({ number: '(210) 555-0130', email: null, emailChannelId: null })
    expect(replyRecipient(demo('unk1'))).toMatchObject({ name: '(830) 555-0172', number: '(830) 555-0172', email: null })
  })

  it('texts the next number when one sent STOP, and says so when every number has', () => {
    const greg = demo('greg')
    const stopped = { id: 'greg-phone', kind: 'phone' as const, value: '(210) 555-0113', optedOutAt: '2026-10-01T15:00:00.000Z' }
    const cell = { id: 'greg-cell', kind: 'phone' as const, value: '(210) 555-0199', optedOutAt: null }
    expect(replyRecipient({ ...greg, channels: [stopped, cell] })).toMatchObject({ number: '(210) 555-0199', numberOptedOut: false, numberChannelId: 'greg-cell' })
    expect(replyRecipient({ ...greg, channels: [stopped] })).toMatchObject({ number: '(210) 555-0113', numberOptedOut: true })
    expect(defaultReplyKind(replyRecipient({ ...greg, channels: [stopped, greg.channels[1]!] }))).toBe('email')
  })
})

describe('the from line', () => {
  it('names our one number or our one mailbox, never a person’s own', () => {
    expect(fromLine('text', CLICK)).toEqual(['from the company number (210) 555-0100', 'Click Construction'])
    expect(fromLine('email', CLICK)).toEqual(['from bids@clickconstruction.example', 'Click Construction'])
    expect(fromLine('note', CLICK)).toEqual([])
    expect(fromHeader(CLICK)).toBe('Click Construction <bids@clickconstruction.example>')
  })
})

describe('the email', () => {
  it('takes its subject from the job and the first line, without its closing stop', () => {
    expect(subjectFor('Boerne Retail Shell', 'Checking on the number. Still good for today?\nThanks.', CLICK)).toBe(
      'Boerne Retail Shell: Checking on the number. Still good for today',
    )
    expect(subjectFor(null, 'Got it, thank you.', CLICK)).toBe('Got it, thank you')
    expect(subjectFor(null, '   ', CLICK)).toBe('A note from Click Construction')
    expect(subjectFor('Helotes Dental Office', '', CLICK)).toBe('Helotes Dental Office: A note from Click Construction')
  })

  it('reads the first line after a blank one, so the count line and the send window agree', () => {
    expect(subjectFor(null, '\n\nThe change order is in your portal to sign.', CLICK)).toBe('The change order is in your portal to sign')
  })

  it('cuts a long first line at a whole word', () => {
    const subject = subjectFor(null, 'Pay application 3 for Fair Oaks Shops, Building D, is in the portal for your certificate today', CLICK)
    expect(subject).toBe('Pay application 3 for Fair Oaks Shops, Building D, is in the…')
    expect(subject.length).toBeLessThanOrEqual(SUBJECT_MAX + 1)
    // A word running past the cut goes whole.
    expect(subjectFor(null, 'Pay application 3 for Fair Oaks Shops, Building D, is in theory late, sorry', CLICK)).toBe(
      'Pay application 3 for Fair Oaks Shops, Building D, is in…',
    )
    // One long word is cut where it falls.
    expect(subjectFor(null, 'x'.repeat(70), CLICK)).toBe(`${'x'.repeat(60)}…`)
  })

  it('keeps the subject typed in the send window, for this one email', () => {
    expect(subjectFor('Boerne Retail Shell', 'Got it.', CLICK, 'Addendum 2 questions')).toBe('Addendum 2 questions')
    expect(subjectFor('Boerne Retail Shell', 'Got it.', CLICK, '   ')).toBe('Boerne Retail Shell: Got it')
    expect(SUBJECT_BLANK).toBe('Type a subject, or Cancel.')
  })

  it('greets by the name the caller reads, or with no name', () => {
    expect(emailGreeting('Dr. Raman')).toBe('Hello Dr. Raman,')
    expect(emailGreeting('Gregory')).toBe('Hello Gregory,')
    expect(emailGreeting('')).toBe('Hello,')
  })

  it('signs with the sender’s name, title and own cell, then the reply line', () => {
    expect(signatureLines(ROBERT)).toEqual(['Robert · Estimator', 'cell (210) 555-0199', 'Email back, text, or call.'])
    expect(signatureLines(ROSA)).toEqual(['Rosa · Office', SIGNATURE_REPLY_LINE])
    expect(signatureLines({ name: 'Wendi' })).toEqual(['Wendi', SIGNATURE_REPLY_LINE])
  })

  it('closes with the company, where it is and the job', () => {
    expect(emailFooter(CLICK, 'Fair Oaks Shops, Building D')).toBe('Click Construction, San Antonio, Texas. About Fair Oaks Shops, Building D.')
    expect(emailFooter({ ...CLICK, address: '' }, null)).toBe('Click Construction.')
  })

  it('keeps our note about the sent copy apart from their footer', () => {
    expect(sentCopyNote(0)).toBe('A copy of this email is kept in Documents.')
    expect(sentCopyNote(1)).toBe('A copy of this email is kept in Documents, with its file.')
    expect(sentCopyNote(2)).toBe('A copy of this email is kept in Documents, with its files.')
  })

  it('draws the whole email from one place', () => {
    const draft = emailDraft({
      company: CLICK,
      sender: ROSA,
      to: ELENA,
      greetingName: 'Elena',
      jobName: 'Fair Oaks Shops, Building D',
      body: '  Pay application 3 is in your portal.\n\nThe architect has it for the certificate.  ',
    })
    expect(draft).toEqual({
      from: 'Click Construction <bids@clickconstruction.example>',
      to: 'elena@cibolocreek.example',
      subject: 'Fair Oaks Shops, Building D: Pay application 3 is in your portal',
      greeting: 'Hello Elena,',
      body: 'Pay application 3 is in your portal.\n\nThe architect has it for the certificate.',
      signature: ['Rosa · Office', 'Email back, text, or call.'],
      footer: 'Click Construction, San Antonio, Texas. About Fair Oaks Shops, Building D.',
    })
    expect(emailDraft({ company: CLICK, sender: ROSA, to: TOM, greetingName: '', jobName: null, body: 'x' }).to).toBeNull()
  })
})

describe('the pieces a text arrives in', () => {
  it('holds 160 places in one text and 153 in each piece after', () => {
    expect(textSegments('')).toEqual({ characters: 0, segments: 0, encoding: 'gsm7' })
    expect(textSegments('a'.repeat(160))).toEqual({ characters: 160, segments: 1, encoding: 'gsm7' })
    expect(textSegments('a'.repeat(161)).segments).toBe(2)
    expect(textSegments('a'.repeat(306)).segments).toBe(2)
    expect(textSegments('a'.repeat(307)).segments).toBe(3)
  })

  it('counts an extension character as two places and never splits one', () => {
    expect(textSegments('€'.repeat(80))).toEqual({ characters: 80, segments: 1, encoding: 'gsm7' })
    // 81 euro signs are 162 places: 76 fit the first piece, as a 77th would make 154.
    expect(textSegments('€'.repeat(81)).segments).toBe(2)
    expect(textSegments('[ok]').encoding).toBe('gsm7')
  })

  it('sends a text with one character outside the alphabet at 70 a text', () => {
    expect(textSegments('Mañana a las 7, en la obra.').encoding).toBe('gsm7')
    expect(textSegments('¿Está listo el número para hoy?').encoding).toBe('ucs2')
    expect(textSegments('Greg’s number is in.').encoding).toBe('ucs2')
    expect(textSegments('á'.repeat(70)).segments).toBe(1)
    expect(textSegments('á'.repeat(71)).segments).toBe(2)
    expect(textSegments('á'.repeat(134)).segments).toBe(2)
    expect(textSegments('á'.repeat(135)).segments).toBe(3)
  })

  it('counts an emoji as one character and two units', () => {
    expect(textSegments('👍'.repeat(35))).toEqual({ characters: 35, segments: 1, encoding: 'ucs2' })
    expect(textSegments('👍'.repeat(36))).toEqual({ characters: 36, segments: 2, encoding: 'ucs2' })
  })

  it('knows the carriers’ basic table, its Greek capitals and its accents', () => {
    expect(GSM7_BASIC_SIZE).toBe(127)
    expect(textSegments('ΔΦΓΛΩΠΨΣΘΞ').encoding).toBe('gsm7')
    // The ohm sign and the increment look like Ω and Δ but are not in it.
    expect(textSegments('\u2126').encoding).toBe('ucs2')
    expect(textSegments('\u2206').encoding).toBe('ucs2')
    expect(textSegments('é è ù ì ò à Ñ ñ Ü ü ¿ ¡').encoding).toBe('gsm7')
    expect(textSegments(optoutLine(CLICK)).encoding).toBe('gsm7')
  })
})

describe('the opt-out line: the two rules', () => {
  it('names the company and how to stop', () => {
    expect(optoutLine(CLICK)).toBe('Click Construction. Reply STOP to opt out.')
  })

  it('rides on the first text we ever send the number', () => {
    expect(optoutReason(null, NOW)).toBe('first')
    expect(daysSinceOurLastText(null, NOW)).toBeNull()
  })

  it('stays off while the conversation is live', () => {
    expect(daysSinceOurLastText(GREG_LAST, NOW)).toBe(2)
    expect(optoutReason(GREG_LAST, NOW)).toBeNull()
  })

  it('rides again once our last text is 30 days old', () => {
    expect(OPTOUT_SILENCE_DAYS).toBe(30)
    expect(daysSinceOurLastText(BILL_LAST_IN_AUGUST, NOW)).toBe(31)
    expect(optoutReason(BILL_LAST_IN_AUGUST, NOW)).toBe('silence')
    expect(optoutReason(NOW - 30 * 86_400_000, NOW)).toBe('silence')
    expect(optoutReason(NOW - 30 * 86_400_000 + 60_000, NOW)).toBeNull()
  })

  it('may be held back once on the silence, never on a first text', () => {
    expect(canHoldOptout('silence')).toBe(true)
    expect(canHoldOptout('first')).toBe(false)
    expect(canHoldOptout(null)).toBe(false)
    expect(optoutRecord('silence', true)).toBe('held')
    expect(optoutRecord('silence', false)).toBe('silence')
    expect(optoutRecord('first', true)).toBe('first')
    expect(optoutRecord(null, true)).toBeNull()
  })

  it('goes on the end of the one text, after a blank line, and counts in its pieces', () => {
    const body = 'Dr. Raman, the start date is Monday, Oct 12. The crew arrives at 7.'
    const sent = textToSend({ body, reason: optoutReason(null, NOW), company: CLICK })
    expect(sent.text).toBe(`${body}\n\nClick Construction. Reply STOP to opt out.`)
    expect(sent).toMatchObject({ withLine: true, optout: 'first', segments: 1, encoding: 'gsm7' })
    expect(sent.characters).toBe(body.length + 2 + optoutLine(CLICK).length)
  })

  it('refuses a hold on a first text', () => {
    expect(textToSend({ body: 'Hi', reason: 'first', held: true, company: CLICK })).toMatchObject({ withLine: true, optout: 'first' })
  })

  it('records a hold on the silence and sends without the line', () => {
    const sent = textToSend({ body: 'Bill, are you free for the Stone Oak walk Monday?', reason: 'silence', held: true, company: CLICK })
    expect(sent.text).toBe('Bill, are you free for the Stone Oak walk Monday?')
    expect(sent).toMatchObject({ withLine: false, optout: 'held' })
  })

  it('sends a live conversation’s text as written, the link lines under it', () => {
    const sent = textToSend({
      body: 'Greg, the plans are up. ',
      links: [{ text: 'The plans are in your portal: ', link: 'click.co/t/7Hq2#plans' }],
      reason: optoutReason(GREG_LAST, NOW),
      company: CLICK,
    })
    expect(sent.text).toBe('Greg, the plans are up.\nThe plans are in your portal: click.co/t/7Hq2#plans')
    expect(sent).toMatchObject({ withLine: false, optout: null })
  })

  it('can make a one-text body two texts once the line rides along', () => {
    const body = 'a'.repeat(130)
    expect(countLine('text', body).parts).toEqual(['130 characters', '1 text'])
    expect(textToSend({ body, reason: 'first', company: CLICK }).segments).toBe(2)
  })

  it('is drawn as the app’s own bubble, saying why it is there', () => {
    expect(optoutBubble('first', null, CLICK)).toEqual({
      line: 'Click Construction. Reply STOP to opt out.',
      tag: ['added by the app', 'required on a first text'],
      tip: {
        name: 'Added by the app',
        does: 'Their first text from us carries the company name and the opt-out line the carriers require.',
        changes: 'It goes at the end of your text, after a blank line. It is drawn apart so it never reads as your words.',
      },
    })
    const quiet = optoutBubble('silence', 31, CLICK)
    expect(quiet.tag).toEqual(['added by the app', 'after 31 quiet days'])
    expect(quiet.tip.does).toBe('Our last text to them was 31 days ago. The carriers ask for the line again after a quiet spell.')
  })

  it('offers the hold under the phone only on the silence', () => {
    expect(optoutHoldNote('silence', false, 31, 'Bill')).toEqual({
      words: 'The line is on because our last text was 31 days ago.',
      press: 'Leave it off this time',
    })
    expect(optoutHoldNote('silence', true, 31, 'Bill')).toEqual({
      words: 'The opt-out line is held back this time. You said the 31 quiet days do not make a stranger of Bill.',
      press: 'Put it back',
    })
    expect(optoutHoldNote('first', false, null, 'Priya')).toBeNull()
    expect(optoutHoldNote(null, false, 2, 'Greg')).toBeNull()
  })
})

describe('the send window', () => {
  it('lets a text go only to a number that can take one, and an email only to an address', () => {
    expect(canSend('text', GREG)).toBe(true)
    expect(canSend('text', GREG_STOPPED)).toBe(false)
    expect(canSend('text', { ...GREG, number: null })).toBe(false)
    expect(canSend('email', TOM)).toBe(false)
    expect(canSend('email', GREG)).toBe(true)
    expect(canSend('note', UNKNOWN)).toBe(true)
  })

  it('warns in its order: STOP, no number, then a text past two pieces', () => {
    expect(sendWarnings('email', TOM)).toEqual(['They have no email on file. Add one on the To line and the email can go.'])
    expect(sendWarnings('email', GREG)).toEqual([])
    expect(sendWarnings('text', { ...GREG_STOPPED, number: null })).toEqual([
      'They sent STOP. The app will not send this text.',
      'They have no mobile number on file. Add one on the To line and the text can go.',
    ])
    const long = textToSend({ body: 'a'.repeat(300), reason: 'first', company: CLICK })
    expect(sendWarnings('text', GREG, long)).toEqual([
      '344 characters is 3 texts, with the opt-out line. Long texts arrive in pieces on some phones. An email may read better.',
    ])
    expect(sendWarnings('text', GREG, textToSend({ body: 'a'.repeat(310), reason: null, company: CLICK }))).toEqual([
      '310 characters is 3 texts. Long texts arrive in pieces on some phones. An email may read better.',
    ])
  })
})

describe('the count line by kind (v1.149)', () => {
  it('gives a text its characters and how many texts', () => {
    expect(countLine('text', 'Greg, checking on the Boerne sitework number. Still good for today?')).toEqual({
      parts: ['67 characters', '1 text'],
      long: false,
    })
    expect(countLine('text', 'a').parts).toEqual(['1 character', '1 text'])
    expect(countLine('text', 'a'.repeat(320))).toEqual({
      parts: ['320 characters', '3 texts', 'long for a text, so an email may read better'],
      long: true,
    })
  })

  it('gives an email the subject it goes with and its words', () => {
    const body = 'Pay application 3 is in your portal.'
    expect(countLine('email', body, subjectFor('Fair Oaks Shops, Building D', body, CLICK)).parts).toEqual([
      'Subject: Fair Oaks Shops, Building D: Pay application 3 is in your portal',
      '7 words',
    ])
  })

  it('gives a note its words and who sees it', () => {
    expect(countLine('note', 'Start date waits on the award of Plumbing.').parts).toEqual(['8 words', 'only the team sees it'])
    expect(countLine('note', 'Called.').parts).toEqual(['1 word', 'only the team sees it'])
  })

  it('has no line for an empty box, or one holding only spaces', () => {
    expect(countLine('text', '')).toEqual({ parts: [], long: false })
    expect(countLine('email', '  \n ', 'x')).toEqual({ parts: [], long: false })
  })

  it('says what went, and from where', () => {
    expect(sentWords('text', CLICK)).toBe('Text sent from the company number.')
    expect(sentWords('email', CLICK)).toBe('Email sent as Click Construction. Its copy is kept in Documents.')
    expect(sentWords('note', CLICK)).toBe('Note added and the row closed. Only the team sees the note.')
  })
})

describe('plain words', () => {
  it('holds every sentence the box and the send window say', () => {
    const sentences = [
      textBoxBlocked('text', GREG_STOPPED) ?? '',
      EMAIL_SOURCES_NOTE,
      TEXT_FROM_NOTE,
      SUBJECT_BLANK,
      SIGNATURE_REPLY_LINE,
      sentCopyNote(0),
      sentCopyNote(2),
      emailFooter(CLICK, 'Boerne Retail Shell'),
      ...(['first', 'silence'] as const).flatMap((r) => {
        const b = optoutBubble(r, 31, CLICK)
        return [b.line, b.tip.does, b.tip.changes]
      }),
      optoutHoldNote('silence', false, 31, 'Bill')?.words ?? '',
      optoutHoldNote('silence', true, 31, 'Bill')?.words ?? '',
      OPTOUT_HOLD_TIP.does,
      OPTOUT_HOLD_TIP.changes,
      ...sendWarnings('email', TOM),
      ...sendWarnings('text', { ...GREG_STOPPED, number: null }, textToSend({ body: 'a'.repeat(300), reason: 'first', company: CLICK })),
      ...(['text', 'email', 'note'] as const).map((k) => sentWords(k, CLICK)),
    ]
    expect(sentences.filter((s) => !s)).toEqual([])
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })

  it('holds every part of the labels to one idea, the screen joining them', () => {
    // The text's from line is left out: the parentheses there are the phone number's own, not two ideas glued.
    const parts = [
      ...NOTE_ASIDE,
      ...fromLine('email', CLICK),
      ...countLine('text', 'a'.repeat(320)).parts,
      ...countLine('note', 'Called.').parts,
      ...optoutBubble('silence', 31, CLICK).tag,
      ...optoutBubble('first', null, CLICK).tag,
    ]
    expect(parts.flatMap((p) => plainWordsFailures(p))).toEqual([])
  })
})
