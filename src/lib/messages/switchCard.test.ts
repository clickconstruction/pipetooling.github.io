import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { allOn, cardLine, laterHolds, laterUntil, onCount, stateTone, SWITCH_ROWS, SWITCH_SETTING_KEYS, SWITCH_WORDS, switchStates, type SwitchRaw } from './switchCard'

const row = (value_text: string | null): SwitchRaw => ({ value_text, value_num: null })

const ALL_ON: Record<string, SwitchRaw> = {
  messages_texts_on_v1: row('true'),
  gmail_sync_on_v1: row('true'),
  messages_assign_rule_v1: row(JSON.stringify({ customer: '11111111-1111-4111-8111-111111111111', trade: '22222222-2222-4222-8222-222222222222', arch: null })),
  messages_boxes_v1: row(JSON.stringify({ team: { address: 'team@clickplumbing.example', phone: '', numberId: '' }, bids: { address: '', phone: '', numberId: '' } })),
  messages_reply_push_on_v1: row('true'),
  messages_quo_seats_v1: row(JSON.stringify({ US1: '11111111-1111-4111-8111-111111111111' })),
  messages_nudge_app_sends_v1: row(JSON.stringify({ residential: { approved: 'offer', paid: 'offer' } })),
  messages_office_hours_v1: row(JSON.stringify({ days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00', techUntil: '17:00', emergency: null, savedAt: '2026-10-21T15:00:00.000Z' })),
}

describe('the switch card (punch list #140 PR 2)', () => {
  it('reads the eight rows in one list, each row naming the setting it reads', () => {
    expect(SWITCH_ROWS.map((r) => r.key)).toEqual(['texts', 'reader', 'assign', 'teamBox', 'replyPush', 'seats', 'reminders', 'hours'])
    expect(SWITCH_SETTING_KEYS).toEqual(['messages_texts_on_v1', 'gmail_sync_on_v1', 'messages_assign_rule_v1', 'messages_boxes_v1', 'messages_reply_push_on_v1', 'messages_quo_seats_v1', 'messages_nudge_app_sends_v1', 'messages_office_hours_v1'])
    expect(SWITCH_ROWS.every((r) => r.href.startsWith('/settings?tab=settings-'))).toBe(true)
  })

  it('reads every switch on, and counts eight of eight', () => {
    const states = switchStates(ALL_ON)
    expect(Object.values(states).every((s) => s === 'on')).toBe(true)
    expect(onCount(states)).toEqual({ on: 8, of: 8 })
    expect(allOn(states)).toBe(true)
  })

  it('reads the day every switch was off as the hand-off found it, missing rows included', () => {
    const states = switchStates({})
    expect(states).toEqual({ texts: 'off', reader: 'off', assign: 'nobody', teamBox: 'not_set', replyPush: 'off', seats: 'nobody', reminders: 'off', hours: 'not_set' })
    expect(onCount(states)).toEqual({ on: 0, of: 8 })
    expect(cardLine(onCount(states))).toBe('Finish switching Messages on · 0 of 8 on')
  })

  it('reads each switch through the app’s own parser, never a bare string', () => {
    expect(switchStates({ ...ALL_ON, messages_texts_on_v1: row('TRUE') }).texts).toBe('off')
    expect(switchStates({ ...ALL_ON, messages_assign_rule_v1: row(JSON.stringify({ customer: '11111111-1111-4111-8111-111111111111', trade: null })) }).assign).toBe('nobody')
    expect(switchStates({ ...ALL_ON, messages_quo_seats_v1: row('{}') }).seats).toBe('nobody')
    expect(switchStates({ ...ALL_ON, messages_nudge_app_sends_v1: row(JSON.stringify({ residential: { approved: true } })) }).reminders).toBe('off')
    expect(switchStates({ ...ALL_ON, messages_nudge_app_sends_v1: row(JSON.stringify({ residential: { approved: true, paid: 'offer' } })) }).reminders).toBe('on')
    expect(switchStates({ ...ALL_ON, messages_office_hours_v1: row('{"days":[1,2,3],"opens":"07:30","closes":"17:00"}') }).hours).toBe('not_set')
  })

  it('says the team inbox is named but not read while Read bids@ is off', () => {
    const states = switchStates({ ...ALL_ON, gmail_sync_on_v1: row('false') })
    expect(states.reader).toBe('off')
    expect(states.teamBox).toBe('not_read')
    expect(stateTone('not_read')).toBe('red')
    expect(stateTone('on')).toBe('green')
    expect(stateTone('nobody')).toBe('amber')
    expect(onCount(states)).toEqual({ on: 6, of: 8 })
  })

  it('Later folds the card for a week on the device, and only while that week runs', () => {
    expect(laterUntil('2026-10-21T15:00:00.000Z')).toBe('2026-10-28T15:00:00.000Z')
    expect(laterHolds('2026-10-28T15:00:00.000Z', '2026-10-21T15:00:00.000Z')).toBe(true)
    expect(laterHolds('2026-10-28T15:00:00.000Z', '2026-10-28T15:00:00.001Z')).toBe(false)
    expect(laterHolds(null, '2026-10-21T15:00:00.000Z')).toBe(false)
    expect(laterHolds('not a date', '2026-10-21T15:00:00.000Z')).toBe(false)
  })

  it('keeps every sentence in plain words', () => {
    const words = [SWITCH_WORDS.title, SWITCH_WORDS.note, SWITCH_WORDS.later, SWITCH_WORDS.laterTip, SWITCH_WORDS.footer, SWITCH_WORDS.count({ on: 3, of: 8 }), ...Object.values(SWITCH_WORDS.state)]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
    for (const r of SWITCH_ROWS) for (const w of [r.title, r.why, r.door]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
