import { describe, expect, it } from 'vitest'
import { callSheetDraftsFromAnswers, gcIdsToAskAbout, liveAskByOwner, pendingAnswersByOwner, wordAskStage, wordAskStatusLine, type GcWordAskAnswerRow, type GcWordAskRow } from './gcWordAskState'
import type { GcWorklistRow } from './gcWorklist'

const NOW = Date.parse('2026-10-01T15:00:00Z')

const answer = (gc: string, status: string, over: Partial<GcWordAskAnswerRow> = {}): GcWordAskAnswerRow => ({ id: `ans-${gc}`, ask_id: 'ask-1', gc_customer_id: gc, temperature: 'warm', note: 'Fine, no date given.', expected_pay_by: null, no_change: false, answered_at: '2026-09-30T15:00:00Z', status, ...over })

const ask = (over: Partial<GcWordAskRow> = {}): GcWordAskRow => ({
  id: 'ask-1',
  week_start: '2026-09-28',
  owner_user_id: 'u-malachi',
  owner_name: 'Malachi',
  gc_ids: ['a', 'b', 'c'],
  token: 'tok',
  created_by_name: 'Taunya',
  created_at: '2026-09-29T15:00:00Z',
  expires_at: '2026-10-07T15:00:00Z',
  emailed_at: null,
  emailed_to: null,
  opened_at: null,
  answered_at: null,
  revoked_at: null,
  answers: [],
  ...over,
})

describe('where a link stands', () => {
  it('asked, opened, answered, run out', () => {
    expect(wordAskStage(ask(), NOW)).toBe('asked')
    expect(wordAskStage(ask({ opened_at: '2026-09-30T12:00:00Z' }), NOW)).toBe('opened')
    expect(wordAskStage(ask({ answered_at: '2026-09-30T15:00:00Z', answers: [answer('a', 'accepted')] }), NOW)).toBe('answered')
    expect(wordAskStage(ask({ expires_at: '2026-09-30T00:00:00Z' }), NOW)).toBe('expired')
  })

  it('answers waiting on the office outlive the link', () => {
    expect(wordAskStage(ask({ expires_at: '2026-09-30T00:00:00Z', answers: [answer('a', 'pending')] }), NOW)).toBe('answered')
  })

  it('reads as a line', () => {
    expect(wordAskStatusLine(ask({ emailed_at: '2026-09-29T15:05:00Z' }), NOW)).toBe('asked Tue · emailed · not opened yet')
    expect(wordAskStatusLine(ask({ opened_at: '2026-09-30T12:00:00Z' }), NOW)).toBe('asked Tue · opened Wed · no answers yet')
    expect(wordAskStatusLine(ask({ answered_at: 'x', answers: [answer('a', 'pending'), answer('b', 'accepted')] }), NOW)).toBe('answered 2 of 3 · 1 waiting on you')
    expect(wordAskStatusLine(ask({ answered_at: 'x', answers: [answer('a', 'accepted')] }), NOW)).toBe('answered 1 of 3 · all read')
    expect(wordAskStatusLine(ask({ expires_at: '2026-09-30T00:00:00Z' }), NOW)).toBe('asked Tue · the link has run out')
  })
})

describe('the week’s links', () => {
  it('one live link per account man, the newest', () => {
    const live = liveAskByOwner([ask({ id: 'old', revoked_at: '2026-09-29T16:00:00Z' }), ask({ id: 'new', created_at: '2026-09-29T16:00:00Z' }), ask({ id: 'trace', owner_user_id: 'u-trace' })])
    expect([...live.entries()].map(([k, v]) => [k, v.id])).toEqual([
      ['u-malachi', 'new'],
      ['u-trace', 'trace'],
    ])
  })

  it('keeps the answers a rotated link collected; a newer answer for the same GC wins', () => {
    const pending = pendingAnswersByOwner([
      ask({ id: 'old', revoked_at: 'x', answers: [answer('a', 'pending', { note: 'Old answer here.' }), answer('b', 'pending')] }),
      ask({ id: 'new', created_at: '2026-09-30T16:00:00Z', answers: [answer('a', 'pending', { note: 'Newer answer here.' }), answer('c', 'accepted')] }),
    ])
    const rows = pending.get('u-malachi') ?? []
    expect(rows.map((r) => [r.gc_customer_id, r.note])).toEqual([
      ['a', 'Newer answer here.'],
      ['b', 'Fine, no date given.'],
    ])
  })
})

describe('who to ask about', () => {
  it('only the GCs over the line with no word in this week', () => {
    const row = (gcId: string, over: Partial<GcWorklistRow>) => ({ gcId, overLine: true, word: false, skipped: false, ...over }) as GcWorklistRow
    expect(gcIdsToAskAbout({ rows: [row('a', {}), row('b', { word: true }), row('c', { skipped: true }), row('d', { overLine: false })] })).toEqual(['a'])
  })
})

describe('callSheetDraftsFromAnswers', () => {
  it('turns his unread answers into drafts she can change', () => {
    expect(
      callSheetDraftsFromAnswers([
        answer('a', 'pending', { temperature: 'cool', note: 'Missed the 20th.', expected_pay_by: '2026-10-10' }),
        answer('b', 'pending', { no_change: true, temperature: null, note: '' }),
        answer('c', 'accepted'),
        answer('d', 'dismissed'),
      ]),
    ).toEqual({
      a: { temperature: 'cool', note: 'Missed the 20th.', payBy: '2026-10-10', noChange: false },
      b: { temperature: null, note: '', payBy: '', noChange: true },
    })
  })
})
