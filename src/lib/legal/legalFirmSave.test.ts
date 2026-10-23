/** Punch list #85, item 27, then #144: the one-firm index's refusal in the app's words. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ONE_FIRM_INDEX, legalFirmSaveErrorWords } from './legalFirmSave'

describe('legalFirmSaveErrorWords', () => {
  it('turns the one-firm index refusal into one plain sentence about the migration', () => {
    expect(legalFirmSaveErrorWords('duplicate key value violates unique constraint "legal_firms_one_active"')).toBe('The database still holds one firm at a time. Push the v2.5756 migration, then add the second firm.')
  })

  it('keeps any other failure as it was', () => {
    expect(legalFirmSaveErrorWords('new row violates row-level security policy')).toBe('Could not save: new row violates row-level security policy')
    expect(legalFirmSaveErrorWords(null)).toBe('Could not save: unknown error')
  })

  it('names the index v2.4641 created and v2.5756 drops', () => {
    const made = readFileSync('supabase/migrations/20261006070144_legal_firms_one_active.sql', 'utf8')
    expect(made).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${ONE_FIRM_INDEX} ON public.legal_firms ((true)) WHERE active;`)
    const dropped = readFileSync('supabase/migrations/20261023010000_legal_firm_counties.sql', 'utf8')
    expect(dropped).toContain(`DROP INDEX IF EXISTS public.${ONE_FIRM_INDEX};`)
    expect(dropped.startsWith("SET lock_timeout = '3s';")).toBe(true)
  })
})
