import { describe, expect, it } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { realpathSync } from 'node:fs'
import { hostname } from 'node:os'
import { buildDesktopSetupCommandFromCode, SETUP_NODE_LINE } from './desktopKickoff'
import { ROUNDS_AGENT_LABEL, buildRoundScript, buildRoundsLaunchAgentPlist } from './roundsLaunchAgent'

/**
 * The setup command's shell prelude, run (v2.5742). A bed stands in for the Mac: a HOME of its
 * own, a PATH that holds a stub `node` (or none), a stub `curl` that is nodejs.org or is down.
 * The stub node answers the version probe and, when handed the script on stdin, says so and
 * exits — so no real twin-setup is ever called. The command must pick the right Node, fetch
 * one only when it has to, verify what it fetched, and never end the shell it was pasted into.
 */
const cmd = buildDesktopSetupCommandFromCode({
  connectorUrl: 'https://mcp.clicktooling.com/twin',
  setupUrl: 'https://abc.supabase.co/functions/v1/twin-setup',
  code: 'K7Q2-M9XD-4T',
  rounds: true,
})

const stubNode = (major: number) => `#!/bin/sh
if [ "$1" = "-p" ]; then echo ${major}; exit 0; fi
if [ "$1" = "-" ]; then cat > /dev/null; echo "NODE_SCRIPT_RAN by=$0 code=$SETUP_CODE rounds=$ROUNDS"; exit 0; fi
exit 1
`

function exe(file: string, text: string) {
  writeFileSync(file, text)
  chmodSync(file, 0o755)
}

type Bed = { home: string; bin: string; log: string }

function bed(opts: { nodeMajor?: number; dist: 'ok' | 'down' }): Bed {
  const root = mkdtempSync(join(tmpdir(), 'pt-setup-'))
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  const log = join(root, 'curl.log')
  mkdirSync(home)
  mkdirSync(bin)
  if (opts.nodeMajor != null) exe(join(bin, 'node'), stubNode(opts.nodeMajor))
  if (opts.dist === 'ok') {
    // A fake nodejs.org: one tarball per chip, each holding bin/node, and the SHASUMS256.txt that names them.
    const dist = join(root, 'dist')
    mkdirSync(dist)
    const sums: string[] = []
    for (const arch of ['arm64', 'x64']) {
      const name = `node-${SETUP_NODE_LINE}.9.9-darwin-${arch}`
      mkdirSync(join(root, name, 'bin'), { recursive: true })
      exe(join(root, name, 'bin', 'node'), stubNode(24))
      const tgz = join(dist, `${name}.tar.gz`)
      const tar = spawnSync('tar', ['-czf', tgz, '-C', root, name])
      if (tar.status !== 0) throw new Error(String(tar.stderr))
      sums.push(`${createHash('sha256').update(readFileSync(tgz)).digest('hex')}  ${name}.tar.gz`)
    }
    writeFileSync(join(dist, 'SHASUMS256.txt'), sums.join('\n') + '\n')
    // curl … -o <out> <url>: serve the url's last segment from the fake dist, and log every call.
    exe(join(bin, 'curl'), `#!/bin/sh
echo "$@" >> "${log}"
out=""; url=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; http*) url="$1"; shift;; *) shift;; esac; done
cp "${dist}/$(basename "$url")" "$out"
`)
  } else {
    exe(join(bin, 'curl'), `#!/bin/sh
echo "$@" >> "${log}"
exit 22
`)
  }
  return { home, bin, log }
}

function run(b: Bed, shell = 'bash') {
  if (existsSync(b.log)) rmSync(b.log)
  const r = spawnSync(shell, ['-c', cmd + '\necho STILL_HERE'], {
    env: { HOME: b.home, PATH: `${b.bin}:/usr/bin:/bin:/usr/sbin:/sbin`, TERM: 'dumb' },
    encoding: 'utf8',
  })
  const curlCalls = existsSync(b.log) ? readFileSync(b.log, 'utf8').trim().split('\n').filter(Boolean) : []
  return { out: `${r.stdout}${r.stderr}`, status: r.status, curlCalls }
}

const fetchedNode = (b: Bed) => join(b.home, 'Library/Application Support/ClickTooling/node/bin/node')
const systemNodeOnPath = existsSync('/usr/bin/node') || existsSync('/bin/node')

describe('the setup command, run against a stand-in Mac (v2.5742)', () => {
  it('opens with the line that reads the same in Terminal and in Claude Code', () => {
    const r = run(bed({ nodeMajor: 20, dist: 'down' }))
    expect(r.out.split('\n')[0]).toBe('ClickTooling robot setup for this Mac. It runs as it is, in Terminal or in Claude Code, and takes a minute or two.')
  })

  it('takes the Mac’s own Node when it is 18+, and fetches nothing', () => {
    const r = run(bed({ nodeMajor: 20, dist: 'down' }))
    expect(r.out).toContain('NODE_SCRIPT_RAN by=')
    expect(r.out).toContain('code=K7Q2-M9XD-4T rounds=1')
    expect(r.out).not.toContain('Getting Node')
    expect(r.curlCalls).toEqual([])
    expect(r.status).toBe(0)
  })

  it('a Node under 18 counts as none: it fetches, verifies, unpacks into the Library folder and runs on that one', () => {
    const b = bed({ nodeMajor: 16, dist: 'ok' })
    const r = run(b)
    expect(r.out).toContain(`Getting Node ${SETUP_NODE_LINE} from nodejs.org`)
    expect(r.out).toContain('Node is in place.')
    expect(existsSync(fetchedNode(b))).toBe(true)
    expect(r.out).toContain(`NODE_SCRIPT_RAN by=${fetchedNode(b)}`)
    expect(r.curlCalls).toHaveLength(2)
    expect(r.curlCalls[0]).toContain(`https://nodejs.org/dist/latest-${SETUP_NODE_LINE}.x/SHASUMS256.txt`)
    expect(r.curlCalls[1]).toMatch(new RegExp(`node-${SETUP_NODE_LINE}\\.9\\.9-darwin-(arm64|x64)\\.tar\\.gz$`))
    // the next run finds the fetched Node and asks nodejs.org for nothing
    const again = run(b)
    expect(again.out).not.toContain('Getting Node')
    expect(again.curlCalls).toEqual([])
    expect(again.out).toContain(`NODE_SCRIPT_RAN by=${fetchedNode(b)}`)
  })

  it.skipIf(systemNodeOnPath)('no Node at all: the same fetch', () => {
    const b = bed({ dist: 'ok' })
    const r = run(b)
    expect(r.out).toContain('Node is in place.')
    expect(r.out).toContain(`NODE_SCRIPT_RAN by=${fetchedNode(b)}`)
  })

  it('nodejs.org out of reach: one plain line, nothing run, and the shell lives on', () => {
    const r = run(bed({ nodeMajor: 16, dist: 'down' }))
    expect(r.out).toContain('Node could not be fetched. Check that this Mac is online, then press Set up on this Mac again for a fresh command.')
    expect(r.out).not.toContain('NODE_SCRIPT_RAN')
    expect(r.out).toContain('STILL_HERE')
    expect(r.status).toBe(0)
  })

  it('a tarball that fails its checksum is refused, and the shell lives on', () => {
    const b = bed({ nodeMajor: 16, dist: 'ok' })
    // corrupt the SHASUMS the fake nodejs.org serves
    const sums = join(b.bin, '..', 'dist', 'SHASUMS256.txt')
    writeFileSync(sums, readFileSync(sums, 'utf8').replace(/^[0-9a-f]{8}/gm, '00000000'))
    const r = run(b)
    expect(r.out).toContain('Node could not be fetched.')
    expect(existsSync(fetchedNode(b))).toBe(false)
    expect(r.out).toContain('STILL_HERE')
  })

  it.skipIf(!existsSync('/bin/zsh'))('runs the same under zsh, the Terminal’s shell', () => {
    const r = run(bed({ nodeMajor: 20, dist: 'down' }), '/bin/zsh')
    expect(r.out).toContain('code=K7Q2-M9XD-4T rounds=1')
    const down = run(bed({ nodeMajor: 16, dist: 'down' }), '/bin/zsh')
    expect(down.out).toContain('Node could not be fetched.')
    expect(down.out).toContain('STILL_HERE')
  })
})

/**
 * The Node half of the command, run by this process's own Node against a local stand-in for
 * twin-setup. The stand-in answers like the real door (a token, the kickoff, where it goes) and
 * keeps what it was asked. `open`, `pbcopy`, `pgrep` and `osascript` are stubs that log their calls.
 */
const heredoc = cmd.slice(cmd.indexOf("<<'NODEEOF'\n") + "<<'NODEEOF'\n".length, cmd.indexOf('\nNODEEOF'))

type Door = { server: Server; url: string; asked: unknown[]; answer: { status: number; body: Record<string, unknown> } }
function door(answer: Door['answer']): Promise<Door> {
  const d: Partial<Door> = { asked: [], answer }
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      d.asked!.push(JSON.parse(raw))
      res.writeHead(d.answer!.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(d.answer!.body))
    })
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    const a = server.address()
    ok({ ...(d as Door), server, url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}` })
  }))
}

type MacBed = { home: string; bin: string; log: string; clip: string }
function mac(opts: { claudeApp: boolean }): MacBed {
  const root = mkdtempSync(join(tmpdir(), 'pt-mac-'))
  const home = join(root, 'home'); const bin = join(root, 'bin'); const log = join(root, 'calls.log'); const clip = join(root, 'clipboard.txt')
  mkdirSync(home); mkdirSync(bin)
  exe(join(bin, 'open'), `#!/bin/sh\necho "open $@" >> "${log}"\n${opts.claudeApp ? 'exit 0' : '[ "$1" = "-Ra" ] && exit 1; exit 0'}\n`)
  exe(join(bin, 'pbcopy'), `#!/bin/sh\necho "pbcopy" >> "${log}"\ncat > "${clip}"\n`)
  exe(join(bin, 'pgrep'), `#!/bin/sh\necho "pgrep $@" >> "${log}"\nexit 1\n`)
  exe(join(bin, 'osascript'), `#!/bin/sh\necho "osascript $@" >> "${log}"\nexit 0\n`)
  return { home, bin, log, clip }
}

function runScript(b: MacBed, setupUrl: string, extra: Record<string, string> = {}): Promise<{ out: string; code: number | null; calls: string[] }> {
  return new Promise((ok) => {
    const child = spawn(process.execPath, ['-'], {
      env: {
        HOME: b.home,
        PATH: `${b.bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
        SETUP_CODE: 'K7Q2-M9XD-4T',
        TWIN_SETUP_URL: setupUrl,
        TWIN_MCP_URL: 'https://mcp.clicktooling.com/twin',
        CONNECTOR_NAME: 'twin-mcp',
        ROUNDS: '0',
        KICKOFF_FILE: 'Library/Application Support/ClickTooling/last-kickoff.md',
        ...extra,
      },
    })
    let out = ''
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { out += c })
    child.on('close', (code) => ok({ out, code, calls: existsSync(b.log) ? readFileSync(b.log, 'utf8').trim().split('\n') : [] }))
    child.stdin.end(heredoc)
  })
}

const configOf = (b: MacBed) => JSON.parse(readFileSync(join(b.home, 'Library/Application Support/Claude/claude_desktop_config.json'), 'utf8'))
const GOOD = { status: 200, body: { token: 'tok_never_shown_9f8e7d', twin_email: 'twin@example.com', connector_name: 'twin-mcp', connector_url: 'https://mcp.clicktooling.com/twin', kickoff: 'THE CODE KICKOFF', kickoff_for: 'code' } }

describe('the command’s Node half, against a stand-in twin-setup (v2.5742)', () => {
  it('redeems the code, writes the connector by absolute paths with that Node’s bin first on its PATH, keeps other servers, copies and files the kickoff, restarts Claude', async () => {
    const d = await door(GOOD)
    try {
      const b = mac({ claudeApp: true })
      const cfgPath = join(b.home, 'Library/Application Support/Claude/claude_desktop_config.json')
      mkdirSync(dirname(cfgPath), { recursive: true })
      writeFileSync(cfgPath, JSON.stringify({ mcpServers: { other: { command: 'x' } }, theme: 'dark' }))
      const r = await runScript(b, d.url)
      expect(r.code).toBe(0)
      expect(d.asked).toEqual([{ action: 'redeem', code: 'K7Q2-M9XD-4T', machine: hostname(), rounds: false }])
      const cfg = configOf(b)
      const nodeBin = realpathSync(process.execPath)
      expect(cfg.theme).toBe('dark')
      expect(cfg.mcpServers.other).toEqual({ command: 'x' })
      const entry = cfg.mcpServers['twin-mcp']
      expect(entry.command).toBe(nodeBin)
      expect(entry.args[0]).toBe(resolve(dirname(nodeBin), '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'))
      expect(entry.args.slice(1)).toEqual(['-y', 'mcp-remote', 'https://mcp.clicktooling.com/twin', '--header', 'X-Twin-Token:${TWIN_TOKEN}'])
      expect(entry.env.TWIN_TOKEN).toBe('tok_never_shown_9f8e7d')
      expect(entry.env.PATH.split(':')[0]).toBe(dirname(nodeBin))
      expect(r.out).not.toContain('tok_never_shown')
      expect(readFileSync(b.clip, 'utf8')).toBe('THE CODE KICKOFF')
      expect(readFileSync(join(b.home, 'Library/Application Support/ClickTooling/last-kickoff.md'), 'utf8')).toBe('THE CODE KICKOFF')
      expect(r.out).toContain('twin-mcp connected for twin@example.com.')
      expect(r.out).toContain('Claude is reopening. The kickoff is on your clipboard: open the Code tab, start a NEW session and paste it. A copy is at ')
      expect(r.calls).toContain('open -Ra Claude')
      expect(r.calls).toContain('open -a Claude')
    } finally { d.server.close() }
  })

  it('under Claude Code it leaves the restart to the person and never quits Claude', async () => {
    const d = await door(GOOD)
    try {
      const b = mac({ claudeApp: true })
      const r = await runScript(b, d.url, { CLAUDECODE: '1' })
      expect(r.code).toBe(0)
      expect(configOf(b).mcpServers['twin-mcp'].env.TWIN_TOKEN).toBe('tok_never_shown_9f8e7d')
      expect(readFileSync(b.clip, 'utf8')).toBe('THE CODE KICKOFF')
      expect(r.out).toContain('Done here. Now quit Claude with Cmd+Q and open it again, so the connector loads. Then open the Code tab, start a NEW session and paste it.')
      expect(r.out).toContain('The kickoff is on your clipboard. A copy is at ')
      expect(r.calls).not.toContain('open -a Claude')
      expect(r.calls.some((c) => c.startsWith('osascript'))).toBe(false)
    } finally { d.server.close() }
  })

  it('a refused code is one line and leaves the config alone', async () => {
    const d = await door({ status: 410, body: { error: 'That code expired.' } })
    try {
      const b = mac({ claudeApp: true })
      const r = await runScript(b, d.url)
      expect(r.code).toBe(1)
      expect(r.out).toContain('Setup code refused: That code expired. Press "Set up on this Mac" again for a fresh command.')
      expect(existsSync(join(b.home, 'Library/Application Support/Claude/claude_desktop_config.json'))).toBe(false)
    } finally { d.server.close() }
  })

  it('a refusal that already says to press Set up on this Mac again is not told twice (v2.5744)', async () => {
    const d = await door({ status: 410, body: { error: 'That setup code is not valid, was already used, or has expired (they last 10 minutes). Press "Set up on this Mac" again for a fresh one.' } })
    try {
      const b = mac({ claudeApp: true })
      const r = await runScript(b, d.url)
      expect(r.code).toBe(1)
      expect(r.out).toContain('Setup code refused: That setup code is not valid')
      expect(r.out.match(/Set up on this Mac/g)).toHaveLength(1)
    } finally { d.server.close() }
  })

  it('no Claude app on the Mac: it says so before the code is spent', async () => {
    const d = await door(GOOD)
    try {
      const b = mac({ claudeApp: false })
      const r = await runScript(b, d.url)
      expect(r.code).toBe(1)
      expect(r.out).toContain('The Claude app is not on this Mac. Install it from claude.ai/download')
      expect(d.asked).toEqual([])
    } finally { d.server.close() }
  })
})

/**
 * The rounds (v2.5752, punch list #142): the same Node half with ROUNDS=1, against a stand-in Mac
 * whose `claude`, `launchctl`, `pmset` and `curl` are stubs that log their calls. The stub claude
 * answers `auth status` from a flag file that `auth login` creates; the stub curl, asked for the
 * installer, prints a script that puts the stub into ~/.local/bin. No real CLI, no network.
 */
type RoundsBed = MacBed & { flag: string }
function roundsMac(opts: { signedIn: boolean; cli: 'path' | 'none'; sleep?: number; bootstrapFails?: boolean }): RoundsBed {
  const b = mac({ claudeApp: true })
  const flag = join(b.home, 'signed-in.flag')
  if (opts.signedIn) writeFileSync(flag, '1')
  const stub = `#!/bin/sh
echo "claude $@" >> "${b.log}"
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then if [ -f "${flag}" ]; then echo '{"loggedIn":true,"authMethod":"claude.ai"}'; else echo '{"loggedIn":false,"authMethod":"none"}'; fi; exit 0; fi
if [ "$1" = "auth" ] && [ "$2" = "login" ]; then touch "${flag}"; exit 0; fi
exit 0
`
  exe(join(b.bin, opts.cli === 'path' ? 'claude' : 'claude-stub'), stub)
  // claude.ai/install.sh stands in as a script that copies the stub into ~/.local/bin
  exe(join(b.bin, 'curl'), `#!/bin/sh\necho "curl $@" >> "${b.log}"\necho 'mkdir -p "$HOME/.local/bin" && cp "${join(b.bin, 'claude-stub')}" "$HOME/.local/bin/claude" && chmod 755 "$HOME/.local/bin/claude"'\n`)
  exe(join(b.bin, 'launchctl'), `#!/bin/sh\necho "launchctl $@" >> "${b.log}"\n[ "$1" = bootout ] && { echo "Boot-out failed: 3: No such process" >&2; exit 3; }\n${opts.bootstrapFails ? '[ "$1" = bootstrap ] && { echo "Bootstrap failed: 5: Input/output error" >&2; exit 5; }' : ''}\nexit 0\n`)
  exe(join(b.bin, 'pmset'), `#!/bin/sh\necho " sleep                ${opts.sleep ?? 0}"\necho " displaysleep         10"\n`)
  return { ...b, flag }
}

const pt = (b: MacBed) => join(b.home, 'Library/Application Support/ClickTooling')
const plistOf = (b: MacBed) => join(b.home, 'Library/LaunchAgents', `${ROUNDS_AGENT_LABEL}.plist`)
const ROUNDS_GOOD = { status: 200, body: { ...GOOD.body, kickoff: 'THE ROUND TEXT', kickoff_for: 'rounds' } }

describe('the rounds: the command installs the Robot rounds agent (v2.5752, punch list #142)', () => {
  it('writes the round text, the connector file, the wrapper and the plist, loads the agent, and never touches the clipboard or the Claude app', async () => {
    const d = await door(ROUNDS_GOOD)
    try {
      const b = roundsMac({ signedIn: true, cli: 'path' })
      const r = await runScript(b, d.url, { ROUNDS: '1' })
      expect(r.code).toBe(0)
      expect(d.asked).toEqual([{ action: 'redeem', code: 'K7Q2-M9XD-4T', machine: hostname(), rounds: true }])
      // Desktop's config as before, and the rounds' own connector file: an HTTP server with the key as its header, mode 600.
      expect(configOf(b).mcpServers['twin-mcp'].env.TWIN_TOKEN).toBe('tok_never_shown_9f8e7d')
      const mcp = JSON.parse(readFileSync(join(pt(b), 'mcp.json'), 'utf8'))
      expect(mcp).toEqual({ mcpServers: { 'twin-mcp': { type: 'http', url: 'https://mcp.clicktooling.com/twin', headers: { 'X-Twin-Token': 'tok_never_shown_9f8e7d' } } } })
      expect(statSync(join(pt(b), 'mcp.json')).mode & 0o777).toBe(0o600)
      expect(readFileSync(join(pt(b), 'round.md'), 'utf8')).toBe('THE ROUND TEXT')
      expect(readFileSync(join(pt(b), 'round.sh'), 'utf8')).toBe(buildRoundScript())
      expect(statSync(join(pt(b), 'round.sh')).mode & 0o111).toBe(0o111)
      expect(existsSync(join(pt(b), 'work'))).toBe(true)
      expect(existsSync(join(b.home, 'Library/Logs/ClickTooling'))).toBe(true)
      expect(readFileSync(plistOf(b), 'utf8')).toBe(buildRoundsLaunchAgentPlist(b.home))
      const uid = process.getuid!()
      expect(r.calls.filter((c) => c.startsWith('launchctl'))).toEqual([
        `launchctl bootout gui/${uid}/${ROUNDS_AGENT_LABEL}`,
        `launchctl enable gui/${uid}/${ROUNDS_AGENT_LABEL}`,
        `launchctl bootstrap gui/${uid} ${plistOf(b)}`,
      ])
      expect(r.calls.filter((c) => c.startsWith('claude'))).toEqual(['claude auth status'])
      expect(r.calls).not.toContain('pbcopy')
      expect(r.calls).not.toContain('open -a Claude')
      expect(r.calls.some((c) => c.startsWith('osascript'))).toBe(false)
      expect(existsSync(join(b.home, 'Library/Application Support/ClickTooling/last-kickoff.md'))).toBe(false)
      expect(r.out).not.toContain('tok_never_shown')
      expect(r.out).toContain('twin-mcp connected for twin@example.com.')
      expect(r.out).toContain('The rounds are installed on this Mac: one every five minutes, with no Claude session open and no question asked. The first is running now. Bids → 🤖 Robots → Console shows this Mac Alive within a minute.')
      expect(r.out).toContain(`To take the rounds off this Mac:  launchctl bootout gui/$UID/${ROUNDS_AGENT_LABEL}`)
      expect(r.out).not.toContain('sleeps after')
    } finally { d.server.close() }
  })

  it('signs the CLI in first when it is not, before the code is spent, and says when the Mac would sleep', async () => {
    const d = await door(ROUNDS_GOOD)
    try {
      const b = roundsMac({ signedIn: false, cli: 'path', sleep: 10 })
      const r = await runScript(b, d.url, { ROUNDS: '1' })
      expect(r.code).toBe(0)
      expect(r.calls.filter((c) => c.startsWith('claude'))).toEqual(['claude auth status', 'claude auth login', 'claude auth status'])
      expect(r.out).toContain('Claude Code is not signed in on this Mac yet. A browser window opens once: sign in with the Claude account the rounds use.')
      expect(r.out).toContain('This Mac sleeps after 10 minutes, and the rounds stop while it sleeps. System Settings → Energy: never sleep.')
      expect(d.asked).toHaveLength(1)
      expect(existsSync(plistOf(b))).toBe(true)
    } finally { d.server.close() }
  })

  it('pasted into Claude Code while the CLI is not signed in: one line, nothing spent, nothing written', async () => {
    const d = await door(ROUNDS_GOOD)
    try {
      const b = roundsMac({ signedIn: false, cli: 'path' })
      const r = await runScript(b, d.url, { ROUNDS: '1', CLAUDECODE: '1' })
      expect(r.code).toBe(1)
      expect(r.out).toContain('Claude Code on this Mac is not signed in for the rounds. In Terminal run:  ')
      expect(r.out).toContain(' auth login  and sign in, then press "Set up on this Mac" again and paste that command into Terminal. Nothing was changed.')
      expect(r.calls.filter((c) => c.startsWith('claude'))).toEqual(['claude auth status'])
      expect(d.asked).toEqual([])
      expect(existsSync(join(pt(b), 'mcp.json'))).toBe(false)
      expect(existsSync(plistOf(b))).toBe(false)
    } finally { d.server.close() }
  })

  it('a Mac with no Claude Code anywhere gets it from claude.ai into ~/.local/bin, then carries on', async () => {
    const d = await door(ROUNDS_GOOD)
    try {
      const b = roundsMac({ signedIn: true, cli: 'none' })
      const r = await runScript(b, d.url, { ROUNDS: '1' })
      expect(r.code).toBe(0)
      expect(r.out).toContain('Getting Claude Code for this Mac from claude.ai, into your Library folder.')
      expect(r.calls).toContain('curl -fsSL https://claude.ai/install.sh')
      expect(existsSync(join(b.home, '.local/bin/claude'))).toBe(true)
      expect(r.calls.filter((c) => c.startsWith('claude'))).toEqual(['claude auth status'])
      expect(existsSync(plistOf(b))).toBe(true)
    } finally { d.server.close() }
  })

  it('launchd refusing the agent is said in one line with the command to run by hand', async () => {
    const d = await door(ROUNDS_GOOD)
    try {
      const b = roundsMac({ signedIn: true, cli: 'path', bootstrapFails: true })
      const r = await runScript(b, d.url, { ROUNDS: '1' })
      expect(r.code).toBe(1)
      expect(r.out).toContain('launchd would not start the rounds: Bootstrap failed: 5: Input/output error. In Terminal run:  launchctl bootstrap gui/')
      expect(r.out).not.toContain('The rounds are installed')
    } finally { d.server.close() }
  })

  it('the pricer joins the rounds: a plain setup adds its key to a connector file that already exists, and writes none where there is none', async () => {
    const pricer = { status: 200, body: { ...GOOD.body, connector_name: 'twin-pricer-mcp', token: 'tok_pricer_7a7a', kickoff: 'THE PRICING KICKOFF', kickoff_for: 'chat' } }
    const d = await door(pricer)
    try {
      const b = mac({ claudeApp: true })
      mkdirSync(pt(b), { recursive: true })
      writeFileSync(join(pt(b), 'mcp.json'), JSON.stringify({ mcpServers: { 'twin-mcp': { type: 'http', url: 'https://mcp.clicktooling.com/twin', headers: { 'X-Twin-Token': 'tok_bid_robot' } } } }))
      const r = await runScript(b, d.url, { ROUNDS: '0', CONNECTOR_NAME: 'twin-pricer-mcp' })
      expect(r.code).toBe(0)
      const mcp = JSON.parse(readFileSync(join(pt(b), 'mcp.json'), 'utf8'))
      expect(Object.keys(mcp.mcpServers)).toEqual(['twin-mcp', 'twin-pricer-mcp'])
      expect(mcp.mcpServers['twin-mcp'].headers['X-Twin-Token']).toBe('tok_bid_robot')
      expect(mcp.mcpServers['twin-pricer-mcp'].headers['X-Twin-Token']).toBe('tok_pricer_7a7a')
      expect(r.calls.some((c) => c.startsWith('launchctl'))).toBe(false)
      expect(readFileSync(b.clip, 'utf8')).toBe('THE PRICING KICKOFF')

      const b2 = mac({ claudeApp: true })
      const r2 = await runScript(b2, d.url, { ROUNDS: '0' })
      expect(r2.code).toBe(0)
      expect(existsSync(join(pt(b2), 'mcp.json'))).toBe(false)
    } finally { d.server.close() }
  })
})
