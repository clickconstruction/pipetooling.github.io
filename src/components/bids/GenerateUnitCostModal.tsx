/** Font Awesome Free v7.x — scatter / correlation-style icon used for Generate Unit Cost. License: https://fontawesome.com/license/free */
import { createPortal } from 'react-dom'
import { useEffect, useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { unitPriceFromTargetPctOfTotal } from '../../lib/unitPriceFromTargetPctOfTotal'

const MODAL_Z = 10050

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 440,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.25rem',
}

export function GenerateUnitCostTriggerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
      <path
        fill="currentColor"
        d="M288 192C288 139 245 96 192 96C139 96 96 139 96 192C96 245 139 288 192 288C245 288 288 245 288 192zM544 448C544 395 501 352 448 352C395 352 352 395 352 448C352 501 395 544 448 544C501 544 544 501 544 448zM534.6 150.6C547.1 138.1 547.1 117.8 534.6 105.3C522.1 92.8 501.8 92.8 489.3 105.3L105.3 489.3C92.8 501.8 92.8 522.1 105.3 534.6C117.8 547.1 138.1 547.1 150.6 534.6L534.6 150.6z"
      />
    </svg>
  )
}

export type GenerateUnitCostModalProps = {
  open: boolean
  onClose: () => void
  fixtureLabel?: string | null
  totalRevenue: number
  currentRowRevenue: number
  currentPctOfTotal: number | null
  count: number
  isFixedPrice: boolean
  onApply: (price: number) => void | Promise<void>
}

function parseTargetPct(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : Number.NaN
}

export function GenerateUnitCostModal({
  open,
  onClose,
  fixtureLabel,
  totalRevenue,
  currentRowRevenue,
  currentPctOfTotal,
  count,
  isFixedPrice,
  onApply,
}: GenerateUnitCostModalProps) {
  const [pctInput, setPctInput] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!open) return
    setApplying(false)
    if (currentPctOfTotal != null && Number.isFinite(currentPctOfTotal)) {
      const rounded = Math.round(currentPctOfTotal * 10000) / 10000
      setPctInput(Number.isFinite(rounded) ? String(rounded) : '')
    } else {
      setPctInput('')
    }
  }, [open, currentPctOfTotal])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const targetPct = parseTargetPct(pctInput.trim())
  const computed =
    Number.isFinite(targetPct) && Number.isFinite(totalRevenue) && Number.isFinite(count)
      ? unitPriceFromTargetPctOfTotal({
          totalRevenue,
          targetPct,
          count,
          isFixed: isFixedPrice,
        })
      : null

  const applyDisabled =
    applying ||
    computed == null ||
    !Number.isFinite(computed.unitPrice) ||
    computed.unitPrice <= 0 ||
    totalRevenue <= 0

  async function handleApply() {
    if (applyDisabled || computed == null) return
    setApplying(true)
    try {
      await onApply(computed.unitPrice)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const pctDisplay =
    currentPctOfTotal != null && Number.isFinite(currentPctOfTotal) ?
      `${currentPctOfTotal.toFixed(1)}%`
    : '—'

  const showThisLineRevenueSummary =
    currentRowRevenue > 0 ||
    (currentPctOfTotal != null && Number.isFinite(currentPctOfTotal) && currentPctOfTotal > 0)

  const rowSubtitleName = fixtureLabel?.trim() ?? ''

  const countN = Math.max(0, Math.floor(Number(count)))
  const showUnitCountPreview =
    !isFixedPrice && Number.isFinite(Number(count)) && countN >= 1

  const showUnitAmountPreviewRow = isFixedPrice || countN !== 1

  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bid pricing line share"
        style={panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {rowSubtitleName ?
          <p
            role="heading"
            aria-level={2}
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {rowSubtitleName}
          </p>
        : null}

        <div
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.875rem',
            color: 'var(--text-700)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
            textAlign: 'center',
          }}
        >
          <span>
            Current Bid Total: <strong>${formatCurrency(totalRevenue)}</strong>
          </span>
          {showThisLineRevenueSummary ?
            <span>
              This line revenue: <strong>${formatCurrency(currentRowRevenue)}</strong>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({pctDisplay} of total)</span>
            </span>
          : null}
        </div>

        {totalRevenue <= 0 ?
          <p style={{ margin: '0 0 0.75rem', padding: '0.5rem', background: 'var(--bg-amber-100)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
            Set prices so total revenue is greater than zero before using this tool.
          </p>
        : null}

        {isFixedPrice ?
          <p style={{ margin: '0 0 0.75rem', padding: '0.5rem', background: 'var(--bg-muted)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            Fixed price: the applied amount is the total revenue for this line (not multiplied by count).
          </p>
        : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <label
            htmlFor="generate-unit-cost-pct-input"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: totalRevenue <= 0 ? 'default' : 'pointer',
              margin: 0,
            }}
          >
            Line share of total (%):
          </label>
          <input
            id="generate-unit-cost-pct-input"
            type="text"
            inputMode="decimal"
            value={pctInput}
            onChange={(e) => setPctInput(e.target.value)}
            disabled={totalRevenue <= 0}
            style={{
              width: '6rem',
              flex: '0 0 auto',
              padding: '0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ margin: '0 0 1rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span>
            New row total:{' '}
            <strong>{computed != null ? `$${formatCurrency(computed.rowRevenue)}` : '—'}</strong>
          </span>
          {showUnitAmountPreviewRow ?
            <span>
              {isFixedPrice ?
                <>Fixed amount to apply: </>
              : showUnitCountPreview ?
                <>
                  <strong>{countN}</strong>
                  {` count${countN === 1 ? '' : 's'}, unit amount`}
                  :{' '}
                </>
              :
                <>Unit amount: </>
              }
              <strong>{computed != null ? `$${formatCurrency(computed.unitPrice)}` : '—'}</strong>
            </span>
          : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applyDisabled}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: 4,
              background: applyDisabled ? '#9ca3af' : '#2563eb',
              color: 'white',
              cursor: applyDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
