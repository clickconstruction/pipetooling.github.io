import { describe, expect, it } from 'vitest'
import { DEV_MCP_CLAUDE_SETTINGS_PATH, DEV_MCP_ENV_VAR, devMcpConnectorHeader, devMcpKeyCanCopy, devMcpKeyLabel, devMcpSettingsWrite, devMcpSetupCommand, devMcpShellLine, formatDevMcpKey, isMissingColumnError, isMissingFunctionError, lastRevealByKey, splitDevMcpKeys } from './devMcpKeys'

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

  it('the setup command also writes the key into Claude Code\u2019s settings, merging, with python3 behind node (v2.6123)', () => {
    const cmd = devMcpSetupCommand('ptd_ab12')
    const write = devMcpSettingsWrite('ptd_ab12')
    expect(cmd).toContain(write)
    expect(DEV_MCP_CLAUDE_SETTINGS_PATH).toBe('$HOME/.claude/settings.json')
    expect(write.startsWith('mkdir -p "$HOME/.claude" && (node -e ')).toBe(true)
    expect(write).toContain(' 2>/dev/null || python3 -c ')
    // the key is an argument to both scripts, never text inside them
    expect(write.match(/'ptd_ab12'/g)).toHaveLength(2)
    // a settings file that exists but is not JSON throws in both scripts, so the command prints no Saved
    expect(write).toContain('if(fs.existsSync(p))j=JSON.parse(fs.readFileSync(p,"utf8"))')
    expect(write).toContain(`j.env=Object.assign({},j.env||{},{${DEV_MCP_ENV_VAR}:k})`)
    expect(write).toContain(`j["env"]=dict(j.get("env") or {},**{"${DEV_MCP_ENV_VAR}":k})`)
    // the settings write runs before the Saved, so a failed write prints no Saved
    expect(cmd.indexOf(write)).toBeLessThan(cmd.indexOf('Saved.'))
    expect(cmd.split('\n')).toHaveLength(1)
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

  it('offers Copy on a live key with a Vault secret only (v2.5899)', () => {
    const base = { id: '1', label: 'a', created_at: '', last_used_at: null }
    expect(devMcpKeyCanCopy({ ...base, revoked_at: null, secret_id: 'vault-1' })).toBe(true)
    expect(devMcpKeyCanCopy({ ...base, revoked_at: null, secret_id: null })).toBe(false)
    expect(devMcpKeyCanCopy({ ...base, revoked_at: null })).toBe(false)
    expect(devMcpKeyCanCopy({ ...base, revoked_at: '2026-10-26T00:00:00Z', secret_id: 'vault-1' })).toBe(false)
  })

  it('keeps the newest reveal per key, whatever order the log comes in', () => {
    const last = lastRevealByKey([
      { credential_id: 'k1', created_at: '2026-10-26T10:00:00Z' },
      { credential_id: 'k1', created_at: '2026-10-26T12:00:00Z' },
      { credential_id: 'k2', created_at: '2026-10-25T09:00:00Z' },
      { credential_id: null, created_at: '2026-10-26T13:00:00Z' },
    ])
    expect(last).toEqual({ k1: '2026-10-26T12:00:00Z', k2: '2026-10-25T09:00:00Z' })
  })

  it('tells the migration window apart from a real error', () => {
    expect(isMissingColumnError({ message: 'column dev_mcp_credentials.secret_id does not exist', code: '42703' })).toBe(true)
    expect(isMissingColumnError({ message: 'column dev_mcp_credentials.secret_id does not exist' })).toBe(true)
    expect(isMissingColumnError({ message: 'permission denied', code: '42501' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
    expect(isMissingFunctionError({ message: 'Could not find the function public.dev_mcp_issue_key(p_label, p_token) in the schema cache', code: 'PGRST202' })).toBe(true)
    expect(isMissingFunctionError({ message: 'That is not a dev key', code: '22023' })).toBe(false)
    expect(isMissingFunctionError(undefined)).toBe(false)
  })
})
