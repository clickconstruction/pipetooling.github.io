/**
 * The "Subs:" line at the top right of the Workflow page: a pill per
 * subcontractor with steps on the project — blue with a count while any are
 * open, grey once all are finished.
 *
 * Draws the roster it is handed; the page builds it from its steps
 * (`buildProjectSubRoster`) and decides whether the line shows at all.
 */
import { subRosterTooltip, type SubRosterEntry } from '../../lib/workflow/projectSubRoster'

export function WorkflowSubsStrip({ entries }: { entries: SubRosterEntry[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Subs:</span>
      {entries.map((sub) => (
        <span
          key={sub.key}
          title={subRosterTooltip(sub)}
          style={{
            padding: '0.15rem 0.5rem',
            background: sub.activeStepCount > 0 ? 'var(--bg-blue-tint)' : 'var(--bg-neutral-100)',
            borderRadius: 999,
            fontSize: '0.8125rem',
            color: sub.activeStepCount > 0 ? 'var(--text-link)' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          🔧 {sub.name}
          {sub.activeStepCount > 0 && <> · {sub.activeStepCount} open</>}
        </span>
      ))}
    </div>
  )
}
