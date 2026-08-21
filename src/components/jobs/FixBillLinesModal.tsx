import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { FixBillLineItem } from '../../lib/jobs/fixBillLines'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * "Fix bill lines in one sitting" (the customer-classifier pattern): every
 * Billed no-bill-line shell listed biggest-first, each with a bill-out date
 * input and a Create button. create_billed_shell_invoice materializes the
 * missing line for the full open remainder, backdated to the supplied date,
 * so the row immediately joins aging, chasing, and the payment forecast.
 */

type RowState = { ymd: string; saving: boolean; done: boolean; error: string | null }

export default function FixBillLinesModal({
  items,
  onClose,
  onAnyFixed,
}: {
  items: FixBillLineItem[]
  onClose: () => void
  /** Fired once on close when at least one line was created (board refetch). */
  onAnyFixed: () => void
}) {
  const { showToast } = useToastContext()
  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const stateFor = (jobId: string): RowState => rowState[jobId] ?? { ymd: todayYmd, saving: false, done: false, error: null }
  const patch = (jobId: string, p: Partial<RowState>) =>
    setRowState((s) => ({ ...s, [jobId]: { ...(s[jobId] ?? { ymd: todayYmd, saving: false, done: false, error: null }), ...p } }))
  const fixedCount = items.filter((i) => rowState[i.jobId]?.done).length

  const createLine = async (item: FixBillLineItem) => {
    const st = stateFor(item.jobId)
    if (!st.ymd) {
      patch(item.jobId, { error: 'Pick the date this bill actually went out' })
      return
    }
    patch(item.jobId, { saving: true, error: null })
    try {
      const { error } = await supabase.rpc('create_billed_shell_invoice' as never, {
        p_job_id: item.jobId,
        p_billed_on: st.ymd,
      } as never)
      if (error) throw error
      patch(item.jobId, { saving: false, done: true })
    } catch (e) {
      patch(item.jobId, { saving: false, error: formatErrorMessage(e, 'Could not create the bill line') })
    }
  }

  const close = () => {
    if (fixedCount > 0) {
      showToast(`${fixedCount} bill line${fixedCount === 1 ? '' : 's'} created.`, 'success')
      onAnyFixed()
    }
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fix bill lines"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(760px, calc(100vw - 2rem))', maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Fix bill lines</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          These billed jobs have open money on no bill line, so it can't age, be chased, or be forecast. Set the date
          each bill actually went out and create its line — the full open amount, backdated, joins the aging machinery
          immediately. Biggest dollars first.
        </p>
        {items.map((item) => {
          const st = stateFor(item.jobId)
          return (
            <div
              key={item.jobId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', opacity: st.done ? 0.6 : 1 }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                {item.customerName ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> · {item.customerName}</span> : null}
                {st.error ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{st.error}</div> : null}
              </div>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>{formatUsdNoCents(item.open)}</span>
              {st.done ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-green-600)', fontWeight: 600 }}>✓ Line created</span>
              ) : (
                <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={st.ymd}
                    max={todayYmd}
                    onChange={(e) => patch(item.jobId, { ymd: e.target.value, error: null })}
                    aria-label={`Bill-out date for ${item.label}`}
                    style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={() => void createLine(item)}
                    disabled={st.saving}
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: st.saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {st.saving ? '…' : 'Create line'}
                  </button>
                </span>
              )}
            </div>
          )
        })}
        <p style={{ margin: '0.85rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status">
          {fixedCount} of {items.length} fixed
          {items.length === 0 ? ' — nothing needs a bill line 🎉' : ''}
        </p>
      </div>
    </div>
  )
}
