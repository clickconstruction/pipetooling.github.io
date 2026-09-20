import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// catalog.ts is generated from src/types/database.ts and the supabase/functions/ folder. A types
// regeneration that forgets it leaves dev-mcp refusing new tables and RPCs by name, and a new edge
// function it never heard of is one check_edge_boot never probes — fail here instead
// (`node scripts/build-dev-mcp-catalog.mjs` rewrites it).
describe('dev-mcp catalog', () => {
  it('is current with src/types/database.ts and supabase/functions/', () => {
    const out = execFileSync('node', ['scripts/build-dev-mcp-catalog.mjs', '--check'], { encoding: 'utf8' })
    expect(out).toContain('is current')
  }, 60_000)
})
