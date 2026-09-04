/**
 * "Get contracts signed" (v2.2738): the first card in Today's Money
 * Opportunities on the Pipeline — how many live jobs (every stage but Paid)
 * have no agreement on file, the dollars riding on them, one tappable chip
 * per stage (the No-contract filter + a jump to that section), and Start the
 * sweep. When the gap is zero it collapses to one quiet green line.
 */
import { CONTRACT_STAGES, CONTRACT_STAGE_LABELS, type ContractStage, type ContractStageCounts } from '../../lib/jobs/jobContractNudge'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

export type PipelineContractCoverage = {
  missingCount: number
  missingRevenue: number
  liveTotal: number
  byStage: ContractStageCounts
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
        <b>Every live job has an agreement on file.</b>
        <span style={{ color: 'var(--text-muted)' }}>
          {coverage.liveTotal} of {coverage.liveTotal} — accepted estimates and bid-room signatures count.
        </span>
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
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} aria-label="Jobs without a contract, by stage">
        {CONTRACT_STAGES.map((stage) => {
          const c = coverage.byStage[stage]
          if (c.total === 0) return null
          const label = CONTRACT_STAGE_LABELS[stage]
          if (c.missing === 0) {
            return (
              <span key={stage} title={`${label}: all ${c.total} have an agreement`} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.74rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>
                {label} ✓
              </span>
            )
          }
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onStageGap(stage)}
              title={`${label}: ${c.missing} of ${c.total} without an agreement (${formatUsdNoCents(c.revenueMissing)}) — filter the board to them`}
              style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.74rem', fontWeight: 600, border: '1px solid var(--border-amber)', background: 'var(--surface)', color: 'var(--text-amber-800)', font: 'inherit', cursor: 'pointer' }}
            >
              {label} <b>{c.missing}</b>
            </button>
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
