/**
 * Pipeline "Hide groups…" modal (v2.1476): pick any GCs, Developments, or
 * Account Men to hide from the Stages board. Opened from the ⋯ tools menu
 * (the same home the include-filters moved to in v2.1232); the applied state
 * surfaces in the command bar as a red "Hiding N groups" chip. Pure state in
 * src/lib/jobsStagesExcludeFilters.ts — this component only renders it.
 */
import {
  EMPTY_STAGES_EXCLUDE_FILTERS,
  STAGES_EXCLUDE_DIMENSIONS,
  STAGES_EXCLUDE_DIMENSION_LABELS,
  countStagesExclusions,
  stagesExcludeOptionsFromJobs,
  toggleStagesExclusion,
  type StagesExcludeFilters,
} from '../../lib/jobsStagesExcludeFilters'
import type { JobWithDetails } from '../../types/jobWithDetails'

export type JobsStagesHideGroupsModalProps = {
  open: boolean
  onClose: () => void
  jobs: JobWithDetails[]
  filters: StagesExcludeFilters
  onChange: (next: StagesExcludeFilters) => void
}

export default function JobsStagesHideGroupsModal({ open, onClose, jobs, filters, onChange }: JobsStagesHideGroupsModalProps) {
  if (!open) return null
  const options = stagesExcludeOptionsFromJobs(jobs, filters)
  const total = countStagesExclusions(filters)

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stages-hide-groups-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 440,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          border: '1px solid var(--border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
          <h2 id="stages-hide-groups-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            Hide groups from the board
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Hidden groups disappear from every section and total. Only this device is affected — the chip in the
            search bar shows the board is filtered.
          </p>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0.25rem 0.5rem 0.5rem' }}>
          {STAGES_EXCLUDE_DIMENSIONS.map((dim) => (
            <div key={dim} style={{ padding: '0.4rem 0 0.2rem' }}>
              <div
                style={{
                  padding: '0.25rem 0.75rem 0.1rem',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                {STAGES_EXCLUDE_DIMENSION_LABELS[dim]}
              </div>
              {options[dim].length === 0 ? (
                <div style={{ padding: '0.2rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
                  Nothing on the board yet.
                </div>
              ) : (
                options[dim].map((o) => {
                  const hidden = filters[dim].includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={hidden}
                      onClick={() => onChange(toggleStagesExclusion(filters, dim, o.id))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.35rem 0.75rem',
                        border: 'none',
                        borderRadius: 6,
                        background: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: '0.875rem',
                        color: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: hidden ? 'line-through' : 'none',
                          color: hidden ? 'var(--text-faint)' : 'inherit',
                        }}
                      >
                        {o.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', flexShrink: 0 }}>
                        {o.count} job{o.count === 1 ? '' : 's'}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 6,
                          border: hidden ? '1px solid #dc2626' : '1px solid var(--border)',
                          background: hidden ? '#dc2626' : 'transparent',
                          color: hidden ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {hidden ? 'Hidden' : 'Hide'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => onChange(EMPTY_STAGES_EXCLUDE_FILTERS)}
            disabled={total === 0}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              font: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: total === 0 ? 'var(--text-faint)' : 'var(--text-link)',
              cursor: total === 0 ? 'default' : 'pointer',
            }}
          >
            Show everything
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 0.9rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              font: 'inherit',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
