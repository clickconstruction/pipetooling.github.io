/**
 * The history of contract wording is written by database triggers, and the trigger on
 * `app_settings` only fires for the keys `contract_text_setting_keys()` lists. This test reads
 * the newest migration that defines that function and fails when the catalog names a Settings
 * text the function does not — a text added to the tab without a history.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contractSettingKeys } from './customerContractCatalog'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')

/** The keys in the newest definition of `contract_text_setting_keys()`. */
export function historyKeysFromMigrations(files: ReadonlyArray<{ name: string; sql: string }>): string[] {
  const defining = files.filter((f) => /CREATE OR REPLACE FUNCTION public\.contract_text_setting_keys\(\)/.test(f.sql)).sort((a, b) => a.name.localeCompare(b.name))
  const newest = defining[defining.length - 1]
  if (!newest) return []
  const body = newest.sql.slice(newest.sql.indexOf('FUNCTION public.contract_text_setting_keys()'))
  const array = /ARRAY\[([\s\S]*?)\]::text\[\]/.exec(body)
  if (!array?.[1]) return []
  return [...array[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!)
}

function realMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(resolve(MIGRATIONS, name), 'utf8') }))
    .filter((f) => f.sql.includes('contract_text_setting_keys'))
}

describe('contract wording history — the keys the trigger records', () => {
  it('reads the newest definition', () => {
    const keys = historyKeysFromMigrations([
      { name: '20260101000000_a.sql', sql: "CREATE OR REPLACE FUNCTION public.contract_text_setting_keys()\nAS $$ SELECT ARRAY['old']::text[] $$;" },
      { name: '20260201000000_b.sql', sql: "CREATE OR REPLACE FUNCTION public.contract_text_setting_keys()\nAS $$ SELECT ARRAY[\n 'one',\n 'two'\n]::text[] $$;" },
      { name: '20260301000000_c.sql', sql: '-- mentions contract_text_setting_keys() and defines nothing' },
    ])
    expect(keys).toEqual(['one', 'two'])
    expect(historyKeysFromMigrations([])).toEqual([])
  })

  it('every Settings text on Contracts & terms has a history', () => {
    const recorded = new Set(historyKeysFromMigrations(realMigrations()))
    expect(recorded.size).toBeGreaterThan(0)
    for (const key of contractSettingKeys()) expect(recorded.has(key), `${key} is on the tab and not in contract_text_setting_keys() — add it in a new migration`).toBe(true)
  })

  it('records nothing the tab does not show', () => {
    const shown = new Set(contractSettingKeys())
    for (const key of historyKeysFromMigrations(realMigrations())) expect(shown.has(key), `${key} is recorded and not on the tab`).toBe(true)
  })
})
