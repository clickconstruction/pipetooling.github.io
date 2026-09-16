/**
 * Billed Awaiting Payment by Job Name (Stages tab decomposition, v2.3530).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (region 5 of the architecture map). One opener:
 * the ⋯ tools menu and the `showBilledTotalByName` handle (`?showBilledTotalByName=true`).
 * The grouping lives in `buildBilledTotalByNameEntries`; the expanded-name state stays in the
 * parent because its reset-on-close effect does.
 */
import { Fragment } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import {
  buildBilledTotalByNameEntries,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
} from '../../lib/jobs/invoiceBilling'

export function StagesBilledTotalByNameModal({
  rows,
  expandedName,
  onToggleName,
  onPrint,
  onGoToBilled,
  onClose,
}: {
  /** The billed-active rows on the board (already search-filtered by the parent). */
  rows: StageRow[]
  expandedName: string | null
  onToggleName: (name: string) => void
  onPrint: () => void
  /** "take me to Job: Stages: Billed" — the parent opens and scrolls the section. */
  onGoToBilled: () => void
  onClose: () => void
}) {
  const entries = buildBilledTotalByNameEntries(rows)
  return (
    <div role="dialog" aria-modal="true" aria-label="Billed Awaiting Payment by Job Name" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Billed Awaiting Payment by Job Name</h2>
          <button
            type="button"
            onClick={onPrint}
            disabled={rows.length === 0}
            title="Print customers, contacts, and amounts due"
            aria-label="Print billed awaiting payment report"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexShrink: 0,
              height: 36,
              padding: '0 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: rows.length === 0 ? 'var(--bg-muted)' : 'var(--surface)',
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              color: 'var(--text-700)',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
              <path
                fill="currentColor"
                d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
              />
            </svg>
            Print
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job Name</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ name, total, rows: groupRows }, idx) => {
              const expanded = expandedName === name
              const panelId = `total-by-name-detail-${idx}`
              const detailRows = sortStageRowsForTotalByNameDetail(groupRows)
              return (
                <Fragment key={name}>
                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => onToggleName(name)}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        id={`total-by-name-toggle-${idx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-strong)',
                          fontSize: 'inherit',
                          textAlign: 'left',
                          maxWidth: '100%',
                        }}
                      >
                        <span aria-hidden style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {expanded ? '▼' : '▶'}
                        </span>
                        {name}
                      </button>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>${formatCurrency(total)}</td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          padding: 0,
                          borderBottom: idx === entries.length - 1 ? 'none' : '1px solid var(--border)',
                          background: 'var(--bg-subtle)',
                        }}
                      >
                        <div id={panelId} role="region" aria-labelledby={`total-by-name-toggle-${idx}`} style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Line</th>
                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Amount</th>
                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Age</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailRows.map((r, detailIdx) => {
                                const amt = stageRowBilledRemainingAmount(r)
                                const days = stageRowBilledAgeDays(r)
                                const ageLabel = days == null ? '—' : `${days} day${days !== 1 ? 's' : ''}`
                                const rowKey = r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`
                                const addr = (r.job.job_address ?? '').trim() || '—'
                                const isLastBillInGroup = detailIdx === detailRows.length - 1
                                return (
                                  <Fragment key={rowKey}>
                                    <tr style={{ borderBottom: 'none' }}>
                                      <td style={{ padding: '0.35rem 0.5rem' }}>{stageRowBilledLineLabel(r)}</td>
                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>${formatCurrency(amt)}</td>
                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{ageLabel}</td>
                                    </tr>
                                    <tr style={{ borderBottom: isLastBillInGroup ? 'none' : '1px solid var(--border)' }}>
                                      <td colSpan={3} style={{ padding: '0 0.5rem 0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {addr}
                                      </td>
                                    </tr>
                                  </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onGoToBilled}
            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
          >
            take me to Job: Stages: Billed
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
