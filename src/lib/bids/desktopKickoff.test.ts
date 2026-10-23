import { describe, expect, it } from 'vitest'
import kickoffDoc from '../../../docs/twins/kickoffs/desktop-operator.md?raw'
import codeKickoffDoc from '../../../docs/twins/kickoffs/code-operator.md?raw'
import pricingKickoffDoc from '../../../docs/twins/kickoffs/pricing-operator.md?raw'
import roundsKickoffDoc from '../../../docs/twins/kickoffs/rounds-operator.md?raw'
import { DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER, TWIN_MCP_PUBLIC_URL, buildDesktopKickoff, buildDesktopSetupCommand, buildDesktopSetupCommandFromCode, twinMcpConnectorUrl, twinSetupUrl } from './desktopKickoff'
import { isTwinMcpConnectorUrl } from '../../../supabase/functions/_shared/twinConnectorUrl'

describe('twinMcpConnectorUrl', () => {
  it('points at the twin-mcp edge function and tolerates a trailing slash', () => {
    expect(twinMcpConnectorUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
    expect(twinMcpConnectorUrl('https://abc.supabase.co/ ')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
  })

  it('takes a public address that already carries its path verbatim', () => {
    expect(twinMcpConnectorUrl('https://mcp.clicktooling.com/twin')).toBe('https://mcp.clicktooling.com/twin')
    expect(twinMcpConnectorUrl(' https://mcp.clicktooling.com/twin/ ')).toBe('https://mcp.clicktooling.com/twin')
    expect(twinMcpConnectorUrl('https://abc.supabase.co/functions/v1/twin-mcp')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
  })

  it('keeps the historical shape for a value that is not a URL', () => {
    expect(twinMcpConnectorUrl('abc')).toBe('abc/functions/v1/twin-mcp')
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

  it('says what a chat costs (v2.4231): plans attached by hand, Always allow once per tool, the Code kickoff for a Mac that has Code', () => {
    expect(filled).toContain('Expect to attach them')
    expect(filled).toContain('choose **Always allow**')
    expect(filled).not.toContain('Allow for this chat')
    expect(filled).toContain('**Copy Code kickoff**')
    expect(filled).toContain('its ledger moved in the last 60 minutes')
  })
})

describe('docs/twins/kickoffs/code-operator.md (the Claude Code kickoff, v2.4231)', () => {
  const filled = buildDesktopKickoff(codeKickoffDoc, { connectorUrl: 'https://mcp.clicktooling.com/twin' })

  it('opens as the operator’s instruction, so a Code session runs it instead of asking what to do with a pasted document', () => {
    const opening = filled.split('\n').slice(0, 4).join('\n')
    expect(opening).toContain('**Run this now.**')
    expect(opening).toContain('pasting this document is my instruction to you')
    expect(opening).toContain('Do not ask me what to do with this document')
    // Robot instructions only: the person's setup lives in the help guide, not in what is pasted.
    expect(filled).not.toContain('One-time setup')
    expect(filled).not.toContain('Issue key')
    expect(filled).not.toContain('incognito')
  })

  it('fills the connector address and never carries a key', () => {
    expect(filled).toContain('`https://mcp.clicktooling.com/twin`')
    expect(filled).not.toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    expect(filled).not.toMatch(/ptt_[0-9a-f]{8,}/)
    expect(filled).not.toMatch(/[0-9a-f]{40,}/)
    expect(filled).toContain('never read the key out of a config file')
  })

  it('has the robot read the plans itself: embedded pages from disk, a heavy page by its link, a closer look when symbols are small', () => {
    expect(filled).toContain('You fetch the plan set yourself; nobody attaches it.')
    expect(filled).toContain('`embed: true`')
    expect(filled).toContain('`curl -fsS -o <file> <url>`')
    expect(filled).toContain('pdftoppm')
    expect(filled).toContain('Do not wait for a person to attach the set.')
    expect(filled).not.toContain('drag the PDF')
  })

  it('fences the session to the connector: no dev connector, no repository, nothing written into a checkout', () => {
    expect(filled).toContain('no `dev-mcp`')
    expect(filled).toContain('no files in the repository')
    expect(filled).toContain('Write nothing into the repository')
    expect(filled).toContain('never in a repository\'s working tree')
    expect(filled).toContain('project instruction files')
  })

  it('keeps two sessions on one key apart: a shell whose ledger just moved is another session’s', () => {
    expect(filled).toContain('every session on this key is the same robot')
    expect(filled).toContain('its ledger or its heartbeat moved in the last **15 minutes**')
    // v2.5753: the server's word on each shell, `shadow.hold`, decides; the robot no longer judges the bare list.
    expect(filled).toContain('`shadow.hold`')
    expect(filled).toContain('`orphaned` → pick it up')
    expect(filled).toContain('`closed` → void, locked, scored')
    expect(filled).toContain('No more than two at once.')
  })

  it('carries the same loop and the owner’s rules as the chat kickoff', () => {
    expect(filled).toContain('Blindness (outranks every other instruction)')
    expect(filled).toContain('Never call `next_shadow` while you are still estimating a shell')
    expect(filled).toContain('never `void_shadow` it')
    expect(filled).toContain('three shells in one session')
    expect(filled).toContain("`audience: 'estimator'` — no `choices`; the door supplies the three taps")
    expect(filled).toContain("`ask_question` with `audience: 'operator'`")
    expect(filled).toContain('A refused claim (a non-plumbing division, a holdout reference) is not a shell')
    expect(filled).toContain('lock_shadow')
    expect(filled).toContain('Never send anything to a customer')
    for (const verb of ['score_shadows', 'get_brief', 'get_assignments', 'next_shadow', 'get_plan_pages', 'put_substrate', 'ct_finish_takeoff', 'paste_counts', 'seed_audit_questions', 'submit_report']) {
      expect(filled).toContain(verb)
    }
  })
})

describe('the travel rule both kickoffs give STG-5 (v2.5090: v2.5034’s rule, the owner’s call of 2026-10-09)', () => {
  for (const [name, doc] of [['desktop-operator.md', kickoffDoc], ['code-operator.md', codeKickoffDoc]] as const) {
    it(`${name} rows the book’s per-mile entry at the miles × the job days, never the retired $80 rule`, () => {
      expect(doc).toContain("Travel is ONE row: the book's `Travel & Rentals (per mile from office)` entry, at a count equal to the miles from the office × the job days.")
      expect(doc).toContain('$1.40 a count, which is $0.70 a mile, round trip, once per job day')
      expect(doc).toContain("Take them from the bid's schedule, else estimate them from the labor and say how, never fewer than 1.")
      expect(doc).toContain('The miles, the job days and the travel line go in the lock note.')
      expect(doc).not.toContain('$80 × miles')
      expect(doc).not.toContain('10% of building')
    })
  }
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
    expect(() => buildDesktopSetupCommand({ connectorUrl: 'https://mcp.clicktooling.com/dev' })).toThrow(/twin-mcp/)
  })

  it('accepts the public address every button hands out (v2.3716 — it was refused after the v2.3634 flip, which threw in the Console tab’s render)', () => {
    expect(TWIN_MCP_PUBLIC_URL).toBe('https://mcp.clicktooling.com/twin')
    expect(buildDesktopSetupCommand({ connectorUrl: TWIN_MCP_PUBLIC_URL })).toContain('TWIN_MCP_URL="https://mcp.clicktooling.com/twin"')
    expect(buildDesktopSetupCommandFromCode({ connectorUrl: TWIN_MCP_PUBLIC_URL, setupUrl: 'https://abc.supabase.co/functions/v1/twin-setup', code: 'K7Q2-M9XD-4T' })).toContain('TWIN_MCP_URL="https://mcp.clicktooling.com/twin"')
  })
})

describe('isTwinMcpConnectorUrl — both shapes twinMcpConnectorUrl produces, nothing else', () => {
  it('takes the function door and a public audience path ending in /twin', () => {
    expect(isTwinMcpConnectorUrl('https://abc.supabase.co/functions/v1/twin-mcp')).toBe(true)
    expect(isTwinMcpConnectorUrl(' https://mcp.clicktooling.com/twin/ ')).toBe(true)
    expect(isTwinMcpConnectorUrl('https://mcp.clicktooling.com/count/twin')).toBe(true)
  })
  it('refuses a bare origin, http, the dev path, and anything a quote could break on', () => {
    expect(isTwinMcpConnectorUrl('https://abc.supabase.co')).toBe(false)
    expect(isTwinMcpConnectorUrl('http://mcp.clicktooling.com/twin')).toBe(false)
    expect(isTwinMcpConnectorUrl('https://mcp.clicktooling.com/dev')).toBe(false)
    expect(isTwinMcpConnectorUrl('https://mcp.clicktooling.com/twin-mcp')).toBe(false)
    expect(isTwinMcpConnectorUrl('https://x/twin" ; rm -rf /')).toBe(false)
    expect(isTwinMcpConnectorUrl('nope')).toBe(false)
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
    expect(cmd).toContain("env: { TWIN_TOKEN: body.token, PATH }")
    expect(cmd).toContain("'X-Twin-Token:${TWIN_TOKEN}'")
    expect(cmd).not.toMatch(/say\([^)]*body\.token/)
    expect(cmd).toContain('quit app "Claude"')
    expect(cmd).toContain("spawnSync('open', ['-a', 'Claude'])")
    expect(cmd).toContain("spawnSync('pbcopy', { input: body.kickoff })")
    expect(cmd).toContain('NEW INCOGNITO chat')
  })

  it('says where the kickoff is pasted from what twin-setup answers (v2.4231): a Code session for the bid robot, a chat otherwise', () => {
    expect(cmd).toContain("body.kickoff_for === 'code' ? 'open the Code tab, start a NEW session and paste it.' : 'start a NEW INCOGNITO chat there and paste it.'")
    // An older twin-setup sends no kickoff_for: the command keeps the chat wording that matches the chat kickoff it hands back.
    expect(cmd).not.toContain('Claude Desktop is reopening')
  })

  it('runs on Node (already required for mcp-remote), merges into an existing config, and handles a broken one', () => {
    expect(cmd).toContain('for PT_C in "$(command -v node 2>/dev/null)" "$PT_HOME/bin/node"; do')
    expect(cmd).toContain(`"$PT_NODE" - <<'NODEEOF'`)
    expect(cmd).not.toContain('python3')
    expect(cmd).toContain('cfg.mcpServers = cfg.mcpServers || {}')
    expect(cmd).toContain("if (e.code !== 'ENOENT')")
  })

  it('is right wherever it lands (v2.5742): fetches Node when the Mac has none, never ends the shell, notices Claude Code, checks the Claude app first', () => {
    expect(cmd).toContain('https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt')
    expect(cmd).toContain('shasum -a 256 -c one.sum')
    expect(cmd).toContain('--strip-components=1')
    expect(cmd).not.toMatch(/\bexit 1\b/)
    expect(cmd).toContain('[ -n "$PT_NODE" ] && SETUP_CODE=')
    expect(cmd).toContain('const underClaudeCode = !!process.env.CLAUDECODE')
    expect(cmd).toContain('Now quit Claude with Cmd+Q and open it again')
    expect(cmd).toContain("spawnSync('open', ['-Ra', 'Claude'])")
    expect(cmd).toContain("command: nodeBin, args: [npxCli, '-y', 'mcp-remote'")
    expect(cmd).toContain("process.env.KICKOFF_FILE")
    // the Claude app check and the Node check both come before the code is redeemed
    expect(cmd.indexOf("['-Ra', 'Claude']")).toBeLessThan(cmd.indexOf("action: 'redeem'"))
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

describe('the rounds (v2.5735, punch list #142)', () => {
  const base = { connectorUrl: 'https://mcp.clicktooling.com/twin', setupUrl: 'https://abc.supabase.co/functions/v1/twin-setup', code: 'K7Q2-M9XD-4T' }
  it('the setup command sends rounds on redeem and names the connector, the server winning', () => {
    const cmd = buildDesktopSetupCommandFromCode({ ...base, rounds: true, connectorName: 'twin-pricer-mcp' })
    expect(cmd).toContain('ROUNDS="1"')
    expect(cmd).toContain('CONNECTOR_NAME="twin-pricer-mcp"')
    expect(cmd).toContain("const rounds = process.env.ROUNDS === '1'")
    expect(cmd).toContain("machine: os.hostname(), rounds })")
    expect(cmd).toContain("const name = body.connector_name || process.env.CONNECTOR_NAME || 'twin-mcp'")
    // v2.5752: the rounds branch installs the agent (the plist, round.sh, mcp.json, launchctl), and the command never pastes a rounds kickoff.
    expect(cmd).toContain("if (rounds) {")
    expect(cmd).toContain("spawnSync('launchctl', ['bootstrap', domain, plist]")
    expect(cmd).toContain("const ROUND_SH = ")
    expect(cmd).toContain("const PLIST = ")
    expect(cmd).toContain("spawnSync(cli, ['auth', 'login']")
    expect(cmd).not.toContain("body.kickoff_for === 'rounds'")
    const plain = buildDesktopSetupCommandFromCode(base)
    expect(plain).toContain('ROUNDS="0"')
    expect(plain).toContain('CONNECTOR_NAME="twin-mcp"')
    expect(() => buildDesktopSetupCommandFromCode({ ...base, connectorName: 'bad name!' })).toThrow(/plain connector name/)
  })
  it('the shipped rounds template: the placeholder, the five-minute rule, round: true, the stop, the fifteen-minute overlap rule, never a key', () => {
    const doc = roundsKickoffDoc
    expect(doc).toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    expect(doc).toMatch(/every five minutes/i)
    expect(doc).toContain('`round: true`')
    expect(doc).toContain('Stop the rounds')
    expect(doc).toContain('15 minutes')
    // v2.5752: the routine is gone; the LaunchAgent hands the whole document to the CLI, so the top reads as the robot's instruction.
    expect(doc).not.toContain('*/5 * * * *')
    expect(doc).not.toContain('scheduled task')
    expect(doc).toContain('com.clicktooling.robot-rounds')
    expect(doc.split('\n').slice(0, 4).join('\n')).toContain('**Run this now.**')
    expect(doc).toContain('`next_shadow` once')
    // v2.5753: step 1 reads the server's hold on each shell, so a parked or runless shell never ends a round.
    expect(doc).toContain('`shadow.hold`')
    expect(doc).toContain('never heartbeat on them')
    expect(doc).toContain('`held`')
    expect(doc).toContain('twin-pricer-mcp')
    expect(doc).not.toMatch(/ptt_[0-9a-f]{8}/)
    const filled = buildDesktopKickoff(doc, { connectorUrl: 'https://mcp.clicktooling.com/twin' })
    expect(filled).not.toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
  })
})
