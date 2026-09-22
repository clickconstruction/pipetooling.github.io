import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { buildDesktopSetupCommand, TWIN_MCP_PUBLIC_URL } from '../../lib/bids/desktopKickoff'
import { mcpConnectorHeader } from '../../lib/mcpKeyPrefixes'
import { BTN, BTN_PRIMARY, CARD, CARD_TITLE, MUTED, TWIN_VIOLET } from '../bids/twinConsoleStyles'

/**
 * The card a freshly issued twin key is shown on, once (Settings → Digital twins; v2.3721 —
 * the twin half of what v2.3686 gave the Dev MCP keys card). It walks a person through the
 * three ways the key is used, plainest first: a claude.ai custom connector with the key in a
 * request header (no Terminal, works on a phone — Path 0 of to-dos/mcp-servers.md), the
 * Terminal command for a Claude Desktop without that option, and the handoff for a Claude
 * Code operator. The key itself never goes in a chat; the buttons copy what each way needs.
 */

const CODE: CSSProperties = { display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' }
const STEPS: CSSProperties = { margin: '0.35rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-700)', lineHeight: 1.5 }
const ROW: CSSProperties = { display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }
const LINK: CSSProperties = { color: 'var(--text-link)' }
export const CONSOLE_HREF = '/bids?tab=robot-console'
const GUIDE_HREF = '/help?g=run-the-robots-from-claude-desktop'

type Props = {
  twinName: string
  twinEmail: string
  token: string
  copy: (text: string, what: string) => void | Promise<void>
  onDone: () => void
}

export default function TwinFreshKeyPanel({ twinName, twinEmail, token, copy, onDone }: Props) {
  return (
    <div style={{ ...CARD, border: `1.5px solid ${TWIN_VIOLET}`, background: 'var(--bg-violet-100)' }} aria-label={`New key for ${twinName}`}>
      <h4 style={CARD_TITLE}>New key for {twinName} — shown ONCE</h4>
      <code style={CODE}>{token}</code>
      <p style={{ ...MUTED, margin: '0.5rem 0 0' }}>
        Only its hash is stored — this value cannot be shown again. <Link to={GUIDE_HREF} style={LINK}>How do I run the robot with it?</Link>
      </p>

      <p style={{ ...MUTED, margin: '0.7rem 0 0' }}>
        <strong>To run {twinName} from claude.ai, Claude Desktop or your phone</strong> — no Terminal at all, if your Claude account shows the <em>Request headers</em> section (it is rolling out):
      </p>
      <ol style={STEPS}>
        <li>On claude.ai open <strong>Customize → Connectors → Add custom connector</strong>. Name it <em>{twinName}</em>; the address is <code>{TWIN_MCP_PUBLIC_URL}</code>.</li>
        <li>Choose <strong>No sign-in</strong>. Under <strong>Request headers</strong> pick <code>authorization</code> and paste the header value from the button below. Press Add.</li>
        <li>Start a <strong>new incognito chat</strong>, turn the connector on under the ＋ menu, and paste the kickoff from <Link to={CONSOLE_HREF} style={LINK}>Robots → Console → Copy Desktop kickoff</Link>. The robot reads its brief and says the connector answered.</li>
      </ol>
      <div style={ROW}>
        <button type="button" style={BTN_PRIMARY} onClick={() => void copy(mcpConnectorHeader(token), 'the header value')}>Copy header value</button>
      </div>

      <p style={{ ...MUTED, margin: '0.7rem 0 0' }}>
        <strong>Claude Desktop without a <em>Request headers</em> section</strong> — one Terminal command (Mac):
      </p>
      <ol style={STEPS}>
        <li>Press <strong>Copy Desktop setup command</strong>. Open <strong>Terminal</strong> (press ⌘ and Space together, type <em>Terminal</em>, press Return), paste (⌘ V), press Return.</li>
        <li>It asks for the key: press <strong>Copy key</strong>, paste, press Return — the prompt is silent, so nothing lands in a history. It writes Claude Desktop's connector config and says what to do next.</li>
        <li>Quit Claude Desktop (⌘ Q), open it again, and paste the same kickoff into a new incognito chat. Next time, skip the key entirely with <strong>Set up on this Mac</strong> on the robot's row.</li>
      </ol>
      <div style={ROW}>
        <button type="button" style={BTN} onClick={() => void copy(buildDesktopSetupCommand({ connectorUrl: TWIN_MCP_PUBLIC_URL }), 'the Claude Desktop setup command')}>Copy Desktop setup command</button>
        <button type="button" style={BTN} onClick={() => void copy(token, 'the key')}>Copy key</button>
        <button type="button" style={BTN} onClick={onDone}>Done — I saved it</button>
      </div>

      <p style={{ ...MUTED, margin: '0.7rem 0 0' }}>
        For a Claude Code operator or any other harness, hand the key over with docs/twins/TWIN_HARNESS.md; the handoff prompt is on <Link to={CONSOLE_HREF} style={LINK}>Robots → Console</Link>. The key never goes in a chat: it is {twinEmail}'s seat, and revoking its label cuts that machine off.
      </p>
    </div>
  )
}
