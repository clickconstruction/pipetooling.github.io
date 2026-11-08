import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * My email's Sent side with no press (punch list #263 PR B, v2.6751): the migration adds the per-person cursor, the
 * two app-placed marks and the tombstone table, closed by the four fences; the function and the client read the names
 * it makes. The function is a Deno file, read here as text.
 */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261108223000_my_email_sent_side.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')
const FUNCTION = readFileSync(join(process.cwd(), 'supabase', 'functions', 'gmail-mine', 'index.ts'), 'utf8')
const IO = readFileSync(join(process.cwd(), 'src', 'lib', 'messages', 'messagesIo.ts'), 'utf8')

describe('the Sent side migration', () => {
  it('starts with the lock timeout, makes the tombstone table once with its key, and closes with the four fences', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(code).toContain('CREATE TABLE IF NOT EXISTS public.email_tag_threads_off (')
    expect(code).toContain('PRIMARY KEY (user_id, gmail_thread_id)')
    expect(code.match(/CREATE TABLE/g)).toHaveLength(1)
    expect(code).toContain('ALTER TABLE public.email_tag_threads_off ENABLE ROW LEVEL SECURITY;')
    expect(code).toContain('REVOKE ALL ON TABLE public.email_tag_threads_off FROM PUBLIC, anon, authenticated;')
    expect(code).toContain('GRANT ALL ON TABLE public.email_tag_threads_off TO service_role;')
    expect(code).not.toMatch(/CREATE POLICY/)
    const tail = code.trim().split('\n').slice(-4)
    expect(tail).toEqual([
      'SELECT public.apply_read_only_write_blocks();',
      'SELECT public.apply_read_only_stmt_blocks();',
      'SELECT public.apply_digital_twin_write_blocks();',
      'SELECT public.apply_archived_read_blocks();',
    ])
  })

  it('adds the cursor and the two marks only when missing, each with its comment, the hot tables last', () => {
    expect(code).toContain('ALTER TABLE public.email_tag_threads ADD COLUMN IF NOT EXISTS placed_by_app boolean NOT NULL DEFAULT false;')
    expect(code).toContain('ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS placed_by_app boolean NOT NULL DEFAULT false;')
    expect(code).toContain('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS my_mail_sent_read_at timestamptz;')
    for (const c of ['public.email_tag_threads.placed_by_app', 'public.messages.placed_by_app', 'public.users.my_mail_sent_read_at']) expect(code).toContain(`COMMENT ON COLUMN ${c} IS`)
    const at = (needle: string) => code.indexOf(needle)
    expect(at('CREATE TABLE IF NOT EXISTS public.email_tag_threads_off')).toBeLessThan(at('ALTER TABLE public.email_tag_threads ADD COLUMN'))
    expect(at('ALTER TABLE public.email_tag_threads ADD COLUMN')).toBeLessThan(at('ALTER TABLE public.messages ADD COLUMN'))
    expect(at('ALTER TABLE public.messages ADD COLUMN')).toBeLessThan(at('ALTER TABLE public.users ADD COLUMN'))
    expect(code).not.toMatch(/cron\./)
  })

  it('names the columns and the table the function and the client read and write', () => {
    expect(FUNCTION).toContain("const FOLLOW_USER_COLUMNS = 'id, name, email, role, read_only, is_sample, is_digital_twin, is_walk_tester, my_mail_on, archived_at, my_mail_hidden_labels, my_mail_sent_read_at'")
    expect(FUNCTION).toContain("update({ my_mail_sent_read_at: nowIso() }).eq('id', me.id).is('my_mail_sent_read_at', null)")
    expect(FUNCTION).toContain('placed_by_app: true, tied_line_ids:')
    expect(FUNCTION).toContain("update({ placed_by_app: true }).eq('id', landed.lineId)")
    expect(FUNCTION).toContain("from('email_tag_threads_off').upsert(")
    expect(FUNCTION).toContain("from('email_tag_threads_off').delete().eq('user_id', me.id).eq('gmail_thread_id', ask.threadId)")
    expect(FUNCTION).toContain("from('email_tag_threads_off').select('gmail_thread_id')")
    // The thread's read carries the mark, whose box and the conversation, so the line draws the mark and Untag.
    expect(IO).toContain('body_html_path, placed_by_app, mail_user_id, gmail_thread_id')
  })
})
