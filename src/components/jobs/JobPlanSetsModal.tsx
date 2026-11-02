import type { CSSProperties } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { asBuiltLineWords, setLineWords, type PlanSetRow } from '../../lib/plans/planSets'
import { jobPlansPickerView, jobPlansPickerWords, type JobPlanSetsEntry } from '../../lib/plans/jobPlanSetsIcon'

/**
 * The Pipeline row's plans picker (punch list #239, PR 6): a job whose part carries two or more sets opens this
 * window from the plans icon in its row. The set the job builds from comes first with its chip, then the older
 * sets and our as-builts, each with Open ↗. **Open the Documents tab** at the foot is where a set is added or
 * switched. One set never opens this window: the icon opens the set itself.
 */
export function JobPlanSetsModal({ job, entry, names = {}, onClose, onOpenDocuments }: { job: { id: string; label: string }; entry: JobPlanSetsEntry; names?: Record<string, string>; onClose: () => void; /** Opens the job window's Documents tab; the window closes first. */ onOpenDocuments?: () => void }) {
  const view = jobPlansPickerView(entry)
  const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }
  const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
  const chip: CSSProperties = { fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', borderRadius: 999, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
  const row = (s: PlanSetRow, line: string, current: boolean) => (
    <li key={s.id} data-testid="job-plan-set-row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: current ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{s.name}</span>
          {current ? <span style={chip}>building from</span> : null}
        </div>
        <div style={muted}>{line}</div>
        {s.memo ? <div style={{ fontSize: '0.8rem' }}>{s.memo}</div> : null}
      </div>
      <button type="button" onClick={() => openInExternalBrowser(s.link)} title={s.link} style={btn}>
        Open ↗
      </button>
    </li>
  )
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Plans on ${job.label}`}
      data-testid="job-plan-sets-modal"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.1rem 1.25rem', maxWidth: 560, width: '100%', maxHeight: 'min(85vh, 100%)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.02rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Plans on {job.label}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'inherit', flexShrink: 0 }}>
            ×
          </button>
        </div>
        <p style={{ ...muted, margin: 0 }}>{jobPlansPickerWords(view)}</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
          {view.current ? row(view.current, setLineWords(view.current), true) : null}
          {view.older.map((s) => row(s, setLineWords(s), false))}
        </ul>
        {view.asBuilts.length > 0 ? (
          <>
            <p style={{ ...muted, margin: 0, fontWeight: 600 }}>Our as-builts</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>{view.asBuilts.map((s) => row(s, asBuiltLineWords(s, s.created_by ? (names[s.created_by] ?? null) : null, entry.sets), false))}</ul>
          </>
        ) : null}
        {onOpenDocuments ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenDocuments()
              }}
              style={btn}
            >
              Open the Documents tab
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
