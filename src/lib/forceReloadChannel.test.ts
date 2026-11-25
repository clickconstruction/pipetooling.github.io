import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FORCE_RELOAD_CHANNEL_OPTIONS,
  FORCE_RELOAD_EVENT,
  FORCE_RELOAD_MESSAGE,
  FORCE_RELOAD_TOPIC,
} from './forceReloadChannel'

const MIGRATION = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261124215500_global_reload_dev_only.sql'),
  'utf8',
)
/** The SQL with its comments taken out, so a word in a comment proves nothing. */
const SQL = MIGRATION.replace(/--.*$/gm, '')

/** One policy's own statement, from CREATE POLICY to its semicolon. */
function policy(name: string): string {
  const found = new RegExp(`CREATE POLICY ${name} ON realtime\\.messages[^;]*;`).exec(SQL)
  if (!found) throw new Error(`the migration makes no policy named ${name}`)
  return found[0]
}

describe('Global Reload’s channel (v2.8532)', () => {
  it('is private: without that the app would hear the open channel anyone can send on', () => {
    expect(FORCE_RELOAD_CHANNEL_OPTIONS).toEqual({ config: { private: true } })
  })

  it('sends one broadcast event that carries nothing', () => {
    expect(FORCE_RELOAD_MESSAGE).toEqual({ type: 'broadcast', event: FORCE_RELOAD_EVENT, payload: {} })
  })

  it('keeps the topic and the event the app has always used, so the names in the docs still hold', () => {
    expect(FORCE_RELOAD_TOPIC).toBe('force-reload')
    expect(FORCE_RELOAD_EVENT).toBe('force_reload')
  })
})

describe('the migration’s two policies name the same channel', () => {
  it('lets anyone signed in hear the topic’s broadcasts, and names no other topic', () => {
    const hear = policy('force_reload_signed_in_hear')
    expect(hear).toContain('FOR SELECT TO authenticated')
    expect(hear).toContain(`(SELECT realtime.topic()) = '${FORCE_RELOAD_TOPIC}'`)
    expect(hear).toContain("realtime.messages.extension = 'broadcast'")
    expect(hear).not.toContain('is_dev')
  })

  it('lets only a dev send on it', () => {
    const send = policy('force_reload_dev_send')
    expect(send).toContain('FOR INSERT TO authenticated')
    expect(send).toContain(`(SELECT realtime.topic()) = '${FORCE_RELOAD_TOPIC}'`)
    expect(send).toContain("realtime.messages.extension = 'broadcast'")
    expect(send).toContain('(SELECT public.is_dev())')
  })

  it('makes those two policies and no third, and gives the signed-out nothing', () => {
    expect(SQL.match(/CREATE POLICY/g)).toHaveLength(2)
    expect(SQL).not.toMatch(/\banon\b/)
    expect(SQL).not.toMatch(/TO public\b/i)
  })

  it('never alters Realtime’s own table, which would fail the whole migration', () => {
    expect(SQL).not.toMatch(/ALTER TABLE/i)
  })

  it('starts with the lock timeout and can run twice', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(SQL.match(/DROP POLICY IF EXISTS/g)).toHaveLength(2)
  })
})
