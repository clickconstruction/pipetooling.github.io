import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * My email's untag and the tag's ties (punch list #230, v2.6292): the migration adds the two columns the function reads
 * and writes, and nothing else. The function is a Deno file, read here as text.
 */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261101183219_gmail_mine_untag_and_ties.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')
const FUNCTION = readFileSync(join(process.cwd(), 'supabase', 'functions', 'gmail-mine', 'index.ts'), 'utf8')

describe('the untag and ties migration', () => {
  it('starts with the lock timeout and adds both columns only when missing, in one statement', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(code).toContain(
      'ALTER TABLE public.email_tag_threads\n  ADD COLUMN IF NOT EXISTS untagging_at timestamptz,\n  ADD COLUMN IF NOT EXISTS tied_line_ids uuid[] NOT NULL DEFAULT \'{}\';',
    )
    expect(code.match(/ALTER TABLE/g)).toHaveLength(1)
  })

  it('says what each column is for, and makes no table, no function and no cron row, so no fence is owed', () => {
    expect(code).toContain('COMMENT ON COLUMN public.email_tag_threads.untagging_at IS')
    expect(code).toContain('COMMENT ON COLUMN public.email_tag_threads.tied_line_ids IS')
    expect(code).not.toMatch(/CREATE (TABLE|OR REPLACE FUNCTION|FUNCTION|INDEX)/i)
    expect(code).not.toMatch(/cron\./)
  })

  it('names the columns the function reads and writes', () => {
    // The untag marks the row first, the follow passes a marked row by, and a tag clears the mark.
    expect(FUNCTION).toContain("update({ untagging_at: nowIso() })")
    expect(FUNCTION).toContain(".is('untagging_at', null)")
    expect(FUNCTION).toContain('untagging_at: null, tied_line_ids: withTies(record?.tied, ties)')
    // The tag and the untag read the record, and the follow adds to it.
    expect(FUNCTION).toContain("const TAG_ROW_COLUMNS = 'id, bid_id, project_id, jobs_ledger_id, tagged_by, tied_line_ids'")
    expect(FUNCTION).toContain('update({ tied_line_ids: withTies(live.tied_line_ids, ids) })')
  })
})
