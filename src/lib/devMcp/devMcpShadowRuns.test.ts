import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SHADOW_RUNS_COLUMNS, SHADOW_RUNS_READ } from '../../../supabase/functions/_shared/devMcpShadowRuns'
import { CATALOG_RPCS } from '../../../supabase/functions/dev-mcp/catalog'

const TYPES = readFileSync('src/types/database.ts', 'utf8')

const SHARED = 'supabase/functions/_shared'
const MIGRATIONS = 'supabase/migrations'

describe('how the dev seat reads the robots’ shadow runs (v2.7947)', () => {
  it('goes through the staff RPC, and every column a plan asks of it is one it answers', () => {
    expect(SHADOW_RUNS_READ).toBe('rpc/list_shadow_runs')
    expect(CATALOG_RPCS.list_shadow_runs).toHaveLength(1)
    // The generated types hold the RPC's whole answer; the seat's catalog cuts it short.
    const from = TYPES.indexOf('list_shadow_runs: {')
    const returns = TYPES.slice(from, TYPES.indexOf('}[]', from))
    expect(returns).toContain('Returns: {')
    for (const c of SHADOW_RUNS_COLUMNS) expect(returns, c).toContain(`${c}:`)
    // The RPC names a run's teacher and its shadow bid by number: it gives neither id, which is why a plan matches by name and by number.
    expect(returns).not.toContain('teacher_user_id:')
    expect(returns).not.toContain('shadow_bid_id:')
  })

  it('the table still has no read policy for a signed-in person, so a direct read answers no rows', () => {
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    const policy = /CREATE POLICY[^;]*\bON\s+(?:public\.|"public"\.)?"?twin_shadow_runs"?[^;]*FOR\s+(SELECT|ALL)\b|CREATE POLICY\s+twin_shadow_runs_select\b/i
    const creates = files.filter((f) => policy.test(readFileSync(`${MIGRATIONS}/${f}`, 'utf8')))
    const drop = '20260901010000_shadow_runs_staff_rpc.sql'
    expect(readFileSync(`${MIGRATIONS}/${drop}`, 'utf8')).toContain('DROP POLICY IF EXISTS twin_shadow_runs_select ON public.twin_shadow_runs;')
    // A read policy made after the drop would make this file's reason stale: say so there, and the direct read may come back.
    expect(creates.filter((f) => f > drop)).toEqual([])
  })

  it('no kernel of the seat and no branch of the server reads the table itself', () => {
    const sources = [...readdirSync(SHARED).filter((f) => /^devMcp.*\.ts$/.test(f)).map((f) => `${SHARED}/${f}`), 'supabase/functions/dev-mcp/index.ts']
    expect(sources.length).toBeGreaterThan(40)
    const direct = /(?:restGet|restRows|restPost)\([^,]+,\s*(?:'[A-Z]+',\s*)?'twin_shadow_runs'|rows\('twin_shadow_runs'|table:\s*'twin_shadow_runs'/
    for (const path of sources) expect(direct.test(readFileSync(path, 'utf8')), path).toBe(false)
  })
})
