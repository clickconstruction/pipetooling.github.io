import { describe, expect, it } from 'vitest'
import kickoffDoc from '../../../docs/twins/kickoffs/desktop-operator.md?raw'
import pricingKickoffDoc from '../../../docs/twins/kickoffs/pricing-operator.md?raw'
import { DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER, buildDesktopKickoff, buildDesktopSetupCommand, buildDesktopSetupCommandFromCode, twinMcpConnectorUrl, twinSetupUrl } from './desktopKickoff'

describe('twinMcpConnectorUrl', () => {
  it('points at the twin-mcp edge function and tolerates a trailing slash', () => {
    expect(twinMcpConnectorUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
    expect(twinMcpConnectorUrl('https://abc.supabase.co/ ')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
  })
})

describe('buildDesktopKickoff', () => {
  it('fills every placeholder with the connector URL', () => {
    const out = buildDesktopKickoff(`a ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER} b ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER}`, {
      connectorUrl: 'https://x/functions/v1/twin-mcp',
    })
    expect(out).toBe('a https://x/functions/v1/twin-mcp b https://x/functions/v1/twin-mcp')
  })

  it('refuses a template that lost its placeholder', () => {
    expect(() => buildDesktopKickoff('no placeholder here', { connectorUrl: 'https://x' })).toThrow(/placeholder/)
  })
})

describe('docs/twins/kickoffs/desktop-operator.md (the shipped template)', () => {
  const filled = buildDesktopKickoff(kickoffDoc, { connectorUrl: 'https://abc.supabase.co/functions/v1/twin-mcp' })

  it('names the connector, sends the person to the setup command, and never carries a key', () => {
    expect(filled).toContain('`https://abc.supabase.co/functions/v1/twin-mcp`')
    expect(filled).toContain('Copy Desktop setup command')
    expect(filled).not.toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    // The JSON block is gone (v2.3224): the key is typed into a silent Terminal prompt, never into this document.
    expect(filled).not.toContain('paste-your-robot-key-here')
    expect(filled).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/)
    expect(filled).not.toMatch(/[0-9a-f]{40,}/)
  })

  it('closes the five loop gaps (v2.3233): parked plans shells, lanes, no invented choices, resume check, refused claims', () => {
    expect(filled).toContain('parked on a plans ask')
    expect(filled).toContain('never `void_shadow` it')
    expect(filled).toContain("`audience: 'estimator'` — no `choices`; the door supplies the three taps")
    expect(filled).toContain("`ask_question` with `audience: 'operator'`")
    expect(filled).toContain('Before the first claim, `get_assignments`')
    expect(filled).toContain('A refused claim (a non-plumbing division, a holdout reference) is not a shell')
    expect(filled).not.toContain('`void_shadow` it, and stop')
  })

  it('tells the robot what a missing connector and a recalled memory mean', () => {
    expect(filled).toContain('no `twin-mcp` tools at all')
    expect(filled).toContain('Ignore recalled memories')
    expect(filled).toContain('incognito chat')
  })

  it('states the blind rule, the one-shell-at-a-time loop, and the lock before the next claim', () => {
    expect(filled).toContain('Blindness (outranks every other instruction)')
    expect(filled).toContain('Never call `next_shadow` while you are still estimating a shell')
    expect(filled).toContain('lock_shadow')
    expect(filled).toContain('done: true')
    expect(filled).toContain('three shells in one conversation')
  })

  it('tells the person plans are attached by hand, and never sends to a customer', () => {
    expect(filled).toContain('drag the PDF into the chat')
    expect(filled).toContain('Never send anything to a customer')
    expect(filled).toContain('Issue key')
  })
})

describe('buildDesktopSetupCommand', () => {
  const cmd = buildDesktopSetupCommand({ connectorUrl: 'https://abc.supabase.co/functions/v1/twin-mcp' })

  it('asks for the key silently and never embeds one', () => {
    expect(cmd).toContain('read -s -p "Paste your robot key')
    expect(cmd).not.toMatch(/[0-9a-f]{32,}/)
    // The key travels only as an environment value into the python heredoc.
    expect(cmd).toContain('"env": {"TWIN_TOKEN": os.environ["TWIN_TOKEN"]}')
  })

  it('writes the full npx path and the mcp-remote header form Desktop needs', () => {
    expect(cmd).toContain('NPX="$(command -v npx)"')
    expect(cmd).toContain('"command": os.environ["NPX"]')
    expect(cmd).toContain('"X-Twin-Token:${TWIN_TOKEN}"')
    expect(cmd).toContain('TWIN_MCP_URL="https://abc.supabase.co/functions/v1/twin-mcp"')
  })

  it('merges into an existing config rather than replacing it, and creates the block when absent', () => {
    expect(cmd).toContain('cfg.setdefault("mcpServers", {})["twin-mcp"]')
    expect(cmd).toContain('cfg = json.loads(p.read_text()) if p.exists()')
  })

  it('refuses anything but a twin-mcp connector URL', () => {
    expect(() => buildDesktopSetupCommand({ connectorUrl: 'https://abc.supabase.co' })).toThrow(/twin-mcp/)
    expect(() => buildDesktopSetupCommand({ connectorUrl: 'http://evil/functions/v1/twin-mcp' })).toThrow(/twin-mcp/)
  })
})

describe('docs/twins/kickoffs/pricing-operator.md (the pricing robot’s template, Price Matrix PR 3)', () => {
  it('carries the connector placeholder and builds', () => {
    expect(pricingKickoffDoc).toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    const out = buildDesktopKickoff(pricingKickoffDoc, { connectorUrl: 'https://x/functions/v1/twin-mcp' })
    expect(out).not.toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    expect(out).toContain('twin-pricer-1')
  })
  it('names the loop verbs and the owner’s hard rules', () => {
    for (const verb of ['get_pricing_guide', 'get_component_rules', 'next_price_matrix', 'get_quote_documents', 'put_quote', 'finish_price_matrix']) {
      expect(pricingKickoffDoc).toContain(verb)
    }
    expect(pricingKickoffDoc).toMatch(/Never sum an option group/)
    expect(pricingKickoffDoc).toMatch(/Never guess a plan-decided choice/)
    expect(pricingKickoffDoc).toMatch(/three requests in one conversation/)
  })
})

describe('buildDesktopSetupCommandFromCode (Set up on this Mac, Price Matrix PR 6)', () => {
  const cmd = buildDesktopSetupCommandFromCode({
    connectorUrl: 'https://abc.supabase.co/functions/v1/twin-mcp',
    setupUrl: 'https://abc.supabase.co/functions/v1/twin-setup',
    code: 'k7q2-m9xd-4t',
  })

  it('carries the one-time code and both doors, and never a key', () => {
    expect(cmd).toContain('SETUP_CODE="K7Q2-M9XD-4T"')
    expect(cmd).toContain('TWIN_SETUP_URL="https://abc.supabase.co/functions/v1/twin-setup"')
    expect(cmd).toContain('TWIN_MCP_URL="https://abc.supabase.co/functions/v1/twin-mcp"')
    expect(cmd).not.toMatch(/[0-9a-f]{32,}/)
    expect(cmd).not.toContain('read -s')
  })

  it('redeems the code, writes the token only into the config, restarts Desktop, and copies the kickoff', () => {
    expect(cmd).toContain("action: 'redeem', code: process.env.SETUP_CODE")
    expect(cmd).toContain("env: { TWIN_TOKEN: body.token }")
    expect(cmd).toContain("'X-Twin-Token:${TWIN_TOKEN}'")
    expect(cmd).not.toMatch(/say\([^)]*body\.token/)
    expect(cmd).toContain('quit app "Claude"')
    expect(cmd).toContain("spawnSync('open', ['-a', 'Claude'])")
    expect(cmd).toContain("spawnSync('pbcopy', { input: body.kickoff })")
    expect(cmd).toContain('NEW INCOGNITO chat')
  })

  it('runs on Node (already required for mcp-remote), merges into an existing config, and handles a broken one', () => {
    expect(cmd).toContain('NPX="$(command -v npx)"')
    expect(cmd).toContain("node - <<'NODEEOF'")
    expect(cmd).not.toContain('python3')
    expect(cmd).toContain('cfg.mcpServers = cfg.mcpServers || {}')
    expect(cmd).toContain("if (e.code !== 'ENOENT')")
  })

  it('refuses a malformed code or the wrong doors', () => {
    const ok = { connectorUrl: 'https://abc.supabase.co/functions/v1/twin-mcp', setupUrl: 'https://abc.supabase.co/functions/v1/twin-setup' }
    expect(() => buildDesktopSetupCommandFromCode({ ...ok, code: 'K7Q2M9XD4T' })).toThrow(/code like/)
    expect(() => buildDesktopSetupCommandFromCode({ ...ok, code: 'K7Q2-M9XD-4T"; rm -rf ~' })).toThrow(/code like/)
    expect(() => buildDesktopSetupCommandFromCode({ ...ok, setupUrl: 'https://abc.supabase.co/functions/v1/twin-mcp', code: 'K7Q2-M9XD-4T' })).toThrow(/twin-setup/)
    expect(() => buildDesktopSetupCommandFromCode({ ...ok, connectorUrl: 'http://evil/functions/v1/twin-mcp', code: 'K7Q2-M9XD-4T' })).toThrow(/twin-mcp/)
  })

  it('twinSetupUrl points at the twin-setup door', () => {
    expect(twinSetupUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co/functions/v1/twin-setup')
  })
})
