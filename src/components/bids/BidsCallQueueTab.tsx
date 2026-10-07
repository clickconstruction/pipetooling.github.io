import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../../lib/bids/updateGuard'
import { formatCurrency } from '../../lib/format'
import {
  PENDING_CHASE_ACTIONS,
  buildPendingChaseActionWrites,
  type PendingChaseActionKey,
} from '../../lib/bidPendingChase'
import { suggestLossCategoryFromNote, type BidLossCategoryKey } from '../../lib/bidLossCategories'
import { entryGcIdFromPacketKey } from '../../lib/bids/bidContacts'
import {
  EMPTY_BID_TAB_VALUES,
  bidTabSummary,
  bidTabValuesFromRow,
  buildBidTabPatch,
  hasAnyBidTabValue,
  type BidTabValues,
} from '../../lib/bidTabCapture'
import { buildCallQueue, type CallQueueBid, type CallQueueBuilder } from '../../lib/bids/callQueue'
import {
  EMPTY_FOLLOWUP_PICK,
  applyFollowupToEntry,
  bidFollowupColumns,
  buildFollowupChangeEntry,
  builderFollowupYmd,
  followupDateLabel,
  followupReasonLabel,
  followupTag,
  noteWithoutFollowupSentence,
  type BidFollowup,
  type BidFollowupColumns,
  type FollowupPick,
} from '../../lib/bids/bidNextFollowup'
import { noteByLineFromEmbed } from '../../lib/noteCreatorDisplay'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { FollowupPickPanel, type FollowupPickPerson } from './FollowupPickPanel'
import { bidsAndPacketsLabel, scopeLabel, type BidSentScope } from '../../lib/bids/bidSentCounts'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { gcOutcomeRowsForBid, gcRowIsPacketScoped, type GcOutcomeRow } from '../../lib/bids/gcOutcomeRows'
import { setGcPacketLossCategory, setGcPacketOutcome } from '../../lib/bids/gcPacketOutcome'
import { cascadePackets, wonCascadeConfirmMessage, wonCascadeNeedsConfirm, wonCascadePlan } from '../../lib/bids/wonCascade'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { BidLossCategoryChips } from './BidLossCategoryChips'
import { BidTabCapturePanel } from './BidTabCapturePanel'
import { clearBidTabEntries, replaceBidTabEntries } from '../../lib/bids/bidTabEntriesData'
import type { BidTabEntryDraft } from '../../lib/bids/bidTabPaste'
import {
  type LedgerPrefixMap,
  bidNumberMatchesQuery,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { telHrefFor } from '../../lib/phoneContact'

export type BidsCallQueueTabProps = {
  bids: BidWithBuilder[]
  /** Tier-2 #20: the trade pill's scope — named in the header beside the counts. */
  sentScope: BidSentScope
  /** Per-bid GC packets — builder stats and rows count each GC's packet, not the bid. */
  gcPacketsByBid: Record<string, GcPacket[]>
  ledgerPrefixMap: LedgerPrefixMap
  /** Latest METHOD-entry instant per bid id (contacts only — v2.2413: method-less notes never count as contact). */
  lastContactFromEntries: Record<string, string>
  narrowViewport640: boolean
  authUserId: string | null
  onError: (message: string | null) => void
  onReloadBids: () => void
  /** Jump to this bid's builder card on the By-builder lens (call session lives there). */
  onOpenBuilderCard: (bid: BidWithBuilder) => void
  /** The people on every customer: who a call-again day can name (v2.4420). */
  contactPersons?: ReadonlyArray<{ id: string; customer_id: string; name: string; phone: string | null; note: string | null }>
  /** After a person is added to a customer from the queue. */
  onReloadContactPersons?: () => void
}

type QueueRowKey = 'chase' | 'reasons' | 'tabs'
/** The four pills over the queue: where the open bids stand today. */
type WhenKey = 'due' | 'overdue' | 'none' | 'later'
/** Contacts that end with "when do we call again?": the three questions open under the tap. */
const ASKS_CALL_AGAIN: ReadonlySet<PendingChaseActionKey> = new Set(['left_message', 'still_pending', 'rebid'])

/** One queue entry = one bid × one GC (Bids by GC, v2.2164). `id` stays the bid id (writes); `rowKey` is unique. */
type MappedBid = CallQueueBid & {
  rowKey: string
  label: string
  project: string
  raw: BidWithBuilder
  gc: GcOutcomeRow
  /** The bid's call-again day, who and why, off the bid row. */
  followupCols: BidFollowupColumns
  /** The customer this row's people belong to: the row's GC, else the bid's customer. */
  peopleCustomerId: string | null
}

const taskLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  padding: '0.42rem 1.2rem 0.34rem 0',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}
const cellStyle: CSSProperties = { padding: '0.34rem 1.2rem 0.34rem 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top', cursor: 'pointer' }

function bidLensLabel(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): string {
  const num = (bid.bid_number ?? '').trim()
  if (!num) return (bid.project_name ?? '').trim() || bid.id.slice(0, 8)
  return formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num)
}

function builderPhoneOf(bid: BidWithBuilder): string | null {
  const info = bid.customers?.contact_info as { phone?: string } | null
  const phone = (info?.phone ?? '').trim()
  if (phone) return phone
  const gcPhone = ((bid.bids_gc_builders as { phone?: string | null } | null)?.phone ?? '').trim()
  return gcPhone || null
}

function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[2])}/${Number(m[3])}`
}

/**
 * The Call queue (v2.2105) — Followup's new one-queue view. One card per
 * builder with a fixed To do / Done table (Chase · Loss reasons · Bid tabs);
 * rows drop open in place to the bids behind the number with the app's
 * existing one-tap collectors. The old four lenses stay untouched next door.
 */
export function BidsCallQueueTab({
  bids,
  sentScope,
  gcPacketsByBid,
  ledgerPrefixMap,
  lastContactFromEntries,
  narrowViewport640,
  authUserId,
  onError,
  onReloadBids,
  onOpenBuilderCard,
  contactPersons,
  onReloadContactPersons,
}: BidsCallQueueTabProps) {
  const confirmDialog = useConfirmDialog()
  const { role: authRole } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKey, setFilterKey] = useState<'all' | QueueRowKey>('all')
  const [openRow, setOpenRow] = useState<{ builderKey: string; row: QueueRowKey } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [lostPickerBidId, setLostPickerBidId] = useState<string | null>(null)
  const [tabOpenBidId, setTabOpenBidId] = useState<string | null>(null)
  const [savingBidId, setSavingBidId] = useState<string | null>(null)
  // Call-again days (v2.4420). `pickFor` is the row whose three questions are open: under a
  // contact tap, or as "change date" on a parked bid.
  const [whenKey, setWhenKey] = useState<WhenKey | null>(null)
  const [laterOpen, setLaterOpen] = useState(false)
  const [pickFor, setPickFor] = useState<{ rowKey: string; action: PendingChaseActionKey | 'change' } | null>(null)
  const [pick, setPick] = useState<FollowupPick>(EMPTY_FOLLOWUP_PICK)
  const [builderPrefs, setBuilderPrefs] = useState<Record<string, { next_followup_at: string | null; snoozed_until: string | null }>>({})
  const [setByEntryId, setSetByEntryId] = useState<Record<string, { text: string; iso: string; by: string }>>({})

  // One instant per mount keeps every memo on the same clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])
  const todayYmd = useMemo(() => todayYmdInAppTz(new Date(nowIso)), [nowIso])

  // The builder's own day (the call window's "Next follow-up", or a snooze): a bid with no day
  // of its own takes it. Fail-soft: without it bids stand on their own days.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(async () => supabase.from('customer_followup_prefs').select('customer_id, next_followup_at, snoozed_until'), 'load builder follow-up dates')
        if (cancelled || !Array.isArray(rows)) return
        const next: Record<string, { next_followup_at: string | null; snoozed_until: string | null }> = {}
        for (const r of rows as Array<{ customer_id: string; next_followup_at: string | null; snoozed_until: string | null }>) {
          next[r.customer_id] = { next_followup_at: r.next_followup_at, snoozed_until: r.snoozed_until }
        }
        setBuilderPrefs(next)
      } catch {
        // quiet
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mapped = useMemo<MappedBid[]>(
    () =>
      bids.flatMap((b) => {
        const builderName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
        const builderKey = b.customer_id ?? b.gc_builder_id ?? builderName
        const fromBid = b.last_contact ?? null
        const fromEntries = lastContactFromEntries[b.id] ?? null
        const lastContactIso =
          fromBid && fromEntries ? (fromBid > fromEntries ? fromBid : fromEntries) : fromBid ?? fromEntries
        const followupCols = bidFollowupColumns(b)
        // Bids by GC: one entry per GC the bid went to, with that GC's outcome / value / reason.
        return gcOutcomeRowsForBid(b, { key: builderKey, name: builderName }, gcPacketsByBid[b.id]).map((row) => ({
          id: b.id,
          rowKey: row.packetKey ? `${b.id}:${row.gcKey}` : b.id,
          builderKey: row.gcKey,
          builderName: row.gcName,
          phone: row.gcKey === builderKey ? builderPhoneOf(b) : null,
          value: row.value,
          outcome: row.outcome,
          sentIso: row.sentOn ?? b.bid_date_sent ?? null,
          lastContactIso,
          lossCategory: row.lossCategory,
          hasTab: bidTabValuesFromRow(b).low != null,
          // One day per bid: every GC row of the bid shares it.
          nextFollowupYmd: followupCols.nextYmd,
          followupCols,
          peopleCustomerId: entryGcIdFromPacketKey(row.packetKey) ?? b.customer_id ?? null,
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          raw: b,
          gc: row,
        }))
      }),
    [bids, gcPacketsByBid, lastContactFromEntries, ledgerPrefixMap],
  )

  const builderNextYmdByKey = useMemo(() => {
    const out: Record<string, string | null> = {}
    for (const [customerId, prefs] of Object.entries(builderPrefs)) out[customerId] = builderFollowupYmd(prefs, todayYmd)
    return out
  }, [builderPrefs, todayYmd])

  const queue = useMemo(() => buildCallQueue(mapped, nowIso, { todayYmd, builderNextYmdByKey }), [mapped, nowIso, todayYmd, builderNextYmdByKey])
  const followupOf = (b: CallQueueBid): BidFollowup | null => queue.followupByBid.get(b) ?? null

  const personById = useMemo(() => {
    const map = new Map<string, FollowupPickPerson & { customer_id: string }>()
    for (const p of contactPersons ?? []) map.set(p.id, p)
    return map
  }, [contactPersons])
  const peopleFor = (b: MappedBid): FollowupPickPerson[] => (b.peopleCustomerId ? (contactPersons ?? []).filter((p) => p.customer_id === b.peopleCustomerId) : [])

  // "Last time": the log entry each open bid's day came from: what was said, when, by whom.
  const dayEntryIdsKey = useMemo(
    () => [...new Set(mapped.filter((b) => b.outcome === 'pending' && b.followupCols.entryId).map((b) => b.followupCols.entryId as string))].sort().join(','),
    [mapped],
  )
  useEffect(() => {
    if (!dayEntryIdsKey) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids_submission_entries')
              .select('id, notes, occurred_at, created_by_user:users!bids_submission_entries_created_by_fkey(name, email)')
              .in('id', dayEntryIdsKey.split(',')),
          'load call-again notes',
        )
        if (cancelled || !Array.isArray(rows)) return
        const next: Record<string, { text: string; iso: string; by: string }> = {}
        for (const r of rows as Array<{ id: string; notes: string | null; occurred_at: string; created_by_user?: Parameters<typeof noteByLineFromEmbed>[0] }>) {
          next[r.id] = { text: noteWithoutFollowupSentence(r.notes), iso: r.occurred_at, by: noteByLineFromEmbed(r.created_by_user).replace(/^By /, '') }
        }
        setSetByEntryId(next)
      } catch {
        // quiet: the card just does not say what was said last time
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dayEntryIdsKey])
  const bidsByBuilder = useMemo(() => {
    const map = new Map<string, MappedBid[]>()
    for (const b of mapped) {
      const list = map.get(b.builderKey)
      if (list) list.push(b)
      else map.set(b.builderKey, [b])
    }
    return map
  }, [mapped])

  const visibleBuilders = useMemo(() => {
    let list = queue.builders
    if (filterKey !== 'all') list = list.filter((b) => b[filterKey].todo.length > 0)
    if (whenKey === 'later') list = list.filter((b) => b.chase.later.length > 0)
    else if (whenKey) list = list.filter((b) => b.chase.todo.some((x) => queue.followupByBid.get(x)?.state === whenKey))
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (b) =>
          b.builderName.toLowerCase().includes(q) ||
          (bidsByBuilder.get(b.builderKey) ?? []).some(
            (x) =>
              x.project.toLowerCase().includes(q) ||
              x.label.toLowerCase().includes(q) ||
              bidNumberMatchesQuery(x.raw, searchQuery, ledgerPrefixMap),
          ),
      )
    }
    return list
  }, [queue.builders, queue.followupByBid, filterKey, whenKey, searchQuery, bidsByBuilder, ledgerPrefixMap])

  /** Parked bids of the builders in view, soonest day first. */
  const laterRows = useMemo(() => {
    const rows = visibleBuilders.flatMap((builder) => builder.chase.later.map((cb) => ({ builder, b: cb as MappedBid, f: queue.followupByBid.get(cb)! })))
    return rows.sort((x, y) => ((x.f.dueYmd ?? '') < (y.f.dueYmd ?? '') ? -1 : (x.f.dueYmd ?? '') > (y.f.dueYmd ?? '') ? 1 : x.builder.builderName.localeCompare(y.builder.builderName)))
  }, [visibleBuilders, queue.followupByBid])

  function openPick(b: MappedBid, action: PendingChaseActionKey | 'change') {
    setLostPickerBidId(null)
    setTabOpenBidId(null)
    if (action === 'change') {
      // Start from the day the bid has: its own, or the builder's it is standing on.
      const person = b.followupCols.personId ? personById.get(b.followupCols.personId) : null
      setPick({ ymd: followupOf(b)?.dueYmd ?? b.followupCols.nextYmd, personId: person?.id ?? null, personName: person?.name ?? null, reason: b.followupCols.reason })
    } else {
      setPick(EMPTY_FOLLOWUP_PICK)
    }
    setPickFor({ rowKey: b.rowKey, action })
  }

  /** "+ person" in the questions: the person joins the customer for good. */
  async function addPersonFor(b: MappedBid, name: string, phone: string): Promise<FollowupPickPerson | null> {
    if (!b.peopleCustomerId) return null
    try {
      const rows = await withSupabaseRetry(
        async () => supabase.from('customer_contact_persons').insert({ customer_id: b.peopleCustomerId as string, name, phone: phone || null }).select('id, name, phone, note'),
        'add contact person',
      )
      const made = Array.isArray(rows) ? (rows[0] as FollowupPickPerson | undefined) : undefined
      if (!made) throw new Error('nothing was saved')
      onError(null)
      onReloadContactPersons?.()
      return made
    } catch (err) {
      onError(err instanceof Error ? `Could not add the person: ${err.message}` : 'Could not add the person.')
      return null
    }
  }

  /** A day moved, or removed, with no call: a note in the log, never a contact. */
  function saveDayChange(b: MappedBid, next: FollowupPick) {
    if (!authUserId) {
      onError('You must be signed in to change the date.')
      return
    }
    if (savingBidId) return
    const entry = buildFollowupChangeEntry({ bidId: b.id, userId: authUserId, nowIso: new Date().toISOString(), gcCustomerId: entryGcIdFromPacketKey(b.gc.packetKey), pick: next, todayYmd })
    setSavingBidId(b.id)
    void (async () => {
      try {
        await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(entry), 'save call-again date')
        onError(null)
        setPickFor(null)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save the date: ${err.message}` : 'Could not save the date.')
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  function toggleRow(builderKey: string, row: QueueRowKey) {
    setNoteDraft('')
    setLostPickerBidId(null)
    setTabOpenBidId(null)
    setPickFor(null)
    setOpenRow((cur) => (cur && cur.builderKey === builderKey && cur.row === row ? null : { builderKey, row }))
  }

  /** Multi-GC bid rows carry their own answer and reason (a packet); single-GC rows write the bid as always. */
  function packetScoped(b: MappedBid): boolean {
    return gcRowIsPacketScoped(b.gc)
  }

  /** One chase tap — entry + last_contact stamp (+ outcome / tab when given), then reload.
      Tier-2 #21: a Won on a multi-GC row states the cascade (other GCs Lost, bid Won) before writing. */
  function chaseAction(b: MappedBid, action: PendingChaseActionKey, lossCategory: BidLossCategoryKey | null = null, tab: BidTabValues | null = null, tabEntries: BidTabEntryDraft[] | null = null, followup: FollowupPick = EMPTY_FOLLOWUP_PICK) {
    if (action === 'won' && packetScoped(b) && b.gc.packetKey != null) {
      const plan = wonCascadePlan({ outcome: b.raw.outcome ?? null }, cascadePackets(gcPacketsByBid[b.id] ?? []), b.gc.packetKey)
      if (wonCascadeNeedsConfirm(plan)) {
        void confirmDialog({ message: wonCascadeConfirmMessage(plan, { gcName: b.gc.gcName }), confirmLabel: 'Mark won' }).then((ok) => {
          if (ok) chaseActionNow(b, action, lossCategory, tab, tabEntries)
        })
        return
      }
    }
    chaseActionNow(b, action, lossCategory, tab, tabEntries, followup)
  }

  function chaseActionNow(b: MappedBid, action: PendingChaseActionKey, lossCategory: BidLossCategoryKey | null = null, tab: BidTabValues | null = null, tabEntries: BidTabEntryDraft[] | null = null, followup: FollowupPick = EMPTY_FOLLOWUP_PICK) {
    if (!authUserId) {
      onError('You must be signed in to log a call.')
      return
    }
    if (savingBidId) return
    const writes = buildPendingChaseActionWrites({
      bidId: b.id,
      userId: authUserId,
      nowIso: new Date().toISOString(),
      action,
      note: noteDraft,
      lossCategory,
      // Per-GC Phase 1: the call is with THIS row's GC — stamp the entry.
      gcCustomerId: entryGcIdFromPacketKey(b.gc.packetKey),
    })
    // The day to call again rides the same log row: the columns, and a plain sentence in the note.
    const entry = applyFollowupToEntry(writes.entry, followup, todayYmd)
    setSavingBidId(b.id)
    setNoteDraft('')
    setLostPickerBidId(null)
    setTabOpenBidId(null)
    setPickFor(null)
    void (async () => {
      try {
        await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(entry), 'log call note')
        // Per-GC Phase 1: the entry insert above fires the last_contact sync trigger — no hand-bump.
        const patch: Record<string, string | number | null> = {}
        if (writes.outcomeUpdate && packetScoped(b)) {
          // Multi-GC bid: the answer is this GC's, not the bid's — write the packet; the bid rolls up.
          const packets = gcPacketsByBid[b.id] ?? []
          const res = await setGcPacketOutcome({
            bidId: b.id,
            bidOutcome: b.raw.outcome ?? null,
            versionIds: b.gc.versionIds,
            outcome: writes.outcomeUpdate.outcome,
            packetsAfter: packets.map((x) => ({ key: x.key, name: x.name, outcome: x.key === b.gc.packetKey ? writes.outcomeUpdate!.outcome : x.outcome, sentOn: x.sentOn, versionIds: x.versions.map((v) => v.id), sharedLetter: x.sharedLetter })),
            actor: { userId: authUserId, role: authRole, path: 'call-queue' },
          })
          if (res.error) throw new Error(res.error)
          if (writes.outcomeUpdate.outcome === 'lost' && writes.outcomeUpdate.loss_category) {
            await setGcPacketLossCategory({ versionIds: b.gc.versionIds, category: writes.outcomeUpdate.loss_category, note: writes.outcomeUpdate.loss_reason })
          }
          window.dispatchEvent(new Event('bid-gc-outcome-changed'))
        } else if (writes.outcomeUpdate) {
          patch.outcome = writes.outcomeUpdate.outcome
          patch.loss_reason = writes.outcomeUpdate.loss_reason
          patch.loss_category = writes.outcomeUpdate.loss_category
        }
        if (tab && hasAnyBidTabValue(tab)) Object.assign(patch, buildBidTabPatch(tab))
        if (Object.keys(patch).length > 0) {
          const rows = await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'), 'save call outcome')
          if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        }
        onError(null)
        // Paste capture (v2.2296): the full per-bidder tab rides along. Fail-soft.
        if (tabEntries?.length) {
          const res = await replaceBidTabEntries(b.id, tabEntries, authUserId ?? null)
          if (!res.ok) onError('Tab summary saved, but the full bidder list could not be stored yet.')
        }
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not log the call: ${err.message}` : 'Could not log the call.')
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  /** Reason tap on a lost bid — patch only (recording a reason isn't a builder touch). */
  function saveReason(b: MappedBid, key: BidLossCategoryKey) {
    if (savingBidId) return
    setSavingBidId(b.id)
    const note = noteDraft.trim()
    const patch: Record<string, string | null> = { loss_category: key }
    if (note) patch.loss_reason = note
    setNoteDraft('')
    void (async () => {
      try {
        if (packetScoped(b)) {
          const res = await setGcPacketLossCategory({ versionIds: b.gc.versionIds, category: key, note: note || null })
          if (res.error) throw new Error(res.error)
          window.dispatchEvent(new Event('bid-gc-outcome-changed'))
        } else {
          const rows = await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'), 'save loss reason')
          if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        }
        onError(null)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save the reason: ${err.message}` : 'Could not save the reason.')
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  /** Tab save/edit outside a chase — patch only, like the lens doors. */
  function saveTab(b: MappedBid, values: BidTabValues, entries: BidTabEntryDraft[] | null = null) {
    if (savingBidId) return
    setSavingBidId(b.id)
    const patch: Record<string, number | null> = { ...buildBidTabPatch(values) }
    const clearing = !hasAnyBidTabValue(values)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'), 'save bid tab')
        if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        onError(null)
        // Paste capture (v2.2296): full per-bidder tab rides along; clears clear it. Fail-soft.
        if (entries?.length) {
          const res = await replaceBidTabEntries(b.id, entries, authUserId ?? null)
          if (!res.ok) onError('Tab summary saved, but the full bidder list could not be stored yet.')
        } else if (clearing) {
          await clearBidTabEntries(b.id)
        }
        setTabOpenBidId(null)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save the bid tab: ${err.message}` : 'Could not save the bid tab.')
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  const noteInputFor = (placeholder: string) => (
    <input
      type="text"
      value={noteDraft}
      onChange={(e) => setNoteDraft(e.target.value)}
      placeholder={placeholder}
      aria-label="Call note"
      style={{ flex: 1, minWidth: '14rem', maxWidth: '30rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.78rem', font: 'inherit' }}
    />
  )
  const noteInput = noteInputFor('what they said (optional — saved with the next tap)')

  function bidHeadline(b: MappedBid, extra: string) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          {b.label} · {b.project}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {b.value > 0 ? `$${formatCurrency(b.value)}` : 'no bid value'}
          {extra}
        </span>
      </div>
    )
  }

  const toneStyle: Record<'red' | 'amber' | 'blue', CSSProperties> = {
    red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)' },
    amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', border: '1px solid var(--border-amber)' },
    blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border-blue)' },
  }
  function dayTag(f: BidFollowup | null) {
    const tag = f ? followupTag(f, todayYmd) : null
    if (!tag) return null
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.08rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', ...toneStyle[tag.tone] }}>{tag.label}</span>
    )
  }

  /** Who to ask for, and what was said when the day was set. Only for a bid standing on its own day. */
  function promiseLine(b: MappedBid, f: BidFollowup | null) {
    if (!f || f.source !== 'bid') return null
    const person = b.followupCols.personId ? personById.get(b.followupCols.personId) : null
    // The person belongs to one GC: on a bid sent to two, name them only on their own GC's row.
    const personHere = person && (!b.peopleCustomerId || person.customer_id === b.peopleCustomerId) ? person : null
    const said = b.followupCols.entryId ? setByEntryId[b.followupCols.entryId] : undefined
    if (!personHere && !said) return null
    return (
      <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-700)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.55rem', maxWidth: '40rem' }}>
        {personHere ? (
          <div>
            Ask for <strong>{personHere.name}</strong>
            {personHere.phone ? (
              <>
                {' · '}
                <a href={telHrefFor(personHere.phone)} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
                  {'☎'} {personHere.phone}
                </a>
              </>
            ) : null}
          </div>
        ) : null}
        {said ? (
          <div>
            Last time, {followupDateLabel(calendarYmdInAppTzFromIso(said.iso), todayYmd)}
            {said.text ? (
              <>
                : <strong>“{said.text}”</strong>
              </>
            ) : null}
            <span style={{ color: 'var(--text-muted)' }}> — {said.by}</span>
          </div>
        ) : null}
      </div>
    )
  }

  function pickPanel(b: MappedBid, opts: { saveLabel: string; noDayHint: string; onSave: () => void; canRemove: boolean }) {
    return (
      <FollowupPickPanel
        todayYmd={todayYmd}
        value={pick}
        onChange={setPick}
        people={peopleFor(b)}
        onAddPerson={b.peopleCustomerId ? (name, phone) => addPersonFor(b, name, phone) : undefined}
        saving={savingBidId != null}
        saveLabel={opts.saveLabel}
        onSave={opts.onSave}
        onCancel={() => setPickFor(null)}
        noDayHint={opts.noDayHint}
        onRemove={opts.canRemove ? () => saveDayChange(b, EMPTY_FOLLOWUP_PICK) : undefined}
      />
    )
  }

  function renderExpansion(builder: CallQueueBuilder, row: QueueRowKey) {
    const expStyle: CSSProperties = {
      marginLeft: '0.2rem',
      borderLeft: '2px solid var(--border-strong)',
      padding: '0.5rem 0.7rem 0.6rem 0.85rem',
      background: 'var(--bg-page)',
      borderRadius: '0 8px 8px 0',
    }
    if (row === 'chase') {
      return (
        <div style={expStyle}>
          {builder.chase.todo.map((cb) => {
            const b = cb as MappedBid
            const quiet = b.lastContactIso ?? b.sentIso
            const quietDays = quiet ? Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(quiet)) / 86_400_000)) : null
            const f = followupOf(b)
            const promised = f != null && f.state !== 'none'
            const waiting = promised && f.source === 'bid' ? followupReasonLabel(b.followupCols.reason) : null
            const asking = pickFor && pickFor.rowKey === b.rowKey && pickFor.action !== 'change' ? pickFor.action : null
            return (
              <div key={b.rowKey} style={{ marginBottom: '0.55rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {bidHeadline(
                    b,
                    `${b.sentIso ? ` · sent ${shortDate(b.sentIso)}` : ''}${
                      promised ? (waiting && b.followupCols.reason !== 'other' ? ` · waiting on ${waiting.charAt(0).toLowerCase()}${waiting.slice(1)}` : '') : quietDays != null ? ` · quiet ${quietDays}d` : ''
                    }`,
                  )}
                  {dayTag(f)}
                </div>
                {promiseLine(b, f)}
                {lostPickerBidId === b.rowKey ? (
                  <div style={{ marginTop: '0.35rem' }}>
                    <BidLossCategoryChips value={null} onSelect={(key) => chaseAction(b, 'lost', key)} />
                  </div>
                ) : tabOpenBidId === b.rowKey ? (
                  <div style={{ marginTop: '0.35rem' }}>
                    <BidTabCapturePanel
                      key={b.rowKey}
                      ourValue={b.value}
                      initial={bidTabValuesFromRow(b.raw)}
                      saving={savingBidId != null}
                      onSave={(values, _noteLine, entries) => chaseAction(b, 'bid_tab', null, values, entries ?? null)}
                      secondaryLabel="Log without numbers"
                      onSecondary={() => chaseAction(b, 'bid_tab')}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {PENDING_CHASE_ACTIONS.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        disabled={savingBidId != null}
                        aria-pressed={ASKS_CALL_AGAIN.has(a.key) ? asking === a.key : undefined}
                        onClick={() => {
                          if (a.key === 'lost') {
                            setPickFor(null)
                            setLostPickerBidId(b.rowKey)
                          } else if (a.key === 'bid_tab') {
                            setPickFor(null)
                            setTabOpenBidId(b.rowKey)
                          } else if (ASKS_CALL_AGAIN.has(a.key)) {
                            // A second tap on the lit chip closes the questions without saving.
                            if (asking === a.key) setPickFor(null)
                            else openPick(b, a.key)
                          } else chaseAction(b, a.key)
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.22rem 0.6rem',
                          borderRadius: 999,
                          cursor: 'pointer',
                          border: asking === a.key ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                          background: asking === a.key ? '#3b82f6' : a.key === 'won' ? 'var(--bg-emerald-tint)' : a.key === 'lost' ? 'var(--bg-red-tint)' : 'var(--surface)',
                          color: asking === a.key ? '#fff' : a.key === 'won' ? 'var(--text-emerald-800)' : a.key === 'lost' ? 'var(--text-red-800)' : 'var(--text-700)',
                          opacity: savingBidId != null ? 0.6 : 1,
                          font: 'inherit',
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* With the questions open the note sits with them, above Save, not under it. */}
                {asking ? <div style={{ display: 'flex', marginTop: '0.45rem' }}>{noteInputFor('what they said (optional)')}</div> : null}
                {asking
                  ? pickPanel(b, {
                      saveLabel: 'Save',
                      noDayHint: 'No day picked: back in the queue in 7 days.',
                      onSave: () => chaseAction(b, asking, null, null, null, pick),
                      canRemove: false,
                    })
                  : null}
              </div>
            )
          })}
          {pickFor && pickFor.action !== 'change' && builder.chase.todo.some((cb) => (cb as MappedBid).rowKey === pickFor.rowKey) ? null : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{noteInput}</div>
          )}
        </div>
      )
    }
    if (row === 'reasons') {
      return (
        <div style={expStyle}>
          {builder.reasons.todo.map((cb) => {
            const b = cb as MappedBid
            return (
              <div key={b.rowKey} style={{ marginBottom: '0.55rem' }}>
                {bidHeadline(b, ' · lost — no reason yet')}
                <div style={{ marginTop: '0.35rem' }}>
                  <BidLossCategoryChips
                    value={null}
                    onSelect={(key) => saveReason(b, key)}
                    suggestedKey={suggestLossCategoryFromNote(b.raw.loss_reason)}
                    suggestedHint="suggested from the note"
                  />
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{noteInput}</div>
        </div>
      )
    }
    const recorded = (bidsByBuilder.get(builder.builderKey) ?? []).filter((b) => b.hasTab)
    return (
      <div style={expStyle}>
        {builder.tabs.todo.map((cb) => {
          const b = cb as MappedBid
          return (
            <div key={b.rowKey} style={{ marginBottom: '0.55rem' }}>
              {bidHeadline(b, `${b.outcome === 'lost' ? ' · lost' : b.sentIso ? ` · sent ${shortDate(b.sentIso)}` : ''}`)}
              {tabOpenBidId === b.rowKey ? (
                <div style={{ marginTop: '0.35rem' }}>
                  <BidTabCapturePanel
                    key={b.rowKey}
                    ourValue={b.value}
                    initial={bidTabValuesFromRow(b.raw)}
                    saving={savingBidId != null}
                    onSave={(values, _noteLine, entries) => saveTab(b, values, entries ?? null)}
                    secondaryLabel="Cancel"
                    onSecondary={() => setTabOpenBidId(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTabOpenBidId(b.rowKey)}
                  style={{ marginTop: '0.25rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.75rem' }}
                >
                  record the bid tab {'→'}
                </button>
              )}
            </div>
          )
        })}
        {recorded.length > 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {recorded.map((b) => (
              <div key={b.rowKey} style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                <span
                  style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.08rem 0.45rem', borderRadius: 999, background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)', letterSpacing: '0.03em' }}
                >
                  RECORDED
                </span>
                <span>
                  {b.project} — {bidTabSummary(bidTabValuesFromRow(b.raw), b.value)}
                </span>
                {tabOpenBidId !== b.rowKey ? (
                  <button
                    type="button"
                    onClick={() => setTabOpenBidId(b.rowKey)}
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.72rem' }}
                  >
                    edit
                  </button>
                ) : null}
                {tabOpenBidId === b.rowKey ? (
                  <div style={{ flexBasis: '100%', marginTop: '0.25rem' }}>
                    <BidTabCapturePanel
                      key={b.rowKey}
                      ourValue={b.value}
                      initial={bidTabValuesFromRow(b.raw)}
                      saving={savingBidId != null}
                      onSave={(values, _noteLine, entries) => saveTab(b, values, entries ?? null)}
                      secondaryLabel="Cancel"
                      onSecondary={() => setTabOpenBidId(null)}
                      onRemove={() => saveTab(b, EMPTY_BID_TAB_VALUES)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const filterChips: Array<{ key: 'all' | QueueRowKey; label: string; count?: number }> = [
    { key: 'all', label: 'All calls' },
    { key: 'chase', label: 'To chase', count: queue.totals.chaseCount },
    { key: 'reasons', label: 'Need a reason', count: queue.totals.reasonsCount },
    { key: 'tabs', label: 'Tab gettable', count: queue.totals.tabsCount },
  ]

  const whenPills: Array<{ key: WhenKey; label: string; count: number; title: string }> = [
    { key: 'due', label: 'Due', count: queue.totals.dueCount, title: 'Bids whose call-again day is today' },
    { key: 'overdue', label: 'Overdue', count: queue.totals.overdueCount, title: 'Bids whose call-again day has passed' },
    { key: 'none', label: 'No date yet', count: queue.totals.noDateCount, title: 'Bids with no day set and no contact in the last seven days' },
    { key: 'later', label: 'Later', count: queue.totals.laterCount, title: 'Bids parked on a day still ahead' },
  ]

  if (queue.builders.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
        No builders with decided or in-flight bids in this trade yet — the queue fills as bids go out.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-700)' }}>
            {queue.totals.buildersWithWork} builder{queue.totals.buildersWithWork === 1 ? '' : 's'} worth a call
          </strong>
          {/* Tier-2 #20: bids lead, GC packets follow — "96 bids · 99 GC packets to chase". */}
          {` · ${scopeLabel(sentScope)} · ${bidsAndPacketsLabel(queue.totals.chaseCount, queue.totals.chasePacketRows)} to chase · ${bidsAndPacketsLabel(queue.totals.reasonsCount, queue.totals.reasonsPacketRows, { one: 'loss', many: 'losses' })} need${queue.totals.reasonsCount === 1 ? 's' : ''} a reason · $${formatCurrency(queue.totals.reasonsDollars)} unexplained · ${queue.totals.tabsCount} tabs gettable`}
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search builders or bids…"
          aria-label="Search the call queue"
          style={{ flex: '1 1 11rem', minWidth: '10rem', maxWidth: '18rem', font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
      </div>
      {/* v2.4420: where the open bids stand today. A pill narrows the list; a second tap clears it. */}
      <div role="group" aria-label="Calls by when they are due" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.55rem 0 0' }}>
        {whenPills.map((w) => {
          const active = whenKey === w.key
          return (
            <button
              key={w.key}
              type="button"
              aria-pressed={active}
              title={w.title}
              onClick={() => {
                setWhenKey(active ? null : w.key)
                if (w.key === 'later' && !active) setLaterOpen(true)
              }}
              style={{
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                padding: '0.25rem 0.75rem',
                borderRadius: 999,
                cursor: 'pointer',
                border: `1px solid ${active ? '#3b82f6' : 'var(--border-strong)'}`,
                background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
                fontWeight: active ? 700 : 500,
              }}
            >
              {w.label}
              <span style={{ fontSize: '0.72rem', marginLeft: '0.3rem', fontWeight: 600, color: w.key === 'overdue' && w.count > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{w.count}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0 0.15rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Show</span>
        {filterChips.map((f) => {
          const active = filterKey === f.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilterKey(f.key)}
              style={{
                fontSize: '0.78rem',
                padding: '0.22rem 0.65rem',
                borderRadius: 999,
                cursor: 'pointer',
                border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                background: active ? 'var(--surface)' : 'transparent',
                color: 'var(--text-700)',
                fontWeight: active ? 600 : 400,
                // fontFamily, not the `font` shorthand: the shorthand beside a longhand resets on re-render (the v2.770 pill bug).
                fontFamily: 'inherit',
              }}
            >
              {f.label}
              {f.count != null ? <span style={{ opacity: 0.75, fontSize: '0.72rem', marginLeft: '0.25rem' }}>{f.count}</span> : null}
            </button>
          )
        })}
      </div>
      <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        One list, worked top to bottom. Calls you promised for a day come first, then whoever has waited longest. Every card
        shows the same three rows; click a row to open the bids behind the number right here. {'📞'} opens the builder card for
        a full call session.
      </p>

      {laterRows.length > 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', marginBottom: '0.6rem' }}>
          <button
            type="button"
            aria-expanded={laterOpen}
            onClick={() => setLaterOpen((v) => !v)}
            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', fontFamily: 'inherit', fontSize: '0.78rem', padding: '0.5rem 0.9rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-700)', textAlign: 'left' }}
          >
            <span>
              <span style={{ display: 'inline-block', width: '0.9rem' }}>{laterOpen ? '▾' : '▸'}</span>
              <strong>Later</strong> · {laterRows.length} bid{laterRows.length === 1 ? '' : 's'} waiting on a date
              {laterOpen ? '' : ` · next ${followupDateLabel(laterRows[0]!.f.dueYmd ?? todayYmd, todayYmd)}`}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>${formatCurrency(laterRows.reduce((sum, r) => sum + (Number.isFinite(r.b.value) ? r.b.value : 0), 0))} pending</span>
          </button>
          {laterOpen
            ? laterRows.map(({ builder, b, f }) => {
                const person = f.source === 'bid' && b.followupCols.personId ? personById.get(b.followupCols.personId) : null
                const personHere = person && (!b.peopleCustomerId || person.customer_id === b.peopleCustomerId) ? person : null
                const waiting = f.source === 'bid' ? followupReasonLabel(b.followupCols.reason) : null
                const changing = pickFor?.rowKey === b.rowKey && pickFor.action === 'change'
                return (
                  <div key={b.rowKey} data-testid="call-queue-later-row" style={{ borderTop: '1px solid var(--border)', padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem 0.9rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong style={{ minWidth: '6.2rem', fontVariantNumeric: 'tabular-nums' }}>{followupDateLabel(f.dueYmd ?? todayYmd, todayYmd)}</strong>
                      <span style={{ flex: '1 1 16rem' }}>
                        <strong>{builder.builderName}</strong> · {b.label} · {b.project}
                        {b.value > 0 ? ` · $${formatCurrency(b.value)}` : ''}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 12rem' }}>
                        {[waiting && b.followupCols.reason !== 'other' ? waiting : null, personHere ? `ask for ${personHere.name}` : null, f.source === 'builder' ? 'the builder’s date' : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => (changing ? setPickFor(null) : openPick(b, 'change'))}
                        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontFamily: 'inherit', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                      >
                        change date
                      </button>
                    </div>
                    {changing
                      ? pickPanel(b, {
                          saveLabel: 'Save the date',
                          noDayHint: 'Pick a day, or No date to put the bid back in the queue.',
                          onSave: () => {
                            if (pick.ymd) saveDayChange(b, pick)
                            else onError('Pick a day to call again, or use No date.')
                          },
                          canRemove: b.followupCols.nextYmd != null,
                        })
                      : null}
                  </div>
                )
              })
            : null}
        </div>
      ) : null}

      {whenKey === 'later' ? (
        laterRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No bid is waiting on a date. Pick a day under Left message or Still pending and it lands here.</p>
        ) : null
      ) : visibleBuilders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          {whenKey ? 'Nothing here today. Tap the pill again to see every call.' : 'Nothing matches — clear the search or switch the filter back to All calls.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {visibleBuilders.map((builder) => {
            const rows: Array<{ key: QueueRowKey; label: string; todo: string | null; todoSub: string | null; done: string }> = [
              {
                key: 'chase',
                label: 'Chase',
                todo: builder.chase.todo.length > 0 ? `${builder.chase.todo.length} pending` : null,
                todoSub:
                  builder.due?.state === 'overdue' ? `promised ${followupDateLabel(builder.due.earliestYmd ?? todayYmd, todayYmd)}`
                  : builder.due?.state === 'due' ? 'promised for today'
                  : builder.chase.oldestQuietDays != null ? `quiet ${builder.chase.oldestQuietDays}d`
                  : null,
                done: `${builder.chase.freshCount} of ${builder.stats.pending} fresh${builder.chase.later.length > 0 ? ` · ${builder.chase.later.length} later` : ''}`,
              },
              {
                key: 'reasons',
                label: 'Loss reasons',
                todo: builder.reasons.todo.length > 0 ? `${builder.reasons.todo.length} loss${builder.reasons.todo.length === 1 ? '' : 'es'}` : null,
                todoSub: builder.reasons.todo.length > 0 ? `$${formatCurrency(builder.reasons.dollars)}` : null,
                done: `${builder.reasons.recordedCount} of ${builder.stats.lost} recorded`,
              },
              {
                key: 'tabs',
                label: 'Bid tabs',
                todo: builder.tabs.todo.length > 0 ? `${builder.tabs.todo.length} gettable` : null,
                todoSub: null,
                done: `${builder.tabs.recordedCount} recorded`,
              },
            ]
            const open = openRow && openRow.builderKey === builder.builderKey ? openRow.row : null
            const anyBid = (bidsByBuilder.get(builder.builderKey) ?? [])[0]
            return (
              <div
                key={builder.builderKey}
                style={{
                  border: `1px solid ${builder.hasWork ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 10,
                  background: 'var(--surface)',
                  padding: '0.7rem 0.9rem',
                  boxShadow: builder.hasWork ? '0 2px 8px rgba(15, 23, 42, 0.07)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)' }}>{builder.builderName}</span>
                  {builder.due && builder.due.state !== 'none' ? dayTag(followupOf(builder.chase.todo[0]!)) : null}
                  {builder.phone ? (
                    <a href={telHrefFor(builder.phone)} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}>
                      {'☎'} {builder.phone}
                    </a>
                  ) : null}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {builder.stats.won} won · {builder.stats.lost} lost · {builder.stats.pending} pending
                    {builder.stats.hitRatePct != null ? ` · hit rate ${builder.stats.hitRatePct}%` : ''}
                    {builder.stats.pendingValue > 0 ? ` · pending $${formatCurrency(builder.stats.pendingValue)}` : ''}
                  </span>
                  {anyBid ? (
                    <button
                      type="button"
                      onClick={() => onOpenBuilderCard(anyBid.raw)}
                      title="Open the builder card on By builder — contacts, notes, and the full call session"
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.8125rem',
                        fontWeight: builder.hasWork ? 700 : 400,
                        padding: '0.3rem 0.8rem',
                        borderRadius: 8,
                        border: builder.hasWork ? 'none' : '1px solid var(--border-strong)',
                        background: builder.hasWork ? '#3b82f6' : 'transparent',
                        color: builder.hasWork ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        font: 'inherit',
                      }}
                    >
                      {'📞'} {builder.hasWork ? 'Start call' : 'Call anyway'}
                    </button>
                  ) : null}
                </div>

                <div style={{ overflowX: narrowViewport640 ? 'auto' : 'visible' }}>
                  <table style={{ borderCollapse: 'collapse', marginTop: '0.45rem', fontSize: '0.8125rem', width: '100%', maxWidth: '46rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '7.5rem', borderBottom: '1px solid var(--border-strong)' }} aria-hidden />
                        <th style={{ textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, padding: '0.15rem 1.2rem 0.15rem 0', borderBottom: '1px solid var(--border-strong)' }}>To do</th>
                        <th style={{ textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, padding: '0.15rem 0 0.15rem 0', borderBottom: '1px solid var(--border-strong)' }}>Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <FragmentRow
                          key={r.key}
                          row={r}
                          open={open === r.key}
                          onToggle={() => toggleRow(builder.builderKey, r.key)}
                          expansion={open === r.key ? renderExpansion(builder, r.key) : null}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FragmentRow({
  row,
  open,
  onToggle,
  expansion,
}: {
  row: { key: QueueRowKey; label: string; todo: string | null; todoSub: string | null; done: string }
  open: boolean
  onToggle: () => void
  expansion: React.ReactNode
}) {
  return (
    <>
      <tr>
        <td style={{ ...taskLabelStyle, ...(open ? { borderBottom: 'none' } : null) }} onClick={onToggle} aria-expanded={open} role="button">
          <span style={{ display: 'inline-block', width: '0.9rem' }}>{open ? '▾' : '▸'}</span>
          {row.label}
        </td>
        <td style={{ ...cellStyle, ...(open ? { borderBottom: 'none' } : null) }} onClick={onToggle}>
          {row.todo ? (
            <>
              <span style={{ color: 'var(--text-strong)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.todo}</span>
              {row.todoSub ? <span style={{ color: 'var(--text-muted)' }}> — {row.todoSub}</span> : null}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
        <td style={{ ...cellStyle, color: 'var(--text-muted)', ...(open ? { borderBottom: 'none' } : null) }} onClick={onToggle}>
          {row.done}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={3} style={{ padding: '0 0 0.55rem 0', borderBottom: '1px solid var(--border)' }}>
            {expansion}
          </td>
        </tr>
      ) : null}
    </>
  )
}
