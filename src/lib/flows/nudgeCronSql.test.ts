import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUN_HOUR, runHourNow } from './nudgeRunLog'

/** The morning run's cron (Messages, cut 5's PR D). */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261014190000_messages_nudge_cron.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')

describe('the morning run’s cron migration', () => {
  it('starts with the lock timeout, and unschedules the job before it schedules it, so a second push makes one job', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    const unschedule = code.indexOf("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'messages-nudge-dispatch';")
    const schedule = code.indexOf("SELECT cron.schedule(\n  'messages-nudge-dispatch',")
    expect(unschedule).toBeGreaterThanOrEqual(0)
    expect(schedule).toBeGreaterThan(unschedule)
    expect(code.match(/cron\.schedule\(/g)).toHaveLength(1)
  })

  it('fires at 14:00 and 15:00 UTC, and one of the two is always 9 AM Central', () => {
    expect(code).toContain("'0 14,15 * * *'")
    for (const day of ['2026-07-01', '2026-11-01', '2026-12-15', '2027-03-14']) {
      const ticks = [14, 15].map((h) => runHourNow(new Date(`${day}T${String(h).padStart(2, '0')}:00:00Z`)))
      expect(ticks.filter(Boolean)).toHaveLength(1)
    }
    expect(RUN_HOUR).toBe(9)
  })

  it('posts an empty body to the function with the cron secret, both read from the vault', () => {
    expect(code).toContain("(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/messages-nudge-dispatch'")
    expect(code).toContain("'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')")
    expect(code).toContain("body := '{}'::jsonb")
    expect(code).not.toMatch(/"dry"/)
  })

  it('makes no table, so it needs no fences', () => {
    expect(code).not.toMatch(/CREATE TABLE/i)
  })
})
