import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- A recording, chainable Supabase stand-in ---------------------------------------------
// Every builder method records itself and returns the builder; awaiting the builder hands the
// recorded chain to a per-test handler that decides the {data, error} to return. The real
// withSupabaseRetry would add backoff on failures, so it is replaced by a passthrough.
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string; code?: string } | null }
type Handler = (table: string, steps: Step[]) => Result

let handler: Handler = () => ({ data: null, error: null })
const calls: Array<{ table: string; steps: Step[] }> = []
let authUser: { id: string } | null = { id: 'me' }

function builder(table: string): unknown {
  const steps: Step[] = []
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
            calls.push({ table, steps })
            try {
              resolve(handler(table, steps))
            } catch (e) {
              reject(e)
            }
          }
        }
        return (...args: unknown[]) => {
          steps.push({ method: String(prop), args })
          return p
        }
      },
    },
  )
  return p
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (name: string, args: unknown) => {
      const b = builder(`rpc:${name}`) as { rpc: (a: unknown) => unknown }
      return b.rpc(args)
    },
    auth: { getUser: async () => ({ data: { user: authUser }, error: null }) },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<Result>, name: string) => {
    const r = await op()
    if (r.error) throw new Error(`${name}: ${r.error.message}`)
    return r.data
  },
}))

import {
  computeCyclePeriodStart,
  computeTeamFeedbackEligibilityDetail,
  fetchAllTeamFeedbackUserStates,
  fetchCrewReviewAggregates,
  fetchCrewTeammates,
  fetchLastTeamFeedbackSubmissionCreatedAt,
  fetchMyCrewRatedThisMonth,
  getTeamFeedbackEligibility,
  markCrewDeckCompleted,
  resetTeamFeedbackUserStateEligibilityForDev,
  resolveManagerUserIdForFeedback,
  submitOpenWords,
  type TeamFeedbackSettingsRow,
  type TeamFeedbackUserStateRow,
} from './teamFeedback'

const settings = (p: Partial<TeamFeedbackSettingsRow> = {}): TeamFeedbackSettingsRow => ({ enabled: true, cadence_days: 14, ...p }) as unknown as TeamFeedbackSettingsRow
const state = (p: Partial<TeamFeedbackUserStateRow> = {}): TeamFeedbackUserStateRow =>
  ({ user_id: 'me', last_completed_at: null, last_skipped_at: null, snooze_until: null, last_prompt_at: null, ...p }) as unknown as TeamFeedbackUserStateRow
const DAY = 86_400_000
const NOW = new Date('2026-09-06T12:00:00Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const stepsOf = (table: string) => calls.find((c) => c.table === table)?.steps ?? []
const step = (table: string, method: string) => stepsOf(table).find((s) => s.method === method)

beforeEach(() => {
  calls.length = 0
  handler = () => ({ data: null, error: null })
  authUser = { id: 'me' }
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => vi.useRealTimers())

describe('computeCyclePeriodStart', () => {
  it('buckets dates into cadence-sized periods anchored at 2024-01-01', () => {
    expect(computeCyclePeriodStart(14, new Date('2024-01-01T12:00:00Z'))).toBe('2024-01-01')
    expect(computeCyclePeriodStart(14, new Date('2024-01-14T23:59:00Z'))).toBe('2024-01-01')
    expect(computeCyclePeriodStart(14, new Date('2024-01-15T12:00:00Z'))).toBe('2024-01-15')
    expect(computeCyclePeriodStart(30, new Date('2026-09-06T12:00:00Z'))).toBe('2026-08-18') // day 979 → period 32 → day 960
  })
  it('a moment before the anchor falls into the previous period', () => {
    expect(computeCyclePeriodStart(14, new Date('2024-01-01T11:59:59Z'))).toBe('2023-12-18')
  })
  it('defaults to now', () => {
    expect(computeCyclePeriodStart(14)).toBe(computeCyclePeriodStart(14, new Date(NOW)))
  })
})

describe('computeTeamFeedbackEligibilityDetail', () => {
  it('disabled beats everything', () => {
    expect(computeTeamFeedbackEligibilityDetail(null, state(), NOW)).toEqual({ eligible: false, reason: 'disabled', earliestEligibleAt: null })
    expect(computeTeamFeedbackEligibilityDetail(settings({ enabled: false }), state(), NOW).reason).toBe('disabled')
  })
  it('no state at all is eligible', () => {
    expect(computeTeamFeedbackEligibilityDetail(settings(), null, NOW)).toEqual({ eligible: true, reason: 'ok', earliestEligibleAt: null })
  })
  it('an active snooze wins over cadence, and its earliest instant is the later of the two barriers', () => {
    const r = computeTeamFeedbackEligibilityDetail(settings(), state({ snooze_until: iso(NOW + 2 * DAY), last_completed_at: iso(NOW - DAY) }), NOW)
    expect(r.reason).toBe('snoozed')
    expect(r.earliestEligibleAt?.getTime()).toBe(NOW - DAY + 14 * DAY) // cadence clears later than the snooze
    const r2 = computeTeamFeedbackEligibilityDetail(settings(), state({ snooze_until: iso(NOW + 20 * DAY), last_completed_at: iso(NOW - DAY) }), NOW)
    expect(r2.earliestEligibleAt?.getTime()).toBe(NOW + 20 * DAY)
  })
  it('an expired snooze is ignored', () => {
    expect(computeTeamFeedbackEligibilityDetail(settings(), state({ snooze_until: iso(NOW - 1) }), NOW).reason).toBe('ok')
  })
  it('cadence counts from the later of completed and skipped, and clears exactly at cadence_days', () => {
    const r = computeTeamFeedbackEligibilityDetail(settings(), state({ last_completed_at: iso(NOW - 10 * DAY), last_skipped_at: iso(NOW - 3 * DAY) }), NOW)
    expect(r).toEqual({ eligible: false, reason: 'cadence', earliestEligibleAt: new Date(NOW - 3 * DAY + 14 * DAY) })
    expect(computeTeamFeedbackEligibilityDetail(settings(), state({ last_completed_at: iso(NOW - 14 * DAY) }), NOW).reason).toBe('ok')
    expect(computeTeamFeedbackEligibilityDetail(settings(), state({ last_completed_at: iso(NOW - 14 * DAY + 1) }), NOW).reason).toBe('cadence')
  })
})

describe('getTeamFeedbackEligibility', () => {
  it('combines settings and state through the same rules', async () => {
    handler = (table) =>
      table === 'team_feedback_settings' ? { data: settings(), error: null } : { data: state({ last_completed_at: iso(NOW - DAY) }), error: null }
    expect(await getTeamFeedbackEligibility('me')).toEqual({ eligible: false, reason: 'cadence' })
    expect(step('team_feedback_user_state', 'eq')?.args).toEqual(['user_id', 'me'])
  })
  it('any failure reads as the error reason, not a throw', async () => {
    handler = () => ({ data: null, error: { message: 'boom' } })
    expect(await getTeamFeedbackEligibility('me')).toEqual({ eligible: false, reason: 'error' })
  })
})

describe('resolveManagerUserIdForFeedback', () => {
  const me = (role: string, email: string | null = 'Pat@Example.com') => ({ role, email })
  it('masters and devs are their own manager', async () => {
    handler = () => ({ data: me('master_technician'), error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBe('me')
    handler = () => ({ data: me('dev'), error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBe('me')
    expect(calls.map((c) => c.table)).toEqual(['users', 'users'])
  })
  it('assistant-likes resolve through their first adopting master, else null', async () => {
    handler = (table) => (table === 'users' ? { data: me('controller'), error: null } : { data: [{ master_id: 'M1' }], error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBe('M1')
    expect(step('master_assistants', 'eq')?.args).toEqual(['assistant_id', 'me'])
    handler = (table) => (table === 'users' ? { data: me('assistant'), error: null } : { data: [], error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBeNull()
  })
  it('superintendents resolve through master_superintendents', async () => {
    handler = (table) => (table === 'users' ? { data: me('superintendent'), error: null } : { data: [{ master_id: 'M2' }], error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBe('M2')
    expect(step('master_superintendents', 'eq')?.args).toEqual(['superintendent_id', 'me'])
  })
  it('field roles resolve through the roster person with the same email, lowercased; no email → null', async () => {
    handler = (table) => (table === 'users' ? { data: me('subcontractor'), error: null } : { data: [{ master_user_id: 'M3' }], error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBe('M3')
    expect(step('people', 'ilike')?.args).toEqual(['email', 'pat@example.com'])
    expect(step('people', 'is')?.args).toEqual(['archived_at', null])
    handler = () => ({ data: me('helpers', '  '), error: null })
    expect(await resolveManagerUserIdForFeedback('me')).toBeNull()
  })
  it('an unknown user → null', async () => {
    handler = () => ({ data: null, error: null })
    expect(await resolveManagerUserIdForFeedback('ghost')).toBeNull()
  })
})

describe('crew deck reads', () => {
  it('fetchCrewTeammates passes the lookback and extra ids, and normalises jobs to an array', async () => {
    handler = () => ({ data: [{ user_id: 'u2', name: 'Marcus', role: 'helpers', days_together: 3, jobs: ['J1'] }, { user_id: 'u3', name: null, role: 'subcontractor', days_together: 1, jobs: null }], error: null })
    const out = await fetchCrewTeammates(30, ['lead-1'])
    expect(calls[0]).toEqual({ table: 'rpc:crew_review_teammates', steps: [{ method: 'rpc', args: [{ p_lookback_days: 30, p_extra_user_ids: ['lead-1'] }] }] })
    expect(out.map((t) => t.jobs)).toEqual([['J1'], []])
  })
  it('fetchMyCrewRatedThisMonth returns the subject ids as a set, scoped to me / crew / month', async () => {
    handler = () => ({ data: [{ subject_user_id: 'u2' }, { subject_user_id: 'u2' }, { subject_user_id: 'u3' }], error: null })
    expect(await fetchMyCrewRatedThisMonth('me', '2026-09')).toEqual(new Set(['u2', 'u3']))
    expect(stepsOf('team_member_reviews').filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([
      ['reviewer_user_id', 'me'],
      ['source', 'crew'],
      ['review_month', '2026-09'],
    ])
  })
  it('fetchCrewReviewAggregates coerces numeric strings and keeps nulls', async () => {
    handler = () => ({ data: [{ subject_user_id: 'u2', review_month: '2026-09', rating_ability: '4.5', rating_drive: null, rating_integrity: 5, rater_count: 2 }], error: null })
    expect(await fetchCrewReviewAggregates()).toEqual([{ subject_user_id: 'u2', review_month: '2026-09', rating_ability: 4.5, rating_drive: null, rating_integrity: 5, rater_count: 2 }])
    expect(await fetchCrewReviewAggregates()).toEqual(expect.any(Array))
  })
  it('fetchLastTeamFeedbackSubmissionCreatedAt and fetchAllTeamFeedbackUserStates', async () => {
    handler = () => ({ data: [{ created_at: '2026-09-01T00:00:00Z' }], error: null })
    expect(await fetchLastTeamFeedbackSubmissionCreatedAt()).toBe('2026-09-01T00:00:00Z')
    handler = () => ({ data: [], error: null })
    expect(await fetchLastTeamFeedbackSubmissionCreatedAt()).toBeNull()
    handler = () => ({ data: [state({ user_id: 'a' }), state({ user_id: 'b' })], error: null })
    const map = await fetchAllTeamFeedbackUserStates()
    expect([...map.keys()]).toEqual(['a', 'b'])
  })
})

describe('crew deck writes', () => {
  it('submitOpenWords refuses without a session', async () => {
    authUser = null
    await expect(submitOpenWords({ source: 'home_button', cadenceDays: 14, managerUserId: null, fixImprove: '', safetyTools: '', training: '', anything: '' })).rejects.toThrow('Not authenticated')
    expect(calls).toHaveLength(0)
  })
  it('submitOpenWords inserts the trimmed answers (blank → null) with the cycle start and reviewer', async () => {
    handler = () => ({ data: null, error: null })
    await submitOpenWords({ source: 'clock_out_prompt', cadenceDays: 14, managerUserId: 'M1', fixImprove: '  fix the van  ', safetyTools: '   ', training: 'more', anything: '' })
    expect(step('team_feedback_submissions', 'insert')?.args).toEqual([
      {
        reviewer_user_id: 'me',
        source: 'clock_out_prompt',
        cycle_period_start: computeCyclePeriodStart(14, new Date(NOW)),
        manager_user_id: 'M1',
        open_fix_improve: 'fix the van',
        open_safety_tools: null,
        open_training: 'more',
        open_anything: null,
      },
    ])
  })
  it('markCrewDeckCompleted stamps completion now and clears any snooze', async () => {
    await markCrewDeckCompleted('me')
    expect(step('team_feedback_user_state', 'upsert')?.args).toEqual([
      { user_id: 'me', updated_at: iso(NOW), last_completed_at: iso(NOW), snooze_until: null },
      { onConflict: 'user_id' },
    ])
  })
  it('resetTeamFeedbackUserStateEligibilityForDev reports whether a row was touched', async () => {
    handler = () => ({ data: [{ user_id: 'u2' }], error: null })
    expect(await resetTeamFeedbackUserStateEligibilityForDev('u2')).toBe('updated')
    expect(step('team_feedback_user_state', 'update')?.args).toEqual([{ snooze_until: null, last_completed_at: null, last_skipped_at: null, last_prompt_at: null, updated_at: iso(NOW) }])
    handler = () => ({ data: [], error: null })
    expect(await resetTeamFeedbackUserStateEligibilityForDev('u2')).toBe('no_row')
  })
})
