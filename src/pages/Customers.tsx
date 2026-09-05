import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import CustomerPortalGlobeButton from '../components/customers/CustomerPortalGlobeButton'
import { NO_CUSTOMER_TYPE_LABEL } from '../constants/customerTypeLabels'
import { supabase } from '../lib/supabase'
import { appliedByInvoiceId, openBillRowsForJob } from '../lib/billing/billTruth'
import { legacyListOpenBalance, reportBillTruthShadow } from '../lib/billing/billTruthShadow'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { formatErrorMessage } from '../utils/errorHandling'
import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { CustomerNotesTable } from '../components/customerNotes/CustomerNotesTable'
import { isCustomerArchived, partitionCustomersByArchived } from '../lib/customerArchive'
import type { Database } from '../types/database'
import type { Json } from '../types/database'
import { findSimilarCustomerGroups } from '../lib/customerSimilarity'
import BackfillHcpPaymentsModal from '../components/customers/BackfillHcpPaymentsModal'
import ClassifyCustomersModal from '../components/customers/ClassifyCustomersModal'
import LinkJobsToCustomersModal from '../components/customers/LinkJobsToCustomersModal'
import {
  customersListRollup,
  type CustomerListRollup,
  type LcvInvoiceRow,
  type LcvJobRow,
  type LcvPaymentRow,
} from '../lib/customers/customersListLcv'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerWithMaster = Customer & {
  master_user: { id: string; name: string | null; email: string | null } | null
}
type BidRow = Database['public']['Tables']['bids']['Row']

function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

/** Signal-chip style for the row's right side (list redesign PR 1). */
function signalChipStyle(variant: 'blue' | 'amber' | 'red' | 'gray'): CSSProperties {
  const colors: Record<'blue' | 'amber' | 'red' | 'gray', { bg: string; fg: string }> = {
    blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' },
    amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
    red: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
    gray: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    padding: '0 8px',
    borderRadius: 9999,
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    background: colors[variant].bg,
    color: colors[variant].fg,
    border: 'none',
    cursor: 'pointer',
  }
}

/** Money rail (v2.1791): paid · billed · unbilled triplet over a proportion bar. */
function CustomerMoneyRail({ rollup }: { rollup: CustomerListRollup | undefined }) {
  const paid = rollup?.lifetimePaid ?? 0
  const billed = rollup?.lcv ?? 0
  const unbilled = rollup?.unbilled ?? 0
  const capStyle: CSSProperties = {
    fontSize: '0.56rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
  }
  const dotStyle = (bg: string, faded?: boolean): CSSProperties => ({
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: 9999,
    marginRight: 3,
    verticalAlign: 1,
    background: bg,
    opacity: faded ? 0.55 : 1,
  })
  const valStyle = (color: string, zero: boolean): CSSProperties => ({
    fontVariantNumeric: 'tabular-nums',
    fontWeight: zero ? 500 : 700,
    fontSize: '0.85rem',
    color: zero ? 'var(--text-faint)' : color,
  })
  const cell: CSSProperties = { width: 86, textAlign: 'right' }
  const fmt = (n: number) => (n > 0.5 ? `$${Math.round(n).toLocaleString('en-US')}` : '—')
  const barTotal = billed + unbilled
  const paidSeg = Math.min(paid, billed)
  const owedSeg = Math.max(0, billed - paid)
  return (
    <span
      title="Lifetime money with this customer — paid (collected), billed (everything ever invoiced), unbilled (work on the books not yet invoiced)"
      style={{ display: 'inline-flex', flexDirection: 'column', flexShrink: 0 }}
    >
      <span style={{ display: 'flex' }}>
        <span style={cell}>
          <span style={capStyle}>
            <span aria-hidden style={dotStyle('var(--text-green-600)')} />
            paid
          </span>
          <span style={{ display: 'block', ...valStyle('var(--text-green-600)', paid <= 0.5) }}>{fmt(paid)}</span>
        </span>
        <span style={cell}>
          <span style={capStyle}>
            <span aria-hidden style={dotStyle('#d97706')} />
            billed
          </span>
          <span style={{ display: 'block', ...valStyle('var(--text-strong)', billed <= 0.5) }}>{fmt(billed)}</span>
        </span>
        <span style={cell}>
          <span style={capStyle}>
            <span aria-hidden style={dotStyle('var(--text-link)', true)} />
            unbilled
          </span>
          <span style={{ display: 'block', ...valStyle('var(--text-link)', unbilled <= 0.5) }}>{fmt(unbilled)}</span>
        </span>
      </span>
      {barTotal > 0.5 ? (
        <span aria-hidden style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-muted)', marginTop: 4 }}>
          <span style={{ width: `${(paidSeg / barTotal) * 100}%`, background: 'var(--text-green-600)' }} />
          <span style={{ width: `${(owedSeg / barTotal) * 100}%`, background: '#d97706' }} />
          <span style={{ width: `${(unbilled / barTotal) * 100}%`, background: 'var(--text-link)', opacity: 0.45 }} />
        </span>
      ) : null}
    </span>
  )
}

const QUIET_AFTER_DAYS = 90

function lastActivityLabel(iso: string | null, kind: 'job' | 'payment' | null): { text: string; quiet: boolean } | null {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return null
  const ageDays = (Date.now() - d.getTime()) / 86_400_000
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  const quiet = ageDays > QUIET_AFTER_DAYS
  return { text: quiet ? `quiet since ${when}` : `${kind === 'payment' ? 'payment' : 'job'} · ${when}`, quiet }
}

type CustomerTypeFilter = 'all' | 'commercial' | 'residential' | 'commercial_default'

function parseCustomerTypeFilter(raw: string | null): CustomerTypeFilter {
  if (raw === 'commercial' || raw === 'residential' || raw === 'commercial_default') return raw
  return 'all'
}

function isCustomerCommercialDefaultType(c: Customer): boolean {
  const t = c.customer_type
  if (t == null) return true
  return typeof t === 'string' && t.trim() === ''
}

function customerTypeTagLabel(c: Customer): string {
  if (isCustomerCommercialDefaultType(c)) return NO_CUSTOMER_TYPE_LABEL
  const t = c.customer_type
  if (t === 'residential') return 'Residential'
  if (t === 'commercial') return 'Commercial'
  if (typeof t === 'string' && t.length > 0) return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  return 'Other'
}

export default function Customers() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const newCustomerModal = useNewCustomerModal()
  const editCustomerModal = useEditCustomerModal()
  const [customers, setCustomers] = useState<CustomerWithMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingBidsForCustomer, setViewingBidsForCustomer] = useState<string | null>(null)
  const [bidsForCustomer, setBidsForCustomer] = useState<BidRow[]>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const [countsByCustomerId, setCountsByCustomerId] = useState<
    Record<string, { projects: number; jobs: number; bids: number; notes: number }>
  >({})
  const [rollupByCustomerId, setRollupByCustomerId] = useState<Record<string, CustomerListRollup>>({})
  /** Latest bid/estimate created_at per customer — the non-job half of the "active" signal. */
  const [recentSignalByCustomerId, setRecentSignalByCustomerId] = useState<Record<string, string>>({})
  const [expandedNotesCustomerId, setExpandedNotesCustomerId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  /** "Show similar" mode: cluster likely duplicates (shared name/address/phone/email) for quick merging. */
  const [showSimilar, setShowSimilar] = useState(false)
  const [classifyOpen, setClassifyOpen] = useState(false)
  const [linkJobsOpen, setLinkJobsOpen] = useState(false)
  const [unlinkedJobsCount, setUnlinkedJobsCount] = useState<number | null>(null)
  const [unrecordedPaidCount, setUnrecordedPaidCount] = useState<number | null>(null)
  const [backfillOpen, setBackfillOpen] = useState(false)

  async function refreshNoteCountsForCustomers(ids: string[]) {
    if (ids.length === 0) return
    const { data, error: err } = await supabase.from('customer_contacts').select('customer_id').in('customer_id', ids)
    if (err) {
      setError(err.message)
      return
    }
    const nextNotes: Record<string, number> = {}
    for (const id of ids) nextNotes[id] = 0
    for (const r of data ?? []) {
      const cid = r.customer_id
      if (cid != null && cid in nextNotes) {
        nextNotes[cid] = (nextNotes[cid] ?? 0) + 1
      }
    }
    setCountsByCustomerId((prev) => {
      const merged = { ...prev }
      for (const id of ids) {
        const base = merged[id] ?? { projects: 0, jobs: 0, bids: 0, notes: 0 }
        merged[id] = { ...base, notes: nextNotes[id] ?? 0 }
      }
      return merged
    })
  }

  async function fetchCustomers() {
    const { data, error: err } = await supabase
      .from('customers')
      .select('*, users!customers_master_user_id_fkey(id, name, email)')
      .order('name')
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as Array<Customer & { users: { id: string; name: string | null; email: string | null } | null }>
    const customersWithMasters: CustomerWithMaster[] = rows.map((row) => {
      const { users, ...customer } = row
      return { ...customer, master_user: users ?? null }
    })
    setCustomers(customersWithMasters)
    const customerIds = customersWithMasters.map((c) => c.id)
    if (customerIds.length > 0) {
      try {
        // Chunked `.in()` + paged (Phase 4 #3(c) — J34-N1/N2): the per-customer reads used to
        // put every customer id in ONE URL, and the invoice/payment reads were whole-table
        // and silently capped at PostgREST's 1,000 rows — every money chip, the header
        // total, "Owes money" and "$ Top customers" drifted with no error and no chip.
        const [projectRows, jobRows, bidRows, contactRows, estimateRows] = await Promise.all([
          fetchAllRowsChunkedIn(
            customerIds,
            (chunk, from, to) => supabase.from('projects').select('customer_id').in('customer_id', chunk).order('id').range(from, to),
            'customers list projects',
          ),
          fetchAllRowsChunkedIn(
            customerIds,
            (chunk, from, to) =>
              supabase
                .from('jobs_ledger')
                .select('id, customer_id, status, revenue, payments_made, created_at')
                .in('customer_id', chunk)
                .order('id')
                .range(from, to),
            'customers list jobs',
          ),
          fetchAllRowsChunkedIn(
            customerIds,
            (chunk, from, to) => supabase.from('bids').select('customer_id, created_at').in('customer_id', chunk).order('id').range(from, to),
            'customers list bids',
          ),
          fetchAllRowsChunkedIn(
            customerIds,
            (chunk, from, to) => supabase.from('customer_contacts').select('customer_id').in('customer_id', chunk).order('id').range(from, to),
            'customers list contacts',
          ),
          fetchAllRowsChunkedIn(
            customerIds,
            (chunk, from, to) => supabase.from('estimates').select('customer_id, created_at').in('customer_id', chunk).order('id').range(from, to),
            'customers list estimates',
          ),
        ])
        // Money rows exist per job, so key them by the jobs just loaded — the same join
        // `customersListRollup` makes — instead of reading the whole invoice/payment tables.
        const jobIds = jobRows.map((j) => j.id)
        const [invoiceRows, paymentRows] = await Promise.all([
          fetchAllRowsChunkedIn(
            jobIds,
            (chunk, from, to) => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount').in('job_id', chunk).order('id').range(from, to),
            'customers list invoices',
          ),
          fetchAllRowsChunkedIn(
            jobIds,
            (chunk, from, to) =>
              supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on').in('job_id', chunk).order('id').range(from, to),
            'customers list payments',
          ),
        ])
      const counts: Record<string, { projects: number; jobs: number; bids: number; notes: number }> = {}
      for (const id of customerIds) counts[id] = { projects: 0, jobs: 0, bids: 0, notes: 0 }
      for (const r of projectRows) {
        const entry = r.customer_id ? counts[r.customer_id] : undefined
        if (entry) entry.projects++
      }
      for (const r of jobRows) {
        const entry = r.customer_id ? counts[r.customer_id] : undefined
        if (entry) entry.jobs++
      }
      for (const r of bidRows) {
        const entry = r.customer_id ? counts[r.customer_id] : undefined
        if (entry) entry.bids++
      }
      for (const r of contactRows) {
        const entry = r.customer_id ? counts[r.customer_id] : undefined
        if (entry) entry.notes++
      }
      setCountsByCustomerId(counts)
      const rollup = customersListRollup(
        jobRows as LcvJobRow[],
        invoiceRows as LcvInvoiceRow[],
        paymentRows as LcvPaymentRow[],
      )
      setRollupByCustomerId(rollup)
      // Bill-truth shadow (one release, journey J34-N6): the list used to clamp each CUSTOMER's
      // open balance at 0 after netting unclamped shells; the kernel clamps per row. Log-only.
      {
        const applied = appliedByInvoiceId(paymentRows as LcvPaymentRow[])
        const invByJob = new Map<string, LcvInvoiceRow[]>()
        for (const inv of invoiceRows as LcvInvoiceRow[]) {
          const list = invByJob.get(inv.job_id)
          if (list) list.push(inv)
          else invByJob.set(inv.job_id, [inv])
        }
        const legacyByCustomer = new Map<string, ReturnType<typeof openBillRowsForJob>>()
        for (const j of jobRows as LcvJobRow[]) {
          if (!j.customer_id) continue
          const rows = openBillRowsForJob(
            { id: j.id, status: j.status, revenue: j.revenue, payments_made: j.payments_made ?? 0 },
            (invByJob.get(j.id) ?? []).map((i) => ({ id: i.id ?? '', job_id: i.job_id, status: i.status, amount: i.amount })),
            applied,
          )
          legacyByCustomer.set(j.customer_id, [...(legacyByCustomer.get(j.customer_id) ?? []), ...rows])
        }
        let legacy = 0
        let kernel = 0
        for (const [cid, rows] of legacyByCustomer) {
          legacy += legacyListOpenBalance(rows)
          kernel += rollup[cid]?.openBalance ?? 0
        }
        reportBillTruthShadow({ surface: 'customers-list-open-balance', legacy, kernel })
      }
      // Paid jobs with zero payment rows (HCP imports): the money rail reads
      // rows, so these show $0 collected until backfilled.
      const jobIdsWithPaymentRows = new Set(
        (paymentRows as LcvPaymentRow[]).map((p) => p.job_id),
      )
      setUnrecordedPaidCount(
        (jobRows as LcvJobRow[]).filter(
          (j) => j.status === 'paid' && Number(j.revenue ?? 0) > 0 && !jobIdsWithPaymentRows.has(j.id),
        ).length,
      )
      const signal: Record<string, string> = {}
      const stampSignal = (cid: string | null, iso: string | null) => {
        if (!cid || !iso) return
        const prev = signal[cid]
        if (!prev || iso > prev) signal[cid] = iso
      }
      for (const r of bidRows as Array<{ customer_id: string | null; created_at: string | null }>) {
        stampSignal(r.customer_id, r.created_at)
      }
      for (const r of estimateRows as Array<{ customer_id: string | null; created_at: string | null }>) {
        stampSignal(r.customer_id, r.created_at)
      }
      setRecentSignalByCustomerId(signal)
      } catch (e) {
        setError(formatErrorMessage(e))
      }
    }
    const unlinkedRes = await supabase
      .from('jobs_ledger')
      .select('id', { count: 'exact', head: true })
      .is('customer_id', null)
    setUnlinkedJobsCount(unlinkedRes.count ?? null)
    setLoading(false)
  }

  async function loadBidsForCustomer(customerId: string) {
    setLoadingBids(true)
    const { data, error } = await supabase
      .from('bids')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setBidsForCustomer(data as BidRow[])
    }
    setLoadingBids(false)
  }

  function getBidStatus(bid: BidRow): string {
    if (!bid.bid_date_sent) return 'Unsent'
    if (bid.outcome === 'won') return 'Won'
    if (bid.outcome === 'lost') return 'Lost'
    if (bid.outcome === 'started_or_complete') return 'Started or Complete'
    return 'Pending'
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    if (location.state?.openNewCustomer && newCustomerModal) {
      newCustomerModal.openNewCustomerModal({ onCreated: fetchCustomers })
      navigate('/customers', { replace: true, state: {} })
    }
  }, [location.state?.openNewCustomer, newCustomerModal, navigate])

  useEffect(() => {
    const editId = location.state?.openEditCustomer
    if (typeof editId === 'string' && editId && editCustomerModal) {
      editCustomerModal.openEditCustomerModal(editId, {
        onSaved: fetchCustomers,
        onDeleted: (id) => setCustomers((prev) => prev.filter((c) => c.id !== id)),
        onMerged: ({ removedId }) =>
          queueMicrotask(() => setCustomers((prev) => prev.filter((c) => c.id !== removedId))),
      })
      navigate('/customers', { replace: true, state: {} })
    }
  }, [location.state?.openEditCustomer, editCustomerModal, navigate])

  if (loading) return <p>Loading customers…</p>
  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>

  const { active: activeCustomers, archived: archivedCustomers } = partitionCustomersByArchived(customers)
  const visibleCustomers = showArchived ? customers : activeCustomers

  const defaultTypeCount = visibleCustomers.filter(isCustomerCommercialDefaultType).length
  const typeFromUrl = parseCustomerTypeFilter(searchParams.get('type'))
  const typeFilter: CustomerTypeFilter =
    typeFromUrl === 'commercial_default' && defaultTypeCount === 0 ? 'all' : typeFromUrl

  /** "Active in the last 90 days": a job created, payment received, bid, or estimate. */
  const activeCutoffIso = new Date(Date.now() - QUIET_AFTER_DAYS * 86_400_000).toISOString()
  const isActive90 = (id: string): boolean => {
    const roll = rollupByCustomerId[id]
    if (roll?.lastActivityIso && roll.lastActivityIso >= activeCutoffIso.slice(0, roll.lastActivityIso.length)) return true
    const sig = recentSignalByCustomerId[id]
    return sig != null && sig >= activeCutoffIso.slice(0, sig.length)
  }
  const owesFilterOn = searchParams.get('owes') === '1'
  const active90FilterOn = searchParams.get('active90') === '1'

  const q = searchQuery.trim().toLowerCase()
  const byType = visibleCustomers.filter((c) => {
    if (typeFilter === 'all') return true
    if (typeFilter === 'commercial') return c.customer_type === 'commercial'
    if (typeFilter === 'commercial_default') return isCustomerCommercialDefaultType(c)
    return c.customer_type === 'residential'
  })
  const byLens = byType.filter((c) => {
    if (owesFilterOn && (rollupByCustomerId[c.id]?.openBalance ?? 0) <= 0.5) return false
    if (active90FilterOn && !isActive90(c.id)) return false
    return true
  })
  const filteredCustomers = q
    ? byLens.filter((c) => {
        const name = (c.name ?? '').toLowerCase()
        const address = (c.address ?? '').toLowerCase()
        const masterName = (c.master_user?.name ?? '').toLowerCase()
        const masterEmail = (c.master_user?.email ?? '').toLowerCase()
        const { phone, email } = extractContactInfo(c.contact_info)
        const phoneLower = (phone ?? '').toLowerCase()
        const emailLower = (email ?? '').toLowerCase()
        return (
          name.includes(q) ||
          address.includes(q) ||
          masterName.includes(q) ||
          masterEmail.includes(q) ||
          phoneLower.includes(q) ||
          emailLower.includes(q)
        )
      })
    : byLens

  const similarGroups = findSimilarCustomerGroups(
    visibleCustomers.map((c) => {
      const { phone, email } = extractContactInfo(c.contact_info)
      return { id: c.id, name: c.name, address: c.address, phone, email }
    }),
  )
  const customersById = new Map(visibleCustomers.map((c) => [c.id, c]))
  /** Similar mode ignores search/type filters — it's a dedicated dedupe view over everything visible. */
  const similarDisplay = similarGroups.flatMap((g) => g.ids.map((id) => customersById.get(id)!).filter(Boolean))
  const similarGroupHeaderById = new Map<string, string>()
  for (const g of similarGroups) {
    similarGroupHeaderById.set(
      g.ids[0]!,
      `Possible duplicates (${g.ids.length}) — matching ${g.matchedBy.join(' + ') || 'details'}`,
    )
  }
  /** Ids in any similar-cluster — powers the inline "possible duplicate" badge. */
  const duplicateIds = new Set(similarGroups.flatMap((g) => g.ids))
  const sortMode = searchParams.get('sort') === 'value' ? 'value' : searchParams.get('sort') === 'recent' ? 'recent' : 'name'
  const sortByValue = sortMode === 'value'
  const sortedCustomers =
    sortMode === 'value'
      ? [...filteredCustomers].sort(
          (a, b) =>
            (rollupByCustomerId[b.id]?.lcv ?? 0) - (rollupByCustomerId[a.id]?.lcv ?? 0) ||
            (a.name ?? '').localeCompare(b.name ?? ''),
        )
      : sortMode === 'recent'
        ? [...filteredCustomers].sort((a, b) => {
            const ra = rollupByCustomerId[a.id]?.lastActivityIso ?? ''
            const rb = rollupByCustomerId[b.id]?.lastActivityIso ?? ''
            return rb.localeCompare(ra) || (a.name ?? '').localeCompare(b.name ?? '')
          })
        : filteredCustomers
  const displayCustomers = showSimilar ? similarDisplay : sortedCustomers

  const statTotals = (() => {
    let residential = 0
    let commercial = 0
    let owesCount = 0
    let owesSum = 0
    let active = 0
    for (const c of visibleCustomers) {
      if (c.customer_type === 'residential') residential += 1
      else if (c.customer_type === 'commercial') commercial += 1
      const open = rollupByCustomerId[c.id]?.openBalance ?? 0
      if (open > 0.5) {
        owesCount += 1
        owesSum += open
      }
      if (isActive90(c.id)) active += 1
    }
    return { total: visibleCustomers.length, residential, commercial, owesCount, owesSum, active }
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Customers</h1>
        <button
          type="button"
          onClick={() => newCustomerModal?.openNewCustomerModal({ onCreated: fetchCustomers })}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 500 }}
        >
          Add customer
        </button>
      </div>
      {customers.length > 0 && (
        <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--surface)',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Customers</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{statTotals.total}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {statTotals.residential} residential · {statTotals.commercial} commercial
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Active last 90 days</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{statTotals.active}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>had a job, payment, bid, or estimate</div>
          </div>
          <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Total open balance</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: statTotals.owesSum > 0.5 ? 'var(--text-amber-800)' : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
              ${Math.round(statTotals.owesSum).toLocaleString('en-US')}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              across {statTotals.owesCount} customer{statTotals.owesCount === 1 ? '' : 's'}
            </div>
          </div>
          {unlinkedJobsCount != null && unlinkedJobsCount > 0 ? (
            <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Jobs missing a customer</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{unlinkedJobsCount}</div>
              <button
                type="button"
                onClick={() => setLinkJobsOpen(true)}
                style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Link →
              </button>
            </div>
          ) : null}
          {unrecordedPaidCount != null && unrecordedPaidCount > 0 ? (
            <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Paid, no payment record</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{unrecordedPaidCount}</div>
              <button
                type="button"
                onClick={() => setBackfillOpen(true)}
                style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Backfill from HCP →
              </button>
            </div>
          ) : null}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>No customer type</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{defaultTypeCount}</div>
            {defaultTypeCount > 0 ? (
              <button
                type="button"
                onClick={() => setClassifyOpen(true)}
                style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Classify →
              </button>
            ) : (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>all classified 🎉</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {(['all', 'commercial', 'residential'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                setSearchParams((p) => {
                  const n = new URLSearchParams(p)
                  if (t === 'all') n.delete('type')
                  else n.set('type', t)
                  return n
                })
              }
              style={{
                padding: '0.35rem 0.75rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: typeFilter === t ? '#2563eb' : 'var(--surface)',
                color: typeFilter === t ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {t === 'all' ? 'All' : t === 'commercial' ? 'Commercial' : 'Residential'}
            </button>
          ))}
          {defaultTypeCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                setSearchParams((p) => {
                  const n = new URLSearchParams(p)
                  n.set('type', 'commercial_default')
                  return n
                })
              }
              style={{
                padding: '0.35rem 0.75rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: typeFilter === 'commercial_default' ? '#2563eb' : 'var(--surface)',
                color: typeFilter === 'commercial_default' ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {NO_CUSTOMER_TYPE_LABEL} ({defaultTypeCount})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                if (n.get('owes') === '1') n.delete('owes')
                else n.set('owes', '1')
                return n
              })
            }
            aria-pressed={owesFilterOn}
            title="Only customers with an open balance"
            style={{
              padding: '0.35rem 0.75rem',
              border: owesFilterOn ? '1px solid #d97706' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: owesFilterOn ? 'var(--bg-amber-tint)' : 'var(--surface)',
              color: owesFilterOn ? 'var(--text-amber-800)' : 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Owes money ({statTotals.owesCount})
          </button>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                if (n.get('active90') === '1') n.delete('active90')
                else n.set('active90', '1')
                return n
              })
            }
            aria-pressed={active90FilterOn}
            title="Only customers with a job, payment, bid, or estimate in the last 90 days"
            style={{
              padding: '0.35rem 0.75rem',
              border: active90FilterOn ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: active90FilterOn ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: active90FilterOn ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Active 90d ({statTotals.active})
          </button>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                if (n.get('sort') === 'value') n.delete('sort')
                else n.set('sort', 'value')
                return n
              })
            }
            aria-pressed={sortByValue}
            title="Sort customers by lifetime value — everything ever billed to them — highest first"
            style={{
              padding: '0.35rem 0.75rem',
              border: sortByValue ? '1px solid #059669' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: sortByValue ? 'var(--bg-green-tint)' : 'var(--surface)',
              color: sortByValue ? 'var(--text-green-600)' : 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              marginLeft: 'auto',
            }}
          >
            $ Top customers
          </button>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                if (n.get('sort') === 'recent') n.delete('sort')
                else n.set('sort', 'recent')
                return n
              })
            }
            aria-pressed={sortMode === 'recent'}
            title="Sort by most recent job or payment activity"
            style={{
              padding: '0.35rem 0.75rem',
              border: sortMode === 'recent' ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: sortMode === 'recent' ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: sortMode === 'recent' ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Recent first
          </button>
          <button
            type="button"
            onClick={() => setShowSimilar((prev) => !prev)}
            aria-pressed={showSimilar}
            title="Cluster customers sharing a name, address, phone, or email so duplicates are easy to spot and merge"
            style={{
              padding: '0.35rem 0.75rem',
              border: showSimilar ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: showSimilar ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: showSimilar ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {showSimilar ? 'Show all' : 'Show similar'} ({similarGroups.length})
          </button>
          {archivedCustomers.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              aria-pressed={showArchived}
              style={{
                padding: '0.35rem 0.75rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: showArchived ? 'var(--bg-muted)' : 'var(--surface)',
                color: 'var(--text-700)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {showArchived ? 'Hide archived' : 'Show archived'} ({archivedCustomers.length})
            </button>
          ) : null}
        </div>
        <div style={{ width: '100%', marginBottom: '0.25rem' }}>
          <input
            type="search"
            placeholder="Search name, address, master, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ width: '100%', padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>
        </>
      )}
      {customers.length === 0 ? (
        <p>No customers yet.{' '}
          <button
            type="button"
            onClick={() => newCustomerModal?.openNewCustomerModal({ onCreated: fetchCustomers })}
            style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
          >
            Add one
          </button>
          .</p>
      ) : showSimilar && displayCustomers.length === 0 ? (
        <p>No potential duplicates found — no two customers share a name, address, phone, or email. 🎉</p>
      ) : displayCustomers.length === 0 ? (
        <p>No customers match your search.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {displayCustomers.map((c) => (
            <li
              key={c.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border-strong)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
            >
              {showSimilar && similarGroupHeaderById.has(c.id) ? (
                <div
                  style={{
                    margin: '0 0 0.5rem',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#d97706',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid #d97706',
                    borderRadius: 6,
                    alignSelf: 'flex-start',
                  }}
                >
                  {similarGroupHeaderById.get(c.id)}
                </div>
              ) : null}
              {/* Whole row navigates to the customer page; inner controls stopPropagation. */}
              <div
                role="link"
                tabIndex={0}
                aria-label={`Open ${(c.name ?? 'customer').trim() || 'customer'}`}
                onClick={() => navigate(`/customers/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/customers/${c.id}`)
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <Link
                    to={`/customers/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={
                      typeFilter === 'all'
                        ? `${(c.name ?? 'Customer').trim() || 'Customer'}, ${customerTypeTagLabel(c)}`
                        : undefined
                    }
                    style={{
                      font: 'inherit',
                      fontWeight: 500,
                      color: 'inherit',
                      textAlign: 'left',
                      textDecoration: 'none',
                    }}
                  >
                    {c.name}
                  </Link>
                  <CustomerPortalGlobeButton
                    customerId={c.id}
                    customerName={(c.name ?? 'Customer').trim() || 'Customer'}
                  />
                  <button
                    type="button"
                    aria-label={`Edit ${(c.name ?? 'customer').trim() || 'customer'}`}
                    title="Edit customer"
                    onClick={(e) => {
                      e.stopPropagation()
                      editCustomerModal?.openEditCustomerModal(c.id, {
                        onSaved: fetchCustomers,
                        onDeleted: (id) => setCustomers((prev) => prev.filter((x) => x.id !== id)),
                        onMerged: ({ removedId }) =>
                          queueMicrotask(() => setCustomers((prev) => prev.filter((x) => x.id !== removedId))),
                      })
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      color: 'var(--text-faint)',
                    }}
                  >
                    ✎
                  </button>
                  {typeFilter === 'all' ? (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: 'var(--bg-muted)',
                        color: 'var(--text-600)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {customerTypeTagLabel(c)}
                    </span>
                  ) : null}
                  {isCustomerArchived(c) ? (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: 'var(--bg-amber-100)',
                        color: 'var(--text-amber-800)',
                        border: '1px solid #f59e0b',
                      }}
                      title={c.archived_at ? `Archived ${new Date(c.archived_at).toLocaleDateString()}` : 'Archived'}
                    >
                      Archived
                    </span>
                  ) : null}
                  {!showSimilar && duplicateIds.has(c.id) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowSimilar(true)
                      }}
                      title="This customer shares a name, address, phone, or email with another — click to review the cluster and merge"
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: 'var(--bg-blue-tint)',
                        color: 'var(--text-blue-700)',
                        border: '1px solid var(--border-strong)',
                        cursor: 'pointer',
                      }}
                    >
                      possible duplicate
                    </button>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {c.address && <span>{c.address}</span>}
                  {c.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: 'var(--text-link)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                      title={`View ${c.address} on map`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                        style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                      >
                        <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                      </svg>
                    </a>
                  )}
                  {(() => {
                    const contactInfo = extractContactInfo(c.contact_info)
                    const phone = contactInfo.phone?.trim()
                    const email = contactInfo.email?.trim()
                    return (
                      <>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'var(--text-link)',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title={`Call ${phone}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 640 640"
                              style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                            >
                              <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z" />
                            </svg>
                          </a>
                        )}
                        {email && (
                          <a
                            href={`mailto:${email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'var(--text-link)',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title={`Email ${email}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 640 640"
                              style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                            >
                              <path d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z" />
                            </svg>
                          </a>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
              <span className="customers-projects-bids-links" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(() => {
                  const counts = countsByCustomerId[c.id] ?? { projects: 0, jobs: 0, bids: 0, notes: 0 }
                  const rollup = rollupByCustomerId[c.id]
                  const owes = rollup?.openBalance ?? 0
                  const activity = rollup ? lastActivityLabel(rollup.lastActivityIso, rollup.lastActivityKind) : null
                  return (
                    <>
                      {counts.projects > 0 ? (
                        <Link
                          to={`/projects?customer=${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Their projects"
                          style={{ ...signalChipStyle('gray'), textDecoration: 'none' }}
                        >
                          {counts.projects} project{counts.projects === 1 ? '' : 's'}
                        </Link>
                      ) : null}
                      {counts.bids > 0 ? (
                        <button
                          type="button"
                          title="Their bids"
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewingBidsForCustomer(c.id)
                            loadBidsForCustomer(c.id)
                          }}
                          style={signalChipStyle('gray')}
                        >
                          {counts.bids} bid{counts.bids === 1 ? '' : 's'}
                        </button>
                      ) : null}
                      {rollup && rollup.openJobs > 0 ? (
                        <Link
                          to={`/customers/${c.id}?tab=jobs`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open jobs — see them on the customer's page"
                          style={{ ...signalChipStyle('blue'), textDecoration: 'none' }}
                        >
                          {rollup.openJobs} open job{rollup.openJobs === 1 ? '' : 's'}
                        </Link>
                      ) : counts.jobs > 0 ? (
                        <Link
                          to={`/customers/${c.id}?tab=jobs`}
                          onClick={(e) => e.stopPropagation()}
                          title="Job history on the customer's page"
                          style={{ ...signalChipStyle('gray'), textDecoration: 'none' }}
                        >
                          {counts.jobs} job{counts.jobs === 1 ? '' : 's'}
                        </Link>
                      ) : null}
                      {owes > 0.5 ? (
                        <Link
                          to={`/customers/${c.id}?tab=invoices`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open balance — see their invoices"
                          style={{ ...signalChipStyle(owes >= 5000 ? 'red' : 'amber'), textDecoration: 'none' }}
                        >
                          owes ${Math.round(owes).toLocaleString('en-US')}
                        </Link>
                      ) : null}
                      {activity ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: activity.quiet ? 'var(--text-faint)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {activity.text}
                        </span>
                      ) : null}
                      {/* notes sits in a fixed slot just left of the value so rows align. */}
                      <button
                        type="button"
                        aria-expanded={expandedNotesCustomerId === c.id}
                        aria-label="Customer notes"
                        title="Customer notes"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedNotesCustomerId((prev) => (prev === c.id ? null : c.id))
                        }}
                        style={signalChipStyle('gray')}
                      >
                        notes{counts.notes > 0 ? ` ${counts.notes}` : ''}
                      </button>
                      <CustomerMoneyRail rollup={rollup} />
                    </>
                  )
                })()}
              </span>
              </div>
              {expandedNotesCustomerId === c.id ? (
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    background: 'var(--bg-subtle)',
                    maxHeight: 'min(70vh, 480px)',
                    overflow: 'auto',
                  }}
                >
                  <CustomerNotesTable
                    customerId={c.id}
                    customerName={c.name}
                    onLoadError={(m) => setError(m)}
                    title=""
                    hasBidsAbove={false}
                    onMutated={() => {
                      void refreshNoteCountsForCustomers([c.id])
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {linkJobsOpen ? (
        <LinkJobsToCustomersModal onClose={() => setLinkJobsOpen(false)} onApplied={fetchCustomers} />
      ) : null}
      {backfillOpen ? (
        <BackfillHcpPaymentsModal onClose={() => setBackfillOpen(false)} onApplied={fetchCustomers} />
      ) : null}
      {classifyOpen ? (
        <ClassifyCustomersModal
          customers={visibleCustomers.filter(isCustomerCommercialDefaultType).map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setClassifyOpen(false)}
          onApplied={fetchCustomers}
        />
      ) : null}
      {viewingBidsForCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setViewingBidsForCustomer(null)}
        >
          <div role="dialog" aria-modal="true"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>
                Bids for {customers.find(c => c.id === viewingBidsForCustomer)?.name}
              </h2>
              <button
                onClick={() => setViewingBidsForCustomer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ×
              </button>
            </div>

            {loadingBids ? (
              <p>Loading bids...</p>
            ) : bidsForCustomer.length === 0 ? (
              <p>No bids found for this customer.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Project Name</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Bid Due Date</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Bid Value</th>
                  </tr>
                </thead>
                <tbody>
                  {bidsForCustomer.map((bid) => (
                    <tr key={bid.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem' }}>{bid.project_name || '—'}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.875rem',
                            background:
                              bid.outcome === 'won'
                                ? 'var(--bg-green-100)'
                                : bid.outcome === 'lost'
                                ? 'var(--bg-red-100)'
                                : bid.outcome === 'started_or_complete'
                                ? 'var(--bg-blue-200)'
                                : 'var(--bg-muted)',
                            color:
                              bid.outcome === 'won'
                                ? 'var(--text-green-800)'
                                : bid.outcome === 'lost'
                                ? 'var(--text-red-800)'
                                : bid.outcome === 'started_or_complete'
                                ? 'var(--text-blue-800)'
                                : 'var(--text-700)',
                          }}
                        >
                          {getBidStatus(bid)}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {bid.bid_due_date
                          ? // DATE-only string: parse at local noon so it doesn't render a day early.
                            new Date(bid.bid_due_date + 'T12:00:00').toLocaleDateString()
                          : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {bid.bid_value != null
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            }).format(bid.bid_value)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
