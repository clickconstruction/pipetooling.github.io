import { type CSSProperties, type ReactNode } from 'react'
import { EstimateLineItemCatalogModal } from './EstimateLineItemCatalogModal'
import { estInputBase } from './estimatesPageStyles'
import { formatEstimateMoney as formatMoney } from '../../lib/estimates/estimateListRows'
import {
  coerceDraftQuantity,
  draftUnitPriceInputCents,
  emptyDraftLine,
} from '../../lib/estimates/estimateDraftLines'
import { formatSignedCentsUsd } from '../../lib/estimateChangeOrder'
import { bridgedCostImpactText } from '../../lib/bidDocuments/changeOrderBridge'
import { isCoCreditLine, type CoCostPromptMode } from '../../lib/coCostLinePrompt'
import type { EstimateCatalogLineItem } from '../../lib/estimateLineItemCatalog'
import {
  type EstimateLineItemNormalized,
} from '../../lib/estimateLineItemNormalize'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

type LineItem = EstimateLineItemNormalized

/** Guided CO cost-entry chips (“+ Added work” / “− Credit / removed work”). */
function coPromptChipStyle(kind: 'add' | 'credit'): CSSProperties {
  return {
    padding: '0.45rem 1rem',
    fontWeight: 600,
    fontSize: '0.85rem',
    borderRadius: 9999,
    border: `1.5px dashed ${kind === 'add' ? 'var(--text-green-600)' : 'var(--text-red-700)'}`,
    background: 'var(--bg-subtle)',
    color: 'var(--text-700)',
    cursor: 'pointer',
  }
}

const coPromptPanelStyle: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  borderRadius: 8,
  padding: '0.85rem 0.95rem',
}

export interface EstimateDraftLineItemsProps {
  /** A change order: the lines are its impact on cost, and a credit is a negative line. */
  isCO: boolean
  totalCents: number
  /** The step rail just jumped here: the block pulses. */
  flash: boolean
  /** The rail's numbered dot for this step. */
  stepDot: ReactNode
  /** The viewed option's lines, or the whole estimate's with no options. */
  lines: LineItem[]
  /** Read for the note a change order bridged from Bids carries. */
  internalNotes: string
  lineItemRecentChips: EstimateCatalogLineItem[]
  applyFromCatalogEntry: (entry: EstimateCatalogLineItem) => void
  catalogModalOpen: boolean
  setCatalogModalOpen: (open: boolean) => void
  catalogLineItems: EstimateCatalogLineItem[]
  loadCatalogFromDb: () => Promise<void>
  canManageEstimateCatalog: boolean
  addCoLine: (mode: CoCostPromptMode) => void
  /** The line the next render should focus, set by the added-work and credit presses. */
  coFocusLineIndexRef: MutableRefObject<number | null>
  updateLine: (index: number, patch: Partial<LineItem>) => void
  setLines: Dispatch<SetStateAction<LineItem[]>>
  catalogIconHovered: boolean
  setCatalogIconHovered: (hovered: boolean) => void
}

/**
 * Line items on a draft estimate (Impact on cost on a change order): the note a bridged change order
 * carries, the heading with the recent picks, the catalog window, the guided added-work and credit
 * presses, a row per line, the add-line and catalog presses, and the total.
 *
 * Moved whole from `EstimateDetail` (v2.7633, punch list #46 row 3, cut 8 of the Estimates map); the
 * markup is the page's own. The lines stay the page's: the options strip above swaps them, and the
 * draft's save reads them. The row math is `lib/estimates/estimateDraftLines`.
 */
export default function EstimateDraftLineItems({
  isCO,
  totalCents,
  flash,
  stepDot,
  lines,
  internalNotes,
  lineItemRecentChips,
  applyFromCatalogEntry,
  catalogModalOpen,
  setCatalogModalOpen,
  catalogLineItems,
  loadCatalogFromDb,
  canManageEstimateCatalog,
  addCoLine,
  coFocusLineIndexRef,
  updateLine,
  setLines,
  catalogIconHovered,
  setCatalogIconHovered,
}: EstimateDraftLineItemsProps) {
  return (
    <>
      {(() => {
        // v2.2911 (J16-F2 / P2): a draft bridged from Bids shows the typed cost text
        // where the money is entered, instead of leaving it to the internal note.
        if (!isCO) return null
        const bridged = bridgedCostImpactText({ lines, internalNotes })
        if (!bridged) return null
        return (
          <div
            role="note"
            style={{ margin: '0 0 0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderLeft: '3px solid #f59e0b', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-amber-800)' }}>From the Bids form — Impact on Cost as typed:</span>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{bridged}</span>
            <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
              {totalCents === 0
                ? 'The draft was created at $0 — add the cost lines below if the price changes.'
                : `Carried below as one net-change line (${formatSignedCentsUsd(totalCents)}). Split it into itemized lines if the customer wants the breakdown.`}
            </span>
          </div>
        )
      })()}
      <div
        id="est-step-cost"
        className={'est-region-ruled' + (flash ? ' estimate-customer-search-highlight' : '')}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{stepDot}{isCO ? 'Impact on cost' : 'Line items'}</h2>
        {lineItemRecentChips.map((c) => {
          const primary = (c.line_item.trim() || c.description.trim() || '(line)').slice(0, 40)
          const short = primary.length > 36 ? `${primary.slice(0, 35)}…` : primary
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => applyFromCatalogEntry(c)}
              title={`${c.line_item ? `${c.line_item} · ` : ''}${c.description} — ${c.quantity} × ${formatMoney(c.unit_price_cents)}`}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-muted)',
                color: 'var(--text-700)',
                cursor: 'pointer',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {short}
            </button>
          )
        })}
      </div>
      <EstimateLineItemCatalogModal open={catalogModalOpen} onClose={() => setCatalogModalOpen(false)} catalogLineItems={catalogLineItems} onReloadCatalog={loadCatalogFromDb} canManage={canManageEstimateCatalog} onInsert={applyFromCatalogEntry} />
      {isCO && lines.length === 0 ? (
        <div style={{ ...coPromptPanelStyle, textAlign: 'center', marginBottom: '0.75rem' }}>
          <p style={{ margin: '0 0 0.2rem', fontWeight: 600 }}>What does this change include?</p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Each line becomes part of the signed contract change.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => addCoLine('add')} style={coPromptChipStyle('add')}>
              + Added work
            </button>
            <button type="button" onClick={() => addCoLine('credit')} style={coPromptChipStyle('credit')}>
              − Credit / removed work
            </button>
          </div>
          {canManageEstimateCatalog || catalogLineItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setCatalogModalOpen(true)}
              style={{
                marginTop: '0.6rem',
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              or pick from the line-item catalog
            </button>
          ) : null}
        </div>
      ) : null}
      <ul
        style={{
          paddingLeft: '1.25rem',
          margin: 0,
          listStylePosition: 'outside',
        }}
      >
        {lines.map((ln, i) => {
          const coCredit = isCO && isCoCreditLine(ln.line_item, ln.unit_price_cents)
          return (
          <li key={i} style={{ marginBottom: '0.35rem' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div className="estimate-detail-line-item-block">
                <div className="estimate-detail-line-item-line">
                  <input
                    ref={(el) => {
                      if (el && coFocusLineIndexRef.current === i) {
                        coFocusLineIndexRef.current = null
                        el.focus()
                      }
                    }}
                    placeholder="Line item"
                    value={ln.line_item}
                    onChange={(e) => updateLine(i, { line_item: e.target.value })}
                    style={{ ...estInputBase, padding: '0.5rem' }}
                  />
                </div>
                <div className="estimate-detail-line-item-qty-unit">
                  <input
                    className="no-spinner"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Count"
                    title="Count"
                    value={ln.quantity}
                    onChange={(e) => updateLine(i, { quantity: coerceDraftQuantity(e.target.value) })}
                    style={{ ...estInputBase, width: 72, padding: '0.5rem' }}
                  />
                  <input
                    className="no-spinner"
                    type="number"
                    min={isCO ? undefined : 0}
                    step="0.01"
                    placeholder="Unit ($)"
                    title={
                      coCredit
                        ? 'Credit line — this amount is credited back to the customer'
                        : isCO
                          ? 'Negative unit price = credit line'
                          : undefined
                    }
                    value={
                      ln.unit_price_cents
                        ? (coCredit ? Math.abs(ln.unit_price_cents) : ln.unit_price_cents) / 100
                        : ''
                    }
                    onChange={(e) => updateLine(i, { unit_price_cents: draftUnitPriceInputCents(e.target.value, { credit: coCredit }) })}
                    style={{
                      ...estInputBase,
                      width: 100,
                      padding: '0.5rem',
                      ...(coCredit ? { color: 'var(--text-red-700)' } : {}),
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    aria-label="Remove line"
                    title="Remove line"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      margin: 0,
                      padding: 0,
                      border: '1px solid var(--border-red)',
                      borderRadius: '50%',
                      background: 'var(--bg-red-tint)',
                      color: 'var(--text-red-700)',
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      lineHeight: 0,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    −
                  </button>
                </div>
              </div>
              <input
                placeholder="Description (optional)"
                aria-label="Description (optional)"
                value={ln.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                style={{
                  ...estInputBase,
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '0.5rem',
                }}
              />
            </div>
          </li>
          )
        })}
        {isCO && lines.length === 0 ? null : (
        <li style={{ marginBottom: '0.35rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: 38,
              flexWrap: 'wrap',
            }}
          >
            {isCO ? (
              <>
                <button type="button" onClick={() => addCoLine('add')} style={coPromptChipStyle('add')}>
                  + Added work
                </button>
                <button type="button" onClick={() => addCoLine('credit')} style={coPromptChipStyle('credit')}>
                  − Credit / removed work
                </button>
              </>
            ) : (
            <button
              type="button"
              onClick={() => setLines((p) => [...p, emptyDraftLine()])}
              aria-label="Add line"
              title="Add line"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                margin: 0,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                color: 'var(--text-700)',
                fontSize: '1.125rem',
                fontWeight: 500,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              +
            </button>
            )}
            <button
              type="button"
              aria-label="Open line item catalog"
              onClick={() => setCatalogModalOpen(true)}
              disabled={!canManageEstimateCatalog && catalogLineItems.length === 0}
              title={
                !canManageEstimateCatalog && catalogLineItems.length === 0
                  ? 'No catalog items'
                  : canManageEstimateCatalog && catalogLineItems.length === 0
                    ? 'Open catalog to add preset line items'
                    : 'Preset line items (edit catalog in modal)'
              }
              onMouseEnter={() => {
                if (canManageEstimateCatalog || catalogLineItems.length > 0) setCatalogIconHovered(true)
              }}
              onMouseLeave={() => setCatalogIconHovered(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                lineHeight: 0,
                flexShrink: 0,
                cursor:
                  !canManageEstimateCatalog && catalogLineItems.length === 0 ? 'not-allowed' : 'pointer',
                color:
                  !canManageEstimateCatalog && catalogLineItems.length === 0 ? 'var(--text-faint)'
                  : catalogIconHovered ? 'var(--text-blue-700)'
                  : 'var(--text-link)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={22} height={22} aria-hidden>
                <path
                  fill="currentColor"
                  d="M192 576L512 576C529.7 576 544 561.7 544 544C544 526.3 529.7 512 512 512L512 445.3C530.6 438.7 544 420.9 544 400L544 112C544 85.5 522.5 64 496 64L448 64L448 233.4C448 245.9 437.9 256 425.4 256C419.4 256 413.6 253.6 409.4 249.4L368 208L326.6 249.4C322.4 253.6 316.6 256 310.6 256C298.1 256 288 245.9 288 233.4L288 64L192 64C139 64 96 107 96 160L96 480C96 533 139 576 192 576zM160 480C160 462.3 174.3 448 192 448L448 448L448 512L192 512C174.3 512 160 497.7 160 480z"
                />
              </svg>
            </button>
          </div>
        </li>
        )}
      </ul>
      <p style={{ fontWeight: 600, textAlign: 'right' }}>
        {isCO ? <>Net change to contract: {formatSignedCentsUsd(totalCents)}</> : <>Total: {formatMoney(totalCents)}</>}
      </p>
    </>
  )
}
