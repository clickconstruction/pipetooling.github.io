/**
 * The robot kickoffs and the setup commands behind Bids → 🤖 Robots → Console.
 *
 * A kickoff is a markdown file in `docs/twins/kickoffs/` copied whole, with the one
 * machine-specific value filled in — the twin-mcp connector URL. The doc is the
 * source of truth; this kernel only fills its placeholder, so the copied prompt and
 * the file never disagree. `code-operator.md` (v2.4231) is pasted into a Claude Code
 * session, which reads the plans itself; `desktop-operator.md` (v2.3207) is the chat
 * fallback, where a person attaches each plan PDF.
 */

export const DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER = '{{CONNECTOR_URL}}'

/**
 * The twin-mcp connector address: the function door for a Supabase project URL, or a
 * public address that already carries its path, verbatim (v2.3633 — shared with twin-setup).
 */
export { twinMcpConnectorUrl } from '../../../supabase/functions/_shared/twinConnectorUrl'
import { isTwinMcpConnectorUrl } from '../../../supabase/functions/_shared/twinConnectorUrl'
import { ROUNDS_AGENT_LABEL, ROUNDS_DIR, ROUNDS_UNINSTALL_COMMAND, buildRoundScript, buildRoundsLaunchAgentPlist } from './roundsLaunchAgent'

/**
 * The address every copy button hands out (v2.3634): the `mcp-router` Worker in front of the
 * twin-mcp function (`scripts/cloudflare/`). The Supabase door keeps answering, so a machine
 * set up before the move needs nothing.
 */
export const TWIN_MCP_PUBLIC_URL = 'https://mcp.clicktooling.com/twin'

/**
 * Fill the kickoff template. Throws when the template lost its placeholder —
 * a copied prompt that still says `{{CONNECTOR_URL}}` would fail step 3 of the
 * setup silently on someone else's machine, so the build should fail instead.
 */
export function buildDesktopKickoff(template: string, opts: { connectorUrl: string }): string {
  if (!template.includes(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)) {
    throw new Error(`desktop kickoff template has no ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER} placeholder`)
  }
  return template.split(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER).join(opts.connectorUrl)
}

/**
 * The Claude Desktop setup command (v2.3224): one Terminal command that does
 * what the kickoff's old step 3 asked a person to do by hand — and failed at,
 * because a fresh install has no `mcpServers` block to "add the entry inside".
 * The command asks for the robot key with a silent prompt (never the clipboard
 * history, the shell history, or a chat), finds Node the way a Dock-launched
 * app cannot (GUI apps don't get the shell's PATH — the full path is written),
 * merges the `twin-mcp` entry into whatever config already exists (creating the
 * file and the block when absent), and prints the next step. macOS only: the
 * config path is Desktop's on a Mac.
 */
export function buildDesktopSetupCommand(opts: { connectorUrl: string }): string {
  const url = opts.connectorUrl.trim()
  if (!isTwinMcpConnectorUrl(url)) {
    throw new Error(`desktop setup command needs a twin-mcp connector URL, got ${JSON.stringify(url)}`)
  }
  return [
    'read -s -p "Paste your robot key, then press Return: " TWIN_TOKEN; echo',
    '[ -n "$TWIN_TOKEN" ] || echo "No key entered. Issue one at Settings → Digital twins → Issue key and run this again."',
    'NPX="$(command -v npx)" || echo "Node not found. Install Node 18+ from nodejs.org, then run this again."',
    // No `exit` in the interactive shell (v2.5742): a miss skips the script and keeps the Terminal window.
    `[ -n "$TWIN_TOKEN" ] && [ -n "$NPX" ] && TWIN_TOKEN="$TWIN_TOKEN" NPX="$NPX" TWIN_MCP_URL="${url}" python3 - <<'PYEOF'`,
    'import json, os, pathlib',
    'p = pathlib.Path.home() / "Library/Application Support/Claude/claude_desktop_config.json"',
    'cfg = json.loads(p.read_text()) if p.exists() and p.read_text().strip() else {}',
    'cfg.setdefault("mcpServers", {})["twin-mcp"] = {',
    '  "command": os.environ["NPX"],',
    '  "args": ["-y", "mcp-remote", os.environ["TWIN_MCP_URL"], "--header", "X-Twin-Token:${TWIN_TOKEN}"],',
    '  "env": {"TWIN_TOKEN": os.environ["TWIN_TOKEN"]},',
    '}',
    'p.parent.mkdir(parents=True, exist_ok=True)',
    'p.write_text(json.dumps(cfg, indent=2))',
    'print("twin-mcp added to Claude Desktop.")',
    'print("Next: quit Claude Desktop with Cmd+Q, reopen it, and in a new chat type:  call get_brief on twin-mcp")',
    'print("If Settings → Developer shows an error, run:  tail -50 ~/Library/Logs/Claude/mcp-server-twin-mcp.log")',
    'PYEOF',
  ].join('\n')
}

export type SetupCodeCommandOpts = {
  /** The twin-mcp door — written into Desktop's config as the connector (the server's answer wins when it differs). */
  connectorUrl: string
  /** The twin-setup door the command redeems the code at. */
  setupUrl: string
  /** The one-time code from twin-setup `mint` (K7Q2-M9XD-4T). Public by design: ten minutes, single use, worth one key. */
  code: string
  /** Robot rounds PR 5 (v2.5735): this Mac makes the rounds — twin-setup hands back the rounds kickoff instead of the batch kickoff. */
  rounds?: boolean
  /** The connector's name in Claude's config: `twin-mcp` for the bid robot, `twin-pricer-mcp` for the pricer, so one Mac can hold both seats. The server's answer wins. */
  connectorName?: string
}

const CONNECTOR_NAME_RE = /^[a-z][a-z0-9-]{1,40}$/
export const TWIN_MCP_CONNECTOR_NAME = 'twin-mcp'
export const TWIN_PRICER_CONNECTOR_NAME = 'twin-pricer-mcp'

const SETUP_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/

/**
 * The Node the setup command fetches when a Mac has none (v2.5742): the newest
 * patch of this LTS line, by nodejs.org's `latest-vN.x/` door, so a one-line bump
 * here moves every future setup. A Mac that already has Node 18+ never downloads.
 */
export const SETUP_NODE_LINE = 'v24'
/** Where the fetched Node lives: the person's own Library folder, no admin rights, nothing else touched. */
export const SETUP_NODE_HOME = '$HOME/Library/Application Support/ClickTooling/node'
/** Where the command leaves a copy of the kickoff, for when the clipboard is lost before the paste. */
export const SETUP_KICKOFF_FILE = 'Library/Application Support/ClickTooling/last-kickoff.md'

/**
 * "Set up on this Mac" (Price Matrix PR 6): the setup command that carries a
 * one-time SETUP CODE instead of asking for a key. Pasted into Terminal it
 * redeems the code at twin-setup (which mints the key server-side and returns
 * it once, to this machine), merges the `twin-mcp` connector into Claude
 * Desktop's config with that key (the Claude app's Code tab loads the same
 * connector), quits and reopens Desktop so the connector loads, and puts the
 * robot's kickoff on the clipboard — so the person's next move is one paste:
 * into a new Code session for the bid robot, a new incognito chat for the
 * pricer (twin-setup's `kickoff_for`). The key is never printed, never
 * typed, never on a clipboard. macOS only: the config path and the quit/reopen
 * are Desktop's on a Mac.
 *
 * v2.5742 (the Mac Mini, 2026-10-22): the command is right wherever it lands.
 * - **It brings its own Node.** The shell prelude takes the Mac's Node when it
 *   is 18+, else a Node this command fetched before, else it fetches the newest
 *   `SETUP_NODE_LINE` tarball from nodejs.org into `SETUP_NODE_HOME` (the right
 *   chip, the checksum verified) — no installer, no admin password, nothing on
 *   the PATH. The connector is written by absolute paths (`node` + npm's
 *   `npx-cli.js`, that Node's bin first on the PATH it hands mcp-remote), so a
 *   Dock-launched Claude finds it.
 * - **It never ends the shell.** No `exit` in the interactive shell: a Mac that
 *   cannot get Node reads one plain line and keeps its Terminal window.
 * - **Pasted into Claude Code instead of Terminal, it still works**: under
 *   `CLAUDECODE` it skips quitting and reopening Claude (which would kill the
 *   session running it), keeps the kickoff on the clipboard and in
 *   `SETUP_KICKOFF_FILE`, and says to quit and reopen Claude by hand.
 * - **No Claude app on the Mac** → one line, before the code is spent.
 *
 * v2.5752 (punch list #142, the structural fix): with `rounds` the command installs the
 * **Robot rounds agent** instead of putting a kickoff on the clipboard — a per-user
 * LaunchAgent (`roundsLaunchAgent.ts`) that runs the Claude Code CLI headless every five
 * minutes with the round text and the connector, no Code session, no mode, no question.
 * Before the code is spent it finds the CLI (the Claude app's own copy, else
 * `claude.ai/install.sh`), signs it in once when it is not (`claude auth login`, a
 * browser window), and says in one line when the Mac would sleep. After the redeem it
 * writes Desktop's config as before, the rounds' own `mcp.json` (the connector as an
 * HTTP server with the key as its header, mode 600), `round.md`, `round.sh` and the
 * plist, then `launchctl bootstrap` loads the agent and the first round runs. The pricer's
 * key joins `mcp.json` when that file already exists, so the pricer joins the rounds.
 * The Claude app is left alone (the rounds do not need it open).
 */
export function buildDesktopSetupCommandFromCode(opts: SetupCodeCommandOpts): string {
  const url = opts.connectorUrl.trim()
  if (!isTwinMcpConnectorUrl(url)) {
    throw new Error(`setup command needs a twin-mcp connector URL, got ${JSON.stringify(url)}`)
  }
  const setupUrl = opts.setupUrl.trim()
  if (!/^https:\/\/[^\s"']+\/functions\/v1\/twin-setup$/.test(setupUrl)) {
    throw new Error(`setup command needs a twin-setup URL, got ${JSON.stringify(setupUrl)}`)
  }
  const code = opts.code.trim().toUpperCase()
  if (!SETUP_CODE_RE.test(code)) {
    throw new Error(`setup command needs a code like K7Q2-M9XD-4T, got ${JSON.stringify(opts.code)}`)
  }
  const connectorName = (opts.connectorName ?? TWIN_MCP_CONNECTOR_NAME).trim()
  if (!CONNECTOR_NAME_RE.test(connectorName)) {
    throw new Error(`setup command needs a plain connector name, got ${JSON.stringify(opts.connectorName)}`)
  }
  const dist = `https://nodejs.org/dist/latest-${SETUP_NODE_LINE}.x`
  return [
    // The first line reads the same to a person in Terminal and to Claude Code when the command lands there.
    'echo "ClickTooling robot setup for this Mac. It runs as it is, in Terminal or in Claude Code, and takes a minute or two."',
    `PT_HOME="${SETUP_NODE_HOME}"; PT_NODE=""`,
    // The Mac's own Node when it is 18+, else the one a previous run fetched. `[` fails quietly on a non-number.
    'for PT_C in "$(command -v node 2>/dev/null)" "$PT_HOME/bin/node"; do',
    '  if [ -n "$PT_C" ] && [ -x "$PT_C" ] && [ "$("$PT_C" -p "process.versions.node.split(\'.\')[0]" 2>/dev/null)" -ge 18 ] 2>/dev/null; then PT_NODE="$PT_C"; break; fi',
    'done',
    'if [ -z "$PT_NODE" ]; then',
    `  echo "This Mac has no Node yet. Getting Node ${SETUP_NODE_LINE} from nodejs.org, about 50 MB, into your Library folder. Nothing else is touched."`,
    '  PT_ARCH=x64; [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ] && PT_ARCH=arm64',
    '  PT_BAR=-sS; [ -t 1 ] && PT_BAR=-#',
    '  PT_TMP="$(mktemp -d)"',
    `  PT_FILE="$(curl -fsSL --retry 3 -o "$PT_TMP/SHASUMS256.txt" "${dist}/SHASUMS256.txt" && grep -o "node-${SETUP_NODE_LINE}[0-9.]*-darwin-$PT_ARCH\\.tar\\.gz" "$PT_TMP/SHASUMS256.txt" | head -1)"`,
    `  if [ -n "$PT_FILE" ] && curl -fL $PT_BAR --retry 3 -o "$PT_TMP/$PT_FILE" "${dist}/$PT_FILE" && (cd "$PT_TMP" && grep " $PT_FILE\\$" SHASUMS256.txt > one.sum && shasum -a 256 -c one.sum > /dev/null) && rm -rf "$PT_HOME" && mkdir -p "$PT_HOME" && tar -xzf "$PT_TMP/$PT_FILE" -C "$PT_HOME" --strip-components=1 && [ -x "$PT_HOME/bin/node" ]; then`,
    '    PT_NODE="$PT_HOME/bin/node"; echo "Node is in place."',
    '  else',
    '    echo "Node could not be fetched. Check that this Mac is online, then press Set up on this Mac again for a fresh command. Still stuck? Install Node from nodejs.org and run that fresh command."',
    '  fi',
    '  rm -rf "$PT_TMP"',
    'fi',
    // No `exit` anywhere above: without a Node the rest is skipped and the shell lives on. The heredoc is the script's stdin.
    `[ -n "$PT_NODE" ] && SETUP_CODE="${code}" TWIN_SETUP_URL="${setupUrl}" TWIN_MCP_URL="${url}" CONNECTOR_NAME="${connectorName}" ROUNDS="${opts.rounds ? '1' : '0'}" KICKOFF_FILE="${SETUP_KICKOFF_FILE}" "$PT_NODE" - <<'NODEEOF'`,
    "const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process')",
    "const say = (s) => console.log(s)",
    // Pasted into Claude Code: its shell carries CLAUDECODE. Quitting Claude from there would kill the session running this.
    "const underClaudeCode = !!process.env.CLAUDECODE",
    "const rounds = process.env.ROUNDS === '1'",
    `const PT = path.join(os.homedir(), ${JSON.stringify(ROUNDS_DIR)})`,
    // v2.5752: the rounds agent's two files, from the kernel (src/lib/bids/roundsLaunchAgent.ts) — the plist's __HOME__ is filled below.
    `const ROUND_SH = ${JSON.stringify(buildRoundScript())}`,
    `const PLIST = ${JSON.stringify(buildRoundsLaunchAgentPlist())}`,
    `const LABEL = ${JSON.stringify(ROUNDS_AGENT_LABEL)}, UNINSTALL = ${JSON.stringify(ROUNDS_UNINSTALL_COMMAND)}`,
    "const isExe = (f) => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile() } catch { return false } }",
    "const verNum = (v) => v.split('.').map((n) => parseInt(n, 10) || 0)",
    "const cmpVer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d } return 0 }",
    // The Claude Code CLI, the same way round.sh finds it: the Claude app's own copy (its newest), else claude.ai/install.sh's in ~/.local/bin, else the PATH's.
    "const findCli = () => {",
    "  const dir = path.join(os.homedir(), 'Library/Application Support/Claude/claude-code'); let app = ''",
    "  try { for (const v of fs.readdirSync(dir).filter((d) => /^\\d/.test(d)).sort(cmpVer).reverse()) { for (const h of fs.readdirSync(path.join(dir, v))) { const c = path.join(dir, v, h, 'claude.app/Contents/MacOS/claude'); if (isExe(c)) { app = c; break } } if (app) break } } catch {}",
    "  const onPath = (spawnSync('sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).stdout || '').trim()",
    "  for (const c of [app, path.join(os.homedir(), '.local/bin/claude'), onPath]) if (c && isExe(c)) return c",
    "  return ''",
    '}',
    "const signedIn = (cli) => { try { return JSON.parse(spawnSync(cli, ['auth', 'status'], { encoding: 'utf8' }).stdout).loggedIn === true } catch { return false } }",
    ';(async () => {',
    "  if (typeof fetch !== 'function') { say('This Node is too old. Install Node 18+ from nodejs.org, then run this again.'); process.exit(1) }",
    // The Claude app itself, before the code is spent: `open -Ra` finds an app without launching it.
    "  if (spawnSync('open', ['-Ra', 'Claude']).status !== 0) { say('The Claude app is not on this Mac. Install it from claude.ai/download, open it and sign in, then press \"Set up on this Mac\" again for a fresh command. Nothing was changed.'); process.exit(1) }",
    // v2.5752: the rounds run the CLI headless, so the CLI and its own sign-in come first — still before the code is spent.
    "  let cli = ''",
    '  if (rounds) {',
    '    cli = findCli()',
    "    if (!cli) { say('Getting Claude Code for this Mac from claude.ai, into your Library folder.'); spawnSync('bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'], { stdio: 'inherit' }); cli = findCli() }",
    "    if (!cli) { say('Claude Code could not be set up on this Mac. Open the Code tab in the Claude app once, then press \"Set up on this Mac\" again for a fresh command. Nothing was changed.'); process.exit(1) }",
    '    if (!signedIn(cli)) {',
    "      if (underClaudeCode) { say('Claude Code on this Mac is not signed in for the rounds. In Terminal run:  ' + cli + ' auth login  and sign in, then press \"Set up on this Mac\" again and paste that command into Terminal. Nothing was changed.'); process.exit(1) }",
    "      say('Claude Code is not signed in on this Mac yet. A browser window opens once: sign in with the Claude account the rounds use.')",
    "      spawnSync(cli, ['auth', 'login'], { stdio: 'inherit' })",
    "      if (!signedIn(cli)) { say('Claude Code is still not signed in. In Terminal run:  ' + cli + ' auth login  then press \"Set up on this Mac\" again. Nothing was changed.'); process.exit(1) }",
    '    }',
    // One plain line when the Mac would sleep between rounds; never a stop.
    "    const m = /^\\s*sleep\\s+(\\d+)/m.exec(spawnSync('pmset', ['-g'], { encoding: 'utf8' }).stdout || '')",
    "    if (m && m[1] !== '0') say('This Mac sleeps after ' + m[1] + ' minutes, and the rounds stop while it sleeps. System Settings → Energy: never sleep.')",
    '  }',
    // v2.5735: `rounds` asks for the rounds kickoff; the server names the connector (`connector_name`) so one Mac can hold both seats.
    "  const res = await fetch(process.env.TWIN_SETUP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'redeem', code: process.env.SETUP_CODE, machine: os.hostname(), rounds }) })",
    '  const body = await res.json().catch(() => ({}))',
    // v2.5744: twin-setup's own refusal already says to press Set up on this Mac again; the command adds that only when the reason does not.
    "  if (!res.ok || !body.token) { const why = body.error || ('HTTP ' + res.status); say('Setup code refused: ' + why + (/Set up on this Mac/.test(why) ? '' : ' Press \"Set up on this Mac\" again for a fresh command.')); process.exit(1) }",
    "  const p = path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json')",
    '  let cfg = {}',
    "  try { const t = fs.readFileSync(p, 'utf8'); if (t.trim()) cfg = JSON.parse(t) } catch (e) { if (e.code !== 'ENOENT') { say('Claude Desktop\\'s config could not be read (' + e.message + '). Fix or move ' + p + ' and run this again.'); process.exit(1) } }",
    '  cfg.mcpServers = cfg.mcpServers || {}',
    "  const name = body.connector_name || process.env.CONNECTOR_NAME || 'twin-mcp'",
    "  const url = body.connector_url || process.env.TWIN_MCP_URL",
    // Absolute paths throughout: the Node running this (the Mac's own or the fetched one) and npm's npx-cli.js beside it, its bin
    // first on the PATH mcp-remote gets — a Dock-launched Claude has no shell PATH, and the fetched Node is on nobody's.
    "  const nodeBin = fs.realpathSync(process.execPath), binDir = path.dirname(nodeBin)",
    "  const npxCli = path.join(binDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js')",
    "  if (!fs.existsSync(npxCli)) { say('npm is missing beside ' + nodeBin + '. Install Node from nodejs.org, then press \"Set up on this Mac\" again for a fresh command.'); process.exit(1) }",
    "  const PATH = [binDir].concat((process.env.PATH || '').split(':').filter((d) => d && d !== binDir)).join(':')",
    "  cfg.mcpServers[name] = { command: nodeBin, args: [npxCli, '-y', 'mcp-remote', url, '--header', 'X-Twin-Token:${TWIN_TOKEN}'], env: { TWIN_TOKEN: body.token, PATH } }",
    '  fs.mkdirSync(path.dirname(p), { recursive: true })',
    '  fs.writeFileSync(p, JSON.stringify(cfg, null, 2))',
    "  say(name + ' connected for ' + body.twin_email + '. The key went straight into Claude Desktop\\'s config — it was never shown.')",
    // v2.5752: the rounds' own connector file — the CLI reads this and never Desktop's config. A Mac that already makes the rounds
    // takes the pricer's key into it too (the pricer joins the rounds); a Mac that does not gets no second copy of a key.
    "  const mcpFile = path.join(PT, 'mcp.json')",
    '  if (rounds || fs.existsSync(mcpFile)) {',
    '    let mcp = {}',
    "    try { mcp = JSON.parse(fs.readFileSync(mcpFile, 'utf8')) } catch {}",
    '    mcp.mcpServers = mcp.mcpServers || {}',
    "    mcp.mcpServers[name] = { type: 'http', url, headers: { 'X-Twin-Token': body.token } }",
    "    fs.mkdirSync(PT, { recursive: true })",
    "    fs.writeFileSync(mcpFile, JSON.stringify(mcp, null, 2), { mode: 0o600 }); fs.chmodSync(mcpFile, 0o600)",
    '  }',
    '  if (rounds) {',
    // The round text (twin-setup's kickoff for a rounds key), the wrapper and the agent; then launchd loads it and the first round runs.
    "    if (!body.kickoff) { say('twin-setup sent no round text. Press \"Set up on this Mac\" again, or ask a dev.'); process.exit(1) }",
    "    fs.mkdirSync(path.join(PT, 'work'), { recursive: true }); fs.mkdirSync(path.join(os.homedir(), 'Library/Logs/ClickTooling'), { recursive: true })",
    "    fs.writeFileSync(path.join(PT, 'round.md'), body.kickoff)",
    "    fs.writeFileSync(path.join(PT, 'round.sh'), ROUND_SH, { mode: 0o755 }); fs.chmodSync(path.join(PT, 'round.sh'), 0o755)",
    "    const agents = path.join(os.homedir(), 'Library/LaunchAgents'); fs.mkdirSync(agents, { recursive: true })",
    "    const plist = path.join(agents, LABEL + '.plist')",
    "    fs.writeFileSync(plist, PLIST.split('__HOME__').join(os.homedir().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))",
    "    const domain = 'gui/' + process.getuid()",
    "    spawnSync('launchctl', ['bootout', domain + '/' + LABEL])",
    "    spawnSync('launchctl', ['enable', domain + '/' + LABEL])",
    "    const boot = spawnSync('launchctl', ['bootstrap', domain, plist], { encoding: 'utf8' })",
    "    if (boot.status !== 0) { say('launchd would not start the rounds: ' + ((boot.stderr || '') + (boot.stdout || '')).trim() + '. In Terminal run:  launchctl bootstrap ' + domain + ' \"' + plist + '\"  or ask a dev.'); process.exit(1) }",
    "    say('The rounds are installed on this Mac: one every five minutes, with no Claude session open and no question asked. The first is running now. Bids → 🤖 Robots → Console shows this Mac Alive within a minute. The log is ~/Library/Logs/ClickTooling/rounds.log. To take the rounds off this Mac:  ' + UNINSTALL)",
    "    say('The Claude app itself loads the connector the next time it opens.')",
    '    return',
    '  }',
    // v2.4231: twin-setup says where its kickoff is pasted — the bid robot's in a Code session, the pricer's in a chat.
    "  const where = body.kickoff_for === 'code' ? 'open the Code tab, start a NEW session and paste it.' : 'start a NEW INCOGNITO chat there and paste it.'",
    "  let kept = ''",
    "  if (body.kickoff) { spawnSync('pbcopy', { input: body.kickoff }); const f = path.join(os.homedir(), process.env.KICKOFF_FILE); try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body.kickoff); kept = ' A copy is at ' + f + '.' } catch {} }",
    "  if (underClaudeCode) {",
    "    say('Done here. Now quit Claude with Cmd+Q and open it again, so the connector loads. Then ' + (body.kickoff ? where + ' The kickoff is on your clipboard.' + kept : 'in a new chat type: ' + (body.check_call || 'call get_brief on ' + name)))",
    "    return",
    "  }",
    "  if (spawnSync('pgrep', ['-x', 'Claude']).status === 0) {",
    "    spawnSync('osascript', ['-e', 'quit app \"Claude\"'])",
    "    for (let i = 0; i < 30 && spawnSync('pgrep', ['-x', 'Claude']).status === 0; i++) spawnSync('sleep', ['0.5'])",
    '  }',
    "  spawnSync('open', ['-a', 'Claude'])",
    "  if (body.kickoff) say('Claude is reopening. The kickoff is on your clipboard: ' + where + kept)",
    "  else say('Claude is reopening. In a new chat type: ' + (body.check_call || 'call get_brief on ' + name))",
    "})().catch((e) => { say('Setup failed: ' + e.message + '. Run it again, or ask a dev.'); process.exit(1) })",
    'NODEEOF',
    '', // a trailing newline: the pasted heredoc terminator must be followed by Return
  ].join('\n')
}

/** The twin-setup edge function door for a Supabase project URL. */
export function twinSetupUrl(supabaseUrl: string): string {
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/twin-setup`
}
