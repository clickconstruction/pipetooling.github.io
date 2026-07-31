import { useMemo, useState } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildGcReviewRollup, type GcReviewGroup } from '../../lib/gcReviewRollup'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import GcHardHatIcon from '../icons/GcHardHatIcon'

type JobsGcReviewModalProps = {
  open: boolean
  onClose: () => void
  billedActiveRows: StageRow[]
  collectionsRows: StageRow[]
  /** Shell glue: build the statement HTML and open the print window (toast on popup block). */
  onPrint: (groups: GcReviewGroup[]) => void
}

/**
 * GC Review (v2.1181): Billed Awaiting Payment grouped by the job's GC — each
 * General Contractor's outstanding total and their customers' bill-out dates.
 * Same overlay pattern as the "by Job Name" modal in JobsStagesTab; rollup
 * math lives in the pure gcReviewRollup kernel so the grand total reconciles
 * with the section header by construction.
 */
export function JobsGcReviewModal({ open, onClose, billedActiveRows, collectionsRows, onPrint }: JobsGcReviewModalProps) {
  const [includeCollections, setIncludeCollections] = useState(false)
  const rollup = useMemo(
    () => buildGcReviewRollup(billedActiveRows, collectionsRows, { includeCollections }),
    [billedActiveRows, collectionsRows, includeCollections],
  )
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GC Review — Billed Awaiting Payment by General Contractor"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 720,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GcHardHatIcon size={18} style={{ color: 'var(--text-muted)' }} />
            GC Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Billed Awaiting Payment grouped by each job&rsquo;s GC/Builder, with bill-out dates. Set a GC in Edit Job →
          Customer.
        </p>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeCollections}
            onChange={() => setIncludeCollections((p) => !p)}
            style={{ margin: 0 }}
          />
          Include Collections ({rollup.collectionsCount} · ${formatCurrency(rollup.collectionsTotal)})
        </label>
        {rollup.groups.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No billed jobs awaiting payment.</p>
        ) : (
          rollup.groups.map((g) => (
            <div key={g.key} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  marginBottom: '0.35rem',
                }}
              >
                {g.isNoGc ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>No GC set</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <GcHardHatIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {g.gcName}
                  </span>
                )}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {g.jobCount} job{g.jobCount === 1 ? '' : 's'} · ${formatCurrency(g.subtotal)} outstanding
                  {g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays}d` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onPrint([g])}
                  title={`Print the ${g.gcName} statement`}
                  aria-label={`Print statement for ${g.gcName}`}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    color: 'var(--text-700)',
                  }}
                >
                  Print
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Customer</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Job</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Billed on</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Days</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        {r.customerName}
                        {r.inCollections ? (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '0.05rem 0.35rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              borderRadius: 4,
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-700)',
                            }}
                          >
                            Collections
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', color: 'var(--text-muted)' }}>
                        {r.hcp}
                        {r.jobName ? ` · ${r.jobName}` : ''}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>{r.referenceDateDisplay}</td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.ageDays != null ? `${r.ageDays}d` : '—'}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            borderTop: '2px solid var(--border-strong)',
            paddingTop: '0.6rem',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            Total
            {rollup.groups.length > 0 ? (
              <button
                type="button"
                onClick={() => onPrint(rollup.groups)}
                title="Print every GC section as one report"
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text-700)',
                }}
              >
                Print all
              </button>
            ) : null}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(rollup.grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
