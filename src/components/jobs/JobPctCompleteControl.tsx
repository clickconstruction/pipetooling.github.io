import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { clampCompletenessPct } from '../../lib/jobs/jobCompleteness'

/**
 * "% complete" control for the Stages expanded Job activity / notes panel.
 * Collapsed it shows the current percent with a "Set % complete" button; opened
 * it reveals a marked 0–100 slider (1% steps) plus an exact number entry, and —
 * once the value is changed — Cancel / "Set to N%" buttons. Commits the same
 * jobs_ledger.pct_complete the Progress & payment cell writes, via `onCommit`
 * (the parent's updateJobPctComplete). Native range input covers touch + mouse.
 */

const PCT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const PCT_LABELS = [0, 25, 50, 75, 100]

const editButtonStyle: CSSProperties = {
  padding: '0.2rem 0.6rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  background: 'none',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
}
const numberInputStyle: CSSProperties = {
  width: 56,
  padding: '0.2rem 0.35rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  textAlign: 'right',
}
const neutralButtonStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  cursor: 'pointer',
}
const setButtonStyle = (saving: boolean): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  background: saving ? 'var(--bg-200)' : '#3b82f6',
  color: saving ? 'var(--text-muted)' : 'white',
  border: 'none',
  borderRadius: 4,
  cursor: saving ? 'not-allowed' : 'pointer',
})

export function JobPctCompleteControl({
  jobId,
  pct,
  canEdit,
  saving,
  onCommit,
}: {
  jobId: string
  pct: number | null
  canEdit: boolean
  saving: boolean
  onCommit: (value: number) => void
}) {
  const savedPct = pct ?? 0
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(savedPct)

  // Close + resync once a save finishes (parent's `saving` flips true → false and
  // `pct` reflects the reloaded value). Also resyncs the draft if `pct` changes
  // underneath a closed editor.
  const wasSaving = useRef(saving)
  useEffect(() => {
    if (wasSaving.current && !saving) {
      setOpen(false)
      setDraft(pct ?? 0)
    }
    wasSaving.current = saving
  }, [saving, pct])
  useEffect(() => {
    if (!open) setDraft(pct ?? 0)
  }, [pct, open])

  const dirty = draft !== savedPct
  const ticksId = `pct-ticks-${jobId}`

  if (!open) {
    // Inline chip sitting in the action-button row. The current percent shows only
    // once the job has a value (pct != null) — reports/unset jobs just get the button.
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {pct != null && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{pct}% complete</span>
        )}
        {canEdit && (
          <button type="button" onClick={() => { setDraft(savedPct); setOpen(true) }} style={editButtonStyle}>
            Set % complete
          </button>
        )}
      </div>
    )
  }

  return (
    // Opened: take a full-width line of its own at the bottom of the flex action row.
    <div
      style={{
        order: 1,
        flexBasis: '100%',
        width: '100%',
        padding: '0.6rem',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Set % complete</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <input
            type="number"
            min={0}
            max={100}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(clampCompletenessPct(e.target.value) ?? 0)}
            aria-label="Percent complete"
            style={numberInputStyle}
          />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>%</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        list={ticksId}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(Number(e.target.value))}
        aria-label="Percent complete slider"
        style={{ width: '100%', accentColor: '#3b82f6', cursor: saving ? 'not-allowed' : 'pointer' }}
      />
      <datalist id={ticksId}>
        {PCT_TICKS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {PCT_LABELS.map((m) => (
          <span key={m}>{m}%</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        {dirty || saving ? (
          <>
            <button type="button" onClick={() => { setDraft(savedPct); setOpen(false) }} disabled={saving} style={neutralButtonStyle}>
              Cancel
            </button>
            <button type="button" onClick={() => onCommit(draft)} disabled={saving} style={setButtonStyle(saving)}>
              {saving ? 'Setting…' : `Set to ${draft}%`}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setOpen(false)} style={neutralButtonStyle}>
            Close
          </button>
        )}
      </div>
    </div>
  )
}
