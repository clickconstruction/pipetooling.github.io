/**
 * "Get contracts signed" (v2.2738): the first card in Today's Money
 * Opportunities on the Pipeline — how many live jobs (every stage but Paid)
 * have no agreement on file, the dollars riding on them, one tappable chip
 * per stage (the No-contract filter + a jump to that section), and Start the
 * sweep. When the gap is zero it collapses to one quiet green line.
 *
 * Contract sweep PR 0: the card also says what it is NOT counting — jobs
 * under the floor and jobs the office marked Not needed — and a dev can set
 * the floor right here (app_settings, dev-write RLS).
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { CONTRACT_STAGES, CONTRACT_STAGE_LABELS, type ContractStage, type ContractStageCounts } from '../../lib/jobs/jobContractNudge'
import { formatContractFloor, parseTypedFloorToCents, setJobContractFloorCents } from '../../lib/jobs/jobContractFloor'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

export type PipelineContractCoverage = {
  missingCount: number
  missingRevenue: number
  liveTotal: number
  byStage: ContractStageCounts
  /** PR 0: what the count leaves out, and the floor it used (cents; 0 = none). */
  underFloor?: { count: number; revenueTotal: number }
  notNeeded?: { count: number }
  floorCents?: number
}

function dispatchChanged() {
  try {
    window.dispatchEvent(new Event('job-contract-changed'))
  } catch {
    /* non-browser */
  }
}

/** "Floor $2,500 · 9 small jobs not counted · 3 marked not needed", with the dev's change control. */
function FloorLine({ coverage }: { coverage: PipelineContractCoverage }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const floorCents = coverage.floorCents ?? 0
  const under = coverage.underFloor?.count ?? 0
  const notNeeded = coverage.notNeeded?.count ?? 0
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const canEdit = role === 'dev'

  const parts: string[] = []
  parts.push(floorCents > 0 ? `Skipping jobs under ${formatContractFloor(floorCents)}` : 'Counting every dollar')
  if (floorCents > 0 && under > 0) parts.push(`${under} not counted`)
  if (notNeeded > 0) parts.push(`${notNeeded} marked not needed`)

  const save = async () => {
    const cents = parseTypedFloorToCents(text)
    if (cents == null) {
      showToast('Type a dollar amount, or 0 for no floor.', 'error')
      return
    }
    setBusy(true)
    try {
      await setJobContractFloorCents(cents)
      setEditing(false)
      dispatchChanged()
      showToast(cents > 0 ? `Floor set to ${formatContractFloor(cents)} — smaller jobs leave the count.` : 'Floor removed — every live job counts.', 'success')
    } catch {
      showToast('Could not save the floor.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
        <label htmlFor="contract-floor-input" style={{ color: 'var(--text-muted)' }}>
          Floor $
        </label>
        <input
          id="contract-floor-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          inputMode="decimal"
          placeholder="2,500"
          autoFocus
          style={{ width: 84, padding: '0.15rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.74rem' }}
        />
        <button type="button" disabled={busy} onClick={() => void save()} style={{ padding: '0.15rem 0.5rem', borderRadius: 5, border: '1px solid var(--text-link)', background: 'var(--text-link)', color: 'white', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)} style={{ padding: '0.15rem 0.4rem', borderRadius: 5, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)', font: 'inherit', fontSize: '0.72rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </span>
    )
  }
  return (
    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }} title="Jobs with an amount under the floor, and jobs the office marked Not needed, are not counted as gaps. A job with no amount always counts.">
      {parts.join(' · ')}
      {canEdit ? (
        <>
          {' '}
          <button
            type="button"
            onClick={() => {
              setText(floorCents > 0 ? String(floorCents / 100) : '')
              setEditing(true)
            }}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline dotted' }}
          >
            {floorCents > 0 ? 'change' : 'set a small‑job floor'}
          </button>
        </>
      ) : null}
    </span>
  )
}

export function PipelineContractCoverageCard({
  coverage,
  onStageGap,
  onStartSweep,
}: {
  coverage: PipelineContractCoverage
  onStageGap: (stage: ContractStage) => void
  onStartSweep: () => void
}) {
  const covered = Math.max(0, coverage.liveTotal - coverage.missingCount)
  if (coverage.liveTotal === 0) return null
  if (coverage.missingCount === 0) {
    return (
      <div
        role="status"
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.82rem' }}
      >
        <span aria-hidden>✓</span>
        <b>Every live job has an agreement on file, or doesn&apos;t need one.</b>
        <span style={{ color: 'var(--text-muted)' }}>
          {coverage.liveTotal} of {coverage.liveTotal} — accepted estimates and bid-room signatures count.
        </span>
        <FloorLine coverage={coverage} />
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem 1rem',
        flexWrap: 'wrap',
        padding: '0.55rem 0.7rem',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--text-amber-700)',
        borderRadius: 8,
        background: 'var(--bg-amber-tint)',
      }}
    >
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-strong)' }}>
          <span aria-hidden>✍ </span>
          Get contracts signed — {coverage.missingCount} live job{coverage.missingCount === 1 ? '' : 's'} without, {formatUsdNoCents(coverage.missingRevenue)} of work
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {covered} of {coverage.liveTotal} live jobs have an agreement on file (accepted estimates and bid-room signatures count). Tap a stage to see its gaps.
        </div>
        <div style={{ marginTop: 2 }}>
          <FloorLine coverage={coverage} />
        </div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'wrap', fontSize: '0.8rem' }} aria-label="Jobs without a contract, by stage">
        {CONTRACT_STAGES
          .filter((stage) => coverage.byStage[stage].total > 0)
          .map((stage, idx) => {
            const c = coverage.byStage[stage]
            const label = CONTRACT_STAGE_LABELS[stage].toLowerCase()
            const sep = idx === 0 ? null : (
              <span aria-hidden style={{ color: 'var(--text-muted)', opacity: 0.5, padding: '0 0.15rem' }}>·</span>
            )
            if (c.missing === 0) {
              return (
                <span key={stage} title={`${label}: all ${c.total} have an agreement or don't need one`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', padding: '0.15rem 0.4rem', color: 'var(--text-green-700)' }}>
                  {sep}
                  <span aria-hidden>✓</span>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                </span>
              )
            }
            return (
              <span key={stage} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                {sep}
                <button
                  type="button"
                  onClick={() => onStageGap(stage)}
                  title={`${label}: ${c.missing} of ${c.total} without an agreement (${formatUsdNoCents(c.revenueMissing)}) — filter the board to them`}
                  style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', padding: '0.2rem 0.45rem', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-amber-800)', font: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.missing}</b>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                </button>
              </span>
            )
          })}
      </div>
      <button
        type="button"
        onClick={onStartSweep}
        style={{ padding: '0.35rem 0.8rem', borderRadius: 7, border: '1px solid var(--text-link)', background: 'var(--text-link)', color: 'white', font: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        Start the sweep →
      </button>
    </div>
  )
}

export default PipelineContractCoverageCard
