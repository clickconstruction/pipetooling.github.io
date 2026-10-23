/**
 * The Robot rounds agent (punch list #142, v2.5752): a per-user LaunchAgent on the Mac
 * that stays on, installed by "Set up on this Mac" with *This Mac makes the rounds* ticked.
 * Every five minutes launchd runs `round.sh`, which hands the round text to the Claude Code
 * CLI headless (`claude -p`) with the twin-mcp connector and nothing else — no Code session,
 * no permission mode to pick, no question a run can stall on. The routine it replaces was a
 * Claude Code scheduled task made by pasting the kickoff into a session, and on 2026-10-22
 * the session's Auto mode refused to create it, silently (v2.5748's words were the stopgap).
 *
 * This file is the pure kernel: the plist, the shell wrapper and the CLI's argument list,
 * each a string the setup command (`desktopKickoff.ts`) embeds and the tests run. Nothing
 * here touches a disk.
 *
 * Decisions (the fragment `docs/recent-features/v2.5752.md` carries the reasons in full):
 * - **The CLI comes from the Claude app.** The desktop app keeps its own copy of the Claude
 *   Code CLI under `~/Library/Application Support/Claude/claude-code/<version>/<hash>/
 *   claude.app/Contents/MacOS/claude`, a native binary that runs headless on its own. The
 *   wrapper takes the newest one at every run (the app updates it under us), else the one
 *   `claude.ai/install.sh` puts in `~/.local/bin`, else the PATH's. The setup command runs
 *   that installer only when a Mac has none of the three.
 * - **The sign-in is the CLI's own.** Outside the app the CLI is not signed in (the app
 *   hands its Code tab a token the CLI never sees), so the setup command runs
 *   `claude auth login` once — a browser window, the same Claude account — before it
 *   spends the one-time code; the credential lands in the login Keychain, which a
 *   LaunchAgent in the `gui` domain reads.
 * - **The connector is a `--mcp-config` file**, `mcp.json` beside the round text, with the
 *   connector as an HTTP server and the key as its header — no mcp-remote, no Node in the
 *   loop — and `--strict-mcp-config` so nothing else on the Mac loads. Claude Desktop's
 *   own config is written too (the Code tab and chats keep the connector) but the CLI
 *   never reads it.
 * - **Permissions never ask**: `--permission-mode dontAsk` with the connector and the plan
 *   tools (`Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`) pre-allowed and the built-in set
 *   cut to those; anything else is refused without a prompt, as the round text expects.
 * - **One session per round**, result and cost logged as one JSON line per round, so the
 *   real cost of an idle round is read from `rounds.log` — see the fragment for the
 *   estimate and the cheaper idle round it recommends next.
 * - **launchd never overlaps rounds** on one Mac (a `StartInterval` job that is still
 *   running is skipped); the wrapper caps a round at `ROUNDS_MAX_MINUTES`, so a hung one
 *   never blocks the next, and the round text's fifteen-minute orphan rule picks up what
 *   it left.
 * - **Uninstall** is one line: `launchctl bootout gui/$UID/com.clicktooling.robot-rounds`
 *   (`ROUNDS_UNINSTALL_COMMAND`). The Console's **Stop the rounds** stays a server order
 *   the round obeys; it never touches the agent.
 */

export const ROUNDS_AGENT_LABEL = 'com.clicktooling.robot-rounds'
/** Five minutes between rounds (the Console's Alive/Quiet/Asleep thresholds are built on it). */
export const ROUNDS_INTERVAL_SECONDS = 300
/** A round that runs longer than this is killed; the next round's orphan rule resumes its shell. */
export const ROUNDS_MAX_MINUTES = 120

/** The plist's absolute paths carry the home directory; the setup command fills this token on the Mac. */
export const ROUNDS_HOME_TOKEN = '__HOME__'
/** Every file the rounds own, relative to the person's home. */
export const ROUNDS_DIR = 'Library/Application Support/ClickTooling'
export const ROUNDS_TEXT_FILE = `${ROUNDS_DIR}/round.md`
export const ROUNDS_MCP_FILE = `${ROUNDS_DIR}/mcp.json`
export const ROUNDS_SCRIPT_FILE = `${ROUNDS_DIR}/round.sh`
export const ROUNDS_WORK_DIR = `${ROUNDS_DIR}/work`
export const ROUNDS_LOG_DIR = 'Library/Logs/ClickTooling'
export const ROUNDS_LOG_FILE = `${ROUNDS_LOG_DIR}/rounds.log`
export const ROUNDS_PLIST_FILE = `Library/LaunchAgents/${ROUNDS_AGENT_LABEL}.plist`

/** The one line that takes the rounds off a Mac for good (the plist may stay; launchd ignores an unloaded one). */
export const ROUNDS_UNINSTALL_COMMAND = `launchctl bootout gui/$UID/${ROUNDS_AGENT_LABEL}`

/** The connectors a round may call: the bid robot's, and the pricer's when the Mac holds its key too. */
export const ROUNDS_CONNECTORS = ['twin-mcp', 'twin-pricer-mcp'] as const
/** The built-in tools a round keeps: the shell and the file tools for plan sheets, nothing that reaches the web or another session. */
export const ROUNDS_BUILTIN_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'] as const

/**
 * The CLI's arguments after `-p <round text>`: the connector file and nothing else, the
 * mode that never asks, the allowed tools, no transcript kept, one JSON line as the answer.
 */
export function roundsCliArgs(mcpFile: string): string[] {
  return [
    '--strict-mcp-config',
    '--mcp-config', mcpFile,
    '--permission-mode', 'dontAsk',
    '--allowedTools', ...ROUNDS_CONNECTORS.map((c) => `mcp__${c}`), ...ROUNDS_BUILTIN_TOOLS,
    '--tools', ROUNDS_BUILTIN_TOOLS.join(','),
    '--no-session-persistence',
    '--output-format', 'json',
  ]
}

/** The `mcp.json` entry for one connector: an HTTP server with the key as its header. */
export function roundsConnectorEntry(url: string, token: string): { type: 'http'; url: string; headers: Record<string, string> } {
  return { type: 'http', url, headers: { 'X-Twin-Token': token } }
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/**
 * `round.sh`: what launchd runs every five minutes. POSIX sh (the plist runs `/bin/sh`), and
 * the same under bash and zsh. It finds the CLI, refuses to run without the round text or
 * the connector file, logs one header and one footer line round the CLI's JSON answer, and
 * kills a round that outlives `ROUNDS_MAX_MINUTES`. `$HOME` is launchd's; nothing is baked in.
 */
export function buildRoundScript(): string {
  const args = roundsCliArgs('"$PT/mcp.json"').map((a) => (a === '"$PT/mcp.json"' ? a : sq(a))).join(' ')
  return [
    '#!/bin/sh',
    `# ClickTooling robot rounds (punch list #142): one round, started by launchd every ${ROUNDS_INTERVAL_SECONDS / 60} minutes.`,
    `# Written by Set up on this Mac. To take the rounds off this Mac:  ${ROUNDS_UNINSTALL_COMMAND}`,
    '[ -n "$ZSH_VERSION" ] && setopt nonomatch 2>/dev/null',
    `PT="$HOME/${ROUNDS_DIR}"`,
    `LOG="$HOME/${ROUNDS_LOG_FILE}"`,
    `mkdir -p "$HOME/${ROUNDS_LOG_DIR}" "$PT/work"`,
    '[ "$(stat -f %z "$LOG" 2>/dev/null || echo 0)" -gt 5000000 ] && mv -f "$LOG" "$LOG.1"',
    'exec >> "$LOG" 2>&1',
    'now() { date -u +%Y-%m-%dT%H:%M:%SZ; }',
    '# The Claude Code CLI: the Claude app\'s own copy (its newest), else the one claude.ai/install.sh put in ~/.local/bin, else the PATH\'s.',
    'APP_CLI="$(ls -d "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude 2>/dev/null | sort -V | tail -n 1)"',
    'CLI=""',
    'for c in "$APP_CLI" "$HOME/.local/bin/claude" "$(command -v claude 2>/dev/null)"; do',
    '  if [ -n "$c" ] && [ -x "$c" ]; then CLI="$c"; break; fi',
    'done',
    'if [ -z "$CLI" ]; then echo "$(now) no Claude Code on this Mac. Press Set up on this Mac again."; exit 0; fi',
    'for f in "$PT/round.md" "$PT/mcp.json"; do',
    '  if [ ! -s "$f" ]; then echo "$(now) $f is missing. Press Set up on this Mac again."; exit 0; fi',
    'done',
    'cd "$PT/work" || exit 0',
    'echo "$(now) round start · $CLI"',
    '# caffeinate keeps the Mac awake for the round itself; the Energy setting covers the gaps between rounds.',
    'if command -v caffeinate >/dev/null 2>&1; then set -- caffeinate -i "$CLI"; else set -- "$CLI"; fi',
    `"$@" -p "$(cat "$PT/round.md")" ${args} &`,
    'PID=$!',
    `( sleep ${ROUNDS_MAX_MINUTES * 60} && kill "$PID" ) 2>/dev/null & WD=$!`,
    'wait "$PID"; RC=$?',
    '# the watchdog and its sleep go with the round, quietly, and are reaped before the footer',
    'pkill -P "$WD" 2>/dev/null; kill "$WD" 2>/dev/null; wait "$WD" 2>/dev/null',
    'echo',
    'echo "$(now) round end · exit $RC"',
    '',
  ].join('\n')
}

function xmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The LaunchAgent plist. `home` is the person's home directory, absolute (launchd expands
 * nothing); the default leaves `ROUNDS_HOME_TOKEN` for the setup command to fill on the Mac.
 * `RunAtLoad` makes the first round the moment the agent is loaded; `StartInterval` the rest.
 * launchd writes the wrapper's output to the same log the wrapper appends to, so a wrapper
 * that fails before its own redirect still leaves a line.
 */
export function buildRoundsLaunchAgentPlist(home: string = ROUNDS_HOME_TOKEN): string {
  const h = xmlText(home.replace(/\/+$/, ''))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>Label</key>',
    `\t<string>${ROUNDS_AGENT_LABEL}</string>`,
    '\t<key>ProgramArguments</key>',
    '\t<array>',
    '\t\t<string>/bin/sh</string>',
    `\t\t<string>${h}/${ROUNDS_SCRIPT_FILE}</string>`,
    '\t</array>',
    '\t<key>StartInterval</key>',
    `\t<integer>${ROUNDS_INTERVAL_SECONDS}</integer>`,
    '\t<key>RunAtLoad</key>',
    '\t<true/>',
    '\t<key>StandardOutPath</key>',
    `\t<string>${h}/${ROUNDS_LOG_FILE}</string>`,
    '\t<key>StandardErrorPath</key>',
    `\t<string>${h}/${ROUNDS_LOG_FILE}</string>`,
    '\t<key>EnvironmentVariables</key>',
    '\t<dict>',
    '\t\t<key>PATH</key>',
    '\t\t<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>',
    '\t</dict>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n')
}
