import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COUNTY_SAVE_CONFLICT_WORDS, countySaveErrorWords, saveCountyChanges } from './firmCountiesSave'

const dbAnswering = (answer: { data: unknown; error: unknown }) => {
  const rpc = vi.fn(async () => answer)
  return { db: { rpc } as unknown as SupabaseClient, rpc }
}

const CHANGE = [{ county: 'Comal', from: { first: 'alamo', also: [] }, to: { first: 'alamo', also: ['snell'] } }]

describe('saveCountyChanges (v2.6227)', () => {
  it('sends each changed county with its firms, its first call and the firms the picker read', async () => {
    const { db, rpc } = dbAnswering({ data: { ok: true, counties: 1 }, error: null })
    expect(await saveCountyChanges(db, CHANGE)).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('legal_save_county_coverage', { p_counties: [{ county: 'Comal', firms: ['alamo', 'snell'], first_call: 'alamo', was: ['alamo'] }] })
  })
  it('writes nothing for nothing', async () => {
    const { db, rpc } = dbAnswering({ data: null, error: null })
    expect(await saveCountyChanges(db, [])).toEqual({ ok: true })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('a stale county is a conflict; a refusal reads in its own words', async () => {
    expect(await saveCountyChanges(dbAnswering({ data: { error: 'stale', county: 'Comal' }, error: null }).db, CHANGE)).toEqual({ ok: false, conflict: true, message: COUNTY_SAVE_CONFLICT_WORDS })
    expect(await saveCountyChanges(dbAnswering({ data: { error: 'Only a dev can change which firm covers a county.' }, error: null }).db, CHANGE)).toEqual({ ok: false, conflict: false, message: 'Only a dev can change which firm covers a county.' })
  })
  it('before the push, the missing function reads as a database update, not as Postgres', () => {
    expect(countySaveErrorWords({ message: 'Could not find the function public.legal_save_county_coverage(p_counties) in the schema cache', code: 'PGRST202' })).toBe('Saving counties needs a database update that is not live yet. Ask a dev to push it, then try again.')
    expect(countySaveErrorWords({ message: 'timeout' })).toBe('Could not save: timeout')
  })
})
