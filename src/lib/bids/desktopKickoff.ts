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
