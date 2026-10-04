import type { Dispatch } from 'react'
import { money, ownCrewWork, type GcAction, type GcProject, type TradePackage } from '../../lib/gcMode/gcModel'
import { Card, Chip, Stat, input } from './gcUi'

/**
 * GC mode design spike: a trade our own crew does, on the Draws tab. It has no statement of work,
 * no draws, no retainage and no waivers: we pay our own crew through payroll. What it has is the
 * work done, reported stage by stage the way the Pipeline runs the job (owner, 2026-10-02). The
 * whole-trade percent follows from the stages; it is the number Bill the owner bills from and the
 * one the Building ring counts. The real build reads the stages from the Pipeline job.
 */

const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GcBuildingCrewCard({ project, pkg, dispatch }: { project: GcProject; pkg: TradePackage; dispatch: Dispatch<GcAction> }) {
  const crew = ownCrewWork(pkg)
  if (!crew) return null
  const bar = (pct: number) => (
    <span className="gcBar" title={`${pct}% done`} style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: '#93c5fd' }} />
    </span>
  )
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span>
            <strong>{pkg.trade}</strong> · our own crew
          </span>
          <Chip tone="violet">Pipeline job {crew.ref}</Chip>
        </div>
        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          <Stat label="Our number" value={money(crew.worth)} />
          <Stat label="Done" value={money(crew.done)} />
          <Stat label="Left" value={money(crew.worth - crew.done)} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.7rem' }}>
        {crew.stages.map((st) => (
          <div key={st.lineId} className="gcBar-row">
            <span>
              {st.label} · {money((crew.worth * st.weight) / 100)}
            </span>
            {bar(st.pct)}
            <select
              aria-label={`Our own crew's percent done on ${st.label}`}
              value={PCTS.includes(st.pct) ? st.pct : Math.round(st.pct / 10) * 10}
              onChange={(e) => dispatch({ type: 'selfReportStage', projectId: project.id, packageId: pkg.id, lineId: st.lineId, pct: Number(e.target.value) })}
              style={input}
            >
              {PCTS.map((p) => (
                <option key={p} value={p}>
                  {p}% done
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="gcBar-row" style={{ fontWeight: 600 }}>
          <span>The whole trade</span>
          {bar(crew.pct)}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{crew.pct}% done</span>
        </div>
      </div>
      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gap: '0.2rem' }}>
        <span>
          {crew.byStage
            ? 'The whole trade follows from the stages. It is the number that bills the customer on Bill the customer.'
            : `Reported as one number so far. Reporting a stage here replaces it.`}
        </span>
        <span>The real build reads the stages from Pipeline job {crew.ref}.</span>
        <span>We pay our own crew through payroll. There are no draws, retainage or waivers here.</span>
      </div>
    </Card>
  )
}
