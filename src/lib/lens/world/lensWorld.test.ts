import { describe, expect, it } from 'vitest'
import { LENS_PEOPLE } from '../lensPeople'
import { buildLensWorld } from './lensWorld'
import { LENS_FUNCTIONS, LENS_RPC, chicagoOffset, lensToday, mondayOf } from './lensWorldAnswers'

const NOW = new Date('2026-10-27T15:00:00Z')
const ctx = (as: keyof typeof LENS_PEOPLE, mood: 'full' | 'empty' = 'full') => {
  const w = buildLensWorld({ as, mood, theme: 'light' }, NOW)
  return { w, c: { viewer: w.viewer, mood: w.mood, store: w.store, now: NOW, readOnly: w.readOnly } }
}

describe('the invented world · its days', () => {
  it('dates everything from today on the company calendar, with Chicago\'s offset that day', () => {
    expect(lensToday(NOW)).toBe('2026-10-27')
    expect(mondayOf('2026-10-27')).toBe('2026-10-26')
    expect(chicagoOffset('2026-10-27')).toBe('-05:00')
    expect(chicagoOffset('2026-12-01')).toBe('-06:00')
    const { w } = ctx('primary')
    expect(w.store.rows('clock_sessions').find((s) => s.user_id === LENS_PEOPLE.primary.id && s.clocked_out_at === null)?.clocked_in_at).toBe('2026-10-27T07:02:00-05:00')
  })

  it('gives a field role only the jobs they work on, and the office every job', () => {
    expect(ctx('helpers').w.store.rows('jobs_ledger').map((j) => j.hcp_number).sort()).toEqual(['1312', '1318'])
    expect(ctx('master_technician').w.store.rows('jobs_ledger')).toHaveLength(5)
    expect(ctx('helpers').w.store.rows('bids')).toEqual([])
  })
})

describe('the invented world · its answers', () => {
  it('builds the crew day from the schedule and the clock, with every list its caller maps over', () => {
    const { c } = ctx('superintendent')
    const day = LENS_RPC.get_crew_day_payload!({ p_day: '2026-10-27' }, c) as Record<string, unknown[]>
    expect(Object.keys(day).sort()).toEqual(['blocks', 'day', 'jobs', 'pct_notes', 'reports', 'sessions', 'users'])
    expect(day.sessions).toHaveLength(3)
    expect(day.blocks).toHaveLength(6)
    expect(day.jobs!.length).toBeGreaterThan(0)
  })

  it('gives the superintendent the days of the people they lead, and everyone else no supervisor view', () => {
    const sup = LENS_RPC.get_supervised_days_payload!({ p_from: '2026-10-20', p_to: '2026-10-28' }, ctx('superintendent').c) as { supervisor: boolean; job_days: { crew: unknown[] }[] }
    expect(sup.supervisor).toBe(true)
    expect(sup.job_days.length).toBeGreaterThan(0)
    expect(sup.job_days.every((d) => Array.isArray(d.crew))).toBe(true)
    expect(LENS_RPC.get_supervised_days_payload!({}, ctx('estimator').c)).toEqual({ supervisor: false })
    const deck = LENS_RPC.get_supervisor_review_deck!({ p_month: '2026-10-01' }, ctx('superintendent').c) as { people: { name: string; days: number }[] }
    expect(deck.people.find((p) => p.name === 'Paco Sample')?.days).toBe(4)
  })

  it('answers the quiet shapes their callers read as empty, and empties out for an empty company', () => {
    expect(LENS_RPC.get_my_partner_summary!({}, ctx('estimator').c)).toEqual({ exists: false })
    expect(LENS_RPC.my_sub_portal_address!({}, ctx('subcontractor').c)).toEqual({ slug: 'sams-plumbing', token: null })
    expect(LENS_RPC.follow_up_count!({}, ctx('assistant', 'empty').c)).toBe(0)
    const bank = LENS_FUNCTIONS['get-mercury-account-balances']!({}, ctx('dev', 'empty').c) as { accounts: unknown[] }
    expect(bank.accounts).toEqual([])
  })

  it('geocodes every address asked for, inside Texas, and writes the points back as the real function does', () => {
    const { w, c } = ctx('dev')
    const out = LENS_FUNCTIONS['geocode-address-batch']!({ addresses: ['  12 Elm  St, Kyle, TX '] }, c) as { results: { address_normalized: string; lat: number; lng: number }[] }
    expect(out.results[0]!.address_normalized).toBe('12 elm st, kyle, tx')
    expect(out.results[0]!.lat).toBeGreaterThan(29.8)
    expect(out.results[0]!.lat).toBeLessThan(30.1)
    expect(w.store.rows('address_geocodes').some((g) => g.address_normalized === '12 elm st, kyle, tx')).toBe(true)
  })
})
