/**
 * Today's Money Opportunities (v2.2145 — extracted from PipelineOverview so
 * Quickfill's Jobs Cleanup station can show the SAME cards): the system-
 * written queue of money moves, the statement-round cards, the payment-chase
 * card, and the fix-ups card. Pure presentation over kernels the caller
 * already ran; every action is a callback so the host decides whether it
 * opens a modal (Pipeline) or navigates (Quickfill). Copy and tones live
 * here once.
 */
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { PipelineFixup, PipelineFixupKey, PipelineMove, PipelineMoveKey } from '../../lib/jobs/pipelineOverview'
import type { PaymentChaseSummary } from '../../lib/jobs/paymentChase'
import { PipelineContractCoverageCard, type PipelineContractCoverage } from './PipelineContractCoverageCard'
import type { ContractStage } from '../../lib/jobs/jobContractNudge'

export type PipelineGcRoundCards = {
  held: { count: number; total: number } | null
  ready: { count: number; total: number } | null
} | null

export type PipelineMoneyOpportunitiesProps = {
  moves: PipelineMove[]
  moveAction: Record<PipelineMoveKey, () => void>
  /** Fix-ups card (v2.1977); pass [] to omit (Quickfill has its own Missing job info station). */
  fixups: PipelineFixup[]
  onFixup: (key: PipelineFixupKey) => void
  chase?: PaymentChaseSummary | null
  onStartChase?: () => void
  gcRound?: PipelineGcRoundCards
  onCertifyRound?: () => void
  onStartRound?: () => void
  /** Contract coverage card (v2.2738) — Pipeline only; omit to hide. */
  contractCoverage?: PipelineContractCoverage | null
  onContractStageGap?: (stage: ContractStage) => void
  onStartContractSweep?: () => void
  /** Quiet note beside the title (Quickfill: "same as Jobs → Pipeline"). */
  headerNote?: string
  /** Empty-state line when nothing needs a move. */
  emptyText?: string
}

export function PipelineMoneyOpportunities({
  moves,
  moveAction,
  fixups,
  onFixup,
  chase,
  onStartChase,
  gcRound,
  onCertifyRound,
  onStartRound,
  contractCoverage,
  onContractStageGap,
  onStartContractSweep,
  headerNote,
  emptyText = 'nothing needs a move right now — the pipeline is clean ✅',
}: PipelineMoneyOpportunitiesProps) {
  const contractCardVisible = contractCoverage != null && contractCoverage.liveTotal > 0 && onContractStageGap != null && onStartContractSweep != null
  const roundHeld = gcRound?.held && gcRound.held.count > 0 ? gcRound.held : null
  const roundReady = gcRound?.ready && gcRound.ready.count > 0 ? gcRound.ready : null
  const gcRoundVisible = roundHeld != null || roundReady != null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.5rem',
          padding: '0.45rem 0.85rem',
          background: 'var(--bg-subtle)',
          borderBottom: moves.length > 0 || fixups.length > 0 || chase || gcRoundVisible || contractCardVisible ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Today&#8217;s Money Opportunities:
        </span>
        {moves.length === 0 && fixups.length === 0 && !chase && !gcRoundVisible && !contractCardVisible ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{emptyText}</span>
        ) : headerNote ? (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{headerNote}</span>
        ) : null}
      </div>
      {/* Card grid (v2.1966): moves tile across the width on big screens
          (the story cards' auto-fit pattern) and stack one-per-row on
          phones — full-width rows left a desert of empty space between
          claim and button on desktop. min(300px, 100%) guards ultra-narrow
          containers from horizontal overflow. */}
      {contractCardVisible ? (
        <div style={{ padding: '0.6rem 0.85rem 0' }}>
          <PipelineContractCoverageCard coverage={contractCoverage} onStageGap={onContractStageGap} onStartSweep={onStartContractSweep} />
        </div>
      ) : null}
      {(moves.length > 0 || fixups.length > 0 || chase != null || gcRoundVisible) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
            gap: '0.55rem',
            padding: '0.6rem 0.85rem',
          }}
        >
          {moves.map((m) => (
            <div
              key={m.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: 0,
                padding: '0.55rem 0.7rem',
                border: '1px solid var(--border)',
                borderLeft: m.key === 'chase-90' ? '3px solid var(--text-red-600)' : '1px solid var(--border)',
                borderRadius: 8,
                background: m.key === 'chase-90' ? 'var(--bg-red-tint)' : 'var(--surface)',
              }}
            >
              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: '0.95rem' }}>{m.icon}</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0, color: m.idle ? 'var(--text-muted)' : 'inherit' }}>{m.claim}</span>
                {m.badgeCount ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 9999,
                      background: '#f59e0b',
                      color: '#1c1917',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                    }}
                  >
                    {m.badgeCount}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{m.why}</span>
              <button
                type="button"
                onClick={moveAction[m.key]}
                style={{
                  alignSelf: 'flex-end',
                  height: 26,
                  padding: '0 0.65rem',
                  border: '1px solid var(--border-400)',
                  borderRadius: 9999,
                  background: 'var(--surface)',
                  color: 'var(--text-blue-700)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.actionLabel}
              </button>
            </div>
          ))}
          {/* Personal statement rounds (v2.2072), two stages: the certifier's
              held card, then the sender's ready card once released. */}
          {roundHeld && onCertifyRound ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: 0,
                padding: '0.55rem 0.7rem',
                border: '1px solid var(--border)',
                borderLeft: '3px solid #d97706',
                borderRadius: 8,
                background: 'var(--bg-amber-tint)',
              }}
            >
              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: '0.95rem' }}>🔏</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0 }}>
                  {roundHeld.count} statement round{roundHeld.count === 1 ? '' : 's'} wait on sign-off — {formatUsdNoCents(roundHeld.total)}
                </span>
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>
                certify each GC and their statement lands in the sender’s round — a personal email, never the system’s
              </span>
              <button
                type="button"
                onClick={onCertifyRound}
                style={{ alignSelf: 'flex-end', height: 26, padding: '0 0.65rem', border: '1px solid var(--border-400)', borderRadius: 9999, background: 'var(--surface)', color: 'var(--text-blue-700)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                Certify in GC Review
              </button>
            </div>
          ) : null}
          {roundReady && onStartRound ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: 0,
                padding: '0.55rem 0.7rem',
                border: '1px solid var(--border)',
                borderLeft: '3px solid #2563eb',
                borderRadius: 8,
                background: 'var(--bg-blue-tint)',
              }}
            >
              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: '0.95rem' }}>📬</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0 }}>
                  Your statement round — {roundReady.count} GC{roundReady.count === 1 ? '' : 's'}, {formatUsdNoCents(roundReady.total)}
                </span>
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>
                certified and ready · a personal email from you, not the system
              </span>
              <button
                type="button"
                onClick={onStartRound}
                style={{ alignSelf: 'flex-end', height: 26, padding: '0 0.65rem', border: 'none', borderRadius: 9999, background: '#2563eb', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                Start round →
              </button>
            </div>
          ) : null}
          {/* Payment chase card (v2.2025): who owes us a phone call about
              money. Office-only (the parent passes null otherwise); hidden
              when nobody owes a call and nothing is waiting. */}
          {chase && onStartChase ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: 0,
                padding: '0.55rem 0.7rem',
                border: '1px solid var(--border)',
                borderLeft: chase.dueCustomers > 0 ? '3px solid var(--text-red-600)' : '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
              }}
            >
              {/* Compact anatomy (v2.2059, owner request): claim — why —
                  button, same as every neighbor card. The badge carries the
                  count; the old chip row folds into the why line as plain
                  text (only non-zero tiers speak). */}
              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: '0.95rem' }}>📞</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0, color: chase.dueCustomers > 0 ? 'inherit' : 'var(--text-muted)' }}>
                  {chase.dueCustomers > 0
                    ? `Ask when they'll pay — ${formatUsdNoCents(chase.dueDollars)}`
                    : 'Payment follow-up · everyone asked'}
                </span>
                {chase.dueCustomers > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 9999,
                      background: '#f59e0b',
                      color: '#1c1917',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                    }}
                  >
                    {chase.dueCustomers}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>
                {[
                  chase.askCount > 0
                    ? `${chase.askCount} customer${chase.askCount === 1 ? '' : 's'} past expected, never asked`
                    : null,
                  chase.brokenCount > 0 ? `${chase.brokenCount} broken promise${chase.brokenCount === 1 ? '' : 's'}` : null,
                  chase.waitingCount > 0 ? `${chase.waitingCount} waiting` : null,
                  chase.disputeCount > 0 ? `${chase.disputeCount} dispute${chase.disputeCount === 1 ? '' : 's'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <button
                type="button"
                onClick={onStartChase}
                style={{
                  alignSelf: 'flex-end',
                  height: 26,
                  padding: '0 0.65rem',
                  border: '1px solid var(--border-400)',
                  borderRadius: 9999,
                  background: 'var(--surface)',
                  color: 'var(--text-blue-700)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Start call mode →
              </button>
            </div>
          ) : null}
          {/* Fix-ups joined the grid as a card (v2.1977; was a footer strip,
              v2.1961) — amber-edged, chips inside, gone when the data is
              clean. Each chip keeps its own action, so no card button. */}
          {fixups.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                minWidth: 0,
                padding: '0.55rem 0.7rem',
                border: '1px solid var(--border)',
                borderLeft: '3px solid #d97706',
                borderRadius: 8,
                background: 'var(--surface)',
              }}
            >
              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: '0.95rem' }}>🔎</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0 }}>Fix-ups — missing data blocks billing</span>
              </span>
              <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                {fixups.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => onFixup(f.key)}
                    title={f.title}
                    style={{
                      padding: '0.15rem 0.65rem',
                      borderRadius: 9999,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      background: f.tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
                      color: f.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-700)',
                      border: `1px solid ${f.tone === 'red' ? '#fecaca' : '#fcd34d'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                each chip opens its fix-it list — this card disappears when the data is clean
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
