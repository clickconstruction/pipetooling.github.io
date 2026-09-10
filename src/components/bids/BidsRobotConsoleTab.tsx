import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { buildRobotQueue } from '../../lib/bids/robotQueue'
import { buildDesktopKickoff, buildDesktopSetupCommand, twinMcpConnectorUrl } from '../../lib/bids/desktopKickoff'
import { relativeTimeFrom } from '../../lib/twinConsoleDisplay'
// The two operator prompts are markdown files in the repo — the source of truth — copied whole.
import desktopKickoffDoc from '../../../docs/twins/kickoffs/desktop-operator.md?raw'
import shadowOperatorPrompt from '../../../docs/twins/kickoffs/shadow-operator.md?raw'
import { TwinOperatorQuestionsCard } from './TwinOperatorQuestionsCard'
import { TwinRunsLedger } from './TwinRunsLedger'
import { BTN, BTN_PRIMARY, CARD, CARD_TITLE, CHIP, MUTED, PROMPT_PRE, STEP_REF, TWIN_VIOLET } from './twinConsoleStyles'

/**
 * The 🤖 Console lens (v2.3224, dev only): the operator's desk. Everything a
 * person does to RUN the robots — start one from Claude Desktop or hand the
 * hourly Claude Code routine to someone, see which bids want a robot, answer
 * what blocked one, watch the runs come in — lives here, beside the Robot
 * Board, Audits and Scoreboard the estimators use. The half that is account
 * and credential admin (mint a twin, issue and revoke keys, the safety rungs,
 * endpoints, the kill switch, the calibration standard) stays on Settings →
 * Digital twins, one door away. Estimators never see this pill.
 */
type Props = {
  /** The human bids (robot scope excluded) — the queue counts come from the same kernel the Queue lens uses. */
  bids: BidWithBuilder[]
  twinBidBySourceId: ReadonlyMap<string, BidWithBuilder>
  onOpenQueue: () => void
}

type TwinRow = { id: string; name: string | null; email: string; read_only: boolean; counttooling_user_id?: string | null }
type CredRow = { twin_user_id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

const db = supabase as unknown as SupabaseClient
const SETTINGS_TWINS_HREF = '/settings?tab=settings-digital-twins'

export function BidsRobotConsoleTab({ bids, twinBidBySourceId, onOpenQueue }: Props) {
  const { showToast } = useToastContext()
  const [openPreview, setOpenPreview] = useState<'setup' | 'kickoff' | 'handoff' | null>(null)
  const [fleet, setFleet] = useState<{ twins: TwinRow[]; creds: CredRow[] } | null>(null)

  const connectorUrl = useMemo(() => twinMcpConnectorUrl(import.meta.env.VITE_SUPABASE_URL), [])
  const setupCommand = useMemo(() => buildDesktopSetupCommand({ connectorUrl }), [connectorUrl])
  const desktopKickoff = useMemo(() => buildDesktopKickoff(desktopKickoffDoc, { connectorUrl }), [connectorUrl])

  // Same rule as the Queue lens, so the counts here and the rows there can never disagree.
  const queue = useMemo(() => {
    const staleDueBefore = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return buildRobotQueue(bids, (bidId) => twinBidBySourceId.has(bidId), { staleDueBefore })
  }, [bids, twinBidBySourceId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [t, c] = await Promise.all([
          db.from('users').select('id, name, email, read_only, counttooling_user_id').eq('is_digital_twin', true).order('email'),
          db.from('twin_credentials').select('twin_user_id, label, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }).limit(100),
        ])
        if (cancelled || t.error) return
        setFleet({ twins: (t.data as TwinRow[] | null) ?? [], creds: (c.data as CredRow[] | null) ?? [] })
      } catch {
        /* the fleet strip hides */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${what}`, 'success')
    } catch {
      showToast('Could not copy', 'error')
    }
  }

  const stepNo = (n: string): React.CSSProperties => ({
    width: '1.4rem',
    height: '1.4rem',
    borderRadius: '50%',
    background: 'var(--bg-violet-100)',
    color: TWIN_VIOLET,
    fontSize: '0.7rem',
    fontWeight: 800,
    display: 'inline-grid',
    placeItems: 'center',
    flex: 'none',
    ...(n.length > 1 ? { fontSize: '0.62rem' } : {}),
  })
  const stepRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }
  const stepText: React.CSSProperties = { flex: '1 1 14rem', minWidth: 0, fontSize: '0.84rem' }
  const stepSub: React.CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.76rem' }
  const pathCol: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.55rem', alignContent: 'start', background: 'var(--surface)' }
  const pathHead: React.CSSProperties = { fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: TWIN_VIOLET }
  const previewLink = (key: 'setup' | 'kickoff' | 'handoff', label: string) => (
    <button
      type="button"
      onClick={() => setOpenPreview((cur) => (cur === key ? null : key))}
      aria-expanded={openPreview === key}
      style={{ font: 'inherit', fontSize: '0.76rem', color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
    >
      {openPreview === key ? `Hide ${label}` : `Preview ${label}`}
    </button>
  )

  const nowMs = Date.now()

  return (
    <div>
      <p style={{ ...MUTED, margin: '0 0 0.9rem', maxWidth: '72ch' }}>
        The operator's desk: start a robot, see which bids want one, answer what blocked one, and watch the runs come in.
        Keys, seats and the safety rungs are on{' '}
        <a href={SETTINGS_TWINS_HREF} style={{ color: 'var(--text-link)' }}>
          Settings → Digital twins
        </a>
        .
      </p>

      {/* Run the robots — the two ways a person starts one. */}
      <div style={CARD}>
        <h4 style={CARD_TITLE}>
          <span style={STEP_REF}>▶</span>Run the robots
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(19rem, 1fr))', gap: '0.7rem' }}>
          <div style={pathCol}>
            <div style={pathHead}>From Claude Desktop · no repo, no terminal after setup</div>
            <div style={stepRow}>
              <span style={stepNo('1')}>1</span>
              <span style={stepText}>
                Set up the connector
                <span style={stepSub}>One Terminal command (Mac). It asks for the robot key, finds Node, and writes Desktop's config. Once per machine.</span>
              </span>
              <button type="button" style={BTN_PRIMARY} onClick={() => void copy(setupCommand, 'the Desktop setup command')} title="Copies a Terminal command that asks for the key and configures Claude Desktop's twin-mcp connector">
                Copy setup command
              </button>
            </div>
            <div style={stepRow}>
              <span style={stepNo('2')}>2</span>
              <span style={stepText}>
                Start a batch
                <span style={stepSub}>Paste into a new incognito chat. The robot works up to three shells, one at a time, and asks for each plan PDF.</span>
              </span>
              <button type="button" style={{ ...BTN_PRIMARY, background: '#3b82f6' }} onClick={() => void copy(desktopKickoff, 'the Claude Desktop kickoff')} title="Copies the whole kickoff: the setup steps for the person and the robot's instructions, with this project's connector filled in">
                Copy Desktop kickoff
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
              {previewLink('setup', 'the setup command')}
              {previewLink('kickoff', 'the kickoff')}
            </div>
            {openPreview === 'setup' ? <pre style={PROMPT_PRE}>{setupCommand}</pre> : null}
            {openPreview === 'kickoff' ? <pre style={PROMPT_PRE}>{desktopKickoff}</pre> : null}
          </div>
          <div style={pathCol}>
            <div style={pathHead}>From Claude Code · the hourly routine on a repo checkout</div>
            <div style={stepRow}>
              <span style={stepNo('↗')}>↗</span>
              <span style={stepText}>
                Hand shadow coverage to someone
                <span style={stepSub}>Their own key, the one allow rule, and the weekday routine with its prompt verbatim. They never see a robot's number.</span>
              </span>
              <button type="button" style={BTN} onClick={() => void copy(shadowOperatorPrompt, 'the shadow-coverage handoff prompt')} title="Copies the whole handoff prompt — the new operator pastes it into Claude Code in a checkout of the repo">
                Copy handoff prompt
              </button>
            </div>
            <div>{previewLink('handoff', 'the handoff prompt')}</div>
            {openPreview === 'handoff' ? <pre style={PROMPT_PRE}>{shadowOperatorPrompt}</pre> : null}
          </div>
        </div>
        <p style={{ ...MUTED, margin: '0.6rem 0 0' }}>
          Sources of truth: <code style={{ fontSize: '0.7rem' }}>docs/twins/kickoffs/desktop-operator.md</code> and{' '}
          <code style={{ fontSize: '0.7rem' }}>docs/twins/kickoffs/shadow-operator.md</code>.
        </p>
      </div>

      {/* Bids to run — the Queue keeps its own page (v2.3222 took it off the estimator-facing bar); this is its door. */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h4 style={{ ...CARD_TITLE, margin: 0 }}>
            <span style={STEP_REF}>⇢</span>Bids to run
          </h4>
          <span style={{ ...CHIP, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }} title="Stamped front of the line from a bid's robot status sheet — oldest ask first">
            Requested · {queue.requested.length}
          </span>
          <span style={{ ...CHIP, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }} title="Robot-able live bids nobody has asked about">
            Ready · {queue.ready.length}
          </span>
          <button type="button" style={{ ...BTN_PRIMARY, background: '#3b82f6', marginLeft: 'auto' }} onClick={onOpenQueue} title="Every robot-able bid, requested ones first, plus the backtest candidates grouped by the axis whose gate they would feed">
            Open the queue
          </button>
        </div>
        <p style={{ ...MUTED, margin: '0.35rem 0 0' }}>
          Front-of-the-line requests first, then every robot-able live bid, then the backtest candidates by axis. Same rule as the Bid Board icons.
        </p>
      </div>

      {/* Fleet at a glance — admin stays on Settings; this is the door. */}
      {fleet && fleet.twins.length > 0 ? (
        <div style={CARD}>
          {fleet.twins.map((t) => {
            const live = fleet.creds.filter((c) => c.twin_user_id === t.id && !c.revoked_at)
            const newest = live[0]
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span style={{ width: '2rem', height: '2rem', borderRadius: 8, background: 'var(--bg-violet-100)', display: 'grid', placeItems: 'center', flex: 'none' }}>🤖</span>
                <b>{t.name ?? t.email}</b>
                {'counttooling_user_id' in t ? (
                  <span style={{ ...CHIP, borderRadius: 999, background: t.counttooling_user_id ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: t.counttooling_user_id ? 'var(--text-green-800)' : 'var(--text-amber-800)' }}>
                    CT seat · {t.counttooling_user_id ? 'linked' : 'missing'}
                  </span>
                ) : null}
                <span style={{ ...CHIP, borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>{t.read_only ? 'rung 1 · read-only' : 'rung 2 · fenced writes'}</span>
                <span style={{ ...CHIP, borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                  {live.length} live key{live.length === 1 ? '' : 's'}
                  {newest ? ` · newest “${newest.label}” ${newest.last_used_at ? `used ${relativeTimeFrom(newest.last_used_at, nowMs)}` : 'never used'}` : ''}
                </span>
                <a href={SETTINGS_TWINS_HREF} style={{ marginLeft: 'auto', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem' }}>
                  Manage keys &amp; seats ↗
                </a>
              </div>
            )
          })}
        </div>
      ) : null}

      <TwinOperatorQuestionsCard />
      <TwinRunsLedger />
    </div>
  )
}
