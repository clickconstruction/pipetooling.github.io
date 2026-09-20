import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// catalog.ts is generated from src/types/database.ts. A types regeneration that forgets
// it leaves dev-mcp refusing new tables and RPCs by name — fail here instead.
describe('dev-mcp catalog', () => {
  it('is current with src/types/database.ts', () => {
    const out = execFileSync('node', ['scripts/build-dev-mcp-catalog.mjs', '--check'], { encoding: 'utf8' })
    expect(out).toContain('is current')
  }, 60_000)
})
