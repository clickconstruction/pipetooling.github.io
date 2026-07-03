import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { buildUnbilledDispatchTitle, createDispatchRequest } from '../lib/dispatchRequestHelpers'
import type { FinancialBucket, FinancialItem } from '../lib/dashboardFinancials'

type CardKey = 'ar' | 'ap' | 'unbilled'

const CARD_META: Record<CardKey, { title: string; hint: string; linkTo: string; linkLabel: string }> = {
  ar: {
    title: 'Accounts Receivable',
    hint: 'Open balances on billed invoices and billed jobs — money owed to us.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Stages',
  },
  ap: {
    title: 'Accounts Payable',
    hint: 'Unpaid supply-house invoices plus open payroll balances — money we owe.',
    linkTo: '/materials?tab=supply-houses',
    linkLabel: 'Open Supply Houses',
  },
  unbilled: {
    title: 'Not Billed Out',
    hint: 'Working and Ready-to-Bill jobs whose revenue is not yet on a billed customer invoice.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Stages',
  },
}

function shortDate(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

/** "Send to Dispatch" composer for a Not-billed row — stacks above the items modal. */
function SendToDispatchModal({ item, onClose }: { item: FinancialItem; onClose: () => void }) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!authUser?.id) {
      showToast('Sign in to send to Dispatch.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await createDispatchRequest({
        fromUserId: authUser.id,
        title: buildUnbilledDispatchTitle(item.label, item.amount, note),
        jobId: item.jobId,
        referenceSummary: item.label,
        pendingAction: 'bill_out_job',
      })
      if (result.outcome === 'duplicate') {
        showToast('Already open with Dispatch for this job.', 'info')
      } else {
        showToast('Sent to Dispatch.', 'success')
      }
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
      setBusy(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1110,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-financials-dispatch-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) onClose()
        }}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          padding: '1rem 1.25rem 1.25rem',
        }}
      >
        <h3 id="dashboard-financials-dispatch-title" style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600 }}>
          Send to Dispatch
        </h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          Not billed out: <strong>{item.label}</strong> — ${formatCurrency(item.amount)}
        </p>
        <label htmlFor="dashboard-financials-dispatch-note" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Note (optional)
        </label>
        <textarea
          id="dashboard-financials-dispatch-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
          disabled={busy}
          placeholder="Anything Dispatch should know…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            padding: '0.5rem 0.65rem',
            font: 'inherit',
            fontSize: '0.875rem',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{ padding: '0.45rem 0.85rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, cursor: busy ? 'default' : 'pointer', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            style={{
              padding: '0.45rem 0.85rem',
              background: busy ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {busy ? 'Sending…' : 'Send to Dispatch'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemsModal({
  cardKey,
  bucket,
  onClose,
  onOpenJob,
  onSendToDispatch,
}: {
  cardKey: CardKey
  bucket: FinancialBucket
  onClose: () => void
  /** Job rows (AR / Not billed) open the Job Detail modal; closes this modal first (it stacks lower). */
  onOpenJob: ((item: FinancialItem) => void) | null
  /** Not-billed rows only: "→" opens the send-to-Dispatch composer. */
  onSendToDispatch: ((item: FinancialItem) => void) | null
}) {
  const meta = CARD_META[cardKey]
  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-financials-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 id="dashboard-financials-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              {meta.title} — ${formatCurrency(bucket.total)}
            </h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              {bucket.count} item{bucket.count === 1 ? '' : 's'} · {meta.hint}
            </p>
          </div>
          <Link to={meta.linkTo} style={{ fontSize: '0.8125rem', color: '#2563eb', whiteSpace: 'nowrap' }}>
            {meta.linkLabel} →
          </Link>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Item</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Amount</th>
                {onSendToDispatch ? <th style={{ padding: '0.5rem 0.35rem', width: '1%' }} aria-label="Send to Dispatch" /> : null}
              </tr>
            </thead>
            <tbody>
              {bucket.items.map((item: FinancialItem) => (
                <tr key={item.key} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.45rem 0.65rem' }}>
                    {item.jobId && onOpenJob ? (
                      <button
                        type="button"
                        onClick={() => onOpenJob(item)}
                        title="Open this job"
                        aria-label={`Open job ${item.label}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          font: 'inherit',
                          color: '#2563eb',
                          textDecoration: 'underline dotted',
                          textUnderlineOffset: '2px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {item.label}
                      </button>
                    ) : (
                      item.label
                    )}
                    {item.sublabel ? (
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> · {item.sublabel}</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>{shortDate(item.dateYmd)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    ${formatCurrency(item.amount)}
                  </td>
                  {onSendToDispatch ? (
                    <td style={{ padding: '0.45rem 0.35rem', whiteSpace: 'nowrap' }}>
                      {item.jobId ? (
                        <button
                          type="button"
                          onClick={() => onSendToDispatch(item)}
                          title="Send a note about billing this job to the Task Dispatch inbox"
                          aria-label={`Send ${item.label} to Dispatch`}
                          style={{
                            padding: '0.15rem 0.5rem',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#2563eb',
                            lineHeight: 1.2,
                          }}
                        >
                          →
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                <td style={{ padding: '0.5rem 0.65rem' }} colSpan={2}>
                  Total
                </td>
                <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${formatCurrency(bucket.total)}
                </td>
                {onSendToDispatch ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Dashboard "Financials" one-pager: AR / AP / Not billed cards with drill-down modals. */
export default function DashboardFinancialsSection() {
  const { data, loading, error } = useDashboardFinancials(true)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [dispatchItem, setDispatchItem] = useState<FinancialItem | null>(null)
  const jobDetailModal = useJobDetailModal()

  const cards: Array<{ key: CardKey; bucket: FinancialBucket; extra?: string }> = data
    ? [
        { key: 'ar', bucket: data.ar },
        {
          key: 'ap',
          bucket: data.ap,
          extra: `Supplies $${formatCurrency(data.ap.supplyTotal)} · Payroll $${formatCurrency(data.ap.payrollTotal)}`,
        },
        { key: 'unbilled', bucket: data.unbilled },
      ]
    : []

  return (
    <div style={{ margin: '0 0 1.5rem' }}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Financials</h2>
      {error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>
      ) : loading || !data ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {cards.map(({ key, bucket, extra }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpenCard(key)}
              title={`${CARD_META[key].hint} Click for the item list.`}
              style={{
                textAlign: 'left',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280' }}>{CARD_META[key].title}</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                ${formatCurrency(bucket.total)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {bucket.count} item{bucket.count === 1 ? '' : 's'}
                {bucket.oldestDateYmd ? ` · oldest ${shortDate(bucket.oldestDateYmd)}` : ''}
              </span>
              {extra ? <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{extra}</span> : null}
            </button>
          ))}
        </div>
      )}
      {openCard && data ? (
        <ItemsModal
          cardKey={openCard}
          bucket={data[openCard]}
          onClose={() => setOpenCard(null)}
          onOpenJob={
            jobDetailModal
              ? (item) => {
                  // The Job Detail backdrop (z 1004) sits below this modal (z 1100) — close first.
                  setOpenCard(null)
                  jobDetailModal.openJobDetail({
                    jobId: item.jobId as string,
                    prefillRowLabel: item.label,
                  })
                }
              : null
          }
          onSendToDispatch={openCard === 'unbilled' ? (item) => setDispatchItem(item) : null}
        />
      ) : null}
      {dispatchItem ? <SendToDispatchModal item={dispatchItem} onClose={() => setDispatchItem(null)} /> : null}
    </div>
  )
}
