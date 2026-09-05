import { describe, expect, it } from 'vitest'
import type { TeamFeedbackSettingsRow, TeamFeedbackUserStateRow } from '../teamFeedback'
import type { SourcedReviewRow } from './crewReview'
import {
  buildFeedbackRows,
  daysAgoLabel,
  deckStateFor,
  deckStateLabel,
  feedbackFilterCounts,
  feedbackStats,
  filterFeedbackRows,
  submissionHasWords,
  unreadWordsCount,
  type WordsSubmission,
} from './feedbackTabRows'

const NOW = new Date('2026-09-05T18:00:00Z').getTime()
const DAY = 86_400_000
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString()

const settings = (enabled: boolean): TeamFeedbackSettingsRow => ({ enabled, cadence_days: 14 } as unknown as TeamFeedbackSettingsRow)
const state = (o: Partial<TeamFeedbackUserStateRow>): TeamFeedbackUserStateRow =>
  ({ user_id: 'x', last_completed_at: null, last_skipped_at: null, last_prompt_at: null, snooze_until: null, updated_at: iso(0), ...o }) as TeamFeedbackUserStateRow

describe('deckStateFor', () => {
  it('is Off when the feature is off, whatever the person did', () => {
    expect(deckStateFor(settings(false), state({ last_completed_at: iso(1) }), NOW)).toEqual({ kind: 'off' })
    expect(deckStateLabel({ kind: 'off' }, NOW)).toBe('Off')
  })
  it('never dealt → due; recently done → done with days ago; skipped after done → Skipped', () => {
    expect(deckStateFor(settings(true), null, NOW)).toEqual({ kind: 'due', never: true })
    expect(deckStateLabel({ kind: 'due', never: true }, NOW)).toBe('Never dealt · due')
    const done = deckStateFor(settings(true), state({ last_completed_at: iso(3) }), NOW)
    expect(done.kind).toBe('done')
    expect(deckStateLabel(done, NOW)).toBe('Done · 3d ago')
    const skipped = deckStateFor(settings(true), state({ last_completed_at: iso(10), last_skipped_at: iso(2) }), NOW)
    expect(deckStateLabel(skipped, NOW)).toBe('Skipped · 2d ago')
  })
  it('past the cadence → due again; snoozed → snoozed with the date', () => {
    expect(deckStateFor(settings(true), state({ last_completed_at: iso(20) }), NOW)).toEqual({ kind: 'due', never: false })
    const snoozed = deckStateFor(settings(true), state({ snooze_until: iso(-5), last_skipped_at: iso(2) }), NOW)
    expect(snoozed.kind).toBe('snoozed')
    expect(deckStateLabel(snoozed, NOW)).toMatch(/^Snoozed → /)
  })
  it('daysAgoLabel says today for under a day', () => {
    expect(daysAgoLabel(iso(0.3), NOW)).toBe('today')
    expect(daysAgoLabel(iso(41), NOW)).toBe('41d ago')
  })
})

const sub = (reviewer: string, daysAgo: number, text: string | null): WordsSubmission => ({
  id: `${reviewer}-${daysAgo}`,
  reviewer_user_id: reviewer,
  created_at: iso(daysAgo),
  open_fix_improve: text,
  open_safety_tools: null,
  open_training: null,
  open_anything: null,
})
const review = (subject: string, reviewer: string, month: string, source: 'crew' | 'office', ability: number): SourcedReviewRow => ({
  id: `${subject}-${reviewer}-${month}-${source}`,
  subject_user_id: subject,
  reviewer_user_id: reviewer,
  review_month: month,
  source,
  rating_ability: ability,
  rating_drive: null,
  rating_integrity: null,
  comment_ability: null,
  comment_drive: null,
  comment_integrity: null,
})

describe('buildFeedbackRows', () => {
  const users = [
    { id: 'grace', name: 'Grace', role: 'assistant' },
    { id: 'isiah', name: 'Isiah', role: 'helpers' },
    { id: 'bryan', name: 'Bryan', role: 'primary' },
    { id: 'blank', name: '  ', role: 'helpers' },
  ]
  const states = new Map([['grace', state({ user_id: 'grace', last_completed_at: iso(3) })]])
  const reviews = [review('grace', 'isiah', '2026-09-01', 'crew', 80), review('grace', 'micah', '2026-09-01', 'crew', 78), review('grace', 'rob', '2026-08-01', 'office', 74)]
  const submissions = [sub('grace', 2, 'Truck 4 has no snake'), sub('grace', 16, 'Backflow cert'), sub('isiah', 1, '   ')]
  const recentJobs = [
    { user_id: 'isiah', last_worked_date: iso(4).slice(0, 10) },
    { user_id: 'grace', last_worked_date: iso(120).slice(0, 10) },
  ]
  const rows = buildFeedbackRows({ users, states, settings: settings(true), reviews, submissions, recentJobs, nowMs: NOW })

  it('folds deck state, crew summary, words, and clock activity into one row per user, due first', () => {
    expect(rows.map((r) => r.name)).toEqual(['Bryan', 'Isiah', 'Unnamed', 'Grace'])
    const grace = rows.find((r) => r.userId === 'grace')!
    expect(grace.deck.kind).toBe('done')
    expect(grace.crew.crewRaterCount).toBe(2)
    expect(grace.crew.officeReviewerCount).toBe(1)
    expect(grace.wordsCount).toBe(2)
    expect(grace.lastWordsAt).toBe(iso(2))
    expect(grace.clocksOut).toBe(false)
    const isiah = rows.find((r) => r.userId === 'isiah')!
    expect(isiah.clocksOut).toBe(true)
    expect(isiah.wordsCount).toBe(0)
  })

  it('filters: clocks-out keeps recent clockers plus anyone with ratings or words; due; words; everyone', () => {
    expect(filterFeedbackRows(rows, 'clocks_out', '').map((r) => r.userId).sort()).toEqual(['grace', 'isiah'])
    expect(filterFeedbackRows(rows, 'due', '').map((r) => r.userId).sort()).toEqual(['blank', 'bryan', 'isiah'])
    expect(filterFeedbackRows(rows, 'words', '').map((r) => r.userId)).toEqual(['grace'])
    expect(filterFeedbackRows(rows, 'everyone', 'gr').map((r) => r.userId)).toEqual(['grace'])
    expect(filterFeedbackRows(rows, 'everyone', 'helper').length).toBe(2)
    expect(feedbackFilterCounts(rows)).toEqual({ clocks_out: 2, due: 3, words: 1, everyone: 4 })
  })

  it('stats count due people, subjects rated this month, and words this month; due is null when off', () => {
    expect(feedbackStats(rows, reviews, submissions, '2026-09-01', true)).toEqual({ dueNow: 3, ratedThisMonth: 1, wordsThisMonth: 1 })
    expect(feedbackStats(rows, reviews, submissions, '2026-09-01', false).dueNow).toBeNull()
  })

  it('unread words count respects the device read marker and ignores blank submissions', () => {
    expect(submissionHasWords(sub('x', 0, '  '))).toBe(false)
    expect(unreadWordsCount(submissions, null)).toBe(2)
    expect(unreadWordsCount(submissions, iso(5))).toBe(1)
    expect(unreadWordsCount(submissions, iso(0))).toBe(0)
  })
})
