/**
 * Installing the Robot rounds agent from a shell (v2.7962), for an agent that set a Mac up through the dev seat and
 * the twin toolkit and has no "Set up on this Mac" command to paste. The app's setup command
 * (`desktopKickoff.ts`) installs the rounds as one of its steps; `scripts/twin/redeem_setup_code.py --rounds`
 * already leaves the key and the round text on the Mac, and nothing put the agent itself in place.
 *
 * This is the pure plan: which files go where with what in them, and which launchctl calls load the agent, built
 * from the same kernel the app's command embeds (`roundsLaunchAgent.ts`). `scripts/twin/install-rounds.ts` is the
 * thin part that reads the key file, writes the files and runs the calls. Nothing here touches a disk, and the key
 * appears in exactly one place: the connector file's header, as the app writes it.
 *
 * What it leaves alone, on purpose: Claude Desktop's own config (the rounds never read it), the sign-in (the CLI's
 * own `auth login`, a person's browser window) and the Energy setting.
 */
import {
  ROUNDS_AGENT_LABEL,
  ROUNDS_CONNECTORS,
  ROUNDS_LOG_DIR,
  ROUNDS_LOG_FILE,
  ROUNDS_MCP_FILE,
  ROUNDS_PLIST_FILE,
  ROUNDS_SCRIPT_FILE,
  ROUNDS_TEXT_FILE,
  ROUNDS_UNINSTALL_COMMAND,
  ROUNDS_WORK_DIR,
  buildRoundScript,
  buildRoundsLaunchAgentPlist,
  roundsConnectorEntry,
} from './roundsLaunchAgent'

export type RoundsInstallInput = {
  /** The person's home directory, absolute. */
  home: string
  /** The numeric user id launchd's gui domain is named by. */
  uid: number
  /** The twin's key, as the key file holds it. */
  token: string
  /** The round text: twin-setup's kickoff for a rounds key, as redeem_setup_code.py --rounds saved it. */
  roundText: string
  /** The connector's name in the rounds' own config: twin-mcp for a bid robot, twin-pricer-mcp for the pricer. */
  connectorName: string
  connectorUrl: string
  /** The connector file already on the Mac, as text; a second seat joins it and the first is kept. */
  existingMcp?: string | null
}

export type RoundsInstallFile = { path: string; content: string; mode: number; holdsKey: boolean }
export type RoundsInstallPlan = {
  dirs: string[]
  files: RoundsInstallFile[]
  /** launchctl's argument lists, in order. The first may fail (nothing loaded yet) and that is fine. */
  launchctl: Array<{ args: string[]; mayFail: boolean }>
  plistPath: string
  logPath: string
  uninstall: string
}

export type RoundsInstallCheck = { ok: true } | { ok: false; refused: string }

/** The round text's own opening words (docs/twins/kickoffs/rounds-operator.md): what tells it from the batch kickoff. */
export const ROUNDS_TEXT_MARK = 'make one round, then end'

/** What must be true before anything is written, refused in words. */
export function checkRoundsInstall(input: RoundsInstallInput): RoundsInstallCheck {
  if (!input.home.startsWith('/')) return { ok: false, refused: 'The home directory is not an absolute path: launchd expands nothing, so the agent could not find its files.' }
  if (!Number.isInteger(input.uid) || input.uid < 0) return { ok: false, refused: 'The user id is not a number: launchd names the agent\'s domain by it.' }
  if (!input.token.trim()) return { ok: false, refused: 'The key file is empty. Redeem a setup code first: python3 scripts/twin/redeem_setup_code.py <code> --rounds' }
  if (/\s/.test(input.token.trim())) return { ok: false, refused: 'The key file holds more than a key. Redeem a fresh setup code: python3 scripts/twin/redeem_setup_code.py <code> --rounds' }
  if (!input.roundText.trim()) return { ok: false, refused: 'The round text is empty. A rounds key\'s kickoff is the round text: mint the setup code with rounds: true and redeem it with --rounds.' }
  if (!input.roundText.includes(ROUNDS_TEXT_MARK)) return { ok: false, refused: 'That file is not the round text: it reads like the batch kickoff, which waits for a person. Mint the setup code with rounds: true and redeem it with --rounds; the file is kickoff-rounds.md beside the key.' }
  if (/\{\{[A-Z_]+\}\}/.test(input.roundText)) return { ok: false, refused: 'That round text still carries a placeholder: it is the repo\'s template, not the text twin-setup sent for this key. Redeem the setup code with --rounds and use the kickoff-rounds.md it saves.' }
  if (!(ROUNDS_CONNECTORS as readonly string[]).includes(input.connectorName)) return { ok: false, refused: `The connector is ${ROUNDS_CONNECTORS.join(' or ')}: a round may call no other.` }
  if (!/^https:\/\/[^\s]+$/.test(input.connectorUrl)) return { ok: false, refused: 'The connector\'s address starts with https://.' }
  return { ok: true }
}

/**
 * The rounds' own connector file with this seat in it: the file already there is kept and this seat's entry set, so
 * a Mac that makes the rounds for the bid robot takes the pricer's key into the same file. A file that is not JSON
 * is started again, as the app's command starts it.
 */
export function roundsMcpConfig(existing: string | null | undefined, name: string, url: string, token: string): string {
  let cfg: { mcpServers?: Record<string, unknown> } = {}
  try {
    const parsed: unknown = existing ? JSON.parse(existing) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cfg = parsed as { mcpServers?: Record<string, unknown> }
  } catch {
    cfg = {}
  }
  const servers = cfg.mcpServers && typeof cfg.mcpServers === 'object' && !Array.isArray(cfg.mcpServers) ? cfg.mcpServers : {}
  return JSON.stringify({ ...cfg, mcpServers: { ...servers, [name]: roundsConnectorEntry(url, token.trim()) } }, null, 2)
}

const xmlText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The plan: every directory, every file with its mode, and the launchctl calls, as the app's command makes them. */
export function roundsInstallPlan(input: RoundsInstallInput): RoundsInstallPlan {
  const home = input.home.replace(/\/+$/, '')
  const at = (rel: string): string => `${home}/${rel}`
  const domain = `gui/${input.uid}`
  const plistPath = at(ROUNDS_PLIST_FILE)
  return {
    dirs: [at(ROUNDS_WORK_DIR), at(ROUNDS_LOG_DIR), at('Library/LaunchAgents')],
    files: [
      { path: at(ROUNDS_MCP_FILE), content: roundsMcpConfig(input.existingMcp, input.connectorName, input.connectorUrl, input.token), mode: 0o600, holdsKey: true },
      { path: at(ROUNDS_TEXT_FILE), content: input.roundText, mode: 0o644, holdsKey: false },
      { path: at(ROUNDS_SCRIPT_FILE), content: buildRoundScript(), mode: 0o755, holdsKey: false },
      // The kernel escapes the home it is given; the app's command fills the token with an escaped home, and so does this.
      { path: plistPath, content: buildRoundsLaunchAgentPlist().split('__HOME__').join(xmlText(home)), mode: 0o644, holdsKey: false },
    ],
    launchctl: [
      { args: ['bootout', `${domain}/${ROUNDS_AGENT_LABEL}`], mayFail: true },
      { args: ['enable', `${domain}/${ROUNDS_AGENT_LABEL}`], mayFail: true },
      { args: ['bootstrap', domain, plistPath], mayFail: false },
    ],
    plistPath,
    logPath: at(ROUNDS_LOG_FILE),
    uninstall: ROUNDS_UNINSTALL_COMMAND,
  }
}

/** The plan as a person or an agent may read it: every path and size, and never a file's words where it holds the key. */
export function roundsInstallPlanWords(plan: RoundsInstallPlan): string[] {
  return [
    ...plan.dirs.map((d) => `make ${d}`),
    ...plan.files.map((f) => `write ${f.path} (mode ${f.mode.toString(8)}, ${f.holdsKey ? 'the connector with the key in its header, not shown' : `${f.content.length} characters`})`),
    ...plan.launchctl.map((c) => `launchctl ${c.args.join(' ')}${c.mayFail ? '  (fine if nothing is loaded yet)' : ''}`),
    `then one round every five minutes, the first at once; the log is ${plan.logPath}`,
    `to take the rounds off this Mac:  ${plan.uninstall}`,
  ]
}
