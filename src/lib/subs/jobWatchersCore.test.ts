import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import { buildWatchEmail, recipientsFor, resolveWatchers, shouldFold } from '../../../supabase/functions/_shared/jobWatchersCore'

describe('jobWatchersCore', () => {
  it('folds assigned superintendents in with defaults and lets explicit rows override', () => {
    const w = resolveWatchers(
      [
        { user_id: 'u-taunya', hear_progress: true, hear_done: true, hear_dates: true, source: 'manual' },
        { user_id: 'u-robert', hear_progress: true, hear_done: false, hear_dates: false, source: 'manual' },
      ],
      ['u-robert', 'u-malachi'],
    )
    expect(w.map((x) => `${x.userId}:${x.source}:${x.hears.progress ? 'p' : ''}${x.hears.done ? 'd' : ''}${x.hears.dates ? 't' : ''}`)).toEqual(['u-malachi:assigned:pd', 'u-robert:assigned:p', 'u-taunya:manual:pdt'])
    expect(recipientsFor(w, 'done').map((x) => x.userId)).toEqual(['u-malachi', 'u-taunya'])
    expect(recipientsFor(w, 'dates').map((x) => x.userId)).toEqual(['u-taunya'])
    expect(resolveWatchers([], [])).toEqual([])
  })

  it('folds a second send inside the hour', () => {
    const now = Date.parse('2026-09-06T15:00:00Z')
    expect(shouldFold('2026-09-06T14:30:00Z', now)).toBe(true)
    expect(shouldFold('2026-09-06T13:30:00Z', now)).toBe(false)
    expect(shouldFold(null, now)).toBe(false)
    expect(shouldFold('junk', now)).toBe(false)
  })

  it('builds one template for the three kinds', () => {
    const e = buildWatchEmail({ kind: 'progress', jobLabel: '#1004 · Summit General', jobAddress: '2210 Goforth Rd', subName: 'Behar Kraja', line: 'Behar Kraja · 50% along on their part', detail: '“Cleanout is behind the water heater”', appOrigin: 'https://clicktooling.com/', jobNumber: '1004' })
    expect(e.subject).toBe('#1004 · Behar Kraja · 50% along on their part')
    expect(e.text).toContain('Sub progress — #1004 · Summit General')
    expect(e.text).toContain('https://clicktooling.com/jobs?tab=subs')
    expect(e.html).toContain('Open Jobs → Subs')
    expect(e.html).toContain('Cleanout')
    expect(buildWatchEmail({ kind: 'done', jobLabel: 'x', jobAddress: null, subName: 's', line: 'done', detail: null, appOrigin: 'https://a', jobNumber: null }).subject).toBe('done')
  })
})
