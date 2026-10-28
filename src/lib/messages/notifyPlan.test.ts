import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NO_SEATS } from '../followUp/assignSeats'
import { OFFICE_HOURS } from './hasRule'
import type { LegalSend } from './legalRoute'
import { NOTIFY_LINES_MAX, planReplyPushes, PUSH_LATE_MAX_MINUTES, REPLY_PUSH_ON_KEY, sweepSince, type NotifyPlanInput, type PlanLine, type PlanOut } from './notifyPlan'
import { parsePushHours } from './pushHours'

/**
 * The mockups' card 13 on Tue Oct 6, 2026 (Chicago, CDT): Luis texted Dana Whitfield from job 1312 at 8:50 AM, and
 * Dana answered at 9:04. The office is Rosa and Tom. Rosa holds the Customers seat in some cases. Nothing here is a real
 * row.
 */
const LUIS = 'u-luis'
const ROSA = 'u-rosa'
const TOM = 'u-tom'
const at = (hhmm: string) => `2026-10-06T${String(Number(hhmm.slice(0, 2)) + 5).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`

const line = (time: string, patch: Partial<PlanLine> = {}): PlanLine => ({
  id: `m-${time}`,
  contactId: 'dana',
  channel: 'text',
  direction: 'in',
  at: at(time),
  body: 'Perfect, thank you. The side gate is unlocked.',
  ...patch,
})
const out = (time: string, patch: Partial<PlanOut> = {}): PlanOut => ({ contactId: 'dana', channel: 'text', direction: 'out', at: at(time), whoUserId: LUIS, ...patch })

const base = (patch: Partial<NotifyPlanInput> = {}): NotifyPlanInput => ({
  now: at('09:05'),
  lines: [line('09:04')],
  contacts: [{ id: 'dana', kind: 'customer', name: 'Dana Whitfield' }],
  outs: [out('08:50')],
  techs: [{ id: LUIS, name: 'Luis' }],
  office: [
    { id: ROSA, name: 'Rosa' },
    { id: TOM, name: 'Tom' },
  ],
  seats: { ...NO_SEATS },
  hours: OFFICE_HOURS,
  waitMinutes: 15,
  legal: {},
  sent: [],
  ...patch,
})

const sent = (input: NotifyPlanInput) => planReplyPushes(input).send.map((p) => `${p.template} ${p.audience} ${p.userIds.join('+')}`)

describe('planReplyPushes: who hears a line, now', () => {
  it('tells Luis at once, since his hold stands, and holds the office’s push for its wait', () => {
    const plan = planReplyPushes(base())
    expect(plan.send).toEqual([expect.objectContaining({ audience: 'tech', userIds: [LUIS], url: null, template: 'message_reply', messageId: 'm-09:04' })])
    expect(plan.waiting).toBe(2)
  })

  it('tells the office at 9:19 when nobody answered, and drops it when someone did', () => {
    const luisHeard = [{ message_id: 'm-09:04', template_type: 'message_reply' as const }]
    expect(sent(base({ now: at('09:20'), sent: luisHeard }))).toEqual(['message_reply_wait office u-rosa+u-tom'])
    const answered = planReplyPushes(base({ now: at('09:20'), sent: luisHeard, outs: [out('08:50'), out('09:10', { whoUserId: ROSA, channel: 'email' })] }))
    expect(answered.send).toEqual([])
    expect(answered.answered).toBe(1)
  })

  it('sends nothing twice: a push already in notification_history stays sent', () => {
    expect(sent(base({ sent: [{ message_id: 'm-09:04', template_type: 'message_reply' }] }))).toEqual([])
  })

  it('never sends a push more than thirty minutes late, as on the morning the switch goes on', () => {
    const plan = planReplyPushes(base({ now: at('09:50') }))
    expect(plan.send).toEqual([])
    expect(plan.late).toBe(2)
    expect(PUSH_LATE_MAX_MINUTES).toBe(30)
  })

  it('goes to the office’s seat at once with the rest after the wait when no tech texted them', () => {
    const plan = planReplyPushes(base({ outs: [], seats: { ...NO_SEATS, customer: ROSA } }))
    expect(plan.send).toEqual([expect.objectContaining({ audience: 'office', userIds: [ROSA], url: '/gc?view=messages&thread=dana&at=m-09%3A04' })])
  })

  it('sends the office’s wait to the Customers seat when one is picked, else to the five office roles', () => {
    expect(sent(base({ outs: [], now: at('09:20') }))).toEqual(['message_reply_wait office u-rosa+u-tom'])
    // With Rosa in the seat she hears at once, and the wait push has nobody left to tell.
    expect(sent(base({ outs: [], now: at('09:20'), seats: { ...NO_SEATS, customer: ROSA } }))).toEqual(['message_reply office u-rosa'])
  })

  it('keeps the teammate who took it: Tom hears at once, though Luis texted last', () => {
    const plan = planReplyPushes(base({ contacts: [{ id: 'dana', kind: 'customer', name: 'Dana Whitfield', hasUserId: TOM, hasHow: 'took' }] }))
    expect(plan.send).toEqual([expect.objectContaining({ audience: 'office', userIds: [TOM] })])
  })

  it('sends a reply after a standing legal line to the office alone, never to Luis', () => {
    const notice: LegalSend = { id: 'filing:f1', jobId: 'jl-1312', paper: 'notice', methods: ['certified_mail'], at: at('08:00') }
    const plan = planReplyPushes(base({ legal: { dana: [notice] } }))
    expect(plan.send).toEqual([expect.objectContaining({ audience: 'office', userIds: [ROSA, TOM], template: 'message_reply' })])
    // A release on that job lifts it, and Luis hears again.
    const release: LegalSend = { ...notice, id: 'filing:f2', paper: 'release', at: at('08:30') }
    expect(sent(base({ legal: { dana: [notice, release] } }))).toEqual(['message_reply tech u-luis'])
  })

  it('tells the office at once after hours, saying it waits for the morning, since no answer goes yet', () => {
    const plan = planReplyPushes(base({ lines: [line('17:30')], outs: [], now: at('17:31') }))
    expect(plan.send).toEqual([expect.objectContaining({ audience: 'office', userIds: [ROSA, TOM], body: 'Dana wrote after hours. It waits for the morning.' })])
  })

  it('pushes only a customer’s, a lead’s or a sub’s line, and only a line in', () => {
    for (const kind of ['trade', 'arch', 'unknown', 'supply_house', 'candidate']) {
      expect(sent(base({ contacts: [{ id: 'dana', kind, name: 'Dana Whitfield' }] })), kind).toEqual([])
    }
    for (const kind of ['lead', 'sub']) expect(sent(base({ contacts: [{ id: 'dana', kind, name: 'Dana Whitfield' }] })), kind).toEqual(['message_reply tech u-luis'])
    expect(sent(base({ lines: [line('09:04', { direction: 'out' })] }))).toEqual([])
    expect(sent(base({ lines: [line('09:04', { channel: 'call' })] }))).toEqual([])
  })

  it('reads at most two hundred lines a call', () => {
    const many = Array.from({ length: NOTIFY_LINES_MAX + 5 }, (_, i) => line('09:04', { id: `m-${i}` }))
    expect(planReplyPushes(base({ lines: many })).send).toHaveLength(NOTIFY_LINES_MAX)
  })
})

describe('a person’s hours (punch list #141 PR 3): held, handed on, widened', () => {
  /** Off until 10 AM on a weekday, at 9:04 and 9:20. */
  const LATE = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '18:00' })
  const held = (input: NotifyPlanInput) => planReplyPushes(input).held.map((h) => `${h.push.template} ${h.userId} back ${h.backAt}`)

  it('holds Luis’s push while he is off, with when he is back, and tells the office at once who is off', () => {
    const plan = planReplyPushes(base({ pushHours: new Map([[LUIS, LATE]]) }))
    expect(plan.held).toEqual([{ push: expect.objectContaining({ template: 'message_reply', userIds: [LUIS] }), userId: LUIS, backAt: at('10:00') }])
    expect(plan.send).toEqual([
      expect.objectContaining({ template: 'message_reply_off', audience: 'office', userIds: [ROSA, TOM], body: 'Dana wrote to Luis, who is off until 10 AM. Perfect, thank you. The side gate is unlocked.' }),
    ])
    expect(plan.waiting).toBe(2)
  })

  it('sends the office’s wait push to the members who are on and holds the rest', () => {
    const luisHeard = [{ message_id: 'm-09:04', template_type: 'message_reply' as const }]
    const input = base({ now: at('09:20'), sent: luisHeard, pushHours: new Map([[TOM, LATE]]) })
    expect(sent(input)).toEqual(['message_reply_wait office u-rosa'])
    expect(held(input)).toEqual([`message_reply_wait ${TOM} back ${at('10:00')}`])
  })

  it('sends nothing and holds everyone when every member is off', () => {
    const luisHeard = [{ message_id: 'm-09:04', template_type: 'message_reply' as const }]
    const plan = planReplyPushes(
      base({
        now: at('09:20'),
        sent: luisHeard,
        pushHours: new Map([
          [ROSA, LATE],
          [TOM, LATE],
        ]),
      }),
    )
    expect(plan.send).toEqual([])
    expect(plan.held.map((h) => h.userId)).toEqual([ROSA, TOM])
    expect(plan.held.every((h) => h.push.template === 'message_reply_wait' && h.backAt === at('10:00'))).toBe(true)
  })

  it('widens the seat’s push to the office roles who are on when the seat is off', () => {
    const plan = planReplyPushes(base({ outs: [], seats: { ...NO_SEATS, customer: ROSA }, pushHours: new Map([[ROSA, LATE]]) }))
    expect(plan.held.map((h) => `${h.push.template} ${h.userId}`)).toEqual([`message_reply ${ROSA}`])
    expect(plan.send).toEqual([expect.objectContaining({ template: 'message_reply_off', userIds: [TOM] })])
    expect(plan.send[0]!.body).toContain('Dana wrote to Rosa, who is off until 10 AM.')
  })

  it('writes nothing twice: a held row counts as sent for its line and template', () => {
    expect(planReplyPushes(base({ pushHours: new Map([[LUIS, LATE]]), sent: [{ message_id: 'm-09:04', template_type: 'message_reply' }] })).held).toEqual([])
  })

  it('changes nothing with no hours read, or every row cleared', () => {
    expect(sent(base({ pushHours: new Map() }))).toEqual(['message_reply tech u-luis'])
    expect(sent(base({ pushHours: new Map([[LUIS, null]]) }))).toEqual(['message_reply tech u-luis'])
    expect(planReplyPushes(base()).held).toEqual([])
  })
})

describe('the walk kit’s thread (punch list #142 PR 6): the devs alone', () => {
  const ROBERT = 'u-robert'
  const kit = { contactId: 'dana' }
  const devs = [{ id: ROBERT, name: 'Robert' }]

  it('pushes the devs at once, though Luis texted last and Rosa holds the seat, with no wait behind it', () => {
    const plan = planReplyPushes(base({ kit, devs, seats: { ...NO_SEATS, customer: ROSA } }))
    expect(plan.send).toEqual([
      expect.objectContaining({ audience: 'office', userIds: [ROBERT], template: 'message_reply', messageId: 'm-09:04', url: '/gc?view=messages&thread=dana&at=m-09%3A04', cancelIfAnswered: false }),
    ])
    expect(plan.waiting).toBe(0)
    expect(sent(base({ kit, devs, now: at('09:20') }))).toEqual(['message_reply office u-robert'])
  })

  it('says the line itself after hours too, never that it waits for the morning', () => {
    const plan = planReplyPushes(base({ kit, devs, lines: [line('17:30')], outs: [], now: at('17:31') }))
    expect(plan.send).toEqual([expect.objectContaining({ userIds: [ROBERT], template: 'message_reply' })])
    expect(plan.send[0]!.body).not.toContain('waits for the morning')
  })

  it('sends nothing with no dev to tell, nothing twice, and nothing past thirty minutes', () => {
    expect(sent(base({ kit, devs: [] }))).toEqual([])
    expect(sent(base({ kit, devs, sent: [{ message_id: 'm-09:04', template_type: 'message_reply' }] }))).toEqual([])
    const late = planReplyPushes(base({ kit, devs, now: at('09:50') }))
    expect(late.send).toEqual([])
    expect(late.late).toBe(1)
  })

  it('changes nothing for anyone else’s line, with or without a kit', () => {
    expect(sent(base({ kit: { contactId: 'zz-walk' }, devs }))).toEqual(['message_reply tech u-luis'])
    expect(sent(base({ kit: null, devs }))).toEqual(['message_reply tech u-luis'])
  })
})

describe('sweepSince', () => {
  it('reads back to the breach push, the thirty minutes and a margin of five, further on a longer wait', () => {
    expect(sweepSince(at('10:00'), 15)).toBe(at('08:35'))
    expect(sweepSince(at('10:00'), null)).toBe(at('08:35'))
    expect(sweepSince(at('10:00'), 0)).toBe(at('08:35'))
    expect(sweepSince(at('10:00'), 60)).toBe(at('08:25'))
  })
})

describe('the owner’s switch (R5’s PR 3)', () => {
  it('is the row the cron’s migration makes, shipping off, and the row its cron reads', () => {
    const dir = resolve(__dirname, '../../../supabase/migrations')
    const file = readdirSync(dir).find((f) => f.endsWith('_messages_notify_cron.sql'))
    expect(file).toBeDefined()
    const sql = readFileSync(resolve(dir, file!), 'utf8')
    expect(sql).toContain(`VALUES ('${REPLY_PUSH_ON_KEY}', 'false')`)
    expect(sql).toContain(`WHERE key = '${REPLY_PUSH_ON_KEY}' AND value_text = 'true'`)
  })
})
