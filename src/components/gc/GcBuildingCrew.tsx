import type { Dispatch } from 'react'
import { money, ownCrewWork, type GcAction, type GcProject, type TradePackage } from '../../lib/gcMode/gcModel'
import { Card, Chip, Stat, input } from './gcUi'

/**
 * GC mode design spike: a trade our own crew does, on the Draws tab. It has no statement of work,
 * no draws, no retainage and no waivers: we pay our own crew through payroll. What it has is the
 * work done, one percent for the whole trade. It is the same number Bill the owner bills from,
 * and the same number the Building ring counts. The real build reads it from the Pipeline job.
 */

const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GcBuildingCrewCard({ project, pkg, dispatch }: { project: GcProject; pkg: TradePackage; dispatch: Dispatch<GcAction> }) {
  const crew = ownCrewWork(pkg)
  if (!crew) return null
  const steps = PCTS.includes(crew.pct) ? PCTS : [...PCTS, crew.pct].sort((a, b) => a - b)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 14rem) 1fr auto', gap: '0.6rem', alignItems: 'center', fontSize: '0.875rem', marginTop: '0.7rem' }}>
        <span>The whole trade · {money(crew.worth)}</span>
        <span title={`${crew.pct}% done`} style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', inset: 0, width: `${crew.pct}%`, background: '#93c5fd' }} />
        </span>
        <select
          aria-label={`Our own crew's percent done on ${pkg.trade}`}
          value={crew.pct}
          onChange={(e) => dispatch({ type: 'selfReport', projectId: project.id, packageId: pkg.id, pct: Number(e.target.value) })}
          style={input}
        >
          {steps.map((p) => (
            <option key={p} value={p}>
              {p}% done
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gap: '0.2rem' }}>
        <span>
          The real build reads the percent from Pipeline job {crew.ref}. The same number bills the owner on Bill the owner.
        </span>
        <span>We pay our own crew through payroll. There are no draws, retainage or waivers here.</span>
      </div>
    </Card>
  )
}
