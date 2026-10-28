import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  afterHoursWords,
  answeredBefore,
  BREACH_MINUTES,
  breachWords,
  officeWaitWords,
  OFFICE_WAIT_MINUTES,
  pushDue,
  pushesFor,
  pushHeldRows,
  pushSentRow,
  replyWords,
  threadUrl,
  type ReplyHas,
  type ReplyLine,
} from './notifyRule'
import { parsePushHours } from './pushHours'
import type { ThreadMessage } from './thread'

/**
 * The mockups' card 13 on Tue Oct 6, 2026 (Chicago, CDT): Luis texted Dana Whitfield from job 1312 at 8:50 AM, and
 * Dana answered at 9:04. The office is Rosa and Tom. Nothing here is a real row.
 */
const LUIS = 'u-luis'
const ROSA = 'u-rosa'
const TOM = 'u-tom'
const settings = { officeWaitMinutes: 15, officeUserIds: [ROSA, TOM, LUIS] }
const at = (hhmm: string) => `2026-10-06T${String(Number(hhmm.slice(0, 2)) + 5).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`

const dana: ReplyLine = {
  id: 'm-31',
  contactId: 'dana',
  channel: 'text',
  direction: 'in',
  at: at('09:04'),
  body: 'Perfect, thank you. The side gate is unlocked.',
  name: 'Dana Whitfield',
  kind: 'customer',
}

/** What `whoHasReply` (#5561) answers at 9:04 and at 5:10 PM, and what `routeReply` answers under a legal line. */
const luisHasIt: ReplyHas = { has: 'tech', userId: LUIS, name: 'Luis', reason: 'tech', autoAnswer: null }
const closed: ReplyHas = { has: 'nobody', userId: null, name: null, reason: 'closed', autoAnswer: 'send' }
const legal: ReplyHas = { has: 'office', userId: null, name: null, reason: 'legal' }

const out = (time: string, patch: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: `o-${time}`,
  contactId: 'dana',
  jobId: null,
  channel: 'text',
  direction: 'out',
  at: at(time),
  who: 'Luis',
  body: 'On our way.',
  ...patch,
})

describe('pushesFor', () => {
  it('tells Luis at once, and the office at 9:19 unless someone answers', () => {
    const [luis, office] = pushesFor(dana, luisHasIt, settings)
    expect(luis).toEqual({
      messageId: 'm-31',
      contactId: 'dana',
      audience: 'tech',
      userIds: [LUIS],
      title: 'Dana Whitfield',
      body: 'Perfect, thank you. The side gate is unlocked.',
      url: null,
      tag: 'messages-dana',
      template: 'message_reply',
      dueAt: at('09:04'),
      cancelIfAnswered: false,
    })
    expect(office).toMatchObject({
      audience: 'office',
      userIds: [ROSA, TOM],
      title: 'Dana Whitfield',
      body: 'Nobody answered Dana in 15 minutes. It is on Needs a reply.',
      url: '/gc?view=messages&thread=dana&at=m-31',
      template: 'message_reply_wait',
      dueAt: at('09:19'),
      cancelIfAnswered: true,
    })
    expect(pushDue(office!, at('09:18'))).toBe(false)
    expect(pushDue(office!, at('09:19'))).toBe(true)
  })

  it('drops the office’s push when Luis answers within the wait, and not for a team note', () => {
    expect(answeredBefore(dana, [out('09:10')], at('09:19'))).toBe(true)
    expect(answeredBefore(dana, [out('09:10', { channel: 'note', direction: 'team' }), out('09:12', { channel: 'event' })], at('09:19'))).toBe(false)
    expect(answeredBefore(dana, [out('09:25')], at('09:19'))).toBe(false)
    expect(answeredBefore(dana, [out('08:50')])).toBe(false)
    expect(answeredBefore(dana, [out('09:10', { contactId: 'priya' })])).toBe(false)
    // The app's own text back after a missed call (v2.6012) answers nothing: the office still hears.
    expect(answeredBefore(dana, [out('09:10', { auto: true })], at('09:19'))).toBe(false)
    expect(answeredBefore(dana, [out('09:10', { auto: true }), out('09:11')], at('09:19'))).toBe(true)
  })

  it('tells the office at once at 5:10 PM, with the after-hours answer, and nobody else', () => {
    const late = { ...dana, at: at('17:10') }
    expect(pushesFor(late, closed, settings)).toEqual([
      expect.objectContaining({
        audience: 'office',
        userIds: [ROSA, TOM, LUIS],
        body: 'Dana wrote after hours. The app answered with the hours we open.',
        template: 'message_reply',
        dueAt: at('17:10'),
        cancelIfAnswered: false,
      }),
    ])
    expect(pushesFor(late, { ...closed, autoAnswer: 'sent' }, settings)[0]?.body).toBe('Dana wrote after hours. The app already answered tonight.')
  })

  it('says only that the line waits for the morning while no after-hours answer goes', () => {
    const late = { ...dana, at: at('17:10') }
    expect(pushesFor(late, { ...closed, autoAnswer: null }, settings)[0]?.body).toBe('Dana wrote after hours. It waits for the morning.')
    expect(afterHoursWords('Dana', null)).toBe('Dana wrote after hours. It waits for the morning.')
    expect(afterHoursWords('Dana', undefined)).toBe('Dana wrote after hours. It waits for the morning.')
  })

  it('sends nothing for a supply house’s or a candidate’s line, our own line, or an answered call', () => {
    expect(pushesFor({ ...dana, channel: 'email', kind: 'supply_house', name: 'Hughes Supply' }, luisHasIt, settings)).toEqual([])
    expect(pushesFor({ ...dana, kind: 'candidate' }, luisHasIt, settings)).toEqual([])
    expect(pushesFor({ ...dana, direction: 'out' }, luisHasIt, settings)).toEqual([])
    expect(pushesFor({ ...dana, channel: 'call' }, luisHasIt, settings)).toEqual([])
  })

  it('sends a legal-line reply to the office alone, at once', () => {
    const pushes = pushesFor(dana, legal, settings)
    expect(pushes).toEqual([expect.objectContaining({ audience: 'office', userIds: [ROSA, TOM, LUIS], template: 'message_reply', dueAt: at('09:04'), url: '/gc?view=messages&thread=dana&at=m-31' })])
    expect(pushesFor(dana, { ...legal, userId: ROSA, name: 'Rosa' }, settings).map((p) => p.userIds)).toEqual([[ROSA]])
  })

  it('tells the office’s seat pick at once and the rest after the wait, and only the wait with no pick', () => {
    const rosa: ReplyHas = { has: 'office', userId: ROSA, name: 'Rosa', reason: 'noTech' }
    expect(pushesFor(dana, rosa, settings).map((p) => [p.userIds, p.template])).toEqual([
      [[ROSA], 'message_reply'],
      [[TOM, LUIS], 'message_reply_wait'],
      [[ROSA], 'message_reply_breach'],
    ])
    expect(pushesFor(dana, { ...rosa, userId: null, name: null }, settings).map((p) => [p.userIds, p.template])).toEqual([
      [[ROSA, TOM, LUIS], 'message_reply_wait'],
      [[ROSA, TOM, LUIS], 'message_reply_breach'],
    ])
  })

  it('never pushes the same line twice, and skips a push with nobody to reach', () => {
    expect(pushesFor(dana, luisHasIt, settings, [{ message_id: 'm-31', template_type: 'message_reply' }]).map((p) => p.template)).toEqual(['message_reply_wait', 'message_reply_breach'])
    expect(
      pushesFor(dana, luisHasIt, settings, [
        { message_id: 'm-31', template_type: 'message_reply' },
        { message_id: 'm-31', template_type: 'message_reply_wait' },
        { message_id: 'm-31', template_type: 'message_reply_breach' },
      ]),
    ).toEqual([])
    expect(pushesFor(dana, luisHasIt, settings, [{ message_id: 'm-30', template_type: 'message_reply' }])).toHaveLength(3)
    expect(pushesFor(dana, luisHasIt, { officeUserIds: [LUIS] }).map((p) => p.template)).toEqual(['message_reply', 'message_reply_breach'])
  })

  it('waits 15 minutes when the setting is missing', () => {
    expect(OFFICE_WAIT_MINUTES).toBe(15)
    expect(pushesFor(dana, luisHasIt, { officeUserIds: [ROSA] })[1]?.dueAt).toBe(at('09:19'))
  })

  it('tells Luis once more at 9:54 when still nobody has answered, and never after hours or under a legal line', () => {
    expect(BREACH_MINUTES).toBe(50)
    const [, , breach] = pushesFor(dana, luisHasIt, settings)
    expect(breach).toEqual({
      messageId: 'm-31',
      contactId: 'dana',
      audience: 'tech',
      userIds: [LUIS],
      title: 'Dana Whitfield',
      body: 'Dana has waited 50 minutes and nobody has answered. The hour is close.',
      url: null,
      tag: 'messages-dana',
      template: 'message_reply_breach',
      dueAt: at('09:54'),
      cancelIfAnswered: true,
    })
    expect(pushesFor({ ...dana, at: at('17:10') }, closed, settings).map((p) => p.template)).toEqual(['message_reply'])
    expect(pushesFor(dana, legal, settings).map((p) => p.template)).toEqual(['message_reply'])
  })
})

describe('a person’s hours (punch list #141 PR 3)', () => {
  /** Luis is pushed 10 AM to 6 PM on weekdays, so at 9:04 he is off until 10. Rosa and Tom are pushed 6 to 8. */
  const LATE = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '18:00' })
  const DAY = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })
  const rosa: ReplyHas = { has: 'office', userId: ROSA, name: 'Rosa Alvarez', reason: 'noTech' }
  const templates = (pushes: ReturnType<typeof pushesFor>) => pushes.map((p) => `${p.template} ${p.userIds.join('+')}`)

  it('tells the office at once when Luis is off, who is off and until when, then her words, and keeps Luis’s own push for the hold', () => {
    const pushes = pushesFor(dana, luisHasIt, { ...settings, pushHours: new Map([[LUIS, LATE]]) })
    expect(templates(pushes)).toEqual(['message_reply u-luis', 'message_reply_off u-rosa+u-tom', 'message_reply_wait u-rosa+u-tom', 'message_reply_breach u-luis'])
    expect(pushes[1]).toMatchObject({
      audience: 'office',
      title: 'Dana Whitfield',
      body: 'Dana wrote to Luis, who is off until 10 AM. Perfect, thank you. The side gate is unlocked.',
      url: '/gc?view=messages&thread=dana&at=m-31',
      dueAt: at('09:04'),
      cancelIfAnswered: false,
    })
    expect(plainWordsFailures(pushes[1]!.body.split('. ').slice(0, 1).join('. ') + '.')).toEqual([])
  })

  it('adds nothing while the holder is on, and never pushes the hand-on twice', () => {
    expect(templates(pushesFor(dana, luisHasIt, { ...settings, pushHours: new Map([[LUIS, DAY]]) }))).toEqual(['message_reply u-luis', 'message_reply_wait u-rosa+u-tom', 'message_reply_breach u-luis'])
    expect(templates(pushesFor(dana, luisHasIt, { ...settings, pushHours: new Map([[LUIS, LATE]]) }, [{ message_id: 'm-31', template_type: 'message_reply_off' }]))).toEqual([
      'message_reply u-luis',
      'message_reply_wait u-rosa+u-tom',
      'message_reply_breach u-luis',
    ])
  })

  it('hands on for the office’s pick who is off too, by her first name', () => {
    const pushes = pushesFor(dana, rosa, { ...settings, pushHours: new Map([[ROSA, LATE]]) })
    expect(templates(pushes)).toEqual(['message_reply u-rosa', 'message_reply_off u-tom+u-luis', 'message_reply_wait u-tom+u-luis', 'message_reply_breach u-rosa'])
    expect(pushes[1]!.body).toContain('Dana wrote to Rosa, who is off until 10 AM.')
    const legal = pushesFor(dana, { has: 'office', userId: ROSA, name: 'Rosa', reason: 'legal' }, { ...settings, pushHours: new Map([[ROSA, LATE]]) })
    expect(templates(legal)).toEqual(['message_reply u-rosa', 'message_reply_off u-tom+u-luis'])
  })

  it('widens a push to the seat alone to the office roles who are on when the seat is off, and keeps it with the seat when nobody is', () => {
    const seat = { officeWaitMinutes: 15, officeUserIds: [ROSA], officeRoleUserIds: [ROSA, TOM, LUIS] }
    const rosaOff = new Map([[ROSA, LATE]])
    // Luis has it and is on; the wait push widens past Rosa to Tom.
    expect(templates(pushesFor(dana, luisHasIt, { ...seat, pushHours: rosaOff }))).toEqual(['message_reply u-luis', 'message_reply_wait u-tom', 'message_reply_breach u-luis'])
    // Rosa holds it, as the seat, and is off: the hand-on and the wait go to Tom and Luis.
    expect(templates(pushesFor(dana, rosa, { ...seat, pushHours: rosaOff }))).toEqual(['message_reply u-rosa', 'message_reply_off u-tom+u-luis', 'message_reply_wait u-tom+u-luis', 'message_reply_breach u-rosa'])
    // After hours at 6:30 PM, past Rosa's 6 PM, the office is the seat: Tom and Luis hear.
    expect(templates(pushesFor({ ...dana, at: at('18:30') }, closed, { ...seat, pushHours: rosaOff }))).toEqual(['message_reply u-tom+u-luis'])
    // Everyone off: the push stays with the seat, for the planner to hold.
    const allOff = new Map([
      [ROSA, LATE],
      [TOM, LATE],
      [LUIS, LATE],
    ])
    expect(templates(pushesFor({ ...dana, at: at('18:30') }, closed, { ...seat, pushHours: allOff }))).toEqual(['message_reply u-rosa'])
    // The seat on: nothing widens, as before.
    expect(templates(pushesFor(dana, luisHasIt, { ...seat, pushHours: new Map([[ROSA, DAY]]) }))).toEqual(['message_reply u-luis', 'message_reply_wait u-rosa', 'message_reply_breach u-luis'])
  })

  it('writes a held row as the push would have gone, channel held', () => {
    const [luis] = pushesFor(dana, luisHasIt, settings)
    expect(pushHeldRows([{ push: luis!, userId: LUIS, backAt: at('10:00') }])).toEqual([
      {
        recipient_user_id: LUIS,
        template_type: 'message_reply',
        title: 'Dana Whitfield',
        body_preview: 'Perfect, thank you. The side gate is unlocked.',
        channel: 'held',
        message_id: 'm-31',
      },
    ])
    expect(pushHeldRows([])).toEqual([])
  })
})

describe('the words', () => {
  it('quote what they said, an email by its subject, and a call that had no words', () => {
    expect(replyWords({ channel: 'email', subject: 'Water heater quote', body: 'Hi Rosa…' })).toBe('Water heater quote')
    expect(replyWords({ channel: 'missed', body: '' })).toBe('Called and nobody picked up.')
    expect(replyWords({ channel: 'voicemail', body: '' })).toBe('Left a voicemail.')
    expect(replyWords({ channel: 'text', body: 'x'.repeat(200) })).toHaveLength(140)
  })

  it('pass the plain words rules', () => {
    for (const w of [officeWaitWords('Dana', 15), officeWaitWords('Dana', 1), breachWords('Dana', BREACH_MINUTES), afterHoursWords('Dana', 'send'), afterHoursWords('Dana', 'sent'), afterHoursWords('Dana', null), replyWords({ channel: 'missed', body: '' }), replyWords({ channel: 'voicemail', body: '' })]) {
      expect(plainWordsFailures(w)).toEqual([])
    }
  })

  it('open the thread at the line', () => {
    expect(threadUrl('c 1', 'm/2')).toBe('/gc?view=messages&thread=c%201&at=m%2F2')
  })
})

describe('pushSentRow', () => {
  it('writes one notification_history row per person reached, with the line', () => {
    const [, office] = pushesFor(dana, luisHasIt, settings)
    expect(pushSentRow(office!, [ROSA])).toEqual([
      {
        recipient_user_id: ROSA,
        template_type: 'message_reply_wait',
        title: 'Dana Whitfield',
        body_preview: 'Nobody answered Dana in 15 minutes. It is on Needs a reply.',
        channel: 'push',
        message_id: 'm-31',
      },
    ])
    expect(pushSentRow(office!)).toHaveLength(2)
  })
})
