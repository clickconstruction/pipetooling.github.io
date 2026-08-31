import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import { ModalShell } from './ModalShell'
import { formatBidNameWithValue, formatDateYYMMDD, formatTimeSinceLastContact } from '../../lib/bids/bidFormatting'
import { buildCustomerLastContactMap, compareCustomersByLastContact } from '../../lib/bids/customerLastContact'
import { compareCustomersForCallQueue, nextFollowupBadge } from '../../lib/bids/callQueueOrdering'
import { BuilderCallSessionModal } from './BuilderCallSessionModal'
import { buildBuilderQuickLogWrites, builderOpenPipelineValue, formatOpenPipelineValue } from '../../lib/bids/builderQuickLog'
import { buildBuilderCallSheetHtml, buildFollowupQueueCallSheetHtml, type CallSheetBuilder } from '../../lib/bids/builderCallSheet'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { effectiveSubmissionBidLastNoteIso, isSubmissionBidStaleForThreshold } from '../../lib/submissionFollowupStale'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { extractContactInfo } from '../../lib/bids/bidContactInfo'
import { getBidStatusLabel } from '../../lib/bids/bidStatusLabel'
import { BID_LOSS_CATEGORIES, isBidLossCategoryKey } from '../../lib/bidLossCategories'
import { BidLostQuickPopover } from './BidLostQuickPopover'
import { getSubmissionSectionKey } from '../../lib/bids/submissionSections'
import { builderBidOutcomeCounts, type BuilderBidOutcomeCounts } from '../../lib/map/builderBidMapFocus'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { gcOutcomeRowsForBid } from '../../lib/bids/gcOutcomeRows'
import type { useNewCustomerModal } from '../../contexts/NewCustomerModalContext'
import type { useEditCustomerModal } from '../../contexts/EditCustomerModalContext'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']

type BidsBuilderReviewTabProps = {
  bids: BidWithBuilder[]
  /** Bids by GC (v2.2164): per-bid GC packets — the header chips count each GC's packet, not the bid. */
  gcPacketsByBid: Record<string, GcPacket[]>
  customers: Customer[]
  customerContacts: CustomerContact[]
  customerContactPersons: CustomerContactPerson[]
  lastContactFromEntries: Record<string, string>
  authUser: { id: string } | null
  narrowViewport640: boolean
  deepLinkHighlightCustomerId: string | null
  deepLinkHighlightGen: number
  onLoadCustomers: () => void
  onReloadCustomerContacts: () => void
  onReloadContactPersons: () => void
  onReloadBids: () => void
  onError: (msg: string | null) => void
  onEditBid: (bid: BidWithBuilder) => void
  onNewBidWithCustomer: (c: Customer) => void
  onViewSubmissions: (bid: BidWithBuilder) => void
  onSetCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  newCustomerModal: ReturnType<typeof useNewCustomerModal> | null
  editCustomerModal: ReturnType<typeof useEditCustomerModal> | null
}

export function BidsBuilderReviewTab({
  bids,
  gcPacketsByBid,
  customers,
  customerContacts,
  customerContactPersons,
  lastContactFromEntries,
  authUser,
  narrowViewport640,
  deepLinkHighlightCustomerId,
  deepLinkHighlightGen,
  onLoadCustomers,
  onReloadCustomerContacts,
  onReloadContactPersons,
  onReloadBids,
  onError,
  onEditBid,
  onNewBidWithCustomer,
  onViewSubmissions,
  onSetCustomers,
  newCustomerModal,
  editCustomerModal,
}: BidsBuilderReviewTabProps) {
  const navigate = useNavigate()
  const confirmDialog = useConfirmDialog()
  // Builder bid map (v2.1162): per-customer won/lost/pending tallies for the
  // header chips, and whether any bid has an address (gates the map button).
  const builderBidMapStats = useMemo(() => {
    const byCustomer = new Map<string, { counts: BuilderBidOutcomeCounts; hasAddress: boolean }>()
    const sectionsByCustomer = new Map<string, Array<ReturnType<typeof getSubmissionSectionKey>>>()
    const addressByCustomer = new Map<string, boolean>()
    for (const b of bids) {
      if (!b.customer_id) continue
      // Bids by GC: one tally entry per GC the bid went to (a bid won with one GC and lost with another
      // counts for each); single-GC bids tally exactly as before.
      const builderName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
      for (const row of gcOutcomeRowsForBid(b, { key: b.customer_id, name: builderName }, gcPacketsByBid[b.id])) {
        const list = sectionsByCustomer.get(row.gcKey) ?? []
        list.push(row.outcome === 'won' ? 'won' : row.outcome === 'lost' ? 'lost' : row.outcome === 'pending' ? 'pending' : 'unsent')
        sectionsByCustomer.set(row.gcKey, list)
        if (b.address?.trim()) addressByCustomer.set(row.gcKey, true)
      }
    }
    for (const [cid, sections] of sectionsByCustomer) {
      byCustomer.set(cid, { counts: builderBidOutcomeCounts(sections), hasAddress: addressByCustomer.get(cid) === true })
    }
    return byCustomer
  }, [bids, gcPacketsByBid])
  /**
   * Bids by GC (v2.2164): the bids a builder's card lists, keyed by customer — a bid's own GC as always,
   * plus any bid with a packet pointed at this GC (listed under that packet's outcome). One entry per bid.
   */
  const customerBidRows = useMemo(() => {
    const map = new Map<string, Array<{ bid: BidWithBuilder; outcome: 'won' | 'lost' | 'pending' | 'unsent' }>>()
    for (const b of bids) {
      const builderName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
      const key = b.customer_id ?? b.gc_builder_id ?? builderName
      for (const row of gcOutcomeRowsForBid(b, { key, name: builderName }, gcPacketsByBid[b.id])) {
        if (row.sharedLetter) continue
        const list = map.get(row.gcKey) ?? []
        if (list.some((x) => x.bid.id === b.id)) continue
        list.push({ bid: b, outcome: row.outcome })
        map.set(row.gcKey, list)
      }
    }
    return map
  }, [bids, gcPacketsByBid])
  const [addContactPersonModalCustomer, setAddContactPersonModalCustomer] = useState<Customer | null>(null)
  const [editingContactPerson, setEditingContactPerson] = useState<CustomerContactPerson | null>(null)
  const [contactPersonName, setContactPersonName] = useState('')
  const [contactPersonPhones, setContactPersonPhones] = useState<string[]>([''])
  const [contactPersonEmail, setContactPersonEmail] = useState('')
  const [contactPersonNote, setContactPersonNote] = useState('')
  const [savingContactPerson, setSavingContactPerson] = useState(false)
  const [builderReviewSectionOpen, setBuilderReviewSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [builderReviewCardExpanded, setBuilderReviewCardExpanded] = useState<Record<string, boolean>>({})
  const [builderReviewSearchQuery, setBuilderReviewSearchQuery] = useState('')
  /** Bid whose quick lost-capture panel is open (v2.2043) — one at a time. */
  const [quickLostBidId, setQuickLostBidId] = useState<string | null>(null)
  const [builderReviewSortOrder, setBuilderReviewSortOrder] = useState<'oldest-first' | 'newest-first'>('oldest-first')
  const [builderReviewPiaCustomerIds, setBuilderReviewPiaCustomerIds] = useState<Set<string>>(() => new Set())
  // Snooze (v2.1386): future wake dates per customer, from customer_followup_prefs.
  const [snoozeByCustomer, setSnoozeByCustomer] = useState<Record<string, { until: string; note: string | null }>>({})
  // Promised next-follow-up instants (v2.1389) — past AND future; overdue floats to the queue top.
  const [nextFollowupByCustomer, setNextFollowupByCustomer] = useState<Record<string, string>>({})
  const [callSessionCustomer, setCallSessionCustomer] = useState<Customer | null>(null)
  const [snoozeModalCustomer, setSnoozeModalCustomer] = useState<Customer | null>(null)
  const [snoozeDateInput, setSnoozeDateInput] = useState('')
  const [snoozeNoteInput, setSnoozeNoteInput] = useState('')
  const [savingSnooze, setSavingSnooze] = useState(false)
  // Per-bid staleness threshold (v2.1386) — same semantics as Submission &
  // Followup's "no update in N days" box, persisted per user.
  const [staleDaysInput, setStaleDaysInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '14'
    try {
      return localStorage.getItem('bids_followup_stale_days') ?? '14'
    } catch {
      return '14'
    }
  })
  const staleThresholdDays = useMemo(() => {
    const n = Number.parseInt(staleDaysInput.trim(), 10)
    return Number.isFinite(n) && n >= 1 ? n : null
  }, [staleDaysInput])
  useEffect(() => {
    try {
      localStorage.setItem('bids_followup_stale_days', staleDaysInput)
    } catch {
      // ignore
    }
  }, [staleDaysInput])
  // Quick-log composer state, keyed per customer card.
  const [quickLogMethod, setQuickLogMethod] = useState<Record<string, string>>({})
  const [quickLogNote, setQuickLogNote] = useState<Record<string, string>>({})
  const [quickLogChecked, setQuickLogChecked] = useState<Record<string, Set<string>>>({})
  const [savingQuickLogCustomerId, setSavingQuickLogCustomerId] = useState<string | null>(null)
  // Bumped after a quick-log so the customer's CustomerNotesTable (which owns
  // its own fetch) remounts and shows the new row immediately.
  const [notesRefreshNonce, setNotesRefreshNonce] = useState<Record<string, number>>({})
  const [quietBuildersOpen, setQuietBuildersOpen] = useState(false)

  // PIA lives in customer_followup_prefs (v2.1385) — one shared list for the
  // whole team instead of the old per-browser localStorage list. Any legacy
  // localStorage list is migrated up once (then cleared) so nobody loses flags.
  // Table not in generated types until the next regen — `(supabase as any)`
  // precedent (see useQuickfillNoncardAttribution).
  const customersLoaded = customers.length > 0

  const loadFollowupPrefs = useCallback(async () => {
    const rows = await withSupabaseRetry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => (supabase as any).from('customer_followup_prefs').select('customer_id, pia, snoozed_until, snooze_note, next_followup_at'),
      'load followup prefs',
    )
    const prefRows = (rows ?? []) as {
      customer_id: string
      pia: boolean
      snoozed_until: string | null
      snooze_note: string | null
      next_followup_at: string | null
    }[]
    setBuilderReviewPiaCustomerIds(new Set(prefRows.filter((r) => r.pia).map((r) => r.customer_id)))
    const nowMs = Date.now()
    const snoozes: Record<string, { until: string; note: string | null }> = {}
    const followups: Record<string, string> = {}
    for (const r of prefRows) {
      if (r.snoozed_until && new Date(r.snoozed_until).getTime() > nowMs) {
        snoozes[r.customer_id] = { until: r.snoozed_until, note: r.snooze_note }
      }
      if (r.next_followup_at) followups[r.customer_id] = r.next_followup_at
    }
    setSnoozeByCustomer(snoozes)
    setNextFollowupByCustomer(followups)
  }, [])

  useEffect(() => {
    if (!authUser?.id || !customersLoaded) return
    void (async () => {
      try {
        const legacyKey = `bids_builder_review_pia_${authUser.id}`
        let legacyIds: string[] = []
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(legacyKey) : null
          if (raw) {
            const arr = JSON.parse(raw) as string[]
            if (Array.isArray(arr)) legacyIds = arr.filter((x): x is string => typeof x === 'string')
          }
        } catch {
          // ignore parse errors
        }
        if (legacyIds.length > 0) {
          await withSupabaseRetry(
            async () =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (supabase as any).from('customer_followup_prefs').upsert(
                legacyIds.map((id) => ({ customer_id: id, pia: true, updated_at: new Date().toISOString() })),
                { onConflict: 'customer_id' },
              ),
            'migrate PIA flags to shared prefs',
          )
          try {
            localStorage.removeItem(legacyKey)
          } catch {
            // ignore
          }
        }
        await loadFollowupPrefs()
      } catch {
        // Prefs are a nicety — an empty set beats blocking the tab on error.
      }
    })()
  }, [authUser?.id, customersLoaded, loadFollowupPrefs])

  function toggleBuilderReviewPia(customerId: string, next: boolean) {
    setBuilderReviewPiaCustomerIds((prev) => {
      const s = new Set(prev)
      if (next) s.add(customerId)
      else s.delete(customerId)
      return s
    })
    void (async () => {
      try {
        await withSupabaseRetry(
          async () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
              .from('customer_followup_prefs')
              .upsert({ customer_id: customerId, pia: next, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' }),
          'save PIA flag',
        )
      } catch (e: unknown) {
        setBuilderReviewPiaCustomerIds((prev) => {
          const s = new Set(prev)
          if (next) s.delete(customerId)
          else s.add(customerId)
          return s
        })
        onError(formatErrorMessage(e, 'Failed to save the PIA flag'))
      }
    })()
  }

  function toggleBuilderReviewSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setBuilderReviewSectionOpen((prev: typeof builderReviewSectionOpen) => ({ ...prev, [key]: !prev[key] }))
  }
  function toggleBuilderReviewCard(customerId: string) {
    setBuilderReviewCardExpanded((prev) => ({ ...prev, [customerId]: !(prev[customerId] !== false) }))
  }

  async function saveSnooze(customerId: string, untilIso: string | null, note: string) {
    setSavingSnooze(true)
    try {
      await withSupabaseRetry(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('customer_followup_prefs').upsert(
            {
              customer_id: customerId,
              snoozed_until: untilIso,
              snooze_note: untilIso ? note.trim() || null : null,
              snoozed_by: untilIso ? (authUser?.id ?? null) : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'customer_id' },
          ),
        'save snooze',
      )
      setSnoozeByCustomer((prev) => {
        const next = { ...prev }
        if (untilIso) next[customerId] = { until: untilIso, note: note.trim() || null }
        else delete next[customerId]
        return next
      })
      setSnoozeModalCustomer(null)
    } catch (e: unknown) {
      onError(formatErrorMessage(e, 'Failed to save the snooze'))
    } finally {
      setSavingSnooze(false)
    }
  }

  async function submitQuickLog(customer: Customer, checkedBidIds: string[], opts?: { builderLog?: boolean }) {
    if (!authUser?.id) return
    const builderLog = opts?.builderLog !== false
    setSavingQuickLogCustomerId(customer.id)
    try {
      const writes = buildBuilderQuickLogWrites({
        customerId: customer.id,
        checkedBidIds,
        method: quickLogMethod[customer.id] ?? 'Phone',
        note: quickLogNote[customer.id] ?? '',
        nowIso: new Date().toISOString(),
        userId: authUser.id,
        includeBuilderLog: builderLog,
      })
      const contactRow = writes.customerContact
      if (contactRow) {
        await withSupabaseRetry(
          async () => supabase.from('customer_contacts').insert(contactRow),
          'quick log: customer contact',
        )
      }
      if (writes.bidEntries.length > 0) {
        await withSupabaseRetry(
          async () => supabase.from('bids_submission_entries').insert(writes.bidEntries),
          'quick log: bid entries',
        )
      }
      // Per-GC Phase 1: the entry inserts above fire the last_contact sync trigger — no hand-stamps.
      setQuickLogNote((prev) => ({ ...prev, [customer.id]: '' }))
      setNotesRefreshNonce((prev) => ({ ...prev, [customer.id]: (prev[customer.id] ?? 0) + 1 }))
      // A logged contact fulfills an OVERDUE promise (the call happened) so the
      // builder stops pinning to the queue top; a future promise stays put —
      // a text today doesn't cancel "call them Tuesday about the award".
      const promise = nextFollowupByCustomer[customer.id]
      if (builderLog && promise && new Date(promise).getTime() <= Date.now()) {
        try {
          await withSupabaseRetry(
            async () =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (supabase as any)
                .from('customer_followup_prefs')
                .upsert({ customer_id: customer.id, next_followup_at: null, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' }),
            'quick log: clear fulfilled promise',
          )
          setNextFollowupByCustomer((prev) => {
            const next = { ...prev }
            delete next[customer.id]
            return next
          })
        } catch {
          // Badge housekeeping only — the log itself already succeeded.
        }
      }
      onReloadCustomerContacts()
      onReloadBids()
    } catch (e: unknown) {
      onError(formatErrorMessage(e, 'Failed to log the contact'))
    } finally {
      setSavingQuickLogCustomerId(null)
    }
  }

  function makeCallSheetBuilder(customer: Customer): CallSheetBuilder {
    const customerRows = customerBidRows.get(customer.id) ?? []
    const openBids = customerRows.filter((x) => x.outcome === 'unsent' || x.outcome === 'pending').map((x) => x.bid)
    const stats = builderBidMapStats.get(customer.id)
    const lastIso = customerLastContactMap.get(customer.id) ?? null
    const contactInfo = extractContactInfo(customer.contact_info ?? null)
    return {
      name: customer.name,
      address: customer.address ?? null,
      phone: contactInfo.phone?.trim() || null,
      lastContactLabel: lastIso ? formatTimeSinceLastContact(lastIso) : null,
      hitRatePct: stats?.counts.hitRatePct ?? null,
      openValueLabel: formatOpenPipelineValue(builderOpenPipelineValue(openBids)),
      people: customerContactPersons
        .filter((cp) => cp.customer_id === customer.id)
        .map((cp) => ({
          name: cp.name,
          phones: (cp.phone ?? '').split('\n').filter(Boolean),
          email: cp.email?.trim() || null,
          note: cp.note?.trim() || null,
        })),
      bids: openBids.map((b) => ({
        label: formatBidNameWithValue(b),
        sectionLabel: getSubmissionSectionKey(b) === 'unsent' ? 'Unsent' : 'Not yet won or lost',
        dueLabel: b.bid_due_date ? formatDateYYMMDD(b.bid_due_date) : null,
        lastUpdateLabel: (() => {
          const iso = effectiveSubmissionBidLastNoteIso(b, lastContactFromEntries, customerContacts)
          return iso ? formatTimeSinceLastContact(iso) : null
        })(),
      })),
    }
  }

  const callSheetGeneratedLabel = () =>
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ClickTooling Followup`

  // One shared last-contact definition for sort + display (v2.1385 kernel);
  // previously duplicated inline with subtly different comparison code.
  const customerLastContactMap = useMemo(
    () => buildCustomerLastContactMap(bids, customerContacts, lastContactFromEntries),
    [bids, customerContacts, lastContactFromEntries],
  )

  const builderReviewCustomersSorted = useMemo(() => {
    // Oldest-first is the call queue: overdue promises → staleness → future
    // promises (v2.1389). Newest-first stays a pure last-contact lookup order.
    if (builderReviewSortOrder === 'oldest-first') {
      const nowMs = Date.now()
      return [...customers].sort((a, b) => compareCustomersForCallQueue(a, b, customerLastContactMap, nextFollowupByCustomer, nowMs))
    }
    return [...customers].sort((a, b) => compareCustomersByLastContact(a, b, customerLastContactMap, builderReviewSortOrder))
  }, [customers, customerLastContactMap, builderReviewSortOrder, nextFollowupByCustomer])

  const customersWithBidIds = useMemo(() => {
    const s = new Set<string>()
    for (const b of bids) if (b.customer_id) s.add(b.customer_id)
    return s
  }, [bids])

  const matchesBuilderSearch = useMemo(() => {
    const q = builderReviewSearchQuery.toLowerCase().trim()
    if (!q) return () => true
    return (c: Customer) => c.name.toLowerCase().includes(q) || (c.address?.toLowerCase().includes(q) ?? false)
  }, [builderReviewSearchQuery])

  const builderReviewCustomersFiltered = useMemo(() => {
    let list = builderReviewCustomersSorted
    // When Oldest first (the call queue): PIA and snoozed customers step out of line.
    if (builderReviewSortOrder === 'oldest-first') {
      list = list.filter((c) => !builderReviewPiaCustomerIds.has(c.id) && !snoozeByCustomer[c.id])
    }
    // Builders with no bids at all fold into the Quiet builders block below.
    list = list.filter((c) => customersWithBidIds.has(c.id))
    return list.filter(matchesBuilderSearch)
  }, [builderReviewCustomersSorted, matchesBuilderSearch, builderReviewSortOrder, builderReviewPiaCustomerIds, snoozeByCustomer, customersWithBidIds])

  // Quiet builders (v2.1386): commercial customers with zero bids — kept out of
  // the call queue, one click away (and still searchable inside the block).
  const quietBuilders = useMemo(
    () => builderReviewCustomersSorted.filter((c) => !customersWithBidIds.has(c.id)).filter(matchesBuilderSearch),
    [builderReviewCustomersSorted, customersWithBidIds, matchesBuilderSearch],
  )

  const snoozedCustomersExcluded = useMemo(() => {
    if (builderReviewSortOrder !== 'oldest-first') return []
    return builderReviewCustomersSorted
      .filter((c) => snoozeByCustomer[c.id] && customersWithBidIds.has(c.id))
      .filter(matchesBuilderSearch)
  }, [builderReviewCustomersSorted, builderReviewSortOrder, snoozeByCustomer, customersWithBidIds, matchesBuilderSearch])

  // When Oldest first: PIA customers that were excluded (for showing in "PIA (excluded)" section)
  const builderReviewPiaCustomersExcluded = useMemo(() => {
    if (builderReviewSortOrder !== 'oldest-first' || builderReviewPiaCustomerIds.size === 0) return []
    return builderReviewCustomersSorted.filter((c) => builderReviewPiaCustomerIds.has(c.id)).filter(matchesBuilderSearch)
  }, [builderReviewCustomersSorted, matchesBuilderSearch, builderReviewSortOrder, builderReviewPiaCustomerIds])

  // Deep-link: when the parent's highlight signal changes to a customer, clear the
  // search, expand that card, and scroll it into view. The parent owns the highlight
  // styling state + its auto-clear timeout (controlled prop).
  useEffect(() => {
    const customerId = deepLinkHighlightCustomerId
    if (!customerId) return
    setBuilderReviewSearchQuery('')
    setBuilderReviewCardExpanded((prev) => ({ ...prev, [customerId]: true }))
    const t = window.setTimeout(() => {
      document.getElementById(`builder-review-customer-${customerId}`)?.scrollIntoView({ behavior: 'auto', block: 'center' })
    }, 175)
    return () => window.clearTimeout(t)
  }, [deepLinkHighlightGen, deepLinkHighlightCustomerId])

  function renderBuilderReviewContactPersonsBlock(customer: Customer, containerStyle: CSSProperties) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Contact persons</div>
        {customerContactPersons
          .filter((cp) => cp.customer_id === customer.id)
          .map((cp) => (
            <div key={cp.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.25rem' }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cp.name}</div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContactPerson(cp)
                      setAddContactPersonModalCustomer(customer)
                      setContactPersonName(cp.name)
                      const phones = (cp.phone ?? '').split('\n').filter(Boolean)
                      setContactPersonPhones(phones.length > 0 ? phones : [''])
                      setContactPersonEmail(cp.email ?? '')
                      setContactPersonNote(cp.note ?? '')
                    }}
                    title="Edit"
                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M416 128L512 224L192 544L96 544L96 448L416 128zM444 64L544 64L576 96L576 196L544 228L444 196L444 64zM128 480L176 480L496 160L448 112L128 432L128 480z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmDialog({ message: 'Delete this contact?', confirmLabel: 'Delete', danger: true }))) return
                      await supabase.from('customer_contact_persons').delete().eq('id', cp.id)
                      onReloadContactPersons()
                    }}
                    title="Delete"
                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-red-700)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M160 128H96V96H256V64H160V128zM288 64V96H544V128H480V512C480 547.3 451.3 576 416 576H224C188.7 576 160 547.3 160 512V128H96V512C96 569.4 142.6 616 200 616H440C497.4 616 544 569.4 544 512V128H288V64zM224 128H416V512H224V128zM288 192V480H352V192H288zM416 192V480H480V192H416z" /></svg>
                  </button>
                </div>
              </div>
              {(cp.phone ?? '').split('\n').filter(Boolean).map((phone, i) => (
                <a key={i} href={`tel:${phone}`} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none', display: 'block' }}>{phone}</a>
              ))}
              {cp.email && (
                <a href={`mailto:${cp.email}`} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none', display: 'block' }}>{cp.email}</a>
              )}
              {cp.note && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{cp.note}</div>
              )}
            </div>
          ))}
        {customerContactPersons.filter((cp) => cp.customer_id === customer.id).length === 0 && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No contacts yet</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => newCustomerModal?.openNewCustomerModal({ onCreated: onLoadCustomers })}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            New Customer
          </button>
          <input
            type="text"
            placeholder="Search builders..."
            value={builderReviewSearchQuery}
            onChange={(e) => setBuilderReviewSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Stale after
            <input
              type="number"
              min={1}
              value={staleDaysInput}
              onChange={(e) => setStaleDaysInput(e.target.value)}
              aria-label="Highlight bids with no update in this many days"
              style={{ width: 52, padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
            />
            days
          </label>
          <button
            type="button"
            onClick={() => setBuilderReviewSortOrder((prev) => (prev === 'oldest-first' ? 'newest-first' : 'oldest-first'))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              background: builderReviewSortOrder === 'oldest-first' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)',
              color: builderReviewSortOrder === 'oldest-first' ? 'var(--text-700)' : 'var(--text-blue-500)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {builderReviewSortOrder === 'oldest-first' ? 'Oldest first' : 'Newest first'}
          </button>
          <button
            type="button"
            onClick={() => setBuilderReviewCardExpanded(Object.fromEntries(builderReviewCustomersFiltered.map((c) => [c.id, false])))}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setBuilderReviewCardExpanded({})}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => {
              const sheets = builderReviewCustomersFiltered.map((c) => makeCallSheetBuilder(c))
              if (sheets.length === 0) return
              printHtmlInNewWindow(buildFollowupQueueCallSheetHtml(sheets, callSheetGeneratedLabel()))
            }}
            title="Print the whole queue: every visible builder with their people and open bids, in call order"
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            Print call sheet
          </button>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Sorted by last contact. Add outreach not tied to bids via General contact. PIA = ignore when Oldest first.
        </p>
        <style>{`
          .br-bid-note-aim { opacity: 0.35; transition: opacity 0.12s; }
          li:hover > .br-bid-note-aim, .br-bid-note-aim:focus-visible { opacity: 1; }
          @media (hover: none) { .br-bid-note-aim { opacity: 0.8; } }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {builderReviewCustomersFiltered.map((customer) => {
            const customerRows = customerBidRows.get(customer.id) ?? []
            const customerBids = customerRows.map((x) => x.bid)
            const brUnsent = customerRows.filter((x) => x.outcome === 'unsent').map((x) => x.bid)
            const brPending = customerRows.filter((x) => x.outcome === 'pending').map((x) => x.bid)
            // "Started or Complete" is the bid's own state; a packet win for this GC lists under Won.
            const brStartedOrComplete = customerRows.filter((x) => x.outcome === 'won' && x.bid.outcome === 'started_or_complete' && x.bid.customer_id === customer.id).map((x) => x.bid)
            const brWon = customerRows.filter((x) => x.outcome === 'won').map((x) => x.bid).filter((b) => !brStartedOrComplete.includes(b))
            const brLost = customerRows.filter((x) => x.outcome === 'lost').map((x) => x.bid)
            const hasBids = customerBids.length > 0
            const lastContact = customerLastContactMap.get(customer.id) ?? null
            const isCardExpanded = builderReviewCardExpanded[customer.id] !== false
            // Quick-log target set (v2.1386): defaults to every pending bid \u2014
            // the ones a phone call is usually about; adjustable per card.
            const quickLogDefaultChecked = new Set(brPending.map((b) => b.id))
            const checkedSet = quickLogChecked[customer.id] ?? quickLogDefaultChecked
            const toggleChecked = (bidId: string) => {
              const next = new Set(checkedSet)
              if (next.has(bidId)) next.delete(bidId)
              else next.add(bidId)
              setQuickLogChecked((prev) => ({ ...prev, [customer.id]: next }))
            }
            const builderReviewOutcomeSections = hasBids ? (
              <div>
                {[
                  { key: 'unsent' as const, label: 'Unsent', bids: brUnsent },
                  { key: 'pending' as const, label: 'Not yet won or lost', bids: brPending },
                  { key: 'won' as const, label: 'Won', bids: brWon },
                  { key: 'startedOrComplete' as const, label: 'Started or Complete', bids: brStartedOrComplete },
                  { key: 'lost' as const, label: 'Lost', bids: brLost },
                ].map(({ key, label, bids: sectionBids }) => (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => toggleBuilderReviewSection(key)}
                      style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span>{builderReviewSectionOpen[key] ? '\u25BC' : '\u25B6'}</span>
                      {label} ({sectionBids.length})
                    </button>
                    {builderReviewSectionOpen[key] && sectionBids.length > 0 && (
                      <ul style={{ margin: '0.25rem 0 0.5rem 1rem', padding: 0, listStyle: 'none' }}>
                        {sectionBids.map((bid) => {
                          const isOpenSection = key === 'unsent' || key === 'pending'
                          const lastNoteIso = isOpenSection ? effectiveSubmissionBidLastNoteIso(bid, lastContactFromEntries, customerContacts) : null
                          const stale =
                            isOpenSection &&
                            staleThresholdDays !== null &&
                            isSubmissionBidStaleForThreshold(bid, lastContactFromEntries, customerContacts, staleThresholdDays)
                          const lostCategory = key === 'lost' && isBidLossCategoryKey(bid.loss_category) ? bid.loss_category : null
                          const lostCategoryChip = key === 'lost' ? BID_LOSS_CATEGORIES.find((c) => c.key === lostCategory) ?? null : null
                          return (
                          <Fragment key={bid.id}>
                          <li style={{ marginBottom: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.125rem 0.35rem', borderRadius: 4, background: stale ? 'var(--bg-red-tint)' : undefined }}>
                            {isOpenSection && (
                              <input
                                type="checkbox"
                                checked={checkedSet.has(bid.id)}
                                onChange={() => toggleChecked(bid.id)}
                                title="Include this bid when logging a contact below"
                                style={{ flexShrink: 0 }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => onEditBid(bid)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left', fontSize: '0.875rem' }}
                            >
                              {formatBidNameWithValue(bid)}
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewSubmissions(bid)}
                              title="View submissions"
                              style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
                              </svg>
                            </button>
                            {isOpenSection && (
                              <button
                                type="button"
                                className="br-bid-note-aim"
                                onClick={() => {
                                  setQuickLogChecked((prev) => ({ ...prev, [customer.id]: new Set([bid.id]) }))
                                  document.getElementById(`quick-log-note-${customer.id}`)?.focus()
                                }}
                                title="Note just this bid — checks only it in the log bar below"
                                aria-label={`Note just ${bid.project_name ?? 'this bid'}`}
                                style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}
                              >
                                📝
                              </button>
                            )}
                            {' — '}
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              due {formatDateYYMMDD(bid.bid_due_date)}, {getBidStatusLabel(bid)}
                            </span>
                            {key === 'lost' ? (
                              lostCategoryChip ? (
                                <button
                                  type="button"
                                  onClick={() => setQuickLostBidId((prev) => (prev === bid.id ? null : bid.id))}
                                  title="Change the loss reason"
                                  style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '0.08rem 0.5rem', borderRadius: 999, border: 'none', cursor: 'pointer', background: lostCategoryChip.chipBg, color: lostCategoryChip.chipFg, whiteSpace: 'nowrap' }}
                                >
                                  {lostCategoryChip.label}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setQuickLostBidId((prev) => (prev === bid.id ? null : bid.id))}
                                  title="Record why this bid was lost"
                                  style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', whiteSpace: 'nowrap' }}
                                >
                                  why? →
                                </button>
                              )
                            ) : null}
                            {isOpenSection && (
                              <button
                                type="button"
                                onClick={() => setQuickLostBidId((prev) => (prev === bid.id ? null : bid.id))}
                                title="Mark this bid lost and record why — without opening Edit Bid"
                                style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.08rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}
                              >
                                Lost…
                              </button>
                            )}
                            {isOpenSection && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'nowrap',
                                  color: stale ? 'var(--text-red-600)' : 'var(--text-muted)',
                                  fontWeight: stale ? 600 : 400,
                                }}
                                title="Latest note on this bid or its customer (same rule as Submission & Followup)"
                              >
                                {lastNoteIso ? formatTimeSinceLastContact(lastNoteIso) : 'no update'}
                              </span>
                            )}
                          </li>
                          {quickLostBidId === bid.id ? (
                            <li style={{ listStyle: 'none' }}>
                              <BidLostQuickPopover
                                bid={bid}
                                onSaved={onReloadBids}
                                onClose={() => setQuickLostBidId(null)}
                              />
                            </li>
                          ) : null}
                          </Fragment>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: '0.75rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.55rem 0.7rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {['Phone', 'Text', 'Email'].map((m) => {
                      const active = (quickLogMethod[customer.id] ?? 'Phone') === m
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setQuickLogMethod((prev) => ({ ...prev, [customer.id]: m }))}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.18rem 0.55rem',
                            borderRadius: 999,
                            border: '1px solid ' + (active ? '#3b82f6' : 'var(--border-strong)'),
                            background: active ? '#3b82f6' : 'var(--surface)',
                            color: active ? 'white' : 'var(--text-700)',
                            cursor: 'pointer',
                            fontWeight: active ? 700 : 400,
                          }}
                        >
                          {m}
                        </button>
                      )
                    })}
                    <input
                      type="text"
                      id={`quick-log-note-${customer.id}`}
                      value={quickLogNote[customer.id] ?? ''}
                      onChange={(e) => setQuickLogNote((prev) => ({ ...prev, [customer.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && savingQuickLogCustomerId !== customer.id) void submitQuickLog(customer, [...checkedSet])
                      }}
                      placeholder="What did they say? Saved by whichever button you pick →"
                      aria-label={`Quick contact log for ${customer.name}`}
                      style={{ flex: 1, minWidth: 180, padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.84rem' }}
                    />
                    <button
                      type="button"
                      disabled={savingQuickLogCustomerId === customer.id}
                      onClick={() => void submitQuickLog(customer, [...checkedSet])}
                      style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', opacity: savingQuickLogCustomerId === customer.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {savingQuickLogCustomerId === customer.id
                        ? 'Logging…'
                        : `Log for builder${checkedSet.size > 0 ? ` + ${checkedSet.size} bid${checkedSet.size === 1 ? '' : 's'}` : ''}`}
                    </button>
                    <button
                      type="button"
                      disabled={savingQuickLogCustomerId === customer.id || checkedSet.size === 0}
                      onClick={() => void submitQuickLog(customer, [...checkedSet], { builderLog: false })}
                      title="Notes the checked bids without logging builder contact — the call queue doesn't move"
                      style={{ padding: '0.4rem 0.7rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, fontWeight: 600, fontSize: '0.82rem', cursor: checkedSet.size === 0 ? 'not-allowed' : 'pointer', opacity: savingQuickLogCustomerId === customer.id || checkedSet.size === 0 ? 0.55 : 1, whiteSpace: 'nowrap' }}
                    >
                      {checkedSet.size === 1 ? 'this bid only' : `${checkedSet.size || ''} bids only`.trim()}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'right' }}>
                    {checkedSet.size === 1
                      ? '“this bid only” notes the checked bid and freshens its clock — the builder’s last contact doesn’t change'
                      : '“bids only” notes the checked bids without logging builder contact — the call queue doesn’t move'}
                  </div>
                </div>
              </div>
            ) : null
            const builderReviewGeneralContactTable = (
              <CustomerNotesTable
                key={`${customer.id}:${notesRefreshNonce[customer.id] ?? 0}`}
                customerId={customer.id}
                customerName={customer.name}
                onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}
                onLoadError={(m) => onError(m)}
                title="General contact"
                hasBidsAbove={hasBids}
              />
            )
            return (
              <div
                key={customer.id}
                id={`builder-review-customer-${customer.id}`}
                data-deeplink-gen={customer.id === deepLinkHighlightCustomerId ? deepLinkHighlightGen : undefined}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  ...(customer.id === deepLinkHighlightCustomerId
                    ? {
                        backgroundColor: 'var(--bg-amber-tint)',
                        outline: '2px solid #d97706',
                        outlineOffset: -2,
                        transition: 'background-color 0.25s ease, outline-color 0.25s ease',
                      }
                    : {}),
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleBuilderReviewCard(customer.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuilderReviewCard(customer.id) } }}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    background: 'var(--bg-subtle)',
                    borderBottom: isCardExpanded ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} aria-hidden>{isCardExpanded ? '\u25BC' : '\u25B6'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div>
                        <strong>{customer.name}</strong>
                        {customer.address && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{customer.address}</span>}
                      </div>
                      {customer.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer' }}
                          title={`View ${customer.address} on map`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                            <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                          </svg>
                        </a>
                      )}
                      {(() => {
                        const stats = builderBidMapStats.get(customer.id)
                        if (!stats) return null
                        const chip = (label: string, bg: string, color: string) => (
                          <span style={{ background: bg, color, borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {label}
                          </span>
                        )
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {stats.hasAddress && (
                              <button
                                type="button"
                                data-builder-map-customer-id={customer.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/map?builder=${encodeURIComponent(customer.id)}`)
                                }}
                                title="See this builder's bids on the map, colored by won / lost / pending"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.15rem 0.5rem',
                                  background: 'var(--bg-blue-tint)',
                                  border: '1px solid #3b82f6',
                                  borderRadius: 6,
                                  color: 'var(--text-blue-700)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11z" />
                                  <circle cx="12" cy="10" r="2.5" />
                                </svg>
                                Bid map
                              </button>
                            )}
                            {stats.counts.won > 0 && chip(`${stats.counts.won} won`, 'var(--bg-green-100)', 'var(--text-green-700)')}
                            {stats.counts.lost > 0 && chip(`${stats.counts.lost} lost`, 'var(--bg-red-100)', 'var(--text-red-700)')}
                            {stats.counts.pending > 0 && chip(`${stats.counts.pending} pending`, 'var(--bg-amber-tint)', 'var(--text-amber-800)')}
                            {stats.counts.hitRatePct !== null && chip(`${stats.counts.hitRatePct}% hit rate`, 'var(--bg-blue-tint)', 'var(--text-blue-700)')}
                            {(() => {
                              const openValue = formatOpenPipelineValue(
                                builderOpenPipelineValue([...brUnsent, ...brPending]),
                              )
                              return openValue ? chip(`${openValue} open`, 'var(--bg-muted)', 'var(--text-700)') : null
                            })()}
                          </span>
                        )
                      })()}
                      {(() => {
                        const contactInfo = extractContactInfo(customer.contact_info ?? null)
                        const phone = contactInfo.phone?.trim()
                        const email = contactInfo.email?.trim()
                        return (
                          <>
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                                title={`Call ${phone}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                  <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z" />
                                </svg>
                                {phone}
                              </a>
                            )}
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer' }}
                                title={`Email ${email}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                  <path d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z" />
                                </svg>
                              </a>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Ignore when Oldest first is selected">
                      <input
                        type="checkbox"
                        checked={builderReviewPiaCustomerIds.has(customer.id)}
                        onChange={(e) => toggleBuilderReviewPia(customer.id, e.target.checked)}
                      />
                      PIA
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSnoozeModalCustomer(customer)
                        setSnoozeDateInput('')
                        setSnoozeNoteInput('')
                      }}
                      title="Snooze — hide from the call queue until a date (shared with the team)"
                      style={{ padding: '0.25rem 0.6rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      Snooze ▾
                    </button>
                    {(() => {
                      const badge = nextFollowupBadge(nextFollowupByCustomer[customer.id], Date.now())
                      if (!badge) return null
                      return (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.55rem',
                            borderRadius: 999,
                            background: badge.overdue ? 'var(--bg-red-100)' : 'var(--bg-blue-tint)',
                            color: badge.overdue ? 'var(--text-red-700)' : 'var(--text-blue-700)',
                            whiteSpace: 'nowrap',
                          }}
                          title={badge.overdue ? 'Promised follow-up is due — this floats the builder to the queue top' : 'Promised follow-up — parked below the queue until due'}
                        >
                          {badge.overdue ? '⚠ ' : ''}
                          {badge.label}
                        </span>
                      )
                    })()}
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Last contact: {lastContact ? formatTimeSinceLastContact(lastContact) : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAddContactPersonModalCustomer(customer)
                        setEditingContactPerson(null)
                        setContactPersonName('')
                        setContactPersonPhones([''])
                        setContactPersonEmail('')
                        setContactPersonNote('')
                      }}
                      title="Add contact person"
                      style={{ padding: '0.375rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <CustomerContactCardIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onNewBidWithCustomer(customer) }}
                      title="New Bid"
                      style={{ padding: '0.375rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}
                    >
                      <span style={{ lineHeight: 1 }}>+</span>
                      New Bid
                    </button>
                  </div>
                </div>
                {isCardExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: narrowViewport640 ? 'column' : 'row',
                        gap: narrowViewport640 ? '1rem' : '1.5rem',
                        padding: '0.75rem 1.25rem',
                      }}
                    >
                      {narrowViewport640 ? (
                        <>
                          {builderReviewOutcomeSections ? (
                            <div style={{ flex: 1, minWidth: 0 }}>{builderReviewOutcomeSections}</div>
                          ) : null}
                          {renderBuilderReviewContactPersonsBlock(customer, { width: '100%', minWidth: 0 })}
                          {builderReviewGeneralContactTable}
                        </>
                      ) : (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {builderReviewOutcomeSections}
                            {builderReviewGeneralContactTable}
                          </div>
                          {renderBuilderReviewContactPersonsBlock(customer, { width: 220, flexShrink: 0 })}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCallSessionCustomer(customer)
                        }}
                        title="Walk every open bid while they're on the phone, then promise the next follow-up"
                        style={{ padding: '0.375rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                      >
                        📞 Start call session
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          printHtmlInNewWindow(buildBuilderCallSheetHtml(makeCallSheetBuilder(customer), callSheetGeneratedLabel()))
                        }}
                        title="One-page printable sheet: this builder's people, numbers, and open bids"
                        style={{ marginRight: 'auto', padding: '0.375rem 0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                      >
                        Call sheet
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          editCustomerModal?.openEditCustomerModal(customer.id, {
                            onSaved: onLoadCustomers,
                            onDeleted: (id) => onSetCustomers((prev) => prev.filter((c) => c.id !== id)),
                            onMerged: ({ removedId }) =>
                              queueMicrotask(() => onSetCustomers((prev) => prev.filter((c) => c.id !== removedId))),
                          })
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: 'var(--bg-muted)',
                          color: 'var(--text-700)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Edit Customer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {builderReviewCustomersFiltered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
              {builderReviewSearchQuery.trim() ? 'No builders match your search.' : 'No builders with bids in the queue.'}
            </div>
          )}
          {snoozedCustomersExcluded.length > 0 && (
            <div style={{ marginTop: '0.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Snoozed — back in the queue on their wake date
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {snoozedCustomersExcluded.map((customer) => {
                  const snooze = snoozeByCustomer[customer.id]
                  if (!snooze) return null
                  return (
                    <div key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <strong>{customer.name}</strong>
                      <span style={{ color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                        until {new Date(snooze.until).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </span>
                      {snooze.note && <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>“{snooze.note}”</span>}
                      <button
                        type="button"
                        onClick={() => void saveSnooze(customer.id, null, '')}
                        style={{ padding: '0.15rem 0.55rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer', fontSize: '0.72rem' }}
                      >
                        Wake now
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {quietBuilders.length > 0 && (
            <div style={{ marginTop: '0.5rem', border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--bg-muted)' }}>
              <button
                type="button"
                onClick={() => setQuietBuildersOpen((v) => !v)}
                style={{ width: '100%', textAlign: 'left', padding: '0.7rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600 }}
              >
                {quietBuildersOpen ? '▼' : '▶'} Quiet builders ({quietBuilders.length}) — no bids yet, kept out of the queue
              </button>
              {quietBuildersOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0 1rem 0.8rem' }}>
                  {quietBuilders.map((customer) => (
                    <div key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>{customer.name}</span>
                      {customer.address && <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{customer.address}</span>}
                      <button
                        type="button"
                        onClick={() => onNewBidWithCustomer(customer)}
                        style={{ padding: '0.15rem 0.55rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer', fontSize: '0.72rem' }}
                      >
                        + New Bid
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editCustomerModal?.openEditCustomerModal(customer.id, {
                            onSaved: onLoadCustomers,
                            onDeleted: (id) => onSetCustomers((prev) => prev.filter((c) => c.id !== id)),
                            onMerged: ({ removedId }) => queueMicrotask(() => onSetCustomers((prev) => prev.filter((c) => c.id !== removedId))),
                          })
                        }
                        style={{ padding: '0.15rem 0.55rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer', fontSize: '0.72rem' }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {builderReviewPiaCustomersExcluded.length > 0 && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>PIA (excluded from Oldest first)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {builderReviewPiaCustomersExcluded.map((customer) => (
                  <label key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleBuilderReviewPia(customer.id, false)}
                    />
                    {customer.name}
                    {customer.address && <span style={{ color: 'var(--text-muted)' }}>{customer.address}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {callSessionCustomer && authUser?.id && (
        <BuilderCallSessionModal
          customer={callSessionCustomer}
          openBids={bids.filter((b) => {
            if (b.customer_id !== callSessionCustomer.id) return false
            const s = getSubmissionSectionKey(b)
            return s === 'unsent' || s === 'pending'
          })}
          contactPersons={customerContactPersons.filter((cp) => cp.customer_id === callSessionCustomer.id)}
          lastContactIso={customerLastContactMap.get(callSessionCustomer.id) ?? null}
          hitRatePct={builderBidMapStats.get(callSessionCustomer.id)?.counts.hitRatePct ?? null}
          authUserId={authUser.id}
          onClose={() => setCallSessionCustomer(null)}
          onSaved={() => {
            const cid = callSessionCustomer.id
            setCallSessionCustomer(null)
            setNotesRefreshNonce((prev) => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }))
            void loadFollowupPrefs().catch(() => {})
            onReloadCustomerContacts()
            onReloadBids()
          }}
          onError={onError}
        />
      )}

      {snoozeModalCustomer && (
        <ModalShell zIndex={1000}>
          <h3 style={{ margin: '0 0 0.5rem' }}>Snooze {snoozeModalCustomer.name}</h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Hides this builder from the Oldest-first call queue until the wake date. Everyone on the team sees the snooze.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {[
              { label: '1 week', days: 7 },
              { label: '2 weeks', days: 14 },
              { label: '1 month', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                type="button"
                disabled={savingSnooze}
                onClick={() => {
                  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
                  void saveSnooze(snoozeModalCustomer.id, until.toISOString(), snoozeNoteInput)
                }}
                style={{ padding: '0.4rem 0.85rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={snoozeDateInput}
              onChange={(e) => setSnoozeDateInput(e.target.value)}
              aria-label="Snooze until date"
              style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.85rem' }}
            />
          </div>
          <input
            type="text"
            value={snoozeNoteInput}
            onChange={(e) => setSnoozeNoteInput(e.target.value)}
            placeholder="Why? (optional — e.g. “awarding after board mtg”)"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', marginBottom: '0.9rem', fontSize: '0.9rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            {snoozeByCustomer[snoozeModalCustomer.id] && (
              <button
                type="button"
                disabled={savingSnooze}
                onClick={() => void saveSnooze(snoozeModalCustomer.id, null, '')}
                style={{ marginRight: 'auto', padding: '0.45rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Wake now
              </button>
            )}
            <button
              type="button"
              onClick={() => setSnoozeModalCustomer(null)}
              style={{ padding: '0.45rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingSnooze || !snoozeDateInput}
              onClick={() => {
                const until = new Date(`${snoozeDateInput}T08:00:00`)
                if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
                  onError('Pick a future date for the snooze.')
                  return
                }
                void saveSnooze(snoozeModalCustomer.id, until.toISOString(), snoozeNoteInput)
              }}
              style={{ padding: '0.45rem 0.9rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: savingSnooze || !snoozeDateInput ? 0.6 : 1 }}
            >
              {savingSnooze ? 'Saving…' : 'Snooze until date'}
            </button>
          </div>
        </ModalShell>
      )}

      {addContactPersonModalCustomer && (
        <ModalShell zIndex={1001} cardStyle={{ background: 'var(--surface)', padding: '1.5rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {editingContactPerson ? 'Edit contact person' : 'Add contact person'} – {addContactPersonModalCustomer.name}
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-name" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                id="contact-person-name"
                type="text"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                placeholder="Name"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone{contactPersonPhones.length > 1 ? 's' : ''}</label>
              {contactPersonPhones.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: i < contactPersonPhones.length - 1 ? '0.35rem' : 0 }}>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => setContactPersonPhones((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="Phone"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                  <button
                    type="button"
                    onClick={() => setContactPersonPhones((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                    title="Remove phone"
                    style={{ padding: '0.5rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', color: 'var(--text-red-800)', flexShrink: 0 }}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setContactPersonPhones((prev) => [...prev, ''])}
                style={{ marginTop: '0.35rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                + Add phone
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
              <input
                id="contact-person-email"
                type="email"
                value={contactPersonEmail}
                onChange={(e) => setContactPersonEmail(e.target.value)}
                placeholder="Email"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-note" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Note</label>
              <textarea
                id="contact-person-note"
                value={contactPersonNote}
                onChange={(e) => setContactPersonNote(e.target.value)}
                placeholder="Note"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingContactPerson || !contactPersonName.trim()}
                onClick={async () => {
                  if (!addContactPersonModalCustomer || !contactPersonName.trim()) return
                  setSavingContactPerson(true)
                  const phoneVal = contactPersonPhones.map((p) => p.trim()).filter(Boolean).join('\n') || null
                  if (editingContactPerson) {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .update({
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                      .eq('id', editingContactPerson.id)
                    setSavingContactPerson(false)
                    if (err) {
                      onError(`Failed to update contact: ${err.message}`)
                      return
                    }
                  } else {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .insert({
                        customer_id: addContactPersonModalCustomer.id,
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                    setSavingContactPerson(false)
                    if (err) {
                      onError(`Failed to save contact: ${err.message}`)
                      return
                    }
                  }
                  onReloadContactPersons()
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingContactPerson ? 'not-allowed' : 'pointer' }}
              >
                {savingContactPerson ? 'Saving…' : 'Save'}
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}
