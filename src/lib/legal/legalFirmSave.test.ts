/** Punch list #85, item 27: a second active firm is refused in the app's words. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ONE_FIRM_INDEX, legalFirmSaveErrorWords } from './legalFirmSave'

describe('legalFirmSaveErrorWords', () => {
  it('turns the one-firm index refusal into one plain sentence', () => {
    expect(legalFirmSaveErrorWords('duplicate key value violates unique constraint "legal_firms_one_active"')).toBe('One firm at a time: another firm is already active. Reload Settings to edit it.')
  })

  it('keeps any other failure as it was', () => {
    expect(legalFirmSaveErrorWords('new row violates row-level security policy')).toBe('Could not save: new row violates row-level security policy')
    expect(legalFirmSaveErrorWords(null)).toBe('Could not save: unknown error')
  })

  it('names the index the migration creates', () => {
    const sql = readFileSync('supabase/migrations/20261006070144_legal_firms_one_active.sql', 'utf8')
    expect(sql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${ONE_FIRM_INDEX} ON public.legal_firms ((true)) WHERE active;`)
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
  })
})
