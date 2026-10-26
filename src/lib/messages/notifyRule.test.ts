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
  pushSentRow,
  replyWords,
  threadUrl,
  type ReplyHas,
  type ReplyLine,
} from './notifyRule'
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
