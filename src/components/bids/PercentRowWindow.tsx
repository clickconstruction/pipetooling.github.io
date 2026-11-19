/**
 * Bids → Pricing: the Percent row window. A row priced as a percent of other rows, such as
 * Connections at 40% of what the pipe rows sell for. One window for both doors: **＋ Percent row**
 * by the grid, and the calculator's **Make a new row…** / **Put on a row…**, which open it filled
 * from the tape.
 *
 * Its top is the row as the grid will show it, drawn live from what is typed: the name, the kind,
 * the rule's chip, the price, and the bid's revenue before and after. The press names what it
 * will do with its number. The window draws and reports: every number is `percentWindowPreview`
 * in `lib/bids/percentRow.ts`, and the write is `usePercentRows`.
 */
import { useEffect, useRef, useState } from 'react'

import type { PercentWindowFrom } from '../../hooks/usePercentRows'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatCurrency } from '../../lib/format'
import { percentSourceOptions, percentWindowPreview, type PercentGridRow, type PercentWindowPreview, type PercentWindowValue } from '../../lib/bids/percentRow'
import { ROW_KINDS, ROW_KIND_WORDS, type RowKind } from '../../lib/bids/rowKinds'

const NO_COST = 'no cost'
const DASH = '—'

const label = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: '0.25rem' } as const
const field = { font: 'inherit', fontSize: '0.95rem', color: 'var(--text-strong)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0 0.7rem', height: 44, boxSizing: 'border-box' } as const
const word = { fontSize: '0.95rem', color: 'var(--text-strong)', paddingBottom: '0.7rem' } as const
const th = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'right' } as const
const td = { padding: '0.4rem 0.7rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const

/** The rule's chip, as the grid draws it on the row. */
export function PercentRuleChipMark({ words, muted }: { words: string; muted?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: muted ? 'var(--text-700)' : 'var(--text-blue-700)', background: 'var(--surface)', border: `1.5px solid ${muted ? 'var(--border-strong)' : '#2563eb'}`, borderRadius: 6, padding: '0.1rem 0.5rem', whiteSpace: 'nowrap' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </svg>
      {words}
    </span>
  )
}

export function PercentRowWindow({
  rows,
  self: openedOn,
  start,
  from,
  sent,
  narrow,
  busy,
  onClose,
  onSubmit,
}: {
  /** The grid's rows over saved prices. */
  rows: ReadonlyArray<PercentGridRow>
  /** The row the window was opened on; null from ＋ Percent row, where a typed name already on the bid picks its row. */
  self: PercentGridRow | null
  /** What the window opens on (`percentWindowStart`). */
  start: PercentWindowValue
  /** A calculator answer the window was sent; null from ＋ Percent row. */
  from: PercentWindowFrom | null
  /** The bid is sent: a price is set once and does not follow. */
  sent: boolean
  narrow: boolean
  /** The press is writing: the window holds still. */
  busy: boolean
  onClose: () => void
  onSubmit: (value: PercentWindowValue, preview: PercentWindowPreview) => void
}) {
  const [value, setValue] = useState<PercentWindowValue>(start)
  const patch = (p: Partial<PercentWindowValue>) => setValue((v) => ({ ...v, ...p }))
  // The cursor starts in the first box still to fill: the percent when the name is in, as on a first use.
  const pctRef = useRef<HTMLInputElement | null>(null)
  const startInPercent = start.pct.trim() === '' && (openedOn != null || start.name.trim() !== '')
  useEffect(() => {
    if (!startInPercent) return
    const id = window.setTimeout(() => pctRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [startInPercent])
  const preview = percentWindowPreview({ rows, self: openedOn, value, fixedRevenue: from?.revenue ?? null })
  const self = preview.target
  const options = percentSourceOptions(rows, self?.id ?? null)
  const picked = options.find((o) => o.key === value.sourceKey) ?? null
  const dead = preview.hold != null || busy
  const submit = () => {
    if (!dead) onSubmit(value, preview)
  }
  const answer = preview.answer
  const money = (n: number | null | undefined) => (n == null ? DASH : `$${formatCurrency(n)}`)
  const rowName = self?.name || value.name.trim() || 'the row'
  const margin = self && self.cost > 0 && answer && answer.revenue > 0 ? `${Math.round(((answer.revenue - self.cost) / answer.revenue) * 100)}%` : NO_COST
  const kindControl = self ? (
    <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 0.5rem', background: 'var(--surface)' }}>{ROW_KIND_WORDS[self.kind]}</span>
  ) : (
    <select
      aria-label="The new row’s kind"
      value={value.kind}
      onChange={(e) => patch({ kind: e.target.value as RowKind })}
      style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.05rem 0.35rem', background: 'var(--surface)', minHeight: narrow ? 32 : undefined }}
    >
      {ROW_KINDS.map((k) => (
        <option key={k} value={k}>
          {ROW_KIND_WORDS[k]}
        </option>
      ))}
    </select>
  )
  // The rule's chip once there is a rule to keep; a typed price with Keep following off; a dash until a percent is in.
  const entryCell = preview.chip ? (
    <PercentRuleChipMark words={preview.chip} />
  ) : value.follow ? (
    <span style={{ color: 'var(--text-muted)' }}>{DASH}</span>
  ) : (
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.12rem 0.55rem' }}>a typed price</span>
  )
  const revenueLine = (
    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
      Bid revenue {money(preview.bidRevenueBefore)} → <strong style={{ color: 'var(--text-strong)' }}>{money(preview.bidRevenueAfter)}</strong>
    </span>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: narrow ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1100, paddingTop: 'var(--app-top-chrome, 0px)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-label="Percent row"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) {
            e.stopPropagation()
            onClose()
          }
        }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: narrow ? '14px 14px 0 0' : 12, padding: narrow ? '1rem' : '1.3rem 1.5rem 1.2rem', width: narrow ? '100%' : 'min(860px, 94vw)', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.12rem' }}>Percent row</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>A row priced as a percent of other rows.</p>
          </div>
          {from ? (
            <span data-testid="percent-row-from-tape" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid #d97706', borderRadius: 999, padding: '0.15rem 0.7rem', fontVariantNumeric: 'tabular-nums' }}>
              From the tape: {from.words}
            </span>
          ) : null}
        </div>

        <div data-testid="percent-row-preview" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{self ? 'The row, as Pricing will show it' : 'The new row, as Pricing will show it'}</span>
            {narrow ? null : revenueLine}
          </div>
          {narrow ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)', padding: '0.7rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.98rem' }}>{rowName}</strong>
                {kindControl}
              </div>
              <div>{entryCell}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-700)' }}>
                  Count {self ? self.count : 1} · {margin}
                </span>
                <strong style={{ fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>{money(answer?.revenue)}</strong>
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={{ ...th, textAlign: 'left' }}>Fixture or tie-in</th>
                    <th style={th}>Count</th>
                    <th style={{ ...th, textAlign: 'left' }}>Book entry</th>
                    <th style={th}>Sale price/unit</th>
                    <th style={th}>Revenue</th>
                    <th style={th}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--bg-blue-tint)' }}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{rowName}</div>
                      {kindControl}
                    </td>
                    <td style={td}>{self ? self.count : 1}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{entryCell}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-strong)' }}>{money(answer?.unitPrice)}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text-strong)' }}>{money(answer?.revenue)}</td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text-muted)' }}>{margin}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {narrow ? revenueLine : null}
        </div>

        {openedOn ? null : (
          <div>
            <label style={label} htmlFor="percent-row-name">
              Name
            </label>
            <input id="percent-row-name" autoFocus={value.name.trim() === ''} value={value.name} onChange={(e) => patch({ name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} style={{ ...field, width: '100%' }} />
            {self ? (
              <p role="status" style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-700)' }}>
                {self.name} is already a row on this bid, so this sets its price.
              </p>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={word}>is</span>
          <div>
            <label style={label} htmlFor="percent-row-pct">
              Percent
            </label>
            <input
              id="percent-row-pct"
              ref={pctRef}
              inputMode="decimal"
              value={value.pct}
              onChange={(e) => patch({ pct: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              style={{ ...field, width: 76, textAlign: 'right' }}
            />
          </div>
          <span style={word}>% of the</span>
          <div role="group" aria-label="Which number of those rows">
            <span style={label}>Their</span>
            <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', height: 44 }}>
              {(['revenue', 'cost'] as const).map((b) => {
                const on = value.basis === b
                const amount = picked ? (b === 'revenue' ? picked.revenue : picked.cost) : null
                const none = amount === 0 && b === 'cost'
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    disabled={none && !on}
                    title={none ? 'These rows carry no takeoff cost yet' : undefined}
                    onClick={() => patch({ basis: b })}
                    style={{ font: 'inherit', fontSize: '0.9rem', border: 'none', padding: '0 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: none && !on ? 'default' : 'pointer', fontWeight: on ? 700 : 400, color: on ? 'var(--text-blue-700)' : none ? DEAD_PRESS_TEXT : 'var(--text-700)', background: on ? 'var(--bg-blue-tint)' : none ? DEAD_PRESS_FILL : 'var(--surface)', boxShadow: on ? 'inset 0 0 0 2px #2563eb' : undefined }}
                  >
                    {b === 'revenue' ? 'Revenue' : 'Cost'}
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: none ? 400 : 700 }}>{amount == null ? '' : none ? 'none yet' : `$${formatCurrency(amount)}`}</span>
                  </button>
                )
              })}
            </span>
          </div>
          <span style={word}>of</span>
          <div style={{ flex: narrow ? '1 1 100%' : undefined }}>
            <label style={label} htmlFor="percent-row-source">
              Rows
            </label>
            <select id="percent-row-source" value={value.sourceKey} onChange={(e) => patch({ sourceKey: e.target.value })} style={{ ...field, minWidth: 190, width: narrow ? '100%' : undefined }}>
              {picked ? null : <option value="">Pick the rows…</option>}
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.9rem', color: 'var(--text-strong)', minHeight: narrow ? 44 : undefined }}>
          <input type="checkbox" checked={value.follow} onChange={(e) => patch({ follow: e.target.checked })} style={{ width: 18, height: 18, margin: 0, accentColor: '#2563eb' }} />
          {sent ? 'Keep the rule on the row. This bid is sent, so its price is set once.' : 'Keep following these rows until the bid is sent'}
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {preview.hold ? (
            <span role="status" style={{ fontSize: '0.82rem', color: 'var(--text-700)', marginRight: 'auto' }}>
              {preview.hold}
            </span>
          ) : null}
          <button type="button" onClick={onClose} disabled={busy} style={{ font: 'inherit', fontSize: '0.92rem', fontWeight: 600, height: 44, padding: '0 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={dead}
            title={preview.hold ?? undefined}
            style={{ font: 'inherit', fontSize: '0.92rem', fontWeight: 700, height: 44, padding: '0 1.1rem', borderRadius: 8, border: 'none', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }}
          >
            {busy ? 'Saving…' : preview.label}
          </button>
        </div>
      </div>
    </div>
  )
}
