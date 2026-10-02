/**
 * Check 20 prices (v2.4392): the window What your materials cost opens. It lists the parts you
 * spend most on, oldest check first. Each line takes today's price, or Same when it has not
 * changed. The writes are passed in (`lib/materials/priceCheckIo.ts`), so the window only draws
 * and reports. It tells the card whether anything was written when it closes.
 */
import { useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { isBigJump, parsePriceInput, type CheckItem } from '../../lib/materials/materialPriceIndex'
import type { PriceCheckResult } from '../../lib/materials/priceCheckIo'
import { formatCurrency } from '../../lib/format'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

type RowState =
  | { kind: 'open'; draft: string; message?: string }
  | { kind: 'saving'; draft: string }
  | { kind: 'same' }
  | { kind: 'saved'; price: number }

const btn: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 }
const pct = (share: number) => `${Math.round(share * 100)}%`

export function CheckPricesWindow({
  items,
  onConfirm,
  onSave,
  onClose,
}: {
  items: CheckItem[]
  onConfirm: (priceId: string) => Promise<PriceCheckResult>
  onSave: (priceId: string, price: number) => Promise<PriceCheckResult>
  /** `changed`: at least one price was confirmed or saved. */
  onClose: (changed: boolean) => void
}) {
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const rowOf = (id: string): RowState => rows[id] ?? { kind: 'open', draft: '' }
  const setRow = (id: string, next: RowState) => setRows((prev) => ({ ...prev, [id]: next }))
  const done = items.filter((i) => ['same', 'saved'].includes(rowOf(i.priceId).kind))
  const changed = done.length > 0
  const close = () => onClose(changed)

  async function act(item: CheckItem) {
    const row = rowOf(item.priceId)
    if (row.kind !== 'open') return
    const typed = row.draft.trim()
    const price = typed ? parsePriceInput(typed) : null
    if (typed && price == null) return
    setRow(item.priceId, { kind: 'saving', draft: row.draft })
    const result = price == null ? await onConfirm(item.priceId) : await onSave(item.priceId, price)
    if (result.ok) setRow(item.priceId, price == null ? { kind: 'same' } : { kind: 'saved', price })
    else setRow(item.priceId, { kind: 'open', draft: row.draft, message: `Couldn’t save: ${result.message}` })
  }

  return (
    <ResponsiveModalShell
      title={`Check ${items.length} prices`}
      onRequestClose={close}
      maxWidthDesktop={620}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A new price changes the book from today. A bid keeps the prices it already has.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" style={btn} onClick={close}>Finish later</button>
            <button type="button" style={btnPrimary} onClick={close}>Done</button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>These are the parts you spend most on, oldest price first. Type today’s price, or press Same if it has not changed.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <strong>{done.length} of {items.length} checked</strong>
            <span style={{ color: 'var(--text-muted)' }}>{pct(done.reduce((s, i) => s + i.spendShare, 0))} of your bid spend</span>
          </div>
          <div role="progressbar" aria-label="Prices checked" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done.length} style={{ height: 8, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: 8, width: `${items.length ? (done.length / items.length) * 100 : 0}%`, background: '#15803d' }} />
          </div>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => {
            const row = rowOf(item.priceId)
            const draft = row.kind === 'open' || row.kind === 'saving' ? row.draft : ''
            const typed = draft.trim()
            const price = typed ? parsePriceInput(typed) : null
            const bad = typed !== '' && price == null
            const change = price != null ? price / item.price - 1 : null
            const big = price != null && isBigJump(item.price, price)
            return (
              <li key={item.priceId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.7rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.partName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.houseName} · ${formatCurrency(item.price)} · {item.lastCheckedDay ? `last checked ${formatWorkDateYmdMonthDayShort(item.lastCheckedDay)}` : 'no check on record'}
                  </div>
                </div>
                {row.kind === 'same' ? (
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-700)' }}>✓ Same as before</span>
                ) : row.kind === 'saved' ? (
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-700)' }}>✓ Saved at ${formatCurrency(row.price)}</span>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Today’s $"
                      aria-label={`Today’s price for ${item.partName}`}
                      value={draft}
                      disabled={row.kind === 'saving'}
                      onChange={(e) => setRow(item.priceId, { kind: 'open', draft: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void act(item)
                      }}
                      style={{ width: '7.5rem', minHeight: 44, boxSizing: 'border-box', padding: '0 0.6rem', fontSize: 16, border: `1px solid ${bad ? 'var(--border-red)' : 'var(--border-strong)'}`, borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
                    />
                    <button type="button" style={typed ? btnPrimary : btn} disabled={row.kind === 'saving' || bad} onClick={() => void act(item)}>
                      {row.kind === 'saving' ? 'Saving…' : typed ? 'Save' : 'Same'}
                    </button>
                  </div>
                )}
                {row.kind === 'open' && (bad || change != null || row.message) ? (
                  <div style={{ flex: '1 1 100%', fontSize: '0.75rem' }}>
                    {bad ? <span style={{ color: 'var(--text-red-700)' }}>Type a price like 12.50.</span> : null}
                    {change != null && !big ? (
                      <span style={{ color: change > 0 ? 'var(--text-orange-700)' : change < 0 ? 'var(--text-blue-700)' : 'var(--text-muted)' }}>
                        {change === 0 ? 'The same as the book.' : `${change > 0 ? 'Up' : 'Down'} ${(Math.abs(change) * 100).toFixed(1)}% from $${formatCurrency(item.price)}.`}
                      </span>
                    ) : null}
                    {big ? <span style={{ color: 'var(--text-amber-800)' }}>That is a big change from ${formatCurrency(item.price)}. Check the size and the pack before you save.</span> : null}
                    {row.message ? <span style={{ color: 'var(--text-red-700)', display: 'block' }}>{row.message}</span> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </ResponsiveModalShell>
  )
}
