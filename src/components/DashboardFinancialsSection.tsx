import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
import { formatMoneyShortK } from '../lib/formatMoneyShortK'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { buildUnbilledDispatchTitle, createDispatchRequest } from '../lib/dispatchRequestHelpers'
import { redactApPayrollItems, redactUpcomingApSection } from '../lib/dashboardFinancials'
import { daysPastDue } from '../lib/supplyHouseAging'
import { googleDrivePreviewEmbedUrl } from '../lib/estimateCustomerAttachment'
import type { FinancialBucket, FinancialItem, UpcomingPayrollApSection } from '../lib/dashboardFinancials'
import type { DashboardApBill } from '../hooks/useDashboardFinancials'

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

/** Deep links consumed by Jobs.tsx's ?stagesSection= handler (opens + scrolls to the section). */
const STAGES_SECTION_LINKS: Record<string, string> = {
  'Ready to Bill': '/jobs?tab=stages&stagesSection=readyToBill',
  Working: '/jobs?tab=stages&stagesSection=working',
  Collections: '/jobs?tab=stages&stagesSection=collections',
}

/** Whole-dollar display for card glance figures, e.g. 56186.78 → "56,187". */
function roundDollars(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function shortDate(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

/** "58 days ago" style age for a card's oldest item; falls back to the short date for today/future. */
function daysAgoLabel(ymd: string): string {
  const days = daysPastDue(ymd, new Date().toLocaleDateString('en-CA'))
  if (!Number.isFinite(days) || days <= 0) return shortDate(ymd)
  return days === 1 ? '1 day ago' : `${days.toLocaleString('en-US')} days ago`
}

/** AP bill detail — invoice facts plus an expandable Google Drive preview of the attached file. */
function ApBillModal({
  bill,
  onClose,
  onOpenJob,
}: {
  bill: DashboardApBill
  onClose: () => void
  /** Opens the Job Detail modal for an allocated job (parent closes the stacked modals first). */
  onOpenJob: ((jobId: string, label: string) => void) | null
}) {
  const [expanded, setExpanded] = useState(false)
  const embedUrl = bill.link ? googleDrivePreviewEmbedUrl(bill.link) : null
  const pastDue = bill.dueDateYmd ? daysPastDue(bill.dueDateYmd, new Date().toLocaleDateString('en-CA')) : null

  const factRow = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
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
        aria-labelledby="dashboard-financials-bill-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: expanded ? 'min(1100px, 96vw)' : 'min(520px, 96vw)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 id="dashboard-financials-bill-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1 }}>
            {bill.houseName} — ${formatCurrency(bill.amount)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1.25rem', overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {factRow('Invoice #', bill.invoiceNumber || '—')}
          {factRow('Purchase Order #', bill.purchaseOrderNumber ?? '—')}
          {factRow('Invoice date', shortDate(bill.invoiceDateYmd))}
          {factRow(
            'Due date',
            <>
              {shortDate(bill.dueDateYmd)}
              {pastDue !== null && pastDue > 0 ? (
                <span
                  style={{
                    marginLeft: '0.4rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 999,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    background: pastDue >= 60 ? 'var(--bg-red-100)' : 'var(--bg-orange-100)',
                    color: pastDue >= 60 ? 'var(--text-red-800)' : 'var(--text-orange-800)',
                  }}
                >
                  {pastDue}d past due
                </span>
              ) : null}
            </>,
          )}
          {factRow('Amount', <strong>${formatCurrency(bill.amount)}</strong>)}
          {factRow(
            bill.jobs.length === 1 ? 'Job' : 'Jobs',
            bill.jobs.length === 0 ? (
              <span style={{ color: 'var(--text-faint)' }}>—</span>
            ) : (
              <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                {bill.jobs.map((j) => (
                  <span key={j.jobId} style={{ whiteSpace: 'nowrap' }}>
                    {onOpenJob ? (
                      <button
                        type="button"
                        onClick={() => onOpenJob(j.jobId, j.label)}
                        title="Open this job"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          font: 'inherit',
                          color: 'var(--text-link)',
                          textDecoration: 'underline dotted',
                          textUnderlineOffset: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        {j.label}
                      </button>
                    ) : (
                      j.label
                    )}
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}> ({j.pct}%)</span>
                  </span>
                ))}
              </span>
            ),
          )}
          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Attached file</span>
              {embedUrl ? (
                <button
                  type="button"
                  onClick={() => setExpanded((x) => !x)}
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  {expanded ? 'Shrink' : 'Expand'}
                </button>
              ) : null}
              {bill.link ? (
                <a href={bill.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-link)', marginLeft: 'auto' }}>
                  Open in Drive ↗
                </a>
              ) : null}
            </div>
            {embedUrl ? (
              <div
                role="presentation"
                onClick={() => {
                  if (!expanded) setExpanded(true)
                }}
                title={expanded ? undefined : 'Click to expand'}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: expanded ? undefined : 'zoom-in',
                  position: 'relative',
                }}
              >
                <iframe
                  src={embedUrl}
                  title={`Attachment for invoice ${bill.invoiceNumber}`}
                  style={{ display: 'block', width: '100%', height: expanded ? '68vh' : 300, border: 'none', pointerEvents: expanded ? undefined : 'none' }}
                  allow="autoplay"
                />
              </div>
            ) : bill.link ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Preview not available for this link — use "Open in Drive ↗".
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No file attached to this bill.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
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
          background: 'var(--surface)',
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
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
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
            border: '1px solid var(--border-strong)',
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
            style={{ padding: '0.45rem 0.85rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: busy ? 'default' : 'pointer', fontSize: '0.875rem' }}
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
  upcomingSection,
  onOpenApBill,
  apBills,
  arCollectionsSection,
}: {
  cardKey: CardKey
  bucket: FinancialBucket
  onClose: () => void
  /** Job rows (AR / Not billed) open the Job Detail modal; closes this modal first (it stacks lower). */
  onOpenJob: ((item: FinancialItem) => void) | null
  /** Not-billed rows only: "→" opens the send-to-Dispatch composer. */
  onSendToDispatch: ((item: FinancialItem) => void) | null
  /** AP only: estimated upcoming payroll — listed after the due items, excluded from the footer total. */
  upcomingSection: UpcomingPayrollApSection | null
  /** AP supply rows: opens the bill detail modal (invoice facts + attachment preview). */
  onOpenApBill: ((item: FinancialItem) => void) | null
  /** AP only: per-bill detail (due date, job allocations) keyed by item key — enriches the rows. */
  apBills: Record<string, DashboardApBill> | null
  /** AR only: parked difficult-to-collect receivables — listed after the main rows, excluded from the headline total. */
  arCollectionsSection: FinancialBucket | null
}) {
  const meta = CARD_META[cardKey]
  // Grouped views (items keep their amount-desc order within each section):
  // - Not billed: Ready to Bill on top (closest to money), Working below.
  // - AP: Payroll due, then Upcoming payroll (estimate), then Supplies — payroll reads first and
  //   the ~130 supply rows sit last. All three AP sections are collapsible.
  type ModalSection = { title: string | null; items: FinancialItem[]; hideSublabels?: boolean; noun?: string }
  const sections: ModalSection[] =
    cardKey === 'unbilled'
      ? (['Ready to Bill', 'Working'] as const)
          .map((title) => ({
            title,
            items: bucket.items.filter((i) => i.sublabel === title),
            hideSublabels: true,
            noun: 'job',
          }))
          .filter((s) => s.items.length > 0)
      : cardKey === 'ap'
        ? (
            [
              {
                title: 'Payroll due',
                items: bucket.items.filter((i) => !i.key.startsWith('supply:')),
                hideSublabels: false,
                noun: 'item',
              },
              {
                title: 'Supplies',
                items: bucket.items.filter((i) => i.key.startsWith('supply:')),
                hideSublabels: true,
                noun: 'bill',
              },
            ] as ModalSection[]
          ).filter((s) => s.items.length > 0)
        : cardKey === 'ar' && arCollectionsSection && arCollectionsSection.count > 0
          ? [
              { title: null, items: bucket.items },
              // Parked receivables — its own collapsible section, outside the headline total.
              { title: 'Collections', items: arCollectionsSection.items, noun: 'item' },
            ]
          : [{ title: null, items: bucket.items }]
  // AR: sortable by date or amount via the column headers; null = incoming order (amount desc).
  const [arSort, setArSort] = useState<{ key: 'date' | 'amount'; dir: 'asc' | 'desc' } | null>(null)
  const sortedSections =
    cardKey === 'ar' && arSort
      ? sections.map((sec) => ({
          ...sec,
          items: [...sec.items].sort((a, b) => {
            const dir = arSort.dir === 'asc' ? 1 : -1
            if (arSort.key === 'amount') return (a.amount - b.amount) * dir
            // Missing dates always sort last regardless of direction.
            if (!a.dateYmd && !b.dateYmd) return 0
            if (!a.dateYmd) return 1
            if (!b.dateYmd) return -1
            return a.dateYmd.localeCompare(b.dateYmd) * dir
          }),
        }))
      : sections
  const toggleArSort = (key: 'date' | 'amount') =>
    setArSort((prev) => ({ key, dir: prev?.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }))
  const arSortIndicator = (key: 'date' | 'amount') =>
    arSort?.key === key ? (arSort.dir === 'desc' ? ' ▼' : ' ▲') : ''
  // Unbilled rows carry the Stages % complete (jobs_ledger.pct_complete) — its own column.
  const showPctComplete = cardKey === 'unbilled'
  const columnCount = 3 + (showPctComplete ? 1 : 0) + (onSendToDispatch ? 1 : 0)
  // AP sections (Payroll due / Upcoming payroll / Supplies) and the AR Collections section are
  // collapsible; expanded on open.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const collapsible = cardKey === 'ap' || sections.some((s) => s.title === 'Collections')
  const isCollapsed = (title: string) => collapsible && (collapsedSections[title] ?? false)
  const toggleSection = (title: string) =>
    setCollapsedSections((prev) => ({ ...prev, [title]: !(prev[title] ?? false) }))
  const sectionChevron = (title: string) => (
    <span aria-hidden style={{ display: 'inline-block', width: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
      {isCollapsed(title) ? '▶' : '▼'}
    </span>
  )
  /** AP: estimated upcoming payroll rows — rendered between Payroll due and Supplies. */
  const upcomingPayrollRows = upcomingSection && upcomingSection.count > 0 ? (
                <Fragment>
                  <tr
                    style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', cursor: collapsible ? 'pointer' : undefined }}
                    onClick={collapsible ? () => toggleSection('Upcoming payroll (estimate)') : undefined}
                    aria-expanded={collapsible ? !isCollapsed('Upcoming payroll (estimate)') : undefined}
                  >
                    <td colSpan={columnCount} style={{ padding: '0.45rem 0.65rem' }}>
                      {collapsible ? sectionChevron('Upcoming payroll (estimate)') : null}
                      <span style={{ fontWeight: 600 }}>Upcoming payroll (estimate)</span>
                      <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
                        {upcomingSection.count} person-week{upcomingSection.count === 1 ? '' : 's'} · $
                        {formatCurrency(upcomingSection.total)}
                      </span>
                    </td>
                  </tr>
                  {(isCollapsed('Upcoming payroll (estimate)') ? [] : upcomingSection.items).map((item) => (
                    <tr key={item.key} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                      <td style={{ padding: '0.45rem 0.65rem' }}>
                        {item.label}
                        {item.sublabel ? (
                          <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}> · {item.sublabel}</span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>{shortDate(item.dateYmd)}</td>
                      <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        ${formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ) : null
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
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 id="dashboard-financials-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, minWidth: 200 }}>
              {meta.title} — ${formatCurrency(bucket.total)}{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                ({bucket.count} item{bucket.count === 1 ? '' : 's'})
              </span>
            </h3>
            <Link to={meta.linkTo} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
              {meta.linkLabel} →
            </Link>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{meta.hint}</p>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Item</th>
                {showPctComplete ? (
                  <th
                    title="% complete from Jobs → Stages"
                    style={{ padding: '0.5rem 0.65rem', textAlign: 'center', whiteSpace: 'nowrap' }}
                  >
                    % Complete
                  </th>
                ) : null}
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>
                  {cardKey === 'ar' ? (
                    <button
                      type="button"
                      onClick={() => toggleArSort('date')}
                      title="Sort by date"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 'inherit', cursor: 'pointer' }}
                    >
                      Date{arSortIndicator('date')}
                    </button>
                  ) : cardKey === 'ap' ? (
                    'Due'
                  ) : (
                    'Date'
                  )}
                </th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>
                  {cardKey === 'ar' ? (
                    <button
                      type="button"
                      onClick={() => toggleArSort('amount')}
                      title="Sort by amount"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 'inherit', cursor: 'pointer' }}
                    >
                      Amount{arSortIndicator('amount')}
                    </button>
                  ) : (
                    'Amount'
                  )}
                </th>
                {onSendToDispatch ? <th style={{ padding: '0.5rem 0.35rem', width: '1%' }} aria-label="Send to Dispatch" /> : null}
              </tr>
            </thead>
            <tbody>
              {sortedSections.map((section) => (
                <Fragment key={section.title ?? 'all'}>
                  {section.title ? (
                    <tr
                      style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', cursor: collapsible ? 'pointer' : undefined }}
                      onClick={collapsible ? () => toggleSection(section.title!) : undefined}
                      aria-expanded={collapsible ? !isCollapsed(section.title) : undefined}
                    >
                      <td colSpan={columnCount} style={{ padding: '0.45rem 0.65rem' }}>
                        {collapsible ? sectionChevron(section.title) : null}
                        {STAGES_SECTION_LINKS[section.title] ? (
                          <Link
                            to={STAGES_SECTION_LINKS[section.title]!}
                            title={`Open Jobs Stages at ${section.title}`}
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-blue-700)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px',
                            }}
                          >
                            {section.title}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{section.title}</span>
                        )}
                        <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
                          {section.items.length} {section.noun ?? 'item'}
                          {section.items.length === 1 ? '' : 's'} · $
                          {formatCurrency(section.items.reduce((s, i) => s + i.amount, 0))}
                        </span>
                      </td>
                    </tr>
                  ) : null}
                  {(section.title && isCollapsed(section.title) ? [] : section.items).map((item: FinancialItem) => (
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
                          color: 'var(--text-link)',
                          textDecoration: 'underline dotted',
                          textUnderlineOffset: '2px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {item.label}
                      </button>
                    ) : onOpenApBill && item.key.startsWith('supply:') ? (
                      <button
                        type="button"
                        onClick={() => onOpenApBill(item)}
                        title="Open this bill"
                        aria-label={`Open bill from ${item.label}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          font: 'inherit',
                          color: 'var(--text-link)',
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
                    {item.sublabel && !section.hideSublabels ? (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}> · {item.sublabel}</span>
                    ) : null}
                    {item.address ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>{item.address}</div>
                    ) : null}
                    {(() => {
                      const bill = apBills?.[item.key]
                      if (!bill || bill.jobs.length === 0) return null
                      return (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                          {bill.jobs.map((j) => `${j.label} (${j.pct}%)`).join(', ')}
                        </div>
                      )
                    })()}
                  </td>
                  {showPctComplete ? (
                    <td
                      style={{
                        padding: '0.45rem 0.65rem',
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        color: item.pctComplete != null ? undefined : 'var(--text-faint)',
                      }}
                    >
                      {item.pctComplete != null ? `${item.pctComplete}%` : '—'}
                    </td>
                  ) : null}
                  <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const bill = apBills?.[item.key]
                      if (!bill) {
                        // AR: age the billed date — "2/9/26 (+45)" = days since the bill went out.
                        if (cardKey === 'ar' && item.dateYmd) {
                          const age = daysPastDue(item.dateYmd, new Date().toLocaleDateString('en-CA'))
                          return (
                            <>
                              {shortDate(item.dateYmd)}
                              {age !== null && age > 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}> (+{age})</span>
                              ) : null}
                            </>
                          )
                        }
                        return shortDate(item.dateYmd)
                      }
                      const days = bill.dueDateYmd
                        ? daysPastDue(bill.dueDateYmd, new Date().toLocaleDateString('en-CA'))
                        : null
                      return (
                        <>
                          {shortDate(bill.dueDateYmd)}
                          {days !== null && days > 0 ? (
                            <span
                              style={{
                                marginLeft: '0.35rem',
                                padding: '0.05rem 0.35rem',
                                borderRadius: 999,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: days >= 60 ? 'var(--bg-red-100)' : 'var(--bg-orange-100)',
                                color: days >= 60 ? 'var(--text-red-800)' : 'var(--text-orange-800)',
                              }}
                            >
                              {days}d
                            </span>
                          ) : null}
                        </>
                      )
                    })()}
                  </td>
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
                            background: 'var(--surface)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: 'var(--text-link)',
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
                  {section.title === 'Payroll due' ? upcomingPayrollRows : null}
                </Fragment>
              ))}
              {sortedSections.some((sec) => sec.title === 'Payroll due') ? null : upcomingPayrollRows}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td style={{ padding: '0.5rem 0.65rem' }} colSpan={showPctComplete ? 3 : 2}>
                  {upcomingSection && upcomingSection.count > 0
                    ? 'Total due'
                    : sections.some((s) => s.title === 'Collections')
                      ? 'Total (excl. Collections)'
                      : 'Total'}
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
  const { role } = useAuth()
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [dispatchItem, setDispatchItem] = useState<FinancialItem | null>(null)
  const [apBill, setApBill] = useState<DashboardApBill | null>(null)
  const jobDetailModal = useJobDetailModal()

  // extraLines render as a second column beside the total (not a run-on subtitle line).
  const cards: Array<{ key: CardKey; bucket: FinancialBucket; extraLines?: string[]; oldestAsDaysAgo?: boolean }> = data
    ? [
        {
          key: 'ar',
          bucket: data.ar,
          extraLines:
            data.arCollections.count > 0
              ? [
                  'Collections:',
                  `$${roundDollars(data.arCollections.total)} (${data.arCollections.count} item${data.arCollections.count === 1 ? '' : 's'})`,
                ]
              : undefined,
        },
        {
          key: 'ap',
          bucket: data.ap,
          // Whole dollars: these are glance figures; the drill-down modal has cents.
          extraLines: [
            `Supply Houses: $${roundDollars(data.ap.supplyTotal)}`,
            `Payroll: $${roundDollars(data.ap.payrollTotal)} due`,
            ...(data.apUpcoming.count > 0 ? [`($${roundDollars(data.apUpcoming.total)} upcoming)`] : []),
          ],
        },
        { key: 'unbilled', bucket: data.unbilled, oldestAsDaysAgo: true },
      ]
    : []

  return (
    <div style={{ margin: '0 0 0.5rem' }}>
      {error ? (
        <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p>
      ) : loading || !data ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {cards.map(({ key, bucket, extraLines, oldestAsDaysAgo }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpenCard(key)}
              title={`${CARD_META[key].hint} Click for the item list.`}
              style={{
                textAlign: 'left',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                columnGap: '0.75rem',
                rowGap: '0.25rem',
                // Buttons don't inherit text color; without this the unstyled
                // amount renders UA-black on the dark surface.
                color: 'inherit',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>{CARD_META[key].title}</span>
                <span
                  title={`$${formatCurrency(bucket.total)}`}
                  style={{ fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatMoneyShortK(bucket.total)}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  {bucket.count} item{bucket.count === 1 ? '' : 's'}
                  {bucket.oldestDateYmd
                    ? ` · oldest ${oldestAsDaysAgo ? daysAgoLabel(bucket.oldestDateYmd) : shortDate(bucket.oldestDateYmd)}`
                    : ''}
                </span>
              </span>
              {extraLines && extraLines.length > 0 ? (
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {extraLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {openCard && data ? (
        <ItemsModal
          cardKey={openCard}
          // Assistants see the payroll total but not per-person amounts (matches the
          // canAccessPay gate that hides the People → Payroll tab from them).
          bucket={openCard === 'ap' && role === 'assistant' ? redactApPayrollItems(data.ap) : data[openCard]}
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
          upcomingSection={
            openCard === 'ap'
              ? role === 'assistant'
                ? redactUpcomingApSection(data.apUpcoming)
                : data.apUpcoming
              : null
          }
          onOpenApBill={
            openCard === 'ap'
              ? (item) => {
                  const bill = data.apBills[item.key]
                  if (bill) setApBill(bill)
                }
              : null
          }
          apBills={openCard === 'ap' ? data.apBills : null}
          arCollectionsSection={openCard === 'ar' ? data.arCollections : null}
        />
      ) : null}
      {apBill ? (
        <ApBillModal
          bill={apBill}
          onClose={() => setApBill(null)}
          onOpenJob={
            jobDetailModal
              ? (jobId, label) => {
                  // Job Detail backdrop (z 1004) sits below these modals — close both first.
                  setApBill(null)
                  setOpenCard(null)
                  jobDetailModal.openJobDetail({ jobId, prefillRowLabel: label })
                }
              : null
          }
        />
      ) : null}
      {dispatchItem ? <SendToDispatchModal item={dispatchItem} onClose={() => setDispatchItem(null)} /> : null}
    </div>
  )
}
