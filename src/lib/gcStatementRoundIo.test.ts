import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { MARK_WORD_COLUMNS, isMissingColumnError, withoutWordColumns } from './gcStatementRoundIo'

describe('the word columns, before and after the migration', () => {
  it('knows a missing column from any other failure', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column gc_statement_round_marks.word_at does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'word_at' column of 'gc_statement_round_marks' in the schema cache" })).toBe(true)
    expect(isMissingColumnError({ message: 'column "word_from_name" does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
  })

  it('strips only the word columns from a write', () => {
    const row = { week_start: '2026-09-21', gc_customer_id: 'gc', action: 'contacted', temperature: 'warm', note: 'Warm.', word_from_user_id: 'u', word_from_name: 'Malachi', word_heard_via: 'call', word_entered_by: 't', word_entered_by_name: 'Taunya', word_at: '2026-09-25T18:00:00Z' }
    expect(withoutWordColumns(row)).toEqual({ week_start: '2026-09-21', gc_customer_id: 'gc', action: 'contacted', temperature: 'warm', note: 'Warm.' })
    expect(MARK_WORD_COLUMNS).toHaveLength(6)
  })
})
