import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BID_ACTIONS, BID_ACTION_HEADER, BID_ACTION_SHAPE, BID_APP_ACTIONS, bidActionHeaders, withBidAction } from './bidActionHeader'

const ROOT = resolve(__dirname, '../../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

/** The newest definition of bid_changes_app_actions() across the migrations, as an array of names. */
function sqlAppActions(): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  let found: string[] | null = null
  for (const f of files) {
    const sql = readFileSync(resolve(MIGRATIONS, f), 'utf8')
    const m = /FUNCTION public\.bid_changes_app_actions\(\)[\s\S]*?SELECT ARRAY\[([\s\S]*?)\]::text\[\]/.exec(sql)
    if (m) found = [...m[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]!)
  }
  if (!found) throw new Error('bid_changes_app_actions() not defined in any migration')
  return found
}

describe('bidActionHeader', () => {
  it('every action is a slug the trigger accepts, and none repeats', () => {
    const names = Object.values(BID_ACTIONS)
    for (const n of names) expect(n).toMatch(BID_ACTION_SHAPE)
    expect(new Set(names).size).toBe(names.length)
  })

  it("the app's own actions match bid_changes_app_actions() in the migrations", () => {
    expect([...BID_APP_ACTIONS].sort()).toEqual(sqlAppActions().sort())
    for (const a of BID_APP_ACTIONS) expect(Object.values(BID_ACTIONS)).toContain(a)
  })

  it('tags a query through its header method and returns the same builder', () => {
    const setHeader = vi.fn()
    const query = { setHeader: (name: string, value: string) => { setHeader(name, value); return query } }
    expect(withBidAction(query, BID_ACTIONS.countsImport)).toBe(query)
    expect(setHeader).toHaveBeenCalledWith(BID_ACTION_HEADER, 'counts-import')
    expect(bidActionHeaders(BID_ACTIONS.robotPaste)).toEqual({ 'x-bid-action': 'robot-paste' })
    // A stub with no header method is handed back untouched.
    const bare = { then: () => undefined }
    expect(withBidAction(bare as unknown as { setHeader?: never }, BID_ACTIONS.countsImport)).toBe(bare)
  })
})
