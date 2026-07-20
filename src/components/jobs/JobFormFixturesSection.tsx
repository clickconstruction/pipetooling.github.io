import { Fragment, type CSSProperties, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import AutosizeTextarea from '../AutosizeTextarea'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { normalizeFixtureDisplayName } from '../../lib/jobs/jobFormRows'
import {
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
  stripeInvoiceFixtureLineLength,
} from '../../lib/stripeInvoiceLineDescription'

const FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

type JobFormFixturesSectionProps = {
  fixtures: FixtureRow[]
  fixtureScopeExpandedById: Record<string, boolean>
  setFixtureScopeExpandedById: Dispatch<SetStateAction<Record<string, boolean>>>
  fixturesSectionHighlight: boolean
  fixturesSectionHighlightRef: MutableRefObject<HTMLDivElement | null>
  updateFixtureRow: (id: string, updates: Partial<FixtureRow>) => void
  addFixtureRow: () => void
  removeFixtureRow: (id: string) => void
  setStripeFixturePreviewRowId: (id: string | null) => void
  /** Live sum of the line items — shown as the running "Job Total" at the top right. */
  jobTotalDollars: number
}

/**
 * The "① Line Items" grid in the Edit/New Job
 * modal: one row per fixture (autosizing name, count, unit price) with an
 * add/remove control, plus the per-row scope/notes sub-row carrying the Stripe
 * line-length counter and the "Stripe preview" dialog trigger. Extracted
 * verbatim from JobFormModal — pure render; all state, the highlight
 * ref/effects, and the Stripe-preview dialog itself stay in the shell and come
 * in as props.
 */
export function JobFormFixturesSection({
  fixtures,
  fixtureScopeExpandedById,
  setFixtureScopeExpandedById,
  fixturesSectionHighlight,
  fixturesSectionHighlightRef,
  updateFixtureRow,
  addFixtureRow,
  removeFixtureRow,
  setStripeFixturePreviewRowId,
  jobTotalDollars,
}: JobFormFixturesSectionProps) {
  return (
          <div
            ref={fixturesSectionHighlightRef}
            style={{
              marginBottom: '1rem',
              borderRadius: 8,
              ...(fixturesSectionHighlight
                ? {
                    padding: '0.75rem',
                    background: 'var(--bg-blue-tint)',
                    border: '2px solid #93c5fd',
                  }
                : {}),
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.15rem' }}>① Line Items</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fixtures / tie-ins / repair. Each line adds to the <strong>Job Total</strong> — this is what the job is worth.</span>
              <span
                aria-live="polite"
                title="Running total of the line items below."
                style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 'auto' }}
              >
                Job Total: ${formatCurrency(jobTotalDollars)}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: '5.25rem' }} />
                <col style={{ width: 'calc(5.5rem + 4px + 1.75rem + 0.5rem)' }} />
              </colgroup>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line Item</th>
                  <th style={{ padding: '0.625rem 0.625rem', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Count</th>
                  <th
                    style={{
                      paddingTop: '0.625rem',
                      paddingBottom: '0.625rem',
                      paddingLeft: '0.625rem',
                      paddingRight: '0.375rem',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border)',
                      verticalAlign: 'middle',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Unit price
                  </th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((row, idx) => {
                  const nameFieldId = `job-fixture-name-${row.id}`
                  const descFieldId = `job-fixture-desc-${row.id}`
                  const stripeLenDescId = `job-fixture-stripe-len-${row.id}`
                  const scopeTrim = (row.line_description ?? '').trim()
                  const scopeExpanded =
                    scopeTrim.length > 0 || fixtureScopeExpandedById[row.id] === true
                  const stripeFixtureLineLen = stripeInvoiceFixtureLineLength(
                    row.name,
                    row.line_description,
                  )
                  const stripeLineOverLimit = stripeFixtureLineLen > STRIPE_INVOICE_LINE_DESCRIPTION_MAX
                  return (
                    <Fragment key={row.id}>
                      <tr style={{ borderBottom: 'none' }}>
                        <td
                          style={{
                            padding: '0.625rem 0.75rem',
                            paddingBottom: '0.35rem',
                            minWidth: 0,
                            verticalAlign: 'top',
                          }}
                        >
                          <label htmlFor={nameFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                            Specific work or materials
                          </label>
                          <AutosizeTextarea
                            minRows={1}
                            extraLines={0}
                            id={nameFieldId}
                            value={row.name}
                            onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                            onBlur={() => {
                              const next = normalizeFixtureDisplayName(row.name ?? '')
                              if (next !== row.name) updateFixtureRow(row.id, { name: next })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault()
                            }}
                            placeholder="Specific work or materials"
                            style={{
                              padding: '0.375rem 0.625rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              lineHeight: 1.4,
                              fontFamily: 'inherit',
                            }}
                          />
                        </td>
                        <td
                          style={{
                            paddingTop: '0.625rem',
                            paddingBottom: '0.35rem',
                            paddingLeft: '0.5rem',
                            paddingRight: '0.625rem',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'top',
                          }}
                        >
                          <input
                            type="number"
                            min={1}
                            value={row.count}
                            onChange={(e) => updateFixtureRow(row.id, { count: Math.max(1, Number(e.target.value) || 1) })}
                            style={{
                              width: '4rem',
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              padding: '0.375rem 0.625rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              textAlign: 'center',
                            }}
                          />
                        </td>
                        <td
                          style={{
                            paddingTop: '0.625rem',
                            paddingRight: '0.375rem',
                            paddingBottom: '0.35rem',
                            paddingLeft: '0.625rem',
                            verticalAlign: 'top',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'flex-start',
                              justifyContent: 'flex-start',
                              gap: 4,
                              flexWrap: 'nowrap',
                            }}
                          >
                            <MoneyDecimalAmountInput
                              value={row.line_unit_price ?? 0}
                              onChange={(n) => updateFixtureRow(row.id, { line_unit_price: n === 0 ? null : n })}
                              placeholder="—"
                              aria-label="Unit price"
                              style={{
                                width: '5.5rem',
                                minWidth: '4.5rem',
                                flexShrink: 0,
                                boxSizing: 'border-box',
                                padding: '0.375rem 0.5rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 6,
                                fontSize: '0.875rem',
                                textAlign: 'right',
                              }}
                            />
                            {fixtures.length === 1 ? (
                              <button
                                type="button"
                                onClick={addFixtureRow}
                                title="Add line item"
                                aria-label="Add line item"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                +
                              </button>
                            ) : idx === fixtures.length - 1 ? (
                              <button
                                type="button"
                                onClick={addFixtureRow}
                                title="Add line item"
                                aria-label="Add line item"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                +
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeFixtureRow(row.id)}
                                title="Remove"
                                aria-label="Remove line item"
                                style={{
                                  padding: '0.35rem',
                                  background: 'transparent',
                                  color: '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                  <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr
                        style={{
                          borderBottom: idx < fixtures.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <td
                          colSpan={3}
                          style={{
                            padding: '0 0.75rem 0.625rem',
                            verticalAlign: 'top',
                            position: 'relative',
                          }}
                        >
                          {scopeExpanded ? (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '0.5rem',
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  id={stripeLenDescId}
                                  aria-live="polite"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: stripeLineOverLimit ? '#d97706' : 'var(--text-muted)',
                                  }}
                                >
                                  ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                                </div>
                                <button
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-controls="stripe-fixture-line-preview-dialog"
                                  onClick={() => setStripeFixturePreviewRowId(row.id)}
                                  style={{
                                    padding: '0.25rem 0',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-link)',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px',
                                  }}
                                >
                                  Stripe preview
                                </button>
                              </div>
                              <label htmlFor={descFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                                Optional scope or notes for this line
                              </label>
                              <textarea
                                id={descFieldId}
                                aria-describedby={stripeLenDescId}
                                value={row.line_description}
                                onChange={(e) =>
                                  updateFixtureRow(row.id, { line_description: e.target.value })
                                }
                                placeholder="Optional scope or notes"
                                rows={2}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  padding: '0.375rem 0.625rem',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                  resize: 'vertical',
                                  minHeight: '2.5rem',
                                  fontFamily: 'inherit',
                                }}
                              />
                            </>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: '0.35rem',
                                marginBottom: 4,
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem' }}>
                                <span
                                  id={stripeLenDescId}
                                  aria-live="polite"
                                  style={{ color: stripeLineOverLimit ? '#d97706' : 'var(--text-muted)' }}
                                >
                                  ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                                </span>
                                <button
                                  type="button"
                                  aria-expanded={false}
                                  aria-controls={descFieldId}
                                  aria-describedby={stripeLenDescId}
                                  onClick={() =>
                                    setFixtureScopeExpandedById((prev) => ({
                                      ...prev,
                                      [row.id]: true,
                                    }))
                                  }
                                  style={{
                                    padding: '0.25rem 0',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-link)',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px',
                                  }}
                                >
                                  Add scope or notes
                                </button>
                              </div>
                              <button
                                type="button"
                                aria-haspopup="dialog"
                                aria-controls="stripe-fixture-line-preview-dialog"
                                onClick={() => setStripeFixturePreviewRowId(row.id)}
                                style={{
                                  padding: '0.25rem 0',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-link)',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '2px',
                                }}
                              >
                                Stripe preview
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
  )
}
