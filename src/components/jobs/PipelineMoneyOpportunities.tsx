/**
 * Today's Money Opportunities (v2.2145 — extracted from PipelineOverview so
 * Quickfill's Jobs Cleanup station can show the SAME cards): the system-
 * written queue of money moves, the statement-round cards, the payment-chase
 * card, and the fix-ups card. Pure presentation over kernels the caller
 * already ran; every action is a callback so the host decides whether it
 * opens a modal (Pipeline) or navigates (Quickfill). Copy and tones live
 * here once.
 *
 * v2.3822 (punch list #44, the owner: "these two cards are very wordy"): one
 * card shell for every card — line one is the glyph, the claim and the door
 * as a link at the right end of the same line (no button row); line two is
 * the why, or chips that are doors themselves. The lien card's piles and its
 * deadline are chips, each opening the desk on that pile; the burn card's
 * worst jobs are chips, each opening its Costs tab. Every explaining
 * sentence that used to take a row is a hover.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { PipelineBurnAlert } from '../../lib/jobs/jobSummaryBurn'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { PipelineFixup, PipelineFixupKey, PipelineMove, PipelineMoveKey } from '../../lib/jobs/pipelineOverview'
import type { PaymentChaseSummary } from '../../lib/jobs/paymentChase'
import { heldRoundHeadline } from '../../lib/jobs/gcStatementRounds'
import { PipelineContractCoverageCard, type PipelineContractCoverage } from './PipelineContractCoverageCard'
import type { ContractStage } from '../../lib/jobs/jobContractNudge'
import type { LienDeskMoneyCard } from '../../lib/jobs/lienDeskMoneyCard'
import type { LienDeskPile } from '../../lib/jobs/lienDesk'

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
  /** Burn card (v2.3191): jobs whose spend leads their progress by > 5 pts; omit / null to hide. */
  burnAlert?: PipelineBurnAlert | null
  onOpenBurnJob?: (jobId: string) => void
  onShowBurnList?: () => void
  /** Contract coverage card (v2.2738) — Pipeline only; omit to hide. */
  contractCoverage?: PipelineContractCoverage | null
  onContractStageGap?: (stage: ContractStage) => void
  onStartContractSweep?: () => void
  /** Lien notices due (v2.3799, punch list #34): the desk's own summary as one card (`buildLienDeskMoneyCard`); null / omitted hides it. Pipeline only — Quickfill's Needs you carries the desk's cards. */
  lienNotices?: LienDeskMoneyCard | null
  /** Opens the Lien desk on its Notices tab — on a pile when a chip asks for one (v2.3822). */
  onOpenLienDesk?: (pile?: LienDeskPile) => void
  /** Quiet note beside the title (Quickfill: "same as Jobs → Pipeline"). */
  headerNote?: string
  /** Empty-state line when nothing needs a move. */
  emptyText?: string
}

type CardTone = 'red' | 'amber' | 'blue' | 'plain'

const EDGE: Record<CardTone, string> = { red: '3px solid var(--text-red-600)', amber: '3px solid #d97706', blue: '3px solid #2563eb', plain: '1px solid var(--border)' }
const FILL: Record<CardTone, string> = { red: 'var(--bg-red-tint)', amber: 'var(--bg-amber-tint)', blue: 'var(--bg-blue-tint)', plain: 'var(--surface)' }

const doorStyle: CSSProperties = {
  marginLeft: 'auto',
  flex: 'none',
  border: 'none',
  background: 'none',
  padding: 0,
  color: 'var(--text-blue-700)',
  fontSize: '0.74rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const badgeStyle: CSSProperties = {
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
  flex: 'none',
}

/** The chip on line two (v2.3822): a door of its own. Red and amber are the desk's tones; `quiet` is a caveat, dashed. */
function OpportunityChip({ label, tone = 'plain', title, onClick, testId }: { label: string; tone?: 'red' | 'amber' | 'plain' | 'quiet'; title?: string; onClick?: () => void; testId?: string }) {
  const c =
    tone === 'red'
      ? { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', bd: '#fecaca' }
      : tone === 'amber'
        ? { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)', bd: '#fcd34d' }
        : tone === 'quiet'
          ? { bg: 'transparent', fg: 'var(--text-muted)', bd: 'var(--border-strong)' }
          : { bg: 'var(--surface)', fg: 'var(--text-700)', bd: 'var(--border-strong)' }
  const style: CSSProperties = {
    padding: '0.1rem 0.6rem',
    borderRadius: 9999,
    fontSize: '0.72rem',
    fontWeight: tone === 'quiet' ? 500 : 600,
    fontFamily: 'inherit',
    cursor: onClick ? 'pointer' : 'default',
    background: c.bg,
    color: c.fg,
    border: `1px ${tone === 'quiet' ? 'dashed' : 'solid'} ${c.bd}`,
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
  return onClick ? (
    <button type="button" onClick={onClick} title={title} style={style} data-testid={testId ?? 'opportunity-chip'} data-tone={tone}>
      {label}
    </button>
  ) : (
    <span title={title} style={style} data-testid={testId ?? 'opportunity-chip'} data-tone={tone}>
      {label}
    </span>
  )
}

/**
 * The card shell (v2.3822): line one — the glyph, the claim (with an optional muted tail and badge) and the door
 * as a link at the right; line two — `children` (a why line or a chip row). Two lines is the height.
 */
function OpportunityCard({ glyph, claim, muted, badge, tone, door, hover, children, testId }: { glyph: string; claim: ReactNode; muted?: ReactNode; badge?: number | null; tone: CardTone; door?: { label: string; onClick: () => void; title?: string } | null; hover?: string; children?: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      title={hover}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0, padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderLeft: EDGE[tone], borderRadius: 8, background: FILL[tone] }}
    >
      <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
        <span aria-hidden style={{ fontSize: '0.95rem', flex: 'none' }}>{glyph}</span>
        <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0 }}>
          {claim}
          {muted ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> {muted}</span> : null}
        </span>
        {badge ? <span style={badgeStyle}>{badge}</span> : null}
        {door ? (
          <button type="button" onClick={door.onClick} title={door.title} style={doorStyle} data-testid={testId ? `${testId}-door` : undefined}>
            {door.label}
          </button>
        ) : null}
      </span>
      {children}
    </div>
  )
}

const whyStyle: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }
const chipRowStyle: CSSProperties = { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }

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
  burnAlert,
  onOpenBurnJob,
  onShowBurnList,
  contractCoverage,
  onContractStageGap,
  onStartContractSweep,
  lienNotices,
  onOpenLienDesk,
  headerNote,
  emptyText = 'nothing needs a move right now — the pipeline is clean ✅',
}: PipelineMoneyOpportunitiesProps) {
  const contractCardVisible = contractCoverage != null && contractCoverage.liveTotal > 0 && onContractStageGap != null && onStartContractSweep != null
  const roundHeld = gcRound?.held && gcRound.held.count > 0 ? gcRound.held : null
  const roundReady = gcRound?.ready && gcRound.ready.count > 0 ? gcRound.ready : null
  const gcRoundVisible = roundHeld != null || roundReady != null
  const burnVisible = burnAlert != null && burnAlert.count > 0 && onOpenBurnJob != null
  const lienVisible = lienNotices != null && lienNotices.count > 0 && onOpenLienDesk != null
  const anyCard = moves.length > 0 || fixups.length > 0 || chase != null || gcRoundVisible || burnVisible || lienVisible
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
          borderBottom: anyCard || contractCardVisible ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Today&#8217;s Money Opportunities:
        </span>
        {!anyCard && !contractCardVisible ? (
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
      {anyCard && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
            gap: '0.55rem',
            padding: '0.6rem 0.85rem',
          }}
        >
          {moves.map((m) => (
            <OpportunityCard
              key={m.key}
              glyph={m.icon}
              claim={<span style={{ color: m.idle ? 'var(--text-muted)' : 'inherit' }}>{m.claim}</span>}
              badge={m.badgeCount}
              tone={m.key === 'chase-90' ? 'red' : 'plain'}
              door={{ label: `${m.actionLabel} →`, onClick: moveAction[m.key] }}
              testId={`pipeline-move-${m.key}`}
            >
              {m.why ? <span style={whyStyle}>{m.why}</span> : null}
            </OpportunityCard>
          ))}
          {/* Lien notices due (v2.3799, punch list #34): the Lien desk's count and dollars,
              the piles and the earliest window as chips (v2.3822) — red inside a week, amber
              inside two — each opening the desk on its pile. The most time-boxed money item
              the office has, so it sits right after the moves. */}
          {lienVisible && lienNotices && onOpenLienDesk ? (
            <OpportunityCard
              glyph="⏱"
              claim={lienNotices.title}
              tone={lienNotices.tone === 'gray' ? 'plain' : lienNotices.tone}
              door={{ label: 'Lien desk →', onClick: () => onOpenLienDesk(), title: 'Open the Lien desk on Notices' }}
              hover={lienNotices.why}
              testId="pipeline-lien-notices-card"
            >
              <span style={chipRowStyle}>
                {lienNotices.piles.map((p) => (
                  <OpportunityChip key={p.key} label={p.label} title={`Opens the desk on this pile`} onClick={() => onOpenLienDesk(p.key)} testId="pipeline-lien-pile-chip" />
                ))}
                {lienNotices.deadline ? (
                  <OpportunityChip label={lienNotices.deadline.label} tone={lienNotices.deadline.tone === 'gray' ? 'plain' : lienNotices.deadline.tone} title={lienNotices.deadline.hover} onClick={() => onOpenLienDesk(lienNotices.deadline!.pile)} testId="pipeline-lien-deadline-chip" />
                ) : null}
              </span>
            </OpportunityCard>
          ) : null}
          {/* Burn (v2.3191): the jobs spending faster than they are finishing —
              the Costs tab's verdict, summed. The worst three are chips (v2.3822),
              each opening that job's Costs tab; the door opens the worst. */}
          {burnVisible && burnAlert && onOpenBurnJob ? (
            <OpportunityCard
              glyph="🔥"
              claim={`${burnAlert.count === 1 ? '1 job burning' : `${burnAlert.count} jobs burning`} · ${formatUsdNoCents(burnAlert.marginAtRiskUsd)} margin at risk`}
              tone="red"
              door={{ label: 'Worst first →', onClick: () => onOpenBurnJob(burnAlert.worst[0]!.jobId), title: 'Open the worst job on its Costs tab' }}
              hover="Jobs that have spent a bigger share of their budget than they have finished; the shortfall against the target margin, summed."
              testId="pipeline-burn-card"
            >
              <span style={chipRowStyle}>
                {burnAlert.worst.map((w) => (
                  <OpportunityChip
                    key={w.jobId}
                    label={`${w.glyph} ${w.label} · ${Math.round(w.spentPct)}% spent at ${Math.round(w.pct)}% done`}
                    tone="red"
                    title={`${w.footing === 'assumed' ? '≈ against an assumed budget — no bid or typed budget on the job. ' : w.footing === 'typed' ? '✎ against the budget typed on the job. ' : '◆ against the bid. '}Opens the job on its Costs tab.`}
                    onClick={() => onOpenBurnJob(w.jobId)}
                    testId="pipeline-burn-job-chip"
                  />
                ))}
                {burnAlert.count > burnAlert.worst.length ? (
                  <OpportunityChip label={`+${burnAlert.count - burnAlert.worst.length} more`} tone="quiet" title="Job Summary on In progress, worst projected margin first" onClick={onShowBurnList} testId="pipeline-burn-more-chip" />
                ) : null}
                {burnAlert.assumedCount > 0 ? (
                  <OpportunityChip
                    label={`≈ ${burnAlert.assumedCount === burnAlert.count ? 'all' : burnAlert.assumedCount} against an assumed budget`}
                    tone="quiet"
                    title="Measured against an assumption, not a bid or a typed budget — link the bid or type a budget on the Costs tab to firm it up"
                    testId="pipeline-burn-assumed-chip"
                  />
                ) : null}
              </span>
            </OpportunityCard>
          ) : null}
          {/* Personal statement rounds (v2.2072), two stages: the certifier's
              held card, then the sender's ready card once released. */}
          {roundHeld && onCertifyRound ? (
            <OpportunityCard glyph="🔏" claim={heldRoundHeadline(roundHeld.count, formatUsdNoCents(roundHeld.total))} tone="amber" door={{ label: 'Certify in GC Review →', onClick: onCertifyRound }} testId="pipeline-round-held-card">
              {/* B6 / J20-F7: held.count is GCs, not rounds — and the verb agrees. */}
              <span style={whyStyle}>certify each GC and their statement lands in the sender’s round — a personal email, never the system’s</span>
            </OpportunityCard>
          ) : null}
          {roundReady && onStartRound ? (
            <OpportunityCard glyph="📬" claim={`Your statement round — ${roundReady.count} GC${roundReady.count === 1 ? '' : 's'}, ${formatUsdNoCents(roundReady.total)}`} tone="blue" door={{ label: 'Start round →', onClick: onStartRound }} testId="pipeline-round-ready-card">
              <span style={whyStyle}>certified and ready · a personal email from you, not the system</span>
            </OpportunityCard>
          ) : null}
          {/* Payment chase card (v2.2025): who owes us a phone call about
              money. Office-only (the parent passes null otherwise); hidden
              when nobody owes a call and nothing is waiting. Compact anatomy
              (v2.2059, owner request): claim — why — door; the badge carries
              the count, only non-zero tiers speak. */}
          {chase && onStartChase ? (
            <OpportunityCard
              glyph="📞"
              claim={<span style={{ color: chase.dueCustomers > 0 ? 'inherit' : 'var(--text-muted)' }}>{chase.dueCustomers > 0 ? `Ask when they'll pay — ${formatUsdNoCents(chase.dueDollars)}` : 'Payment follow-up · everyone asked'}</span>}
              badge={chase.dueCustomers > 0 ? chase.dueCustomers : null}
              tone={chase.dueCustomers > 0 ? 'red' : 'plain'}
              door={{ label: 'Start call mode →', onClick: onStartChase }}
              testId="pipeline-chase-card"
            >
              {(() => {
                const why = [
                  chase.askCount > 0 ? `${chase.askCount} customer${chase.askCount === 1 ? '' : 's'} past expected, never asked` : null,
                  chase.brokenCount > 0 ? `${chase.brokenCount} broken promise${chase.brokenCount === 1 ? '' : 's'}` : null,
                  chase.waitingCount > 0 ? `${chase.waitingCount} waiting` : null,
                  chase.disputeCount > 0 ? `${chase.disputeCount} dispute${chase.disputeCount === 1 ? '' : 's'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return why ? <span style={whyStyle}>{why}</span> : null
              })()}
            </OpportunityCard>
          ) : null}
          {/* Fix-ups joined the grid as a card (v2.1977; was a footer strip,
              v2.1961) — amber-edged, chips inside, gone when the data is
              clean. Each chip keeps its own action, so no card door. */}
          {fixups.length > 0 && (
            <OpportunityCard glyph="🔎" claim="Fix-ups — missing data blocks billing" tone="amber" hover="Each chip opens its fix-it list — this card disappears when the data is clean" testId="pipeline-fixups-card">
              <span style={chipRowStyle}>
                {fixups.map((f) => (
                  <OpportunityChip key={f.key} label={f.label} tone={f.tone === 'red' ? 'red' : 'amber'} title={f.title} onClick={() => onFixup(f.key)} testId="pipeline-fixup-chip" />
                ))}
              </span>
            </OpportunityCard>
          )}
        </div>
      )}
    </div>
  )
}
