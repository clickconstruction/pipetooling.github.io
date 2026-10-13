import { describe, expect, it } from 'vitest'
import { quickRepliesFromRows, versionsFromRows, type QuickReplyRow, type QuickReplyUseRow, type QuickReplyVersionRow } from './rows'

const ROSA = 'u-rosa'
const ROBERT = 'u-robert'

const row = (set: Partial<QuickReplyRow> & Pick<QuickReplyRow, 'id'>): QuickReplyRow => ({
  text: 'Got it, thank you.',
  for_kind: 'any',
  step_key: null,
  scope: 'team',
  added_by: ROSA,
  added_at: '2026-09-12T14:00:00.000Z',
  removed_at: null,
  ...set,
})

const use = (quick_reply_id: string, user_id: string | null, at: string, contact_id: string | null = 'greg'): QuickReplyUseRow => ({ quick_reply_id, user_id, contact_id, at })

const version = (set: Partial<QuickReplyVersionRow> & Pick<QuickReplyVersionRow, 'id' | 'kind' | 'at'>): QuickReplyVersionRow => ({
  quick_reply_id: 'q3',
  from_text: null,
  to_text: null,
  from_for_kind: null,
  from_step_key: null,
  to_for_kind: null,
  to_step_key: null,
  by_user_id: ROBERT,
  ...set,
})

describe('quick replies read from the tables', () => {
  it('counts each person’s presses and keeps the newest as last used', () => {
    const [line] = quickRepliesFromRows(
      [row({ id: 'q14' })],
      [use('q14', ROSA, '2026-10-01T15:00:00.000Z'), use('q14', ROBERT, '2026-10-03T15:00:00.000Z', 'elena'), use('q14', ROSA, '2026-10-02T15:00:00.000Z')],
    )
    expect(line).toEqual({
      id: 'q14',
      text: 'Got it, thank you.',
      for: 'any',
      stepId: null,
      scope: 'team',
      addedBy: ROSA,
      addedAt: Date.parse('2026-09-12T14:00:00.000Z'),
      removed: false,
      uses: { [ROSA]: 2, [ROBERT]: 1 },
      lastUsed: { at: Date.parse('2026-10-03T15:00:00.000Z'), by: ROBERT, contactId: 'elena' },
      textEs: null,
      phoneOrder: null,
      phoneName: null,
    })
  })

  it('reads a line’s Spanish, its place on the phone and its name, and a line for each of the seven kinds (R3)', () => {
    const lines = quickRepliesFromRows(
      [
        row({ id: 'r2', for_kind: 'customer', step_key: 'onway', text_es: 'Vamos en camino.', phone_order: 1, phone_name: 'On our way' }),
        row({ id: 'r9', for_kind: 'lead' }),
        row({ id: 'r10', for_kind: 'supply_house' }),
      ],
      [],
    )
    expect(lines.map((l) => [l.id, l.for, l.textEs, l.phoneOrder, l.phoneName])).toEqual([
      ['r2', 'customer', 'Vamos en camino.', 1, 'On our way'],
      ['r9', 'lead', null, null, null],
      ['r10', 'supply_house', null, null, null],
    ])
  })

  it('reads a step on a kind’s line, a removed line, and a line of my own', () => {
    const lines = quickRepliesFromRows(
      [
        row({ id: 'q3', text: 'Checking on the number. Still good for today?', for_kind: 'trade', step_key: 'ask' }),
        row({ id: 'q8', for_kind: 'trade', removed_at: '2026-10-01T15:00:00.000Z' }),
        row({ id: 'q10', for_kind: 'trade', step_key: 'ask', scope: 'mine', added_by: ROBERT }),
      ],
      [],
    )
    expect(lines.map((l) => [l.id, l.for, l.stepId, l.scope, l.removed, l.lastUsed])).toEqual([
      ['q3', 'trade', 'ask', 'team', false, null],
      ['q8', 'trade', null, 'team', true, null],
      ['q10', 'trade', 'ask', 'mine', false, null],
    ])
  })

  it('leaves out a line whose kind it does not know, and gives a line for anyone no step', () => {
    const lines = quickRepliesFromRows([row({ id: 'qx', for_kind: 'vendor' }), row({ id: 'qa', step_key: 'ask' })], [])
    expect(lines.map((l) => [l.id, l.stepId])).toEqual([['qa', null]])
  })

  it('counts a press whose person was deleted toward last used only', () => {
    const [line] = quickRepliesFromRows([row({ id: 'q14' })], [use('q14', null, '2026-10-01T15:00:00.000Z')])
    expect(line?.uses).toEqual({})
    expect(line?.lastUsed).toEqual({ at: Date.parse('2026-10-01T15:00:00.000Z'), by: '', contactId: 'greg' })
  })
})

describe('a line’s versions', () => {
  it('read oldest first, one save’s words before its tags, each kind with its own fields', () => {
    const at = '2026-09-22T14:05:00.000Z'
    const out = versionsFromRows([
      version({ id: 3, kind: 'tags', at, from_for_kind: 'trade', from_step_key: 'ask', to_for_kind: 'trade', to_step_key: null }),
      version({ id: 2, kind: 'words', at, from_text: 'Checking on the quote. Still good for today?', to_text: 'Checking on the number. Still good for today?' }),
      version({ id: 1, kind: 'added', at: '2026-09-14T13:40:00.000Z', to_text: 'Checking on the quote. Still good for today?', to_for_kind: 'trade', to_step_key: 'ask' }),
    ])
    expect(out.q3).toEqual([
      { by: ROBERT, at: Date.parse('2026-09-14T13:40:00.000Z'), kind: 'added', toText: 'Checking on the quote. Still good for today?', toTags: { for: 'trade', stepId: 'ask' } },
      { by: ROBERT, at: Date.parse(at), kind: 'words', fromText: 'Checking on the quote. Still good for today?', toText: 'Checking on the number. Still good for today?' },
      { by: ROBERT, at: Date.parse(at), kind: 'tags', fromTags: { for: 'trade', stepId: 'ask' }, toTags: { for: 'trade', stepId: null } },
    ])
  })

  it('reads the Spanish’s words and the phone’s places (R3)', () => {
    const out = versionsFromRows([
      version({ id: 1, kind: 'es', at: '2026-10-01T15:00:00.000Z', to_text: 'Vamos en camino.' }),
      version({ id: 2, kind: 'phone', at: '2026-10-02T15:00:00.000Z', from_phone_order: null, to_phone_order: 2 }),
      version({ id: 3, kind: 'phone', at: '2026-10-03T15:00:00.000Z' }),
    ])
    expect(out.q3).toEqual([
      { by: ROBERT, at: Date.parse('2026-10-01T15:00:00.000Z'), kind: 'es', toText: 'Vamos en camino.' },
      { by: ROBERT, at: Date.parse('2026-10-02T15:00:00.000Z'), kind: 'phone', fromPhoneOrder: null, toPhoneOrder: 2 },
      { by: ROBERT, at: Date.parse('2026-10-03T15:00:00.000Z'), kind: 'phone', fromPhoneOrder: null, toPhoneOrder: null },
    ])
  })

  it('skips a change it does not know and keeps each line’s own list', () => {
    const out = versionsFromRows([
      version({ id: 1, kind: 'renamed', at: '2026-09-14T13:40:00.000Z' }),
      version({ id: 2, kind: 'removed', at: '2026-09-15T13:40:00.000Z', quick_reply_id: 'q8' }),
    ])
    expect(out).toEqual({ q8: [{ by: ROBERT, at: Date.parse('2026-09-15T13:40:00.000Z'), kind: 'removed' }] })
  })
})
