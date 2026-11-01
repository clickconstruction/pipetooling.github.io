import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { orFilter } from './gmailMineFakes'
import { FOLLOW_WINDOW_DAYS, followSince, followWindow } from './mineFunction'

/** My email's follow window (punch list #230, a follow-up to PR 4): the cron's gate and the function's window are one rule. */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261101172319_gmail_mine_follow_window.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')

describe('the follow window’s migration', () => {
  it('starts with the lock timeout, adds the column and its index only when missing, and makes no table', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(code).toContain('ALTER TABLE public.email_tag_threads ADD COLUMN IF NOT EXISTS last_mail_at timestamptz;')
    expect(code).toContain('CREATE INDEX IF NOT EXISTS email_tag_threads_last_mail ON public.email_tag_threads (last_mail_at);')
    // last_read_at now marks a failed read too, so its comment says so.
    expect(code).toContain('COMMENT ON COLUMN public.email_tag_threads.last_read_at IS')
    expect(code).not.toMatch(/CREATE TABLE/i)
  })

  it('unschedules the cron row before it schedules it again, every five minutes, posting the follow as PR 4 did', () => {
    const unschedule = code.indexOf("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gmail-mine-follow';")
    const schedule = code.indexOf("SELECT cron.schedule(\n  'gmail-mine-follow',\n  '*/5 * * * *',")
    expect(unschedule).toBeGreaterThanOrEqual(0)
    expect(schedule).toBeGreaterThan(unschedule)
    expect(code.match(/cron\.schedule\(/g)).toHaveLength(1)
    expect(code).toContain("(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gmail-mine'")
    expect(code).toContain("'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')")
    expect(code).toContain(`body := '{"action":"follow"}'::jsonb`)
  })

  it('posts only while the function’s window holds a row: the newest mail, or the tag when later, younger than 60 days', () => {
    // The one gate, and never the last read, which kept a conversation that still read in the window for good.
    expect(code.split('\n').filter((l) => l.includes('WHERE EXISTS'))).toEqual([
      `  WHERE EXISTS (SELECT 1 FROM public.email_tag_threads WHERE greatest(last_mail_at, tagged_at) > now() - interval '${FOLLOW_WINDOW_DAYS} days');`,
    ])
    // greatest() passes over a null newest mail, as the function's filter does: the same rows either way.
    const since = followSince(Date.parse('2026-11-01T12:00:00.000Z'))
    const inWindow = orFilter(followWindow(since))
    const greatest = (r: { last_mail_at: string | null; tagged_at: string }) => [r.last_mail_at, r.tagged_at].some((t) => t !== null && t > since)
    for (const r of [
      { last_mail_at: '2026-10-30T00:00:00.000Z', tagged_at: '2026-01-01T00:00:00.000Z' },
      { last_mail_at: '2026-09-01T12:00:00.000Z', tagged_at: '2026-08-01T00:00:00.000Z' },
      { last_mail_at: '2026-08-03T12:00:00.000Z', tagged_at: '2026-10-31T12:00:00.000Z' },
      { last_mail_at: null, tagged_at: '2026-10-30T00:00:00.000Z' },
      { last_mail_at: null, tagged_at: '2026-08-01T00:00:00.000Z' },
    ]) {
      expect(inWindow(r), JSON.stringify(r)).toBe(greatest(r))
    }
  })
})
