import { describe, expect, it } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ROUNDS_AGENT_LABEL,
  ROUNDS_BUILTIN_TOOLS,
  ROUNDS_HOME_TOKEN,
  ROUNDS_INTERVAL_SECONDS,
  ROUNDS_MAX_MINUTES,
  ROUNDS_UNINSTALL_COMMAND,
  buildRoundScript,
  buildRoundsLaunchAgentPlist,
  roundsCliArgs,
  roundsConnectorEntry,
} from './roundsLaunchAgent'

/**
 * The Robot rounds agent's two files (v2.5752, punch list #142) as pure kernels, and the
 * wrapper run under sh, bash and zsh against a stand-in Mac: a HOME of its own, a stub
 * `claude` that records its arguments and answers one JSON line, no app, no network.
 */

describe('the LaunchAgent plist', () => {
  it('runs round.sh every five minutes from load, and logs to the rounds log', () => {
    const p = buildRoundsLaunchAgentPlist('/Users/robert')
    expect(p).toContain(`<string>${ROUNDS_AGENT_LABEL}</string>`)
    expect(p).toContain('<string>/bin/sh</string>')
    expect(p).toContain('<string>/Users/robert/Library/Application Support/ClickTooling/round.sh</string>')
    expect(p).toContain(`<key>StartInterval</key>\n\t<integer>${ROUNDS_INTERVAL_SECONDS}</integer>`)
    expect(ROUNDS_INTERVAL_SECONDS).toBe(300)
    expect(p).toContain('<key>RunAtLoad</key>\n\t<true/>')
    expect(p.match(/<string>\/Users\/robert\/Library\/Logs\/ClickTooling\/rounds\.log<\/string>/g)).toHaveLength(2)
    expect(p).not.toContain(ROUNDS_HOME_TOKEN)
  })

  it('leaves the home token for the setup command by default, trims a trailing slash and escapes XML', () => {
    expect(buildRoundsLaunchAgentPlist()).toContain(`<string>${ROUNDS_HOME_TOKEN}/Library/Application Support/ClickTooling/round.sh</string>`)
    expect(buildRoundsLaunchAgentPlist('/Users/robert/')).toContain('<string>/Users/robert/Library/Logs/ClickTooling/rounds.log</string>')
    expect(buildRoundsLaunchAgentPlist('/Users/a&b')).toContain('/Users/a&amp;b/Library')
  })

  it.skipIf(process.platform !== 'darwin')('is a plist macOS parses (plutil -lint)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pt-plist-'))
    const f = join(dir, `${ROUNDS_AGENT_LABEL}.plist`)
    writeFileSync(f, buildRoundsLaunchAgentPlist('/Users/robert'))
    const r = spawnSync('plutil', ['-lint', f], { encoding: 'utf8' })
    expect(r.stdout).toContain('OK')
    expect(r.status).toBe(0)
  })

  it('the uninstall is one launchctl line on the label', () => {
    expect(ROUNDS_UNINSTALL_COMMAND).toBe('launchctl bootout gui/$UID/com.clicktooling.robot-rounds')
  })
})

describe('the CLI arguments', () => {
  it('load the connector file and nothing else, never ask, allow the connectors and the plan tools, keep no transcript, answer JSON', () => {
    const a = roundsCliArgs('/x/mcp.json')
    expect(a.slice(0, 3)).toEqual(['--strict-mcp-config', '--mcp-config', '/x/mcp.json'])
    expect(a).toContain('dontAsk')
    expect(a[a.indexOf('--permission-mode') + 1]).toBe('dontAsk')
    const allowed = a.slice(a.indexOf('--allowedTools') + 1, a.indexOf('--tools'))
    expect(allowed).toEqual(['mcp__twin-mcp', 'mcp__twin-pricer-mcp', ...ROUNDS_BUILTIN_TOOLS])
    expect(a[a.indexOf('--tools') + 1]).toBe('Bash,Read,Write,Edit,Glob,Grep')
    expect(a).toContain('--no-session-persistence')
    expect(a.slice(-2)).toEqual(['--output-format', 'json'])
    expect(a).not.toContain('--dangerously-skip-permissions')
    expect(a.join(' ')).not.toMatch(/WebFetch|WebSearch|Agent/)
  })

  it('the connector entry is an HTTP server with the key as its header', () => {
    expect(roundsConnectorEntry('https://mcp.clicktooling.com/twin', 'ptt_x')).toEqual({ type: 'http', url: 'https://mcp.clicktooling.com/twin', headers: { 'X-Twin-Token': 'ptt_x' } })
  })
})

/** A stand-in Mac for round.sh: its own HOME, a bin with a stub claude, and the two files the setup command writes. */
type Bed = { home: string; bin: string; calls: string; prompt: string }
function bed(opts: { claude: 'app' | 'local' | 'path' | 'none'; files?: boolean }): Bed {
  const root = mkdtempSync(join(tmpdir(), 'pt-round-'))
  const home = join(root, 'home'); const bin = join(root, 'bin'); const calls = join(root, 'calls.log'); const prompt = join(root, 'prompt.md')
  mkdirSync(home); mkdirSync(bin)
  const stub = `#!/bin/sh
if [ "$1" = "-p" ]; then printf '%s' "$2" > "${prompt}"; shift 2; echo "claude-p $@" >> "${calls}"; echo '{"type":"result","result":"nothing to do","num_turns":6,"total_cost_usd":0.12}'; exit 0; fi
echo "claude $@" >> "${calls}"; exit 1
`
  const put = (f: string) => { mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, stub); chmodSync(f, 0o755) }
  if (opts.claude === 'app') {
    // two versions: the wrapper must take the newest, and 2.1.99 sorts after 2.1.304 only by version
    put(join(home, 'Library/Application Support/Claude/claude-code/2.1.99/aaaa/claude.app/Contents/MacOS/claude'))
    put(join(home, 'Library/Application Support/Claude/claude-code/2.1.304/bbbb/claude.app/Contents/MacOS/claude'))
  }
  if (opts.claude === 'local') put(join(home, '.local/bin/claude'))
  if (opts.claude === 'path') put(join(bin, 'claude'))
  if (opts.files !== false) {
    const pt = join(home, 'Library/Application Support/ClickTooling')
    mkdirSync(pt, { recursive: true })
    writeFileSync(join(pt, 'round.md'), 'THE ROUND TEXT\nline two')
    writeFileSync(join(pt, 'mcp.json'), JSON.stringify({ mcpServers: { 'twin-mcp': roundsConnectorEntry('https://mcp.clicktooling.com/twin', 'ptt_never_logged') } }))
  }
  return { home, bin, calls, prompt }
}

function run(b: Bed, shell: string) {
  const script = join(b.home, 'round.sh')
  writeFileSync(script, buildRoundScript())
  const r = spawnSync(shell, [script], { env: { HOME: b.home, PATH: `${b.bin}:/usr/bin:/bin:/usr/sbin:/sbin` }, encoding: 'utf8' })
  const log = join(b.home, 'Library/Logs/ClickTooling/rounds.log')
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, log: existsSync(log) ? readFileSync(log, 'utf8') : '', calls: existsSync(b.calls) ? readFileSync(b.calls, 'utf8').trim().split('\n') : [] }
}

const shells = ['/bin/sh', 'bash', ...(existsSync('/bin/zsh') ? ['/bin/zsh'] : [])]

describe('round.sh, run against a stand-in Mac', () => {
  for (const shell of shells) {
    it(`under ${shell}: takes the app’s newest CLI, hands it the round text and the connector file with the never-ask flags, logs the header, the JSON answer and the footer`, () => {
      const b = bed({ claude: 'app' })
      const r = run(b, shell)
      expect(r.status).toBe(0)
      expect(r.stdout + r.stderr).toBe('') // everything goes to the log
      expect(r.calls).toHaveLength(1)
      expect(r.calls[0]).toBe(`claude-p ${roundsCliArgs(join(b.home, 'Library/Application Support/ClickTooling/mcp.json')).join(' ')}`)
      expect(readFileSync(b.prompt, 'utf8')).toBe('THE ROUND TEXT\nline two')
      expect(r.log).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ round start · .*claude-code\/2\.1\.304\/bbbb\/claude\.app\/Contents\/MacOS\/claude\n/)
      expect(r.log).toContain('{"type":"result","result":"nothing to do","num_turns":6,"total_cost_usd":0.12}')
      expect(r.log).toMatch(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ round end · exit 0\n$/)
      expect(r.log).not.toMatch(/Terminated|Killed/)
      expect(r.log).not.toContain('ptt_never_logged')
      expect(existsSync(join(b.home, 'Library/Application Support/ClickTooling/work'))).toBe(true)
    })
  }

  it('falls back to ~/.local/bin/claude, then to the PATH’s claude', () => {
    const local = run(bed({ claude: 'local' }), '/bin/sh')
    expect(local.calls).toHaveLength(1)
    expect(local.log).toContain('/.local/bin/claude')
    const onPath = run(bed({ claude: 'path' }), '/bin/sh')
    expect(onPath.calls).toHaveLength(1)
    expect(onPath.log).toMatch(/round start · .*\/bin\/claude\n/)
  })

  it('no CLI: one line in the log and exit 0, so launchd keeps the schedule', () => {
    const r = run(bed({ claude: 'none' }), '/bin/sh')
    expect(r.status).toBe(0)
    expect(r.log).toContain('no Claude Code on this Mac. Press Set up on this Mac again.')
    expect(r.calls).toEqual([])
  })

  it('no round text or connector file: one line naming the file, nothing run', () => {
    const r = run(bed({ claude: 'app', files: false }), '/bin/sh')
    expect(r.status).toBe(0)
    expect(r.log).toContain('round.md is missing. Press Set up on this Mac again.')
    expect(r.calls).toEqual([])
  })

  it('a round that outlives the cap is killed, the CLI with it, and the footer says so', () => {
    const b = bed({ claude: 'app' })
    // the newest app CLI hangs; the cap is cut from two hours to one second for the test
    const hung = join(b.home, 'Library/Application Support/Claude/claude-code/2.1.304/bbbb/claude.app/Contents/MacOS/claude')
    writeFileSync(hung, '#!/bin/sh\necho started\nsleep 30\necho never\n')
    const script = join(b.home, 'round.sh')
    writeFileSync(script, buildRoundScript().replace('sleep 7200', 'sleep 1'))
    const t0 = Date.now()
    const r = spawnSync('/bin/sh', [script], { env: { HOME: b.home, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(Date.now() - t0).toBeLessThan(15_000)
    const log = readFileSync(join(b.home, 'Library/Logs/ClickTooling/rounds.log'), 'utf8')
    expect(log).toContain('started')
    expect(log).not.toContain('never')
    expect(log).toMatch(/round end · exit (1[2-9]\d|[2-9]\d\d)\n$/)
    expect(spawnSync('pgrep', ['-f', hung]).status).toBe(1)
  })

  it('caps a round at two hours and takes the watchdog down with it', () => {
    expect(ROUNDS_MAX_MINUTES).toBe(120)
    const s = buildRoundScript()
    expect(s).toContain('( sleep 7200 && kill "$PID" ) 2>/dev/null & WD=$!')
    expect(s).toContain('pkill -P "$WD" 2>/dev/null; kill "$WD" 2>/dev/null; wait "$WD" 2>/dev/null')
    expect(s.startsWith('#!/bin/sh\n')).toBe(true)
    expect(s).toContain(ROUNDS_UNINSTALL_COMMAND)
  })
})
