import { describe, expect, it } from 'vitest'
import { DEV_MCP_ENV_VAR, devMcpConnectorHeader, devMcpKeyLabel, devMcpSetupCommand, devMcpShellLine, formatDevMcpKey, splitDevMcpKeys } from './devMcpKeys'

describe('devMcpKeys', () => {
  it('prefixes a key and writes the shell line around it', () => {
    const key = formatDevMcpKey('ab12')
    expect(key).toBe('ptd_ab12')
    expect(devMcpShellLine(key)).toBe(`export ${DEV_MCP_ENV_VAR}='ptd_ab12'`)
  })

  it('the setup command replaces an old line, appends the shell line to ~/.zshrc, and says what to do next', () => {
    const cmd = devMcpSetupCommand('ptd_ab12')
    expect(cmd).toContain(`sed -i '' '/^export ${DEV_MCP_ENV_VAR}=/d' ~/.zshrc`)
    expect(cmd).toContain(`echo "export ${DEV_MCP_ENV_VAR}='ptd_ab12'" >> ~/.zshrc`)
    expect(cmd).toContain('quit Claude Code and open it again')
    expect(cmd.split('\n')).toHaveLength(1) // one line: one paste, one Return
  })

  it('the connector header carries the scheme, because Claude sends the value exactly as typed', () => {
    expect(devMcpConnectorHeader('ptd_ab12')).toBe('Bearer ptd_ab12')
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
