import type { CSSProperties } from 'react'
import {
  jobPercentFromStages,
  stageEffectivePct,
  stagePickerNumber,
  stageReportSummary,
  type StageProgressRow,
} from '../lib/reports/stageProgressReport'

/**
 * The stage-weighted percent field on a field report (v2.3192): which stage
 * did you work on, and how far along is it. The job's percent is derived and
 * written into the template's percent field by the host; this component only
 * shows the arithmetic. Layout mirrors `ReportTemplatePercentField` (quick
 * picks + slider) so techs see a familiar control.
 */

const PERCENT_QUICK_PICKS = [25, 50, 75, 100]

const rowStyle = (selected: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '26px 1fr auto',
  gap: '0.6rem',
  alignItems: 'center',
  width: '100%',
  padding: '0.55rem 0.7rem',
  border: 'none',
  borderTop: '1px solid var(--border)',
  background: selected ? 'var(--bg-blue-tint)' : 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
})

export function ReportStageProgressField({
  label,
  stages,
  pick,
  onPick,
  onPct,
  onSwitchToWholeJob,
}: {
  /** The template's percent-field label ("How complete is the job?") — shown as the derived line's name. */
  label: string
  stages: StageProgressRow[]
  pick: { fixtureId: string; pct: number }
  onPick: (fixtureId: string) => void
  onPct: (pct: number) => void
  onSwitchToWholeJob: () => void
}) {
  const picked = stages.find((s) => s.fixtureId === pick.fixtureId) ?? null
  const summary = stageReportSummary(stages, pick.fixtureId, pick.pct)
  const before = jobPercentFromStages(stages)
  const sliderId = `report-stage-pct-${pick.fixtureId}`
  return (
    <div style={{ marginBottom: '0.75rem', width: '100%' }} data-testid="report-stage-progress">
      <div style={{ fontWeight: 500, lineHeight: 1.3, marginBottom: 4 }}>Which stage did you work on today?</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        {stages.map((s, idx) => {
          const selected = s.fixtureId === pick.fixtureId
          const eff = selected ? pick.pct : stageEffectivePct(s)
          const done = s.drawPaid || eff >= 100
          return (
            <button
              key={s.fixtureId}
              type="button"
              onClick={() => onPick(s.fixtureId)}
              aria-pressed={selected}
              style={{ ...rowStyle(selected), borderTop: idx === 0 ? 'none' : rowStyle(selected).borderTop }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: selected ? '#2563eb' : done ? 'var(--bg-green-tint)' : 'var(--bg-muted)',
                  color: selected ? '#fff' : done ? 'var(--text-green-800)' : 'var(--text-muted)',
                }}
              >
                {stagePickerNumber(stages, s)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {Math.round(s.weightPct)}% of the job{s.drawPaid ? ' · draw paid' : s.kind === 'any' ? ' · any time' : ''}
                </span>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: selected ? 'var(--text-blue-700)' : done ? 'var(--text-green-800)' : 'var(--text-muted)' }}>
                {done && !selected ? '✓ 100%' : `${eff}%`}
              </span>
            </button>
          )
        })}
      </div>

      {picked ? (
        <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.7rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: 6 }}>
            <label htmlFor={sliderId} style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {picked.name} is
            </label>
            <output htmlFor={sliderId} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {pick.pct}% complete
            </output>
          </div>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={5}
            value={pick.pct}
            onChange={(e) => onPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#2563eb' }}
            aria-label={`${picked.name} percent complete`}
          />
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: 6 }}>
            {PERCENT_QUICK_PICKS.map((p) => {
              const active = pick.pct === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPct(p)}
                  aria-pressed={active}
                  aria-label={`Set ${picked.name} to ${p} percent`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '0.45rem 0',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                    borderRadius: 6,
                    background: active ? '#2563eb' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-700)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {p === 100 ? 'Done ✓' : `${p}%`}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div
        style={{ marginTop: '0.6rem', padding: '0.6rem 0.7rem', borderRadius: 8, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}
        data-testid="report-stage-derived"
      >
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-green-800)', fontVariantNumeric: 'tabular-nums' }}>{summary.after}% of the job</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {label}: was {before}% · {picked ? `${picked.name} ${pick.pct}% × ${Math.round(picked.weightPct)}% = ${summary.contributionPts} pts` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitchToWholeJob}
          style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
        >
          Set the whole-job % instead
        </button>
      </div>
    </div>
  )
}
