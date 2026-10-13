import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1, APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1 } from '../appSettingsKeys'

/** The morning run's two app_settings rows (Messages, cut 5's PR B). */
const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261014012000_messages_nudge_settings.sql'), 'utf8')
const code = SQL.split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')

describe('the morning run’s settings migration', () => {
  it('starts with the lock timeout', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
  })

  it('seeds the switch and the summary as {}, and never writes over a row that is there', () => {
    expect(code).toContain(`('${APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1}', '{}')`)
    expect(code).toContain(`('${APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1}', '{}')`)
    expect(code).toMatch(/ON CONFLICT \(key\) DO NOTHING;/)
  })

  it('lets the owner or a dev change the switch alone, and gives the summary no policy of its own', () => {
    const policies = [...code.matchAll(/CREATE POLICY (\w+) ON public\.app_settings([\s\S]*?);/g)]
    expect(policies.map((p) => p[1])).toEqual(['master_or_dev_update_messages_nudge_app_sends'])
    const body = policies[0]![2]!
    expect(body).toContain('FOR UPDATE TO authenticated')
    expect(body).toContain(`USING (key = '${APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1}' AND public.is_master_or_dev())`)
    expect(body).toContain(`WITH CHECK (key = '${APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1}' AND public.is_master_or_dev())`)
    expect(code).toContain('DROP POLICY IF EXISTS master_or_dev_update_messages_nudge_app_sends ON public.app_settings;')
    expect(code).not.toContain(`key = '${APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1}'`)
  })

  it('makes no table, so it needs no fences', () => {
    expect(code).not.toMatch(/CREATE TABLE/i)
  })
})
