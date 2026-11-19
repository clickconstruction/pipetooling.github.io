import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROUNDS_TEXT_MARK, checkRoundsInstall, roundsInstallPlan, roundsInstallPlanWords, roundsMcpConfig, type RoundsInstallInput } from './roundsInstall'
import { ROUNDS_AGENT_LABEL, ROUNDS_UNINSTALL_COMMAND, buildRoundScript, buildRoundsLaunchAgentPlist } from './roundsLaunchAgent'
import { TWIN_MCP_PUBLIC_URL } from './desktopKickoff'
import { CODE_KICKOFF, PRICING_KICKOFF, ROUNDS_KICKOFF } from '../../../supabase/functions/_shared/twinKickoffs'
import { fillTwinKickoff } from '../../../supabase/functions/_shared/twinKickoffFill'

const APP_COMMAND = readFileSync('src/lib/bids/desktopKickoff.ts', 'utf8')
const SCRIPT = readFileSync('scripts/twin/install-rounds.ts', 'utf8')
const REDEEM = readFileSync('scripts/twin/redeem_setup_code.py', 'utf8')
const TOOLKIT = readFileSync('scripts/twin/README.md', 'utf8')

// A made-up key and a made-up home: nothing here is a real secret or a real person's folder.
const KEY = 'ptt_madeupkeymadeupkeymadeupkey'
const ROUND_TEXT = fillTwinKickoff(ROUNDS_KICKOFF, { connectorUrl: TWIN_MCP_PUBLIC_URL, kind: 'estimator', twinEmail: 'twin-estimator-4@twins.pipetooling.local' })
const input = (over: Partial<RoundsInstallInput> = {}): RoundsInstallInput => ({ home: '/Users/made-up', uid: 501, token: `${KEY}\n`, roundText: ROUND_TEXT, connectorName: 'twin-mcp', connectorUrl: TWIN_MCP_PUBLIC_URL, existingMcp: null, ...over })

describe('installing the rounds agent from a shell (v2.7962)', () => {
  it('knows the round text from the other kickoffs, and refuses the repo’s unfilled template', () => {
    expect(ROUNDS_KICKOFF).toContain(ROUNDS_TEXT_MARK)
    for (const other of [CODE_KICKOFF, PRICING_KICKOFF]) expect(other).not.toContain(ROUNDS_TEXT_MARK)
    expect(checkRoundsInstall(input())).toEqual({ ok: true })
    const refused = (over: Partial<RoundsInstallInput>): string => {
      const r = checkRoundsInstall(input(over))
      if (r.ok) throw new Error('expected a refusal')
      return r.refused
    }
    expect(refused({ roundText: CODE_KICKOFF })).toContain('That file is not the round text: it reads like the batch kickoff')
    expect(refused({ roundText: ROUNDS_KICKOFF })).toContain('still carries a placeholder: it is the repo\'s template')
    expect(refused({ roundText: '  ' })).toContain('The round text is empty.')
    expect(refused({ token: '' })).toContain('The key file is empty.')
    expect(refused({ token: 'two words' })).toContain('holds more than a key')
    expect(refused({ home: 'Users/made-up' })).toContain('not an absolute path')
    expect(refused({ uid: -1 })).toContain('The user id is not a number')
    expect(refused({ connectorName: 'dev-mcp' })).toBe('The connector is twin-mcp or twin-pricer-mcp: a round may call no other.')
    expect(refused({ connectorUrl: 'http://localhost:54321/twin' })).toContain('starts with https://')
    // No refusal ever repeats the key.
    for (const over of [{ roundText: '' }, { connectorName: 'x' }, { home: 'x' }]) expect(refused(over)).not.toContain(KEY)
  })

  it('writes the four files the app’s command writes, from the app’s own kernel', () => {
    const plan = roundsInstallPlan(input())
    expect(plan.dirs).toEqual(['/Users/made-up/Library/Application Support/ClickTooling/work', '/Users/made-up/Library/Logs/ClickTooling', '/Users/made-up/Library/LaunchAgents'])
    expect(plan.files.map((f) => [f.path, f.mode.toString(8), f.holdsKey])).toEqual([
      ['/Users/made-up/Library/Application Support/ClickTooling/mcp.json', '600', true],
      ['/Users/made-up/Library/Application Support/ClickTooling/round.md', '644', false],
      ['/Users/made-up/Library/Application Support/ClickTooling/round.sh', '755', false],
      ['/Users/made-up/Library/LaunchAgents/com.clicktooling.robot-rounds.plist', '644', false],
    ])
    expect(plan.files[1]!.content).toBe(ROUND_TEXT)
    expect(plan.files[2]!.content).toBe(buildRoundScript())
    expect(plan.files[3]!.content).toBe(buildRoundsLaunchAgentPlist('/Users/made-up'))
    expect(plan.files[3]!.content).not.toContain('__HOME__')
    // The key sits in the connector file alone, as a header, and that file is the only one closed to others.
    expect(plan.files.filter((f) => f.content.includes(KEY)).map((f) => f.path)).toEqual([plan.files[0]!.path])
    expect(JSON.parse(plan.files[0]!.content)).toEqual({ mcpServers: { 'twin-mcp': { type: 'http', url: TWIN_MCP_PUBLIC_URL, headers: { 'X-Twin-Token': KEY } } } })
    // The app's command writes the same entry, the same modes and the same file names.
    expect(APP_COMMAND).toContain("mcp.mcpServers[name] = { type: 'http', url, headers: { 'X-Twin-Token': body.token } }")
    expect(APP_COMMAND).toContain("fs.writeFileSync(mcpFile, JSON.stringify(mcp, null, 2), { mode: 0o600 })")
    expect(APP_COMMAND).toContain("fs.writeFileSync(path.join(PT, 'round.md'), body.kickoff)")
    expect(APP_COMMAND).toContain("fs.writeFileSync(path.join(PT, 'round.sh'), ROUND_SH, { mode: 0o755 })")
  })

  it('a home with a character XML reserves is escaped in the plist, as the app’s command escapes it', () => {
    const plist = roundsInstallPlan(input({ home: '/Users/a&b/' })).files[3]!
    expect(plist.path).toBe('/Users/a&b/Library/LaunchAgents/com.clicktooling.robot-rounds.plist')
    expect(plist.content).toContain('<string>/Users/a&amp;b/Library/Application Support/ClickTooling/round.sh</string>')
    expect(APP_COMMAND).toContain("PLIST.split('__HOME__').join(os.homedir().replace(/&/g, '&amp;')")
  })

  it('a second seat joins the connector file and the first stays; a file that is not JSON is started again', () => {
    const first = roundsMcpConfig(null, 'twin-mcp', TWIN_MCP_PUBLIC_URL, KEY)
    const both = JSON.parse(roundsMcpConfig(first, 'twin-pricer-mcp', TWIN_MCP_PUBLIC_URL, 'ptt_secondmadeupkey')) as { mcpServers: Record<string, { headers: Record<string, string> }> }
    expect(Object.keys(both.mcpServers)).toEqual(['twin-mcp', 'twin-pricer-mcp'])
    expect(both.mcpServers['twin-mcp']!.headers['X-Twin-Token']).toBe(KEY)
    expect(JSON.parse(roundsMcpConfig('not json {', 'twin-mcp', TWIN_MCP_PUBLIC_URL, KEY))).toEqual({ mcpServers: { 'twin-mcp': { type: 'http', url: TWIN_MCP_PUBLIC_URL, headers: { 'X-Twin-Token': KEY } } } })
    // Another key of the file is kept, and the key's trailing newline is not written.
    expect(JSON.parse(roundsMcpConfig('{"note":"keep"}', 'twin-mcp', TWIN_MCP_PUBLIC_URL, `${KEY}\n`))).toMatchObject({ note: 'keep', mcpServers: { 'twin-mcp': { headers: { 'X-Twin-Token': KEY } } } })
  })

  it('loads the agent with the app’s three launchctl calls, in its order', () => {
    const plan = roundsInstallPlan(input())
    expect(plan.launchctl).toEqual([
      { args: ['bootout', `gui/501/${ROUNDS_AGENT_LABEL}`], mayFail: true },
      { args: ['enable', `gui/501/${ROUNDS_AGENT_LABEL}`], mayFail: true },
      { args: ['bootstrap', 'gui/501', plan.plistPath], mayFail: false },
    ])
    const order = ["spawnSync('launchctl', ['bootout', domain + '/' + LABEL])", "spawnSync('launchctl', ['enable', domain + '/' + LABEL])", "spawnSync('launchctl', ['bootstrap', domain, plist]"].map((s) => APP_COMMAND.indexOf(s))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(plan.uninstall).toBe(ROUNDS_UNINSTALL_COMMAND)
    expect(plan.logPath).toBe('/Users/made-up/Library/Logs/ClickTooling/rounds.log')
  })

  it('the plan’s words name every path and never the key', () => {
    const words = roundsInstallPlanWords(roundsInstallPlan(input()))
    expect(words.join('\n')).not.toContain(KEY)
    expect(words).toContain('write /Users/made-up/Library/Application Support/ClickTooling/mcp.json (mode 600, the connector with the key in its header, not shown)')
    expect(words).toContain('launchctl bootout gui/501/com.clicktooling.robot-rounds  (fine if nothing is loaded yet)')
    expect(words[words.length - 1]).toBe(`to take the rounds off this Mac:  ${ROUNDS_UNINSTALL_COMMAND}`)
  })

  it('the script is the thin part: it plans with this kernel, checks the CLI before it writes, and never prints the key', () => {
    expect(SCRIPT).toContain("import { checkRoundsInstall, roundsInstallPlan, roundsInstallPlanWords } from '../../src/lib/bids/roundsInstall'")
    expect(SCRIPT).toContain('const plan = roundsInstallPlan(input)')
    // Nothing is written on a dry run, with no CLI, or with a CLI that is not signed in.
    const firstWrite = SCRIPT.indexOf('fs.writeFileSync(')
    for (const gate of ['if (dry) process.exit(0)', "if (!cli) stop('install-rounds: no Claude Code on this Mac.", 'if (!signedIn()) stop(`install-rounds: Claude Code is not signed in for the rounds.']) {
      expect(SCRIPT.indexOf(gate), gate).toBeGreaterThan(0)
      expect(SCRIPT.indexOf(gate), gate).toBeLessThan(firstWrite)
    }
    // The key is read into the plan and written by the plan; no line says it.
    expect(SCRIPT.match(/input\.token/g)).toBeNull()
    for (const line of SCRIPT.split('\n').filter((l) => /\bsay\(|\bstop\(/.test(l))) expect(line, line).not.toMatch(/token\b(?!File)|file\.content/)
    // It finds the CLI as the app's command and round.sh find it.
    expect(SCRIPT).toContain("'Library/Application Support/Claude/claude-code'")
    expect(SCRIPT).toContain("path.join(home, '.local/bin/claude')")
    expect(APP_COMMAND).toContain("path.join(os.homedir(), '.local/bin/claude')")
    // The step before it is the toolkit's, and both say so.
    expect(REDEEM).toContain('ap.add_argument("--rounds"')
    expect(REDEEM).toContain('scripts/twin/install-rounds.ts')
    expect(TOOLKIT).toContain('`install-rounds.ts`')
  })
})
