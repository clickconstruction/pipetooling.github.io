import { describe, expect, it } from 'vitest'
import { NO_SEATS } from '../followUp/assignSeats'
import { OFFICE_HOURS } from './hasRule'
import type { LegalSend } from './legalRoute'
import { NOTIFY_LINES_MAX, planReplyPushes, PUSH_LATE_MAX_MINUTES, sweepSince, type NotifyPlanInput, type PlanLine, type PlanOut } from './notifyPlan'

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
    expect(plan.waiting).toBe(1)
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

describe('sweepSince', () => {
  it('reads back the wait, the thirty minutes and a margin of five', () => {
    expect(sweepSince(at('10:00'), 15)).toBe(at('09:10'))
    expect(sweepSince(at('10:00'), null)).toBe(at('09:10'))
    expect(sweepSince(at('10:00'), 0)).toBe(at('09:25'))
  })
})
