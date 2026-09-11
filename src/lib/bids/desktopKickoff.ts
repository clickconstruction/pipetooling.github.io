/**
 * The Claude Desktop kickoff (v2.3207): the Robots → Queue lens copies
 * `docs/twins/kickoffs/desktop-operator.md` whole, with the one machine-specific
 * value filled in — the twin-mcp connector URL for the linked Supabase project.
 * The doc is the source of truth; this kernel only fills its placeholder, so
 * the copied prompt and the file never disagree.
 */

export const DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER = '{{CONNECTOR_URL}}'

/** The twin-mcp edge function door for a Supabase project URL (no trailing slash either way). */
export function twinMcpConnectorUrl(supabaseUrl: string): string {
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/twin-mcp`
}

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
  if (!/^https:\/\/[^\s"']+\/functions\/v1\/twin-mcp$/.test(url)) {
    throw new Error(`desktop setup command needs a twin-mcp connector URL, got ${JSON.stringify(url)}`)
  }
  return [
    'read -s -p "Paste your robot key, then press Return: " TWIN_TOKEN; echo',
    '[ -n "$TWIN_TOKEN" ] || { echo "No key entered. Issue one at Settings → Digital twins → Issue key and run this again."; exit 1; }',
    'NPX="$(command -v npx)" || { echo "Node not found. Install Node 18+ from nodejs.org, then run this again."; exit 1; }',
    `TWIN_TOKEN="$TWIN_TOKEN" NPX="$NPX" TWIN_MCP_URL="${url}" python3 - <<'PYEOF'`,
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
}

const SETUP_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/

/**
 * "Set up on this Mac" (Price Matrix PR 6): the setup command that carries a
 * one-time SETUP CODE instead of asking for a key. Pasted into Terminal it
 * redeems the code at twin-setup (which mints the key server-side and returns
 * it once, to this machine), merges the `twin-mcp` connector into Claude
 * Desktop's config with that key, quits and reopens Desktop so the connector
 * loads, and puts the robot's kickoff on the clipboard — so the person's next
 * move is one paste into a new incognito chat. The key is never printed, never
 * typed, never on a clipboard. The script is Node (Node is already required for
 * `mcp-remote`), so a Mac without the Xcode command-line tools' python3 works
 * too. macOS only: the config path and the quit/reopen are Desktop's on a Mac.
 */
export function buildDesktopSetupCommandFromCode(opts: SetupCodeCommandOpts): string {
  const url = opts.connectorUrl.trim()
  if (!/^https:\/\/[^\s"']+\/functions\/v1\/twin-mcp$/.test(url)) {
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
  return [
    'NPX="$(command -v npx)" || { echo "Node not found. Install Node 18+ from nodejs.org, then run this again."; exit 1; }',
    `SETUP_CODE="${code}" TWIN_SETUP_URL="${setupUrl}" TWIN_MCP_URL="${url}" NPX="$NPX" node - <<'NODEEOF'`,
    "const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process')",
    "const say = (s) => console.log(s)",
    ';(async () => {',
    "  if (typeof fetch !== 'function') { say('This Node is too old. Install Node 18+ from nodejs.org, then run this again.'); process.exit(1) }",
    "  const res = await fetch(process.env.TWIN_SETUP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'redeem', code: process.env.SETUP_CODE, machine: os.hostname() }) })",
    '  const body = await res.json().catch(() => ({}))',
    "  if (!res.ok || !body.token) { say('Setup code refused: ' + (body.error || ('HTTP ' + res.status)) + ' Press \"Set up on this Mac\" again for a fresh command.'); process.exit(1) }",
    "  const p = path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json')",
    '  let cfg = {}',
    "  try { const t = fs.readFileSync(p, 'utf8'); if (t.trim()) cfg = JSON.parse(t) } catch (e) { if (e.code !== 'ENOENT') { say('Claude Desktop\\'s config could not be read (' + e.message + '). Fix or move ' + p + ' and run this again.'); process.exit(1) } }",
    '  cfg.mcpServers = cfg.mcpServers || {}',
    "  cfg.mcpServers['twin-mcp'] = { command: process.env.NPX, args: ['-y', 'mcp-remote', body.connector_url || process.env.TWIN_MCP_URL, '--header', 'X-Twin-Token:${TWIN_TOKEN}'], env: { TWIN_TOKEN: body.token } }",
    '  fs.mkdirSync(path.dirname(p), { recursive: true })',
    '  fs.writeFileSync(p, JSON.stringify(cfg, null, 2))',
    "  say('twin-mcp connected for ' + body.twin_email + '. The key went straight into Claude Desktop\\'s config — it was never shown.')",
    "  if (spawnSync('pgrep', ['-x', 'Claude']).status === 0) {",
    "    spawnSync('osascript', ['-e', 'quit app \"Claude\"'])",
    "    for (let i = 0; i < 30 && spawnSync('pgrep', ['-x', 'Claude']).status === 0; i++) spawnSync('sleep', ['0.5'])",
    '  }',
    "  spawnSync('open', ['-a', 'Claude'])",
    "  if (body.kickoff) { spawnSync('pbcopy', { input: body.kickoff }); say('Claude Desktop is reopening. The kickoff is on your clipboard: start a NEW INCOGNITO chat there and paste it.') }",
    "  else say('Claude Desktop is reopening. In a new chat type: ' + (body.check_call || 'call get_brief on twin-mcp'))",
    "})().catch((e) => { say('Setup failed: ' + e.message + '. Run it again, or ask a dev.'); process.exit(1) })",
    'NODEEOF',
    '', // a trailing newline: the pasted heredoc terminator must be followed by Return
  ].join('\n')
}

/** The twin-setup edge function door for a Supabase project URL. */
export function twinSetupUrl(supabaseUrl: string): string {
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/twin-setup`
}
