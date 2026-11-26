import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADD_COUNT_NOTE } from './onSite'

/**
 * What makes a box due a count is ruled in the database too (punch list #398): `on_site_door_facts` and
 * `on_site_job_summary` leave a count row out of a box's last count when its note is the add's note, the words
 * `ADD_COUNT_NOTE`. The rule hangs on those words, held as one constant here and copied into the SQL, so this test
 * reads the migration and fails when either side changes alone. The bed `supabase/tests/on_site_guards/70_box_due.sql`
 * plays the functions themselves.
 */
const MIGRATION = 'supabase/migrations/20261126014752_box_due_a_count.sql'

describe('the add’s count note, one constant on both sides (punch list #398)', () => {
  it('the SQL copies ADD_COUNT_NOTE word for word, in both functions', () => {
    const sql = readFileSync(resolve(__dirname, '../../..', MIGRATION), 'utf8')
    const literal = `'${ADD_COUNT_NOTE}'`
    const door = sql.slice(sql.indexOf('FUNCTION public.on_site_door_facts'), sql.indexOf('FUNCTION public.on_site_job_summary'))
    const summary = sql.slice(sql.indexOf('FUNCTION public.on_site_job_summary'))
    expect(door).toContain(`COALESCE(m.note, '') <> ${literal}`)
    expect(summary).toContain(`WHERE note <> ${literal}`)
  })

  it('the words themselves do not change by accident: History and the ledger on prod carry them', () => {
    expect(ADD_COUNT_NOTE).toBe('counted as added')
  })
})
