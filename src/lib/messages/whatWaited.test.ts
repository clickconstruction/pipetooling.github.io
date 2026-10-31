import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parsePushHours } from './pushHours'
import { heldKind, sinceWords, waitedCountWords, waitedSince, whatWaited, type Answer, type HeldLine, type HeldRow } from './whatWaited'

/** Mon to Fri, 6 AM to 8 PM. */
const WEEKDAYS = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })!

/** Chicago, 2026-10-28 (a Wednesday, CDT = UTC−5) and the days around it. */
const wed = (hm: string) => `2026-10-28T${hm}:00-05:00`
const thu = (hm: string) => `2026-10-29T${hm}:00-05:00`
const fri = (hm: string) => `2026-10-30T${hm}:00-05:00`
const sat = (hm: string) => `2026-10-31T${hm}:00-05:00`
const mon = (hm: string) => `2026-11-02T${hm}:00-06:00`

const iso = (s: string) => new Date(s).toISOString()

const held = (messageId: string | null, sentAt: string, templateType = 'message_reply'): HeldRow => ({ messageId, templateType, sentAt: iso(sentAt) })
const line = (id: string, contactId: string, at: string, name: string): HeldLine => ({ id, contactId, at: iso(at), name })
const answer = (contactId: string, at: string, whoName: string | null = 'Evan Hart', patch: Partial<Answer> = {}): Answer => ({ contactId, at: iso(at), channel: 'text', direction: 'out', auto: false, whoName, ...patch })

describe('While you were off (punch list #141 PR 4): the stretch read', () => {
  it('starts at the hours’ last close, whether the person is back or still off', () => {
    expect(waitedSince(thu('07:00'), WEEKDAYS)).toBe(iso(wed('20:00')))
    expect(waitedSince(wed('23:00'), WEEKDAYS)).toBe(iso(wed('20:00')))
    expect(waitedSince(mon('07:00'), WEEKDAYS)).toBe(iso(fri('20:00')))
    expect(waitedSince(sat('10:00'), WEEKDAYS)).toBe(iso(fri('20:00')))
  })

  it('reads nothing for any time', () => {
    expect(waitedSince(thu('07:00'), null)).toBeNull()
    expect(whatWaited({ held: [held('m1', wed('22:00'))], lines: [], answers: [], since: null, now: thu('07:00'), back: true })).toBeNull()
  })

  it('says since when: the time alone within a day, the day before that', () => {
    expect(sinceWords(iso(wed('20:00')), thu('07:00'))).toBe('8 PM')
    expect(sinceWords(iso(fri('20:00')), mon('07:00'))).toBe('Fri 8 PM')
  })
})

describe('While you were off: the line', () => {
  const since = iso(wed('20:00'))
  const now = thu('07:00')
  const lines = [line('m1', 'dana', wed('23:42'), 'Dana Whitfield'), line('m2', 'luis', wed('21:10'), 'Luis Ortega'), line('m3', 'ana', thu('05:30'), 'Ana Cruz')]

  it('counts one wait per line however many pushes it would have been, and names what waited', () => {
    const rows = [held('m1', wed('23:42')), held('m1', thu('00:42'), 'message_reply_breach'), held('m2', wed('21:10')), held('m3', thu('05:30'), 'message_reply_wait')]
    const out = whatWaited({ held: rows, lines, answers: [], since, now, back: true })!
    expect(out.count).toBe(3)
    expect(out.title).toBe('While you were off: 3 replies waited')
    expect(out.detail).toBe('Since 8 PM.')
    // The door opens the earliest line still waiting.
    expect(out.first).toEqual({ contactId: 'luis', messageId: 'm2' })
  })

  it('leaves out a line someone answered meanwhile, and says who answered whom', () => {
    const rows = [held('m1', wed('23:42')), held('m2', wed('21:10')), held('m3', thu('05:30'))]
    const answers = [answer('dana', wed('23:50')), answer('luis', thu('06:10'), 'Rosa Delgado')]
    const out = whatWaited({ held: rows, lines, answers, since, now, back: true })!
    expect(out.count).toBe(1)
    expect(out.title).toBe('While you were off: a reply waited')
    expect(out.detail).toBe('Since 8 PM. Evan answered Dana at 11:50 PM. 1 more was answered.')
    expect(out.first).toEqual({ contactId: 'ana', messageId: 'm3' })
  })

  it('an answer is a text, an email or a call we sent after the line, never a note, the app’s own text, or one before', () => {
    const rows = [held('m1', wed('23:42'))]
    const not = [
      answer('dana', wed('23:00')),
      answer('dana', wed('23:50'), 'Evan', { channel: 'note', direction: 'team' }),
      answer('dana', wed('23:55'), null, { auto: true }),
      answer('luis', wed('23:58')),
    ]
    expect(whatWaited({ held: rows, lines, answers: not, since, now, back: true })!.count).toBe(1)
    const unnamed = whatWaited({ held: [...rows, held('m2', wed('21:10'))], lines, answers: [answer('dana', wed('23:50'), null)], since, now, back: true })!
    expect(unnamed.count).toBe(1)
    expect(unnamed.detail).toBe('Since 8 PM. Dana was answered at 11:50 PM.')
  })

  it('a line the read did not find still counts, unnamed; a push about something else counts by its kind', () => {
    const rows = [held('m9', wed('22:00')), held(null, wed('22:30'), 'work_order')]
    const out = whatWaited({ held: rows, lines: [], answers: [], since, now, back: true })!
    expect(out.count).toBe(2)
    expect(out.title).toBe('While you were off: a reply and a work order waited')
    expect(out.first).toBeNull()
  })

  it('reads nothing before the stretch began, and nothing when every wait was answered', () => {
    expect(whatWaited({ held: [held('m1', wed('19:00'))], lines, answers: [], since, now, back: true })).toBeNull()
    expect(whatWaited({ held: [held('m1', wed('23:42'))], lines, answers: [answer('dana', wed('23:50'))], since, now, back: true })).toBeNull()
  })

  it('while the person is still off, the line says so in the present', () => {
    const one = whatWaited({ held: [held('m1', wed('23:42'))], lines, answers: [], since, now: wed('23:50'), back: false })!
    expect(one.title).toBe('While you are off: a reply waits')
    const two = whatWaited({ held: [held('m1', wed('23:42')), held('m2', wed('21:10'))], lines, answers: [], since, now: wed('23:50'), back: false })!
    expect(two.title).toBe('While you are off: 2 replies wait')
  })

  it('the counts in words, and the kinds', () => {
    expect(waitedCountWords(new Map([['reply', 3], ['push', 1]]))).toBe('3 replies and a push')
    expect(waitedCountWords(new Map([['reply', 1]]))).toBe('a reply')
    expect(waitedCountWords(new Map([['reply', 2], ['work order', 1], ['push', 2]]))).toBe('2 replies, a work order and 2 pushes')
    for (const t of ['message_reply', 'message_reply_wait', 'message_reply_breach', 'message_reply_off']) expect(heldKind(t)).toBe('reply')
    // The other senders' kinds (PR 5), by the template their held row carries.
    expect(heldKind('work_order')).toBe('work order')
    expect(heldKind('work_order_offered')).toBe('work order')
    expect(heldKind('stage_assigned_started')).toBe('work order')
    expect(heldKind('dispatch_request')).toBe('dispatch request')
    expect(heldKind('dispatch_request_closed')).toBe('dispatch answer')
    expect(heldKind('estimator_request')).toBe('estimator request')
    expect(heldKind('bid_mark')).toBe('marked bid')
    expect(heldKind('help_feedback')).toBe('help note')
    expect(heldKind('lien_approval_ask')).toBe('lien notice')
    expect(heldKind('trial_helper_verdict')).toBe('try-out question')
    expect(heldKind('bid_followup')).toBe('call-again day')
    expect(heldKind('ready_to_bill')).toBe('Ready to Bill')
    expect(heldKind('bank_return')).toBe('returned check')
    expect(heldKind('checklist_completed')).toBe('checklist item')
    expect(heldKind('checklist-reopen-abc')).toBe('checklist item')
    expect(heldKind('scheduled_reminder')).toBe('task reminder')
    expect(heldKind('report_submitted')).toBe('report')
    expect(heldKind('something_new')).toBe('push')
    expect(waitedCountWords(new Map([['estimator request', 1], ['call-again day', 2]]))).toBe('an estimator request and 2 call-again days')
  })

  it('the words, plain', () => {
    const out = whatWaited({ held: [held('m1', wed('23:42')), held('m2', wed('21:10')), held('m3', thu('05:30'))], lines, answers: [answer('dana', wed('23:50')), answer('luis', thu('06:10'))], since, now, back: true })!
    expect(plainWordsFailures(out.title)).toEqual([])
    expect(plainWordsFailures(out.detail)).toEqual([])
  })
})
