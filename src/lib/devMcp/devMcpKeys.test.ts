import { describe, expect, it } from 'vitest'
import { DEV_MCP_ENV_VAR, devMcpKeyLabel, devMcpShellLine, formatDevMcpKey, splitDevMcpKeys } from './devMcpKeys'

describe('devMcpKeys', () => {
  it('prefixes a key and writes the shell line around it', () => {
    const key = formatDevMcpKey('ab12')
    expect(key).toBe('ptd_ab12')
    expect(devMcpShellLine(key)).toBe(`export ${DEV_MCP_ENV_VAR}='ptd_ab12'`)
  })

  it('never stores an empty label', () => {
    expect(devMcpKeyLabel('  ')).toBe('unlabeled')
    expect(devMcpKeyLabel("  Robert's MacBook ")).toBe("Robert's MacBook")
    expect(devMcpKeyLabel('x'.repeat(200))).toHaveLength(80)
  })

  it('splits live from revoked', () => {
    const rows = [
      { id: '1', label: 'a', created_at: '', last_used_at: null, revoked_at: null },
      { id: '2', label: 'b', created_at: '', last_used_at: null, revoked_at: '2026-09-20T00:00:00Z' },
    ]
    const { live, revoked } = splitDevMcpKeys(rows)
    expect(live.map((r) => r.id)).toEqual(['1'])
    expect(revoked.map((r) => r.id)).toEqual(['2'])
  })
})
