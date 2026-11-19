import { useEffect, useId, useState } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { DRAW_BILL_NONE_DETAIL, DRAW_BILL_NONE_LABEL, DRAW_BILL_NO_BILLS, DRAW_BILL_WINDOW_TITLE, drawBillWindowLead, type DrawBillOption } from '../../lib/subWorkOrders/drawTie'

/** The window's answer for "No bill": the sheet rides on nothing. */
const NONE = '__none__'

/**
 * Which bill does this sheet ride on? (v2.7835, punch list #388, step 1.) The office ties a sub's sheet to
 * one of the job's bills when it requests the draw, or changes the tie later from the sheet's row. A job
 * with one open bill never shows this window on the stage move: the database makes that tie by itself.
 * The window only gathers the pick; `useDrawBillPick` does the read and the save around it.
 */
export default function SubSheetDrawBillModal({
  subName,
  options,
  initial,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  subName: string
  options: DrawBillOption[]
  /** The row picked when the window opens: a bill's id, `null` for No bill, `undefined` for nothing yet. */
  initial: string | null | undefined
  /** The press names the act: "Request the draw" on the stage move, "Save the bill" on a change. */
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  /** A bill's id, or `null` for No bill. */
  onConfirm: (billId: string | null) => void
}) {
  const isTopmost = useModalStackEntry()
  const titleId = useId()
  const groupName = useId()
  const [picked, setPicked] = useState<string | null>(initial === undefined ? null : (initial ?? NONE))

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTopmost() && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTopmost, onCancel, busy])

  const dead = busy || picked == null
  const rows: Array<{ value: string; label: string; detail: string }> = [...options.map((o) => ({ value: o.id, label: o.label, detail: o.detail })), { value: NONE, label: DRAW_BILL_NONE_LABEL, detail: DRAW_BILL_NONE_DETAIL }]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="sub-sheet-draw-bill-modal"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem', boxSizing: 'border-box' }}
      onClick={(e) => {
        e.stopPropagation()
        if (!busy) onCancel()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, 100%)', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.05rem' }}>
          {DRAW_BILL_WINDOW_TITLE}
        </h2>
        <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{options.length === 0 ? DRAW_BILL_NO_BILLS : drawBillWindowLead(subName)}</p>

        <div role="radiogroup" aria-labelledby={titleId} style={{ display: 'grid', gap: 6 }}>
          {rows.map((r) => {
            const on = picked === r.value
            return (
              <label
                key={r.value}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.55rem 0.7rem', borderRadius: 8, border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'transparent', cursor: busy ? 'default' : 'pointer' }}
              >
                <input type="radio" name={groupName} value={r.value} checked={on} disabled={busy} onChange={() => setPicked(r.value)} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{r.label}</span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.detail}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: busy ? 'default' : 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (picked != null) onConfirm(picked === NONE ? null : picked)
            }}
            disabled={dead}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 6, cursor: dead ? 'default' : 'pointer' }}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
