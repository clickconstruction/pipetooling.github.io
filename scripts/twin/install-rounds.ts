/**
 * install-rounds.ts — put the Robot rounds agent on this Mac from a shell (v2.7962).
 *
 *     npx vite-node scripts/twin/install-rounds.ts               # install, from the key and round text beside it
 *     npx vite-node scripts/twin/install-rounds.ts -- --dry-run  # say what it would write and run, and touch nothing
 *     npx vite-node scripts/twin/install-rounds.ts -- --uninstall
 *
 * The step before it:  python3 scripts/twin/redeem_setup_code.py <code> --rounds
 * (the code minted with rounds: true), which leaves the key in ~/pt-twin-digest/twin.token and the round text in
 * ~/pt-twin-digest/kickoff-rounds.md. This script reads those two files and installs what the app's own
 * "Set up on this Mac" installs with *This Mac makes the rounds* ticked: the connector file, the round text, the
 * wrapper and the LaunchAgent, from the same kernel (src/lib/bids/roundsLaunchAgent.ts, through roundsInstall.ts).
 *
 * It checks before it writes: the Claude Code CLI is on this Mac and signed in. It does not sign in for you (that is
 * a browser window, a person's) and it leaves Claude Desktop's own config alone (the rounds never read it).
 * The key is never printed: the connector file is written mode 600 and named by its path alone.
 *
 * Options: --token-file PATH  --round-text PATH  --connector twin-mcp|twin-pricer-mcp  --url https://…
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { TWIN_MCP_PUBLIC_URL } from '../../src/lib/bids/desktopKickoff'
import { checkRoundsInstall, roundsInstallPlan, roundsInstallPlanWords } from '../../src/lib/bids/roundsInstall'
import { ROUNDS_AGENT_LABEL, ROUNDS_MCP_FILE, ROUNDS_UNINSTALL_COMMAND } from '../../src/lib/bids/roundsLaunchAgent'

const say = (line: string): void => {
  process.stdout.write(`${line}\n`)
}
const stop = (line: string): never => {
  process.stderr.write(`${line}\n`)
  process.exit(1)
}

const argv = process.argv.slice(2).filter((a) => a !== '--')
const flag = (name: string): boolean => argv.includes(name)
const opt = (name: string): string | null => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1]! : null
}
const known = new Set(['--dry-run', '--uninstall', '--token-file', '--round-text', '--connector', '--url'])
for (const a of argv) if (a.startsWith('--') && !known.has(a)) stop(`install-rounds: no option ${a}. The options: ${[...known].join(' ')}`)

if (process.platform !== 'darwin') stop('install-rounds: the rounds run under launchd, on a Mac. This is not one.')
const home = os.homedir()
const uid = process.getuid ? process.getuid() : -1
const domain = `gui/${uid}`

if (flag('--uninstall')) {
  const out = spawnSync('launchctl', ['bootout', `${domain}/${ROUNDS_AGENT_LABEL}`], { encoding: 'utf8' })
  say(out.status === 0 ? `The rounds are off this Mac (${ROUNDS_UNINSTALL_COMMAND}). The key, the round text and the log stay where they are.` : `Nothing was loaded: ${((out.stderr || '') + (out.stdout || '')).trim() || 'launchd knew no such agent'}.`)
  process.exit(0)
}

const folder = path.join(home, 'pt-twin-digest')
const tokenFile = opt('--token-file') ?? process.env.TWIN_TOKEN_FILE ?? path.join(folder, 'twin.token')
const roundTextFile = opt('--round-text') ?? path.join(path.dirname(tokenFile), 'kickoff-rounds.md')
const read = (file: string, what: string): string => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return stop(`install-rounds: ${what} is not at ${file}. Mint a setup code with rounds: true, then:  python3 scripts/twin/redeem_setup_code.py <code> --rounds`)
  }
}
const mcpFile = path.join(home, ROUNDS_MCP_FILE)
let existingMcp: string | null = null
try {
  existingMcp = fs.readFileSync(mcpFile, 'utf8')
} catch {
  existingMcp = null
}

const input = {
  home,
  uid,
  token: read(tokenFile, 'the key file'),
  roundText: read(roundTextFile, 'the round text'),
  connectorName: opt('--connector') ?? 'twin-mcp',
  connectorUrl: opt('--url') ?? TWIN_MCP_PUBLIC_URL,
  existingMcp,
}
const checked = checkRoundsInstall(input)
if (!checked.ok) stop(`install-rounds: ${checked.refused}`)

// The Claude Code CLI, found as round.sh finds it: the Claude app's newest copy, else ~/.local/bin, else the PATH's.
const isExe = (f: string): boolean => {
  try {
    fs.accessSync(f, fs.constants.X_OK)
    return fs.statSync(f).isFile()
  } catch {
    return false
  }
}
const verNum = (v: string): number[] => v.split('.').map((n) => parseInt(n, 10) || 0)
const cmpVer = (a: string, b: string): number => {
  const x = verNum(a)
  const y = verNum(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}
function findCli(): string {
  const dir = path.join(home, 'Library/Application Support/Claude/claude-code')
  let app = ''
  try {
    for (const v of fs.readdirSync(dir).filter((d) => /^\d/.test(d)).sort(cmpVer).reverse()) {
      for (const h of fs.readdirSync(path.join(dir, v))) {
        const c = path.join(dir, v, h, 'claude.app/Contents/MacOS/claude')
        if (isExe(c)) {
          app = c
          break
        }
      }
      if (app) break
    }
  } catch {
    app = ''
  }
  const onPath = (spawnSync('sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).stdout || '').trim()
  for (const c of [app, path.join(home, '.local/bin/claude'), onPath]) if (c && isExe(c)) return c
  return ''
}
const cli = findCli()
const signedIn = (): boolean => {
  try {
    return (JSON.parse(spawnSync(cli, ['auth', 'status'], { encoding: 'utf8' }).stdout) as { loggedIn?: unknown }).loggedIn === true
  } catch {
    return false
  }
}

const plan = roundsInstallPlan(input)
const dry = flag('--dry-run')
say(dry ? 'Dry run: nothing is written and nothing is loaded.' : 'Installing the Robot rounds agent on this Mac.')
say(`Key file: ${tokenFile} (read, never shown). Round text: ${roundTextFile}. Connector: ${input.connectorName} at ${input.connectorUrl}.`)
say(cli ? `Claude Code: ${cli}${signedIn() ? ', signed in.' : ', NOT signed in.'}` : 'Claude Code: not found on this Mac.')
for (const line of roundsInstallPlanWords(plan)) say(`  ${line}`)
const sleep = /^\s*sleep\s+(\d+)/m.exec(spawnSync('pmset', ['-g'], { encoding: 'utf8' }).stdout || '')
if (sleep && sleep[1] !== '0') say(`This Mac sleeps after ${sleep[1]} minutes, and the rounds stop while it sleeps. System Settings → Energy: never sleep.`)
if (dry) process.exit(0)

// Before anything is written: a round with no CLI, or a CLI that is not signed in, would fail every five minutes.
if (!cli) stop('install-rounds: no Claude Code on this Mac. Open the Code tab in the Claude app once, or run  curl -fsSL https://claude.ai/install.sh | bash  then run this again. Nothing was changed.')
if (!signedIn()) stop(`install-rounds: Claude Code is not signed in for the rounds. In Terminal run:  ${cli} auth login  and sign in with the Claude account the rounds use, then run this again. Nothing was changed.`)

for (const dir of plan.dirs) fs.mkdirSync(dir, { recursive: true })
for (const file of plan.files) {
  fs.mkdirSync(path.dirname(file.path), { recursive: true })
  fs.writeFileSync(file.path, file.content, { mode: file.mode })
  fs.chmodSync(file.path, file.mode)
}
for (const call of plan.launchctl) {
  const out = spawnSync('launchctl', call.args, { encoding: 'utf8' })
  if (out.status !== 0 && !call.mayFail) stop(`install-rounds: launchd would not start the rounds: ${((out.stderr || '') + (out.stdout || '')).trim()}. The files are written; in Terminal run:  launchctl ${call.args.join(' ')}`)
}
say(`The rounds are installed on this Mac: one every five minutes, with no Claude session open and no question asked. The first is running now. Bids → Robots → Console shows this Mac Alive within a minute. The log is ${plan.logPath}. To take the rounds off this Mac:  ${plan.uninstall}`)
