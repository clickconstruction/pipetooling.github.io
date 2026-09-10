import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import AutosizeTextarea from '../AutosizeTextarea'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { normalizeFixtureDisplayName } from '../../lib/jobs/jobFormRows'
import {
  DISCOUNT_REASON_PRESETS,
  derivedDiscountDollars,
  discountBasisDollars,
  discountBasisRows,
  discountBillDescription,
  discountExceedsBasis,
  discountNameForReason,
  discountReadout,
  discountRowIsLocked,
  discountSharesByWorkRow,
  discountTwinLabel,
  formatPct,
  isDiscountRow,
  parseDiscountEntry,
  workLineDollars,
} from '../../lib/jobs/discountLine'

/** Discount green stays literal (saturated status color, theme rules). */
const DISCOUNT_INK = '#0f7a52'
const DISCOUNT_WASH = 'var(--bg-green-100)'

const VISUALLY_HIDDEN: CSSProperties = {
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

const GROUP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
}

/** The dashed "−" badge in the stage column: a discount is never a stage. */
export function DiscountBadge({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-label="Discount line"
      title="A discount — never a stage; it follows the work it applies to onto every draw"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        border: `1.5px dashed ${DISCOUNT_INK}`,
        color: DISCOUNT_INK,
        fontSize: size * 0.55,
        fontWeight: 700,
        lineHeight: 1,
        boxSizing: 'border-box',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      −
    </span>
  )
}

type JobFormDiscountRowProps = {
  row: FixtureRow
  fixtures: FixtureRow[]
  idx: number
  narrowViewport: boolean
  showBadgeColumn: boolean
  updateFixtureRow: (id: string, updates: Partial<FixtureRow>) => void
  removeFixtureRow: (id: string) => void
  moveFixtureRow: (id: string, direction: 'up' | 'down') => void
}

/**
 * A discount row in ① Line Items (v2.3252+, Mockup B): the same rhythm as a
 * work row — badge, name field, amount cell, trash — with one smart field
 * ("10%" is a percent, "500" is dollars), the other form beside it to tap-
 * swap, and a plain-English second line saying what it applies to and how
 * it bills. Renders `<tr>`s for the fixtures `<tbody>`; the invariants
 * (derived price, cap, count 1) are the kernel's job, run by the shell's
 * setter — this component only reads and asks for updates.
 */
export function JobFormDiscountRow({
  row,
  fixtures,
  idx,
  narrowViewport,
  showBadgeColumn,
  updateFixtureRow,
  removeFixtureRow,
  moveFixtureRow,
}: JobFormDiscountRowProps) {
  const nameFieldId = `job-fixture-name-${row.id}`
  const entryFieldId = `job-discount-entry-${row.id}`
  const locked = discountRowIsLocked(fixtures, row)
  const pctMode = row.discount_pct != null
  const dollars = derivedDiscountDollars(fixtures, row)
  const basisDollars = discountBasisDollars(fixtures, row)
  const overCap = discountExceedsBasis(fixtures, row)
  const readout = discountReadout(fixtures, row)
  const twin = discountTwinLabel(fixtures, row)
  const workRows = fixtures.filter((f) => !isDiscountRow(f) && workLineDollars(f) > 0)
  const basisRows = discountBasisRows(fixtures, row)
  const nameEmpty = !(row.name ?? '').trim()
  const [basisOpen, setBasisOpen] = useState(false)
  const showBasisPicker = workRows.length > 1 && !locked

  // The smart field keeps a local draft while focused so "10" → "10%" reads
  // naturally; when not focused it shows the canonical form for the mode.
  const canonical = pctMode ? formatPct(Number(row.discount_pct)).replace('%', '') : dollars > 0 ? formatCurrency(dollars) : ''
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(canonical)
  useEffect(() => {
    if (!focused) setDraft(canonical)
  }, [canonical, focused])

  const commit = (raw: string) => {
    const parsed = parseDiscountEntry(raw)
    if (!parsed) {
      updateFixtureRow(row.id, { discount_pct: null, line_unit_price: null })
      return
    }
    if (parsed.mode === 'pct') updateFixtureRow(row.id, { discount_pct: parsed.pct })
    else updateFixtureRow(row.id, { discount_pct: null, line_unit_price: parsed.dollars > 0 ? -parsed.dollars : null })
  }
  const swapMode = () => {
    if (locked) return
    if (pctMode) {
      updateFixtureRow(row.id, { discount_pct: null, line_unit_price: dollars > 0 ? -dollars : null })
    } else {
      const pct = basisDollars > 0 && dollars > 0 ? Math.round((dollars / basisDollars) * 10000) / 100 : 0
      updateFixtureRow(row.id, { discount_pct: pct })
    }
  }
  const toggleBasisRow = (id: string) => {
    const current = row.discount_basis_ids == null ? workRows.map((r) => r.id) : row.discount_basis_ids
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    const all = workRows.every((r) => next.includes(r.id))
    updateFixtureRow(row.id, { discount_basis_ids: all || next.length === 0 ? null : next })
  }

  const shares = discountSharesByWorkRow(fixtures)
  const billLine = discountBillDescription(row.name, row.discount_pct)
  const billShares = basisRows
    .map((r) => ({ name: (r.name ?? '').trim(), cents: (shares.get(r.id) ?? []).find((s) => s.discountId === row.id)?.cents ?? 0 }))
    .filter((s) => s.cents > 0)

  const entryField = (
      <span style={{ ...GROUP_STYLE, ...(locked ? { opacity: 0.75 } : {}) }}>
        <button
          type="button"
          onClick={swapMode}
          disabled={locked}
          title={pctMode ? 'Percent of the work — tap to enter dollars instead' : 'Dollars off — tap to enter a percent instead'}
          aria-label={pctMode ? 'Percent mode; switch to dollars' : 'Dollar mode; switch to percent'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 0.4rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: DISCOUNT_INK,
            background: DISCOUNT_WASH,
            border: 'none',
            borderRight: '1px solid var(--border)',
            cursor: locked ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {pctMode ? '%' : '$'}
        </button>
        <label htmlFor={entryFieldId} style={VISUALLY_HIDDEN}>
          Discount — type a percent like 10% or a dollar amount
        </label>
        <input
          id={entryFieldId}
          type="text"
          inputMode="decimal"
          value={focused ? draft : canonical}
          disabled={locked}
          placeholder="10% or 500"
          aria-label="Discount amount"
          onFocus={() => {
            setFocused(true)
            setDraft(canonical)
          }}
          onBlur={() => {
            setFocused(false)
            commit(draft)
          }}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9.,%$\-\s]/g, '')
            setDraft(next)
            commit(next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          style={{
            width: pctMode ? '3.4rem' : '5.4rem',
            boxSizing: 'border-box',
            padding: '0.375rem 0.5rem',
            border: 'none',
            borderRadius: 0,
            fontSize: '0.875rem',
            textAlign: 'right',
            background: 'transparent',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
      </span>
  )
  const twinButton = (
      <button
        type="button"
        onClick={swapMode}
        disabled={locked}
        title={pctMode ? 'The dollars this comes to — tap to enter dollars instead' : 'The percent this comes to — tap to enter a percent instead'}
        style={{
          ...GROUP_STYLE,
          borderStyle: 'dashed',
          padding: '0.3rem 0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: DISCOUNT_INK,
          background: 'transparent',
          cursor: locked ? 'default' : 'pointer',
          fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          ...(locked ? { opacity: 0.75 } : {}),
        }}
      >
        {twin}
      </button>
  )
  const entryGroup = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {entryField}
      {twinButton}
    </span>
  )

  const deleteButton =
    fixtures.length === 1 || locked ? null : (
      <button
        type="button"
        onClick={() => removeFixtureRow(row.id)}
        title="Remove"
        aria-label="Remove discount"
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
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
          <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
        </svg>
      </button>
    )

  const nameField = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
        <label htmlFor={nameFieldId} style={VISUALLY_HIDDEN}>
          Discount name
        </label>
        <AutosizeTextarea
          minRows={1}
          extraLines={0}
          id={nameFieldId}
          value={row.name}
          disabled={locked}
          onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
          onBlur={() => {
            const next = normalizeFixtureDisplayName(row.name ?? '')
            if (next !== row.name) updateFixtureRow(row.id, { name: next })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder="Discount — say why"
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
        {locked && (
          <span
            style={{
              alignSelf: 'center',
              margin: '0 0.4rem',
              padding: '0.1rem 0.4rem',
              borderRadius: 4,
              fontSize: '0.6875rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: 'var(--text-blue-800)',
              background: 'var(--bg-blue-200)',
            }}
          >
            On a bill · locked
          </span>
        )}
      </div>
      {nameEmpty && !locked && (
        <div data-testid="discount-reason-chips" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
          {DISCOUNT_REASON_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => updateFixtureRow(row.id, { name: discountNameForReason(p), discount_reason: p })}
              style={{
                border: '1px solid #a7dcc2',
                background: DISCOUNT_WASH,
                color: DISCOUNT_INK,
                borderRadius: 999,
                padding: '1px 9px',
                fontSize: '0.71875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const moveButtons =
    fixtures.length > 1 ? (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0, height: 34, alignSelf: 'flex-start' }}>
        <button
          type="button"
          onClick={() => moveFixtureRow(row.id, 'up')}
          disabled={idx === 0}
          title="Move up"
          aria-label="Move discount up"
          style={{ padding: '0 0.15rem', fontSize: '0.625rem', lineHeight: 1.2, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => moveFixtureRow(row.id, 'down')}
          disabled={idx === fixtures.length - 1}
          title="Move down"
          aria-label="Move discount down"
          style={{ padding: '0 0.15rem', fontSize: '0.625rem', lineHeight: 1.2, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: idx === fixtures.length - 1 ? 'default' : 'pointer', opacity: idx === fixtures.length - 1 ? 0.3 : 1 }}
        >
          ▼
        </button>
      </div>
    ) : null

  const secondLineIndent = `calc(0.75rem${showBadgeColumn ? ' + 34px' : ''}${fixtures.length > 1 ? ' + 22px' : ''})`

  return (
    <Fragment>
      <tr data-testid="discount-row" style={{ borderBottom: 'none' }}>
        <td colSpan={narrowViewport ? 3 : undefined} style={{ padding: '0.45rem 0.75rem', paddingBottom: '0.25rem', minWidth: 0, verticalAlign: 'top' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
            {showBadgeColumn && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 34, flexShrink: 0, alignSelf: 'flex-start' }}>
                <DiscountBadge />
              </div>
            )}
            {moveButtons}
            {nameField}
          </div>
          {narrowViewport && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: secondLineIndent, flexWrap: 'wrap' }}>
              {entryGroup}
              {deleteButton}
            </div>
          )}
        </td>
        {!narrowViewport && (
          <td colSpan={2} style={{ padding: '0.45rem 0.75rem 0.25rem 0', verticalAlign: 'top' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              {entryField}
              {deleteButton}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>{twinButton}</div>
          </td>
        )}
      </tr>
      <tr style={{ borderBottom: 'none' }}>
        <td colSpan={3} style={{ padding: `0 0.75rem 0.4rem ${secondLineIndent}`, verticalAlign: 'top' }}>
          {locked ? (
            <div data-testid="discount-readout" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Part of it is already on a bill — delete or send back that bill to change it. On a sent bill, use <strong>Add discount</strong> on the invoice (a write-down) instead.
            </div>
          ) : (
            <div data-testid="discount-readout" style={{ fontSize: '0.75rem', color: 'var(--text-700)', lineHeight: 1.5, display: 'flex', flexWrap: 'wrap', gap: '0 0.35rem', alignItems: 'baseline' }}>
              <strong>{readout.head}</strong>
              {showBasisPicker ? (
                <button
                  type="button"
                  onClick={() => setBasisOpen((v) => !v)}
                  aria-expanded={basisOpen}
                  style={{ padding: 0, background: 'transparent', border: 'none', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {readout.basis}
                </button>
              ) : (
                <span>{readout.basis}</span>
              )}
              <span style={{ color: 'var(--text-muted)' }}>· {readout.tail}</span>
            </div>
          )}
          {basisOpen && showBasisPicker && (
            <div data-testid="discount-basis-picker" style={{ marginTop: 4, padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Applies to</span>
              {workRows.map((r) => {
                const on = row.discount_basis_ids == null || row.discount_basis_ids.includes(r.id)
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleBasisRow(r.id)} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(r.name ?? '').trim()}</span>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(workLineDollars(r))}</span>
                  </label>
                )
              })}
            </div>
          )}
          {overCap && !locked && (
            <div
              data-testid="discount-cap"
              role="status"
              style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-amber-700)', background: 'var(--bg-amber-100)', border: '1px solid #f5d9a8', borderRadius: 6, padding: '3px 8px' }}
            >
              Can&apos;t exceed ${formatCurrency(basisDollars)} — the work it applies to. Kept at ${formatCurrency(basisDollars)}.
            </div>
          )}
          {dollars > 0 && billShares.length > 0 && !locked && (
            <div data-testid="discount-bill-line" style={{ marginTop: 3, fontSize: '0.75rem', color: DISCOUNT_INK, lineHeight: 1.5 }}>
              On the customer&apos;s bill: <em>{billLine}</em>{' '}
              {billShares.slice(0, 3).map((s, i) => (
                <span key={s.name + i}>
                  {i > 0 ? ', ' : ''}−${formatCurrency(s.cents / 100)} with {s.name}
                </span>
              ))}
              {billShares.length > 3 ? ', …' : ''}
            </div>
          )}
        </td>
      </tr>
    </Fragment>
  )
}
