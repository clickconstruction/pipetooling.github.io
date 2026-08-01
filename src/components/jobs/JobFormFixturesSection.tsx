import { Fragment, useEffect, useRef, useState, type CSSProperties, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import AutosizeTextarea from '../AutosizeTextarea'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { normalizeFixtureDisplayName } from '../../lib/jobs/jobFormRows'
import { fixtureInvoiceLinkChip, fixtureRowIsLocked } from '../../lib/jobs/jobFormFixtureLinks'
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
  /** Swap a row with its neighbor; order persists via sequence_order on save (v2.1067). */
  moveFixtureRow: (id: string, direction: 'up' | 'down') => void
  /**
   * jobs_ledger_invoices.id → status for this job; rows whose invoice_id is
   * set render locked with a lifecycle chip (v2.1069). Re-ordering stays
   * allowed — order is presentation, not money.
   */
  invoiceStatusById?: Record<string, string>
  /** Opens the Multiple Segment Generator modal (v2.1071). */
  onOpenSegmentGenerator: () => void
  /** Opens the all-line-items Stripe preview dialog (v2.1223, title-row trigger). */
  onOpenStripeFixturePreview: () => void
  /** Live sum of the line items — shown as the running "Job Total" at the top right. */
  jobTotalDollars: number
  /** Rider `<tr>`s (hazmat fees) rendered after the fixture rows (v2.1029). */
  riderRows?: ReactNode
  /** Sum of rider fees — folds into the displayed Job Total with a breakdown. */
  riderFeesDollars?: number
}

/**
 * The "① Line Items" grid in the Edit/New Job
 * modal: one row per fixture (autosizing name with an in-border scope pencil,
 * count and unit price as ×/$ input groups) with add/remove controls, a
 * title-row "Stripe preview" trigger (all-lines dialog, v2.1223), and a
 * near-limit Stripe line-length counter in the expanded scope block. Pure
 * render; all state, the highlight ref/effects, and the Stripe-preview dialog
 * itself stay in the shell and come in as props.
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
  moveFixtureRow,
  invoiceStatusById = {},
  onOpenSegmentGenerator,
  onOpenStripeFixturePreview,
  jobTotalDollars,
  riderRows,
  riderFeesDollars = 0,
}: JobFormFixturesSectionProps) {
  const [helperOpen, setHelperOpen] = useState(false)
  // Phone-width focus expansion (v2.1229): while a row's name field (or any
  // field in that row) holds focus on a narrow viewport, the name spans the
  // full grid width and the ×/$ inputs drop to their own row below, so the
  // user can read what they're typing. The collapse is delayed a beat so a
  // tap on the relocated count/price/trash lands before the layout snaps back.
  const narrowViewport = useNarrowViewport640()
  const [nameFocusRowId, setNameFocusRowId] = useState<string | null>(null)
  const nameFocusCollapseTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (nameFocusCollapseTimer.current != null) window.clearTimeout(nameFocusCollapseTimer.current)
    },
    [],
  )
  const holdNameFocusExpansion = () => {
    if (nameFocusCollapseTimer.current != null) {
      window.clearTimeout(nameFocusCollapseTimer.current)
      nameFocusCollapseTimer.current = null
    }
  }
  const scheduleNameFocusCollapse = () => {
    holdNameFocusExpansion()
    nameFocusCollapseTimer.current = window.setTimeout(() => setNameFocusRowId(null), 120)
  }
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
              <span style={{ fontWeight: 400, textDecoration: 'underline', fontSize: '0.9375rem', color: 'var(--text-700)' }}>① Line Items</span>
              <button
                type="button"
                onClick={() => setHelperOpen((v) => !v)}
                aria-expanded={helperOpen}
                style={{
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-link)',
                  fontSize: '0.6875rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                ⓘ What are line items?
              </button>
              <button
                type="button"
                onClick={onOpenSegmentGenerator}
                style={{
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-link)',
                  textDecoration: 'underline',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Multiple Segment Generator
              </button>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-controls="stripe-fixture-line-preview-dialog"
                onClick={onOpenStripeFixturePreview}
                title="Preview the Stripe invoice line for every line item"
                style={{
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-link)',
                  textDecoration: 'underline',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Stripe preview
              </button>
            </div>
            {helperOpen && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Specific segments of work{riderFeesDollars > 0 ? ' — plus riders (hazmat fees)' : ''} add to the{' '}
                  <strong>Job Total</strong>. Each line can carry its own scope notes and be billed on its own invoice.
                </span>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
              {/* No header band (v2.1149) — the inputs self-label: count and unit
                  price carry muted "×" / "$" prefixes inside their own borders
                  (input groups, v2.1223), so a full row of column titles isn't
                  spent labeling what is usually a single line. */}
              <colgroup>
                <col />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: 'calc(6.2rem + 4px + 1.75rem)' }} />
              </colgroup>
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
                  const locked = fixtureRowIsLocked(row)
                  const linkChip = fixtureInvoiceLinkChip(row.invoice_id, invoiceStatusById)
                  const nameEditExpanded = narrowViewport && !locked && nameFocusRowId === row.id
                  const countGroup = (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'stretch',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 0.3rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-subtle)',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        ×
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={row.count}
                        disabled={locked}
                        aria-label="Count"
                        onChange={(e) => updateFixtureRow(row.id, { count: Math.max(1, Number(e.target.value) || 1) })}
                        style={{
                          width: '2.6rem',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '0.375rem 0.25rem',
                          border: 'none',
                          borderRadius: 0,
                          fontSize: '0.875rem',
                          textAlign: 'center',
                          background: 'transparent',
                        }}
                      />
                    </span>
                  )
                  const priceGroup = (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'stretch',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 0.3rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-subtle)',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        $
                      </span>
                      <MoneyDecimalAmountInput
                        value={row.line_unit_price ?? 0}
                        onChange={(n) => updateFixtureRow(row.id, { line_unit_price: n === 0 ? null : n })}
                        readOnly={locked}
                        commitOnType
                        placeholder="—"
                        aria-label="Unit price"
                        style={{
                          width: '5rem',
                          minWidth: '4rem',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                          padding: '0.375rem 0.5rem',
                          border: 'none',
                          borderRadius: 0,
                          fontSize: '0.875rem',
                          textAlign: 'right',
                          background: 'transparent',
                        }}
                      />
                    </span>
                  )
                  // The add-line-item action lives in the footer next to Job Total
                  // (v2.1131) — a (+) pinned to the last row made freshly generated
                  // rows read as "not added yet". Every removable row now carries
                  // the same trash icon; the sole remaining row keeps none (the
                  // grid always holds at least one row).
                  const deleteButton =
                    fixtures.length === 1 || locked ? null : (
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
                    )
                  return (
                    <Fragment key={row.id}>
                      <tr
                        style={{ borderBottom: 'none' }}
                        onFocus={holdNameFocusExpansion}
                        onBlur={scheduleNameFocusCollapse}
                      >
                        <td
                          colSpan={nameEditExpanded ? 3 : undefined}
                          style={{
                            padding: '0.45rem 0.75rem',
                            paddingBottom: '0.25rem',
                            minWidth: 0,
                            verticalAlign: 'top',
                          }}
                        >
                          <label htmlFor={nameFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                            Specific work or materials
                          </label>
                          <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                            {fixtures.length > 1 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => moveFixtureRow(row.id, 'up')}
                                  disabled={idx === 0}
                                  title="Move up"
                                  aria-label="Move line item up"
                                  style={{
                                    padding: '0 0.15rem',
                                    fontSize: '0.625rem',
                                    lineHeight: 1.2,
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    border: 'none',
                                    cursor: idx === 0 ? 'default' : 'pointer',
                                    opacity: idx === 0 ? 0.3 : 1,
                                  }}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFixtureRow(row.id, 'down')}
                                  disabled={idx === fixtures.length - 1}
                                  title="Move down"
                                  aria-label="Move line item down"
                                  style={{
                                    padding: '0 0.15rem',
                                    fontSize: '0.625rem',
                                    lineHeight: 1.2,
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    border: 'none',
                                    cursor: idx === fixtures.length - 1 ? 'default' : 'pointer',
                                    opacity: idx === fixtures.length - 1 ? 0.3 : 1,
                                  }}
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Input group (v2.1223): the scope pencil sits INSIDE the name
                                  field's border as a suffix (top-anchored so it doesn't jump
                                  when a name wraps). The Stripe preview is job-wide and lives
                                  on the ① title row. */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'stretch',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                }}
                              >
                                <AutosizeTextarea
                                  minRows={1}
                                  extraLines={0}
                                  id={nameFieldId}
                                  value={row.name}
                                  disabled={locked}
                                  onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                                  onFocus={() => {
                                    if (narrowViewport && !locked) {
                                      holdNameFocusExpansion()
                                      setNameFocusRowId(row.id)
                                    }
                                  }}
                                  onBlur={() => {
                                    const next = normalizeFixtureDisplayName(row.name ?? '')
                                    if (next !== row.name) updateFixtureRow(row.id, { name: next })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.preventDefault()
                                  }}
                                  placeholder="Specific work or materials"
                                  style={{
                                    flex: 1,
                                    width: '100%',
                                    minWidth: 0,
                                    padding: '0.375rem 0.625rem',
                                    border: 'none',
                                    borderRadius: 0,
                                    fontSize: '0.875rem',
                                    lineHeight: 1.4,
                                    fontFamily: 'inherit',
                                    background: 'transparent',
                                    ...(locked ? { opacity: 0.75 } : {}),
                                  }}
                                />
                                {!locked && (
                                <span style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0, padding: '0.1rem 0.1rem 0 0' }}>
                                    <button
                                      type="button"
                                      aria-expanded={scopeExpanded}
                                      aria-controls={descFieldId}
                                      onClick={() => {
                                        if (!scopeExpanded) {
                                          setFixtureScopeExpandedById((prev) => ({ ...prev, [row.id]: true }))
                                        } else if (scopeTrim.length === 0) {
                                          setFixtureScopeExpandedById((prev) => ({ ...prev, [row.id]: false }))
                                        } else {
                                          document.getElementById(descFieldId)?.focus()
                                        }
                                      }}
                                      title={
                                        !scopeExpanded
                                          ? 'Add scope or notes'
                                          : scopeTrim.length === 0
                                            ? 'Hide scope or notes'
                                            : 'Edit the scope notes below'
                                      }
                                      aria-label={!scopeExpanded ? 'Add scope or notes' : 'Scope or notes'}
                                      style={{
                                        padding: '0.3rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 4,
                                        color: scopeExpanded ? 'var(--text-blue-500)' : 'var(--text-link)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                      </svg>
                                    </button>
                                </span>
                                )}
                              </div>
                              {linkChip && (
                                <span
                                  title="This line item is billed by an invoice in ② Invoices. Send the invoice back or delete it to edit the line."
                                  style={{
                                    display: 'inline-block',
                                    marginTop: 3,
                                    padding: '0.05rem 0.4rem',
                                    borderRadius: 999,
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    color: linkChip.color,
                                    background: linkChip.background,
                                  }}
                                >
                                  {linkChip.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {!nameEditExpanded && (
                          <>
                            <td
                              style={{
                                paddingTop: '0.45rem',
                                paddingBottom: '0.25rem',
                                paddingLeft: '0.25rem',
                                paddingRight: '0.25rem',
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'top',
                              }}
                            >
                              {/* Input group (v2.1223): the × lives INSIDE the field's
                                  border as a muted prefix — a floating glyph in the
                                  gutter read as a stray character. */}
                              {countGroup}
                            </td>
                            <td
                              style={{
                                paddingTop: '0.45rem',
                                paddingRight: '0.375rem',
                                paddingBottom: '0.25rem',
                                paddingLeft: '0.25rem',
                                verticalAlign: 'top',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  alignItems: 'flex-start',
                                  justifyContent: 'flex-end',
                                  gap: 4,
                                  flexWrap: 'nowrap',
                                }}
                              >
                                {/* Same input-group treatment as the count field: the $
                                    is a muted in-border prefix, not a floating glyph. */}
                                {priceGroup}
                                {deleteButton}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                      {nameEditExpanded && (
                        <tr
                          style={{ borderBottom: 'none' }}
                          onFocus={holdNameFocusExpansion}
                          onBlur={scheduleNameFocusCollapse}
                        >
                          <td colSpan={3} style={{ padding: '0 0.75rem 0.25rem', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                              {countGroup}
                              {priceGroup}
                              {deleteButton}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        style={{
                          borderBottom: idx < fixtures.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <td
                          colSpan={3}
                          style={{
                            padding: scopeExpanded || stripeLineOverLimit ? '0 0.75rem 0.45rem' : '0 0 0.2rem',
                            verticalAlign: 'top',
                            position: 'relative',
                          }}
                        >
                          {scopeExpanded ? (
                            <>
                              {/* The counter earns its space only near the Stripe line limit
                                  (v2.1223) — under that the expanded block is just the textarea.
                                  The Stripe-preview affordance lives on the row's name field
                                  (v2.1223), not here. */}
                              {stripeFixtureLineLen >= STRIPE_INVOICE_LINE_DESCRIPTION_MAX - 100 && (
                                <div
                                  id={stripeLenDescId}
                                  aria-live="polite"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: stripeLineOverLimit ? '#d97706' : 'var(--text-muted)',
                                    marginBottom: 4,
                                  }}
                                >
                                  ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                                </div>
                              )}
                              <label htmlFor={descFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                                Optional scope or notes for this line
                              </label>
                              <textarea
                                id={descFieldId}
                                aria-describedby={stripeLenDescId}
                                value={row.line_description}
                                disabled={locked}
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
                          ) : stripeLineOverLimit ? (
                            /* Collapsed rows carry no secondary line (v2.1223) — the scope
                               and Stripe-preview affordances are icons on the input row.
                               The counter surfaces only as this over-limit warning. */
                            <div
                              id={stripeLenDescId}
                              aria-live="polite"
                              style={{ padding: '0 0.75rem', fontSize: '0.75rem', color: '#d97706' }}
                            >
                              ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX}) — over the Stripe line limit
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
                {riderRows}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={addFixtureRow}
                title="Add a new line item row"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.9rem',
                  background: 'transparent',
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 6,
                  color: 'var(--text-link)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add line item
              </button>
              <span
                aria-live="polite"
                title={riderFeesDollars > 0 ? 'Running total of the line items above, riders included.' : 'Running total of the line items above.'}
                style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                Job Total: ${formatCurrency(jobTotalDollars + riderFeesDollars)}
                {riderFeesDollars > 0 ? (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {' '}(${formatCurrency(jobTotalDollars)} work + ${formatCurrency(riderFeesDollars)} riders)
                  </span>
                ) : null}
              </span>
            </div>
          </div>
  )
}
