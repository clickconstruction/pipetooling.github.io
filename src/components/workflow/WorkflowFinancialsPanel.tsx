/**
 * The Workflow page's Projections & Ledger panel: the summary bar
 * (Projections | Ledger | Left, + Add Projection, Details) and, opened, the
 * table that sets each stage's projections beside the line items spent on it.
 *
 * Draws the projections, steps and line items it is handed and hands the
 * three projection actions back; the page's `useWorkflowProjections` call
 * holds the list and the edit window, which the stage list opens too. The
 * panel owns only whether its table is open.
 *
 * Dev and master see everything. A role that manages stages but is not one
 * of them sees the Ledger figure and column alone: projections are not read
 * for it, and the Projections, Left and Actions parts are not drawn.
 */
import { useState } from 'react'
import type { Database } from '../../types/database'
import { normalizeUrl } from '../../lib/projectsForecastStageLineItems'
import { buildUnifiedFinancialRows, panelMoneyTotals } from '../../lib/workflow/unifiedFinancialRows'
import { formatAmount } from '../../lib/workflow/workflowFormat'

type Projection = Database['public']['Tables']['workflow_projections']['Row']
type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']

export type WorkflowFinancialsPanelProps = {
  projections: Projection[]
  steps: ReadonlyArray<{ id: string; name: string }>
  lineItems: Record<string, LineItem[]>
  /** Dev or master: sees projections and may change them. */
  isDevOrMaster: boolean
  /** May manage stages: sees the ledger. */
  canManageStages: boolean
  onAddProjection: () => void
  onEditProjection: (projection: Projection) => void
  onDeleteProjection: (projectionId: string) => void
}

export function WorkflowFinancialsPanel({
  projections,
  steps,
  lineItems,
  isDevOrMaster,
  canManageStages,
  onAddProjection,
  onEditProjection,
  onDeleteProjection,
}: WorkflowFinancialsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const totals = panelMoneyTotals(projections, lineItems)
  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Collapsible summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 8 }}>
        {isDevOrMaster && (
          <>
            <span style={{ fontSize: '0.875rem', color: totals.projectionsTotal < 0 ? 'var(--text-red-700)' : 'var(--text-strong)', fontWeight: 500 }}>
              Projections: {formatAmount(totals.projectionsTotal)}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-faint)' }}>|</span>
          </>
        )}
        {canManageStages && (
          <span style={{ fontSize: '0.875rem', color: totals.ledgerTotal < 0 ? 'var(--text-red-700)' : 'var(--text-strong)', fontWeight: 500 }}>
            Ledger: {formatAmount(totals.ledgerTotal)}
          </span>
        )}
        {isDevOrMaster && (
          <>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-faint)' }}>|</span>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: (() => {
                  const left = totals.left
                  return left < 0 ? '#b91c1c' : '#047857'
                })(),
              }}
            >
              Left: {formatAmount(totals.left)}
            </span>
          </>
        )}
        {isDevOrMaster && (
          <button
            type="button"
            onClick={() => onAddProjection()}
            className="wf-btn-success"
            style={{ marginLeft: 'auto' }}
          >
            + Add Projection
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="wf-btn-secondary wf-btn-secondary-blue"
          style={{ marginLeft: 'auto' }}
        >
          {expanded ? '\u25b2 Hide details' : '\u25be Details'}
        </button>
      </div>

      {/* Expanded unified table */}
      {expanded && (() => {
        const unifiedRows = buildUnifiedFinancialRows(projections, steps, lineItems)
        const hasProjections = projections.length > 0
        const hasLedger = Object.keys(lineItems).length > 0 && !Object.values(lineItems).every((items) => items.length === 0)
        const hasAnyData = hasProjections || hasLedger

        if (!hasAnyData) {
          return (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No projections or ledger items.
              {isDevOrMaster && (
                <button
                  type="button"
                  onClick={() => onAddProjection()}
                  className="wf-btn-success"
                  style={{ marginLeft: '0.5rem' }}
                >
                  Add Projection
                </button>
              )}
            </div>
          )
        }

        return (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-sky)' }}>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Step</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Memo</th>
                  {isDevOrMaster && <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Projections</th>}
                  <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Ledger</th>
                  {isDevOrMaster && <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 600, width: 90 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {unifiedRows.map((row, idx) => (
                  <tr key={row.projection?.id ?? row.ledgerItem?.id ?? `row-${idx}`} style={{ borderBottom: '1px solid #e0f2fe' }}>
                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-strong)', fontWeight: row.stageName ? 500 : 'normal' }}>{row.stageName || '\u00a0'}</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-700)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{row.memo}</span>
                        {row.ledgerItem?.link && (
                          <a
                            href={normalizeUrl(row.ledgerItem.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-blue-500)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                            title={row.ledgerItem.link}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const normalizedLink = normalizeUrl(row.ledgerItem!.link)
                              if (normalizedLink) {
                                window.open(normalizedLink, '_blank', 'noopener,noreferrer')
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '12px', height: '12px', fill: 'currentColor' }}>
                              <path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    {isDevOrMaster && (
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: (row.projectionAmount ?? 0) < 0 ? 'var(--text-red-700)' : 'var(--text-strong)', fontWeight: 500 }}>
                        {row.projectionAmount != null ? formatAmount(row.projectionAmount) : '\u2014'}
                      </td>
                    )}
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: (row.ledgerAmount ?? 0) < 0 ? 'var(--text-red-700)' : 'var(--text-strong)', fontWeight: 500 }}>
                      {row.ledgerAmount != null ? formatAmount(row.ledgerAmount) : '\u2014'}
                    </td>
                    {isDevOrMaster && (
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                        {row.projection ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => row.projection && onEditProjection(row.projection)}
                              className="wf-btn-secondary"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => row.projection && onDeleteProjection(row.projection.id)}
                              className="wf-btn-danger"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          '\u00a0'
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #0ea5e9' }}>
                  <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600 }} colSpan={isDevOrMaster ? 2 : 2}>
                    Total
                  </td>
                  {isDevOrMaster && (
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: totals.projectionsTotal < 0 ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
                      {formatAmount(totals.projectionsTotal)}
                    </td>
                  )}
                  <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: totals.ledgerTotal < 0 ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
                    {formatAmount(totals.ledgerTotal)}
                  </td>
                  {isDevOrMaster && <td style={{ padding: '0.5rem 0.5rem' }} />}
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })()}
    </div>
  )
}
