import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
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
}

function shortDate(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
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
      <span style={{ color: '#6b7280' }}>{label}</span>
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
          background: 'white',
          borderRadius: 8,
          width: expanded ? 'min(1100px, 96vw)' : 'min(520px, 96vw)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 id="dashboard-financials-bill-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1 }}>
            {bill.houseName} — ${formatCurrency(bill.amount)}
          </h3>
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
                    background: pastDue >= 60 ? '#fee2e2' : '#ffedd5',
                    color: pastDue >= 60 ? '#991b1b' : '#9a3412',
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
              <span style={{ color: '#9ca3af' }}>—</span>
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
                          color: '#2563eb',
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
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> ({j.pct}%)</span>
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
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                >
                  {expanded ? 'Shrink' : 'Expand'}
                </button>
              ) : null}
              {bill.link ? (
                <a href={bill.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', marginLeft: 'auto' }}>
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
                  border: '1px solid #e5e7eb',
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
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                Preview not available for this link — use "Open in Drive ↗".
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>No file attached to this bill.</p>
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
  upcomingSection,
  onOpenApBill,
  apBills,
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
        : [{ title: null, items: bucket.items }]
  const columnCount = onSendToDispatch ? 4 : 3
  // AP sections (Payroll due / Upcoming payroll / Supplies) are collapsible; expanded on open.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const collapsible = cardKey === 'ap'
  const isCollapsed = (title: string) => collapsible && (collapsedSections[title] ?? false)
  const toggleSection = (title: string) =>
    setCollapsedSections((prev) => ({ ...prev, [title]: !(prev[title] ?? false) }))
  const sectionChevron = (title: string) => (
    <span aria-hidden style={{ display: 'inline-block', width: '1rem', fontSize: '0.7rem', color: '#6b7280' }}>
      {isCollapsed(title) ? '▶' : '▼'}
    </span>
  )
  /** AP: estimated upcoming payroll rows — rendered between Payroll due and Supplies. */
  const upcomingPayrollRows = upcomingSection && upcomingSection.count > 0 ? (
                <Fragment>
                  <tr
                    style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', cursor: collapsible ? 'pointer' : undefined }}
                    onClick={collapsible ? () => toggleSection('Upcoming payroll (estimate)') : undefined}
                    aria-expanded={collapsible ? !isCollapsed('Upcoming payroll (estimate)') : undefined}
                  >
                    <td colSpan={columnCount} style={{ padding: '0.45rem 0.65rem' }}>
                      {collapsible ? sectionChevron('Upcoming payroll (estimate)') : null}
                      <span style={{ fontWeight: 600 }}>Upcoming payroll (estimate)</span>
                      <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
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
                          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> · {item.sublabel}</span>
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
          background: 'white',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 id="dashboard-financials-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, minWidth: 200 }}>
              {meta.title} — ${formatCurrency(bucket.total)}{' '}
              <span style={{ fontWeight: 400, color: '#6b7280' }}>
                ({bucket.count} item{bucket.count === 1 ? '' : 's'})
              </span>
            </h3>
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
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>{meta.hint}</p>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Item</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>{cardKey === 'ap' ? 'Due' : 'Date'}</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Amount</th>
                {onSendToDispatch ? <th style={{ padding: '0.5rem 0.35rem', width: '1%' }} aria-label="Send to Dispatch" /> : null}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.title ?? 'all'}>
                  {section.title ? (
                    <tr
                      style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', cursor: collapsible ? 'pointer' : undefined }}
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
                              color: '#1d4ed8',
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px',
                            }}
                          >
                            {section.title}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{section.title}</span>
                        )}
                        <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
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
                          color: '#2563eb',
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
                    {item.sublabel && !section.hideSublabels ? (
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> · {item.sublabel}</span>
                    ) : null}
                    {item.address ? (
                      <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: 2 }}>{item.address}</div>
                    ) : null}
                    {(() => {
                      const bill = apBills?.[item.key]
                      if (!bill || bill.jobs.length === 0) return null
                      return (
                        <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: 2 }}>
                          {bill.jobs.map((j) => `${j.label} (${j.pct}%)`).join(', ')}
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const bill = apBills?.[item.key]
                      if (!bill) return shortDate(item.dateYmd)
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
                                background: days >= 60 ? '#fee2e2' : '#ffedd5',
                                color: days >= 60 ? '#991b1b' : '#9a3412',
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
                  {section.title === 'Payroll due' ? upcomingPayrollRows : null}
                </Fragment>
              ))}
              {sections.some((sec) => sec.title === 'Payroll due') ? null : upcomingPayrollRows}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                <td style={{ padding: '0.5rem 0.65rem' }} colSpan={2}>
                  {upcomingSection && upcomingSection.count > 0 ? 'Total due' : 'Total'}
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

  const cards: Array<{ key: CardKey; bucket: FinancialBucket; extra?: string }> = data
    ? [
        { key: 'ar', bucket: data.ar },
        {
          key: 'ap',
          bucket: data.ap,
          extra:
            `Supplies $${formatCurrency(data.ap.supplyTotal)} · Payroll: $${formatCurrency(data.ap.payrollTotal)} due` +
            (data.apUpcoming.count > 0 ? ` / $${formatCurrency(data.apUpcoming.total)} upcoming` : ''),
        },
        { key: 'unbilled', bucket: data.unbilled },
      ]
    : []

  return (
    <div style={{ margin: '0 0 0.5rem' }}>
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
