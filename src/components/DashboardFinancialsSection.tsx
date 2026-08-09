import { Fragment, useState, type CSSProperties } from 'react'
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
import { useIsMobile } from '../hooks/useIsMobile'
import {
  filterFinanceItems,
  financeAgingBuckets,
  financeAgingDays,
  financeAgingTone,
  sortFinanceItems,
  type FinanceAgingTone,
  type FinanceDrillSort,
} from '../lib/dashboardFinanceModalRows'
import { googleDrivePreviewEmbedUrl } from '../lib/estimateCustomerAttachment'
import type { FinancialBucket, FinancialItem, UpcomingPayrollApSection } from '../lib/dashboardFinancials'
import type { DashboardApBill } from '../hooks/useDashboardFinancials'

type CardKey = 'ar' | 'ap' | 'unbilled'

const CARD_META: Record<CardKey, { title: string; hint: string; linkTo: string; linkLabel: string }> = {
  ar: {
    title: 'Accounts Receivable',
    hint: 'Open balances on billed invoices and billed jobs — money owed to us.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Pipeline',
  },
  ap: {
    title: 'Accounts Payable',
    hint: 'Unpaid supply-house invoices, sub labor, and all team labor owed — open pay reports plus estimated unreported weeks.',
    linkTo: '/materials?tab=supply-houses',
    linkLabel: 'Open Supply Houses',
  },
  unbilled: {
    title: 'Not Billed Out',
    hint: 'Working and Ready-to-Bill jobs whose revenue is not yet on a billed customer invoice.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Pipeline',
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

/** "2/26 (95d)" — month/day of the oldest item plus its age in days (date only when not past). */
function oldestShortWithAge(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  const days = daysPastDue(ymd, new Date().toLocaleDateString('en-CA'))
  return Number.isFinite(days) && days > 0 ? `${md} (${days}d)` : md
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
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
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
  /** AP only: estimated upcoming payroll — its own section after the due items; included in the footer total (the bucket merges it in). */
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
                // Merged-in upcoming items render in their own "(estimate)" section below.
                items: bucket.items.filter((i) => !i.key.startsWith('supply:') && !i.key.startsWith('upcoming:')),
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
              { title: 'Collections', items: arCollectionsSection.items, noun: 'bill' },
            ]
          : [{ title: null, items: bucket.items }]
  // Search + sort + aging state shared by the phone sheet and the desktop
  // table (v2.1483 / v2.1484). The AR column-header sort was replaced by the
  // Biggest/Oldest pills so all three drill-downs sort the same way.
  const isMobile = useIsMobile()
  const [drillQuery, setDrillQuery] = useState('')
  const [drillSort, setDrillSort] = useState<FinanceDrillSort>('amount')
  /** Desktop aging-strip filter: only rows in this aging bucket; null = all. */
  const [agingFilter, setAgingFilter] = useState<FinanceAgingTone | null>(null)
  // Unbilled/AR rows carry the Stages % complete — shown under the amount.
  const showPctComplete = cardKey === 'unbilled' || cardKey === 'ar'
  const columnCount = 3 + (onSendToDispatch ? 1 : 0)
  // Every titled section is collapsible (v2.1484 — previously AP + Collections only); expanded on open.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const toggleSection = (title: string) =>
    setCollapsedSections((prev) => ({ ...prev, [title]: !(prev[title] ?? false) }))
  const todayYmd = new Date().toLocaleDateString('en-CA')
  /** AP supply rows age by the bill's DUE date; everything else by the row date. */
  const itemDateYmd = (item: FinancialItem): string | null => apBills?.[item.key]?.dueDateYmd ?? item.dateYmd
  // AP's upcoming-payroll estimate joins as a real section so search / sort /
  // collapse / the aging strip treat it like the rest (it already counts into
  // the bucket total upstream).
  const drillSections: ModalSection[] = (() => {
    const base = [...sections]
    if (upcomingSection && upcomingSection.count > 0) {
      const upSec: ModalSection = { title: 'Upcoming payroll (estimate)', items: upcomingSection.items, noun: 'person-week' }
      const payrollIdx = base.findIndex((sec) => sec.title === 'Payroll due')
      if (payrollIdx >= 0) base.splice(payrollIdx + 1, 0, upSec)
      else base.push(upSec)
    }
    return base
  })()
  const q = drillQuery.trim()
  const bucketMatches = (item: FinancialItem) => {
    if (!agingFilter) return true
    const days = financeAgingDays(itemDateYmd(item), todayYmd)
    return days != null && financeAgingTone(days) === agingFilter
  }
  const shownSections = drillSections.map((sec) => ({
    ...sec,
    shown: sortFinanceItems(filterFinanceItems(sec.items, drillQuery).filter(bucketMatches), drillSort, itemDateYmd),
  }))
  const filtersActive = q !== '' || agingFilter != null
  const isCollapsed = (title: string | null) => title != null && !filtersActive && (collapsedSections[title] ?? false)
  const shownCount = shownSections.reduce((sum, sec) => sum + sec.shown.length, 0)
  const shownTotal = shownSections.reduce((sum, sec) => sum + sec.shown.reduce((t, i) => t + i.amount, 0), 0)
  const totalItemCount = drillSections.reduce((sum, sec) => sum + sec.items.length, 0)
  const agingBuckets = financeAgingBuckets(
    drillSections.flatMap((sec) => sec.items.map((i) => ({ amount: i.amount, ymd: itemDateYmd(i) }))),
    todayYmd,
  )
  const agingChip = (item: FinancialItem) => {
    const days = financeAgingDays(itemDateYmd(item), todayYmd)
    if (days == null) return null
    const tone = financeAgingTone(days)
    const bg = tone === 'late' ? 'var(--bg-red-100)' : tone === 'warn' ? 'var(--bg-orange-100)' : 'var(--bg-green-100)'
    const fg = tone === 'late' ? 'var(--text-red-800)' : tone === 'warn' ? 'var(--text-orange-800)' : 'var(--text-green-800)'
    return (
      <span
        title={`${days} day${days === 1 ? '' : 's'} since ${cardKey === 'ap' ? 'due date' : cardKey === 'ar' ? 'billing' : 'last work'}`}
        style={{ padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: bg, color: fg, whiteSpace: 'nowrap' }}
      >
        {days}d
      </span>
    )
  }
  const footerTotalLabel =
    upcomingSection && upcomingSection.count > 0
      ? 'Total (incl. estimate)'
      : sections.some((sec) => sec.title === 'Collections')
        ? 'Total (excl. Collections)'
        : 'Total'
  const pillStyle = (on: boolean): CSSProperties => ({
    padding: '0.4rem 0.7rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    border: on ? '1px solid var(--text-link)' : '1px solid var(--border-strong)',
    background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: on ? 'var(--text-link)' : 'var(--text-muted)',
  })

  if (isMobile) {
    // ── Mobile: full-height sheet with card rows (v2.1483) ──────────────
    // The desktop table overflowed sideways at phone widths (AR/Not Billed
    // hid the Amount column and the → action); cards keep name + money always
    // visible, aging becomes a color chip, and search/sort get thumb targets.
    // All list computations live in the shared block above (v2.1484).
    const visibleSections = shownSections
    const mobileIsCollapsed = isCollapsed
    return (
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 1100 }}
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
            borderRadius: '14px 14px 0 0',
            width: '100%',
            height: '92dvh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
          }}
        >
          <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '8px auto 2px', flexShrink: 0 }} />
          <div style={{ padding: '0.35rem 1rem 0.6rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 id="dashboard-financials-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
                {meta.title}
              </h3>
              <Link to={meta.linkTo} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
                {meta.linkLabel} →
              </Link>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close"
                style={{ width: 36, height: 36, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
              >
                ×
              </button>
            </div>
            <div style={{ marginTop: '0.1rem' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(bucket.total)}</span>{' '}
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
                · {bucket.count} item{bucket.count === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              type="search"
              value={drillQuery}
              onChange={(e) => setDrillQuery(e.target.value)}
              placeholder={`Search ${bucket.count} items…`}
              aria-label="Search items"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.45rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                color: 'inherit',
                font: 'inherit',
                fontSize: '0.875rem',
              }}
            />
            <button type="button" aria-pressed={drillSort === 'amount'} onClick={() => setDrillSort('amount')} style={pillStyle(drillSort === 'amount')}>
              Biggest
            </button>
            <button type="button" aria-pressed={drillSort === 'oldest'} onClick={() => setDrillSort('oldest')} style={pillStyle(drillSort === 'oldest')}>
              Oldest
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {q !== '' && shownCount === 0 ? (
              <p style={{ padding: '1.25rem 1rem', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
                Nothing matches “{q}”.
              </p>
            ) : (
              visibleSections.map((sec) => {
                if (q !== '' && sec.shown.length === 0) return null
                const collapsed = mobileIsCollapsed(sec.title)
                return (
                  <Fragment key={sec.title ?? 'all'}>
                    {sec.title ? (
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.title!)}
                        aria-expanded={!collapsed}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          width: '100%',
                          padding: '0.5rem 1rem',
                          background: 'var(--bg-muted)',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          font: 'inherit',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span aria-hidden style={{ width: '0.9em', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {collapsed ? '▶' : '▼'}
                        </span>
                        {sec.title}
                        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {sec.items.length} {sec.noun ?? 'item'}
                          {sec.items.length === 1 ? '' : 's'} · ${formatCurrency(sec.items.reduce((s, i) => s + i.amount, 0))}
                        </span>
                      </button>
                    ) : null}
                    {(collapsed ? [] : sec.shown).map((item) => {
                      const openJob = item.jobId && onOpenJob ? () => onOpenJob(item) : null
                      const openBill = !openJob && onOpenApBill && item.key.startsWith('supply:') ? () => onOpenApBill(item) : null
                      const onTap = openJob ?? openBill
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {onTap ? (
                              <button
                                type="button"
                                onClick={onTap}
                                title={openJob ? 'Open this job' : 'Open this bill'}
                                aria-label={openJob ? `Open job ${item.label}` : `Open bill from ${item.label}`}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  margin: 0,
                                  font: 'inherit',
                                  fontWeight: 600,
                                  fontSize: '0.9375rem',
                                  color: 'var(--text-link)',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                }}
                              >
                                {item.label}
                              </button>
                            ) : (
                              <div style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.sublabel && !sec.hideSublabels ? (
                                <span style={{ padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--bg-subtle)', whiteSpace: 'nowrap', maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.sublabel}
                                </span>
                              ) : null}
                              <span style={{ whiteSpace: 'nowrap' }}>{shortDate(apBills?.[item.key]?.dueDateYmd ?? item.dateYmd)}</span>
                              {agingChip(item)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>${formatCurrency(item.amount)}</div>
                            {showPctComplete && item.pctComplete != null ? (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{item.pctComplete}% done</div>
                            ) : null}
                          </div>
                          {onSendToDispatch && item.jobId ? (
                            <button
                              type="button"
                              onClick={() => onSendToDispatch(item)}
                              title="Send a note about billing this job to the Task Dispatch inbox"
                              aria-label={`Send ${item.label} to Dispatch`}
                              style={{
                                width: 40,
                                height: 40,
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'var(--surface)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 10,
                                cursor: 'pointer',
                                fontSize: '1rem',
                                color: 'var(--text-link)',
                              }}
                            >
                              →
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })
            )}
          </div>
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
            {q !== '' ? (
              <span style={{ color: 'var(--text-muted)' }}>
                Showing {shownCount} of {totalItemCount} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(shownTotal)}</span>
              </span>
            ) : (
              <span style={{ fontWeight: 600 }}>{footerTotalLabel}</span>
            )}
            {q === '' ? (
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(bucket.total)}</span>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop: widened dialog, pinned header/controls/footer, aging strip (v2.1484) ──
  const agingStripMeta: Array<{ tone: FinanceAgingTone; label: string }> = [
    { tone: 'ok', label: '0–14d' },
    { tone: 'warn', label: '15–30d' },
    { tone: 'late', label: '30d+' },
  ]
  const toneColors = (tone: FinanceAgingTone, on: boolean): CSSProperties => {
    const bg = tone === 'late' ? 'var(--bg-red-100)' : tone === 'warn' ? 'var(--bg-orange-100)' : 'var(--bg-green-100)'
    const fg = tone === 'late' ? 'var(--text-red-800)' : tone === 'warn' ? 'var(--text-orange-800)' : 'var(--text-green-800)'
    return {
      padding: '0.3rem 0.6rem',
      borderRadius: 999,
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      fontVariantNumeric: 'tabular-nums',
      border: on ? `1px solid ${'currentColor'}` : '1px solid transparent',
      background: bg,
      color: fg,
      opacity: agingFilter != null && !on ? 0.45 : 1,
    }
  }
  const thStyle: CSSProperties = {
    padding: '0.5rem 0.65rem',
    textAlign: 'left',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'var(--bg-subtle)',
    borderBottom: '1px solid var(--border)',
  }
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
          maxWidth: 'min(880px, 94vw)',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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
              style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', color: 'inherit' }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{meta.hint}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            <input
              type="search"
              value={drillQuery}
              onChange={(e) => setDrillQuery(e.target.value)}
              placeholder={`Search ${bucket.count} items…`}
              aria-label="Search items"
              style={{
                flex: '1 1 12rem',
                minWidth: '9rem',
                maxWidth: '20rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                color: 'inherit',
                font: 'inherit',
                fontSize: '0.875rem',
              }}
            />
            <button type="button" aria-pressed={drillSort === 'amount'} onClick={() => setDrillSort('amount')} style={pillStyle(drillSort === 'amount')}>
              Biggest
            </button>
            <button type="button" aria-pressed={drillSort === 'oldest'} onClick={() => setDrillSort('oldest')} style={pillStyle(drillSort === 'oldest')}>
              Oldest
            </button>
            <span aria-hidden style={{ width: 1, height: '1.25rem', background: 'var(--border)', margin: '0 0.2rem' }} />
            {/* Aging strip: how much money sits in each age band; click to filter. */}
            {agingStripMeta.map(({ tone, label }) => {
              const b = agingBuckets[tone]
              const on = agingFilter === tone
              return (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={on}
                  disabled={b.count === 0}
                  onClick={() => setAgingFilter((prev) => (prev === tone ? null : tone))}
                  title={`${b.count} item${b.count === 1 ? '' : 's'} aged ${label} — click to ${on ? 'clear the filter' : 'show only these'}`}
                  style={{ ...toneColors(tone, on), ...(b.count === 0 ? { opacity: 0.3, cursor: 'default' } : null) }}
                >
                  {label} ${formatMoneyShortK(b.total)}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>{cardKey === 'ap' ? 'Due' : 'Date'}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                {onSendToDispatch ? <th style={{ ...thStyle, padding: '0.5rem 0.35rem', width: '1%' }} aria-label="Send to Dispatch" /> : null}
              </tr>
            </thead>
            <tbody>
              {filtersActive && shownCount === 0 ? (
                <tr>
                  <td colSpan={columnCount} style={{ padding: '1.25rem 0.65rem', textAlign: 'center', color: 'var(--text-faint)' }}>
                    Nothing matches{q !== '' ? ` \u201c${q}\u201d` : ' this age band'}.
                  </td>
                </tr>
              ) : (
                shownSections.map((section) => {
                  if (filtersActive && section.shown.length === 0) return null
                  const collapsed = isCollapsed(section.title)
                  return (
                    <Fragment key={section.title ?? 'all'}>
                      {section.title ? (
                        <tr
                          style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => toggleSection(section.title!)}
                          aria-expanded={!collapsed}
                        >
                          <td colSpan={columnCount} style={{ padding: '0.45rem 0.65rem' }}>
                            <span aria-hidden style={{ display: 'inline-block', width: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {collapsed ? '\u25B6' : '\u25BC'}
                            </span>
                            {STAGES_SECTION_LINKS[section.title] ? (
                              <Link
                                to={STAGES_SECTION_LINKS[section.title]!}
                                title={`Open Jobs Pipeline at ${section.title}`}
                                onClick={(e) => e.stopPropagation()}
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
                              {formatCurrency(section.items.reduce((sum, i) => sum + i.amount, 0))}
                            </span>
                          </td>
                        </tr>
                      ) : null}
                      {(collapsed ? [] : section.shown).map((item: FinancialItem) => (
                        <tr key={item.key} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
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
                          <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                            {shortDate(itemDateYmd(item))}
                            <span style={{ marginLeft: '0.35rem' }}>{agingChip(item)}</span>
                          </td>
                          <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ${formatCurrency(item.amount)}
                            {showPctComplete && item.pctComplete != null ? (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{item.pctComplete}% done</div>
                            ) : null}
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
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 1.25rem', borderTop: '2px solid var(--border)', fontSize: '0.875rem' }}>
          {filtersActive ? (
            <span style={{ color: 'var(--text-muted)' }}>
              Showing {shownCount} of {totalItemCount} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(shownTotal)}</span>
            </span>
          ) : (
            <span style={{ fontWeight: 600 }}>{footerTotalLabel}</span>
          )}
          {!filtersActive ? (
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(bucket.total)}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Dashboard "Financials" one-pager: AR / AP / Not billed cards with drill-down modals. */
export default function DashboardFinancialsSection() {
  const { role } = useAuth()
  const { data, loading, error } = useDashboardFinancials(true, undefined, role)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [dispatchItem, setDispatchItem] = useState<FinancialItem | null>(null)
  const [apBill, setApBill] = useState<DashboardApBill | null>(null)
  const jobDetailModal = useJobDetailModal()

  // extraLines render as a second column beside the total (not a run-on subtitle line).
  // itemNoun names the bucket's rows in the uniform "N <noun>s, oldest: M/D (Xd)" footer.
  const cards: Array<{ key: CardKey; bucket: FinancialBucket; extraLines?: string[]; itemNoun: string }> = data
    ? [
        {
          key: 'ar',
          bucket: data.ar,
          itemNoun: 'invoice',
          // One line (matches the AP card's "Label: $value" form) so it reads the same
          // beside the total and when it wraps under the invoice-count footer.
          extraLines:
            data.arCollections.count > 0
              ? [
                  `Collections: $${roundDollars(data.arCollections.total)} (${data.arCollections.count} bill${data.arCollections.count === 1 ? '' : 's'})`,
                ]
              : undefined,
        },
        {
          key: 'ap',
          bucket: data.ap,
          itemNoun: 'bill',
          // Whole dollars: these are glance figures; the drill-down modal has cents.
          // Team = payroll due + estimated upcoming ("$due+upcoming") on one line.
          extraLines: [
            `Supply Houses: $${roundDollars(data.ap.supplyTotal)}`,
            `Sub Labor: $${roundDollars(data.ap.subLaborTotal)}`,
            `Team: $${roundDollars(data.ap.payrollTotal)}${
              data.apUpcoming.count > 0 ? `+${roundDollars(data.apUpcoming.total)}` : ''
            }`,
          ],
        },
        { key: 'unbilled', bucket: data.unbilled, itemNoun: 'job' },
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
          {cards.map(({ key, bucket, extraLines, itemNoun }) => (
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
                // Top-aligned so all three card titles read on one line even when the
                // grid stretches shorter cards to the tallest card's height (alignContent
                // covers the wrapped two-row case at narrow widths).
                alignItems: 'flex-start',
                alignContent: 'flex-start',
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
                  {`${bucket.count} ${itemNoun}${bucket.count === 1 ? '' : 's'}${
                    bucket.oldestDateYmd ? `, oldest: ${oldestShortWithAge(bucket.oldestDateYmd)}` : ''
                  }`}
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
