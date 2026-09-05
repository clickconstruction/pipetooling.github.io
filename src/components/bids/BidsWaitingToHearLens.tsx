import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { type BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import { BidRoomStateChip } from './BidRoomStateChip'
import { BidWonJobActions } from './BidWonJobActions'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from '../../lib/bids/updateGuard'
import { formatCurrency } from '../../lib/format'
import { entryGcIdFromPacketKey } from '../../lib/bids/bidContacts'
import { bidBoardLastContactParts } from '../../lib/bids/bidBoardDateCells'
import { bidAddressMapsUrl } from '../../lib/buildBidPricingPackageHtml'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  PENDING_CHASE_ACTIONS,
  PENDING_CHASE_STALE_CONTACT_DAYS,
  bidNeedsChase,
  buildPendingChaseActionWrites,
  buildPendingChaseRollup,
  groupPendingChaseByBuilder,
  nextPendingChaseBidIndex,
  type PendingChaseActionKey,
  type PendingChaseBid,
} from '../../lib/bidPendingChase'
import { BID_LOSS_CATEGORIES, type BidLossCategoryKey } from '../../lib/bidLossCategories'
import {
  EMPTY_BID_TAB_VALUES,
  bidTabValuesFromRow,
  buildBidTabPatch,
  hasAnyBidTabValue,
  type BidTabRow,
  type BidTabValues,
} from '../../lib/bidTabCapture'
import { BidTabCapturePanel, BidTabEntriesLadder, BidTabRecordedLine } from './BidTabCapturePanel'
import { clearBidTabEntries, fetchBidTabEntries, replaceBidTabEntries, type BidTabEntryRow } from '../../lib/bids/bidTabEntriesData'
import type { BidTabEntryDraft } from '../../lib/bids/bidTabPaste'
import { looksLikeCombinedGcName, type BidGcRecipientsMap } from '../../lib/bids/bidGcRecipients'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { gcOutcomeRowsForBid, gcRowIsPacketScoped, type GcOutcomeRow } from '../../lib/bids/gcOutcomeRows'
import { setGcPacketLossCategory, setGcPacketOutcome } from '../../lib/bids/gcPacketOutcome'
import {
  type LedgerPrefixMap,
  bidNumberMatchesQuery,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import { bidTriagePillLabel } from '../../lib/bids/bidFormatting'
import { buildBidStory, buildSiblingLines, type StorySourceEntry } from '../../lib/bids/followupStorySoFar'
import { SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR, noteByLineFromEmbed } from '../../lib/noteCreatorDisplay'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

export type BidsWaitingToHearLensProps = {
  bids: BidWithBuilder[]
  /** Bids by GC (v2.2164): per-bid GC packets — a bid waits under each GC whose packet is still open. */
  gcPacketsByBid: Record<string, GcPacket[]>
  ledgerPrefixMap: LedgerPrefixMap
  /** Latest METHOD-entry instant per bid id (contacts only — v2.2413: method-less notes never count as contact). */
  lastContactFromEntries: Record<string, string>
  /** bid_id → other GCs the bid went to; each gets its own queue entry. */
  recipientsByBidId: BidGcRecipientsMap
  /** Bid Room read-backs (v2.2471): bidId → gcKey ('' = own GC) → summary. */
  roomStatesByBid?: Record<string, Record<string, BidRoomStateSummary>>
  narrowViewport640: boolean
  authUserId: string | null
  onError: (message: string | null) => void
  onReloadBids: () => void
  /** Jump to this bid's builder card on the By-builder lens (existing deep-link plumbing). */
  onOpenBuilderCard: (bid: BidWithBuilder) => void
}

type LensBid = PendingChaseBid & {
  /** Unique per bid × GC; `id` stays the bid id. */
  rowKey: string
  gc: GcOutcomeRow
  label: string
  project: string
  address: string | null
  estimatorName: string | null
  dueIso: string | null
  raw: BidWithBuilder
}

// The one white thing on the pane's gray stage — the card must read as "the
// document you're working on" (v2.2083: bg-page on surface was invisible).
const cardStyle: CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '0.75rem 0.9rem',
  background: 'var(--surface)',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.07)',
}

function bidLensLabel(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): string {
  const num = (bid.bid_number ?? '').trim()
  if (!num) return (bid.project_name ?? '').trim() || bid.id.slice(0, 8)
  return formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num)
}

function estimatorNameOf(bid: BidWithBuilder): string | null {
  const est = bid.estimator
  const one = Array.isArray(est) ? est[0] : est
  return (one?.name ?? '').trim() || null
}

function builderPhoneOf(bid: BidWithBuilder): string | null {
  const info = bid.customers?.contact_info as { phone?: string } | null
  const phone = (info?.phone ?? '').trim()
  if (phone) return phone
  const gcPhone = ((bid.bids_gc_builders as { phone?: string | null } | null)?.phone ?? '').trim()
  return gcPhone || null
}

/**
 * 'YYYY-MM-DD' or ISO instant → 'M/D'. Instants render in the browser's local
 * calendar — the Bid Board's last-contact convention — never the UTC date
 * (an evening call would otherwise show as the next day). Bare dates pass through.
 */
function shortDate(iso: string): string {
  if (iso.includes('T')) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[2])}/${Number(m[3])}`
}

function daysAgoLabel(days: number): string {
  if (days <= 0) return 'today'
  return `${days}d ago`
}

export function BidsWaitingToHearLens({
  bids,
  gcPacketsByBid,
  ledgerPrefixMap,
  lastContactFromEntries,
  recipientsByBidId,
  roomStatesByBid,
  narrowViewport640,
  authUserId,
  onError,
  onReloadBids,
  onOpenBuilderCard,
}: BidsWaitingToHearLensProps) {
  const [chaseSearchQuery, setChaseSearchQuery] = useState('')
  const [selectedBuilderKey, setSelectedBuilderKey] = useState<string | null>(null)
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [lostPickerOpen, setLostPickerOpen] = useState(false)
  const [tabCaptureOpen, setTabCaptureOpen] = useState(false)
  /** Full per-bidder tabs (v2.2296), fetched lazily for the open bid; keyed by bid id. */
  const [tabEntriesByBid, setTabEntriesByBid] = useState<Record<string, BidTabEntryRow[]>>({})
  const [savingBidId, setSavingBidId] = useState<string | null>(null)
  // "The story so far" (v2.2406, Wendi): the group's conversation history, keyed by bid id.
  // null-ish (missing key) = not fetched yet; the fetch is per builder group, fail-soft.
  const [storyByBid, setStoryByBid] = useState<Record<string, StorySourceEntry[]>>({})
  const [storyExpanded, setStoryExpanded] = useState(false)
  // Optimistic layers over props so taps feel instant while the reload catches up.
  const [localTouches, setLocalTouches] = useState<Record<string, string>>({})
  const [localResolved, setLocalResolved] = useState<Record<string, 'won' | 'lost'>>({})
  // Tier-1 #8: the one-tap Won leaves the queue instantly — this strip keeps the win on screen with
  // "Open the job" so the person who recorded it does not have to go hunt for the door.
  const [justWon, setJustWon] = useState<{ bidId: string; label: string; gcName: string } | null>(null)
  const [chasedThisSession, setChasedThisSession] = useState(0)

  // One instant per mount keeps every memo on the same clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])

  const lensBids = useMemo<LensBid[]>(() => {
    return bids.flatMap((b) => {
      const builderName =
        (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
      const builderKey = b.customer_id ?? b.gc_builder_id ?? builderName
      const fromBid = localTouches[b.id] ?? b.last_contact ?? null
      const fromEntries = lastContactFromEntries[b.id] ?? null
      const lastContactIso =
        fromBid && fromEntries ? (fromBid > fromEntries ? fromBid : fromEntries) : fromBid ?? fromEntries
      // Bids by GC: one entry per GC whose packet is still waiting (a GC that already answered drops off).
      return gcOutcomeRowsForBid(b, { key: builderKey, name: builderName }, gcPacketsByBid[b.id])
        .filter((row) => row.outcome === 'pending')
        .map((row) => ({ row, rowKey: row.packetKey ? `${b.id}:${row.gcKey}` : b.id }))
        .filter(({ rowKey }) => !localResolved[rowKey])
        .map(({ row, rowKey }) => ({
          id: b.id,
          rowKey,
          gc: row,
          builderKey: row.gcKey,
          builderName: row.gcName,
          value: row.value,
          sentIso: row.sentOn ?? b.bid_date_sent ?? '',
          lastContactIso,
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          address: (b.address ?? '').trim() || null,
          estimatorName: estimatorNameOf(b),
          dueIso: b.bid_due_date ?? null,
          raw: b,
        }))
    })
  }, [bids, gcPacketsByBid, lastContactFromEntries, ledgerPrefixMap, localTouches, localResolved])

  // Search narrows the queue (sidebar + bids), never the rollup headline —
  // "N to chase" stays a status of the whole queue, not of the query.
  const searchedLensBids = useMemo(() => {
    const q = chaseSearchQuery.trim().toLowerCase()
    if (!q) return lensBids
    return lensBids.filter(
      (b) =>
        b.project.toLowerCase().includes(q) ||
        b.builderName.toLowerCase().includes(q) ||
        b.label.toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q) ||
        (b.estimatorName ?? '').toLowerCase().includes(q) ||
        bidNumberMatchesQuery(b.raw, chaseSearchQuery, ledgerPrefixMap),
    )
  }, [lensBids, chaseSearchQuery, ledgerPrefixMap])

  // Per-GC rows already carry one entry per GC (packets + "Also sent to"); contact stamps stay per-bid,
  // so a touch under any GC freshens every copy.
  const expandedLensBids = searchedLensBids

  const groups = useMemo(() => groupPendingChaseByBuilder(expandedLensBids, nowIso), [expandedLensBids, nowIso])
  // Rollup stays per-bid — dollars are never double-counted across GC copies.
  const rollup = useMemo(() => buildPendingChaseRollup(lensBids.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i), nowIso), [lensBids, nowIso])

  const selectedGroup = useMemo(() => {
    if (groups.length === 0) return null
    return groups.find((g) => g.builderKey === selectedBuilderKey) ?? groups[0]!
  }, [groups, selectedBuilderKey])

  const selectedBids = useMemo(
    () => (selectedGroup ? expandedLensBids.filter((b) => b.builderKey === selectedGroup.builderKey) : []),
    [expandedLensBids, selectedGroup],
  )
  const selectedBid = useMemo(() => {
    if (selectedBids.length === 0) return null
    return (
      selectedBids.find((b) => b.rowKey === selectedBidId) ??
      selectedBids.find((b) => bidNeedsChase(b, nowIso)) ??
      selectedBids[0]!
    )
  }, [selectedBids, selectedBidId, nowIso])

  useEffect(() => {
    setNoteDraft('')
    setLostPickerOpen(false)
    setTabCaptureOpen(false)
    setStoryExpanded(false)
  }, [selectedBid?.id])

  // The story panels' feed: one fetch per builder group for every bid id not
  // loaded yet (fail-soft — an error just leaves the panels quiet).
  useEffect(() => {
    const ids = [...new Set(selectedBids.map((b) => b.id))].filter((id) => storyByBid[id] == null)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      let data: unknown
      try {
        data = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids_submission_entries')
              .select(SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR)
              .in('bid_id', ids)
              .order('occurred_at', { ascending: false })
              .limit(400),
          'chase story entries',
        )
      } catch {
        return // fail-soft: the panels just stay quiet
      }
      if (cancelled || !Array.isArray(data)) return
      type Row = {
        id: string
        bid_id: string
        gc_customer_id: string | null
        contact_method: string | null
        notes: string | null
        occurred_at: string
        created_by_user?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
      }
      setStoryByBid((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = []
        for (const r of data as Row[]) {
          ;(next[r.bid_id] ??= []).push({
            id: r.id,
            gcCustomerId: r.gc_customer_id ?? null,
            method: r.contact_method,
            text: (r.notes ?? '').trim(),
            iso: r.occurred_at,
            byLine: noteByLineFromEmbed(r.created_by_user),
          })
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBids, storyByBid])

  // Lazy full-tab fetch for the open bid (fail-soft: pre-migration reads just
  // leave the ladder off).
  useEffect(() => {
    const bidId = selectedBid?.id
    if (!bidId || tabEntriesByBid[bidId] != null) return
    let cancelled = false
    void fetchBidTabEntries(bidId).then((res) => {
      if (!cancelled && res.available) setTabEntriesByBid((prev) => ({ ...prev, [bidId]: res.entries }))
    })
    return () => {
      cancelled = true
    }
  }, [selectedBid?.id, tabEntriesByBid])

  function selectBuilder(key: string) {
    setSelectedBuilderKey(key)
    setSelectedBidId(null)
  }

  function runAction(
    b: LensBid,
    action: PendingChaseActionKey,
    lossCategory: BidLossCategoryKey | null = null,
    tab: { values: BidTabValues; noteLine: string; entries?: BidTabEntryDraft[] | null } | null = null,
  ) {
    if (!authUserId) {
      onError('You must be signed in to log a chase.')
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
      // Per-GC Phase 1: the chase is with THIS row's GC — stamp the entry.
      gcCustomerId: entryGcIdFromPacketKey(b.gc.packetKey),
    })
    if (tab) {
      // Tab numbers replace the plain "Bid tab received" label in the history note.
      const trimmed = noteDraft.trim()
      writes.entry.notes = trimmed ? `${tab.noteLine}. ${trimmed}` : tab.noteLine
    }
    // Optimistic: resolved bids leave the queue, contact-only taps go fresh —
    // and the tap lands at the top of the story panel right away (v2.2406).
    const localStoryId = `local-${writes.lastContact}`
    if (writes.outcomeUpdate) {
      setLocalResolved((prev) => ({ ...prev, [b.rowKey]: writes.outcomeUpdate!.outcome }))
      if (writes.outcomeUpdate.outcome === 'won') setJustWon({ bidId: b.id, label: b.label, gcName: b.gc.gcName })
    } else {
      setLocalTouches((prev) => ({ ...prev, [b.id]: writes.lastContact }))
      setStoryByBid((prev) => ({
        ...prev,
        [b.id]: [
          { id: localStoryId, gcCustomerId: writes.entry.gc_customer_id, method: writes.entry.contact_method, text: writes.entry.notes, iso: writes.entry.occurred_at, byLine: null },
          ...(prev[b.id] ?? []),
        ],
      }))
    }
    setChasedThisSession((n) => n + 1)
    setNoteDraft('')
    setLostPickerOpen(false)
    setTabCaptureOpen(false)
    setSavingBidId(b.id)
    advanceFrom(b.rowKey)
    void (async () => {
      try {
        await withSupabaseRetry(
          async () => supabase.from('bids_submission_entries').insert(writes.entry),
          'log chase note',
        )
        // Per-GC Phase 1: the entry insert above fires the last_contact sync trigger — no hand-bump.
        const bidPatch: Record<string, string | number | null> = {}
        if (tab) Object.assign(bidPatch, buildBidTabPatch(tab.values))
        if (writes.outcomeUpdate && gcRowIsPacketScoped(b.gc)) {
          // Multi-GC bid: this GC's answer goes on its packet; the bid rolls up (a win marks the others lost).
          const packets = gcPacketsByBid[b.id] ?? []
          const res = await setGcPacketOutcome({
            bidId: b.id,
            bidOutcome: b.raw.outcome ?? null,
            versionIds: b.gc.versionIds,
            outcome: writes.outcomeUpdate.outcome,
            packetsAfter: packets.map((x) => ({ key: x.key, name: x.name, outcome: x.key === b.gc.packetKey ? writes.outcomeUpdate!.outcome : x.outcome, sentOn: x.sentOn, versionIds: x.versions.map((v) => v.id), sharedLetter: x.sharedLetter })),
          })
          if (res.error) throw new Error(res.error)
          if (writes.outcomeUpdate.outcome === 'lost' && writes.outcomeUpdate.loss_category) {
            await setGcPacketLossCategory({ versionIds: b.gc.versionIds, category: writes.outcomeUpdate.loss_category, note: writes.outcomeUpdate.loss_reason })
          }
          window.dispatchEvent(new Event('bid-gc-outcome-changed'))
        } else if (writes.outcomeUpdate) {
          bidPatch.outcome = writes.outcomeUpdate.outcome
          bidPatch.loss_reason = writes.outcomeUpdate.loss_reason
          bidPatch.loss_category = writes.outcomeUpdate.loss_category
        }
        if (Object.keys(bidPatch).length > 0) {
          const rows = await withSupabaseRetry(
            async () => supabase.from('bids').update(bidPatch).eq('id', b.id).select('id'),
            'save chase outcome',
          )
          if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        }
        onError(null)
        // Paste capture (v2.2296): the full per-bidder tab rides along. Fail-soft
        // — the summary above already saved, so a missing table only costs rungs.
        if (tab?.entries?.length) {
          const res = await replaceBidTabEntries(b.id, tab.entries, authUserId)
          if (res.ok) setTabEntriesByBid((prev) => ({ ...prev, [b.id]: tab.entries!.map((e, i) => ({ ...e, id: `local-${i}` })) }))
          else onError('Tab summary saved, but the full bidder list could not be stored yet.')
        }
        // The saved entry replaces the optimistic one (real id + by-line) on refetch.
        setStoryByBid((prev) => {
          const next = { ...prev }
          delete next[b.id]
          return next
        })
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not log the chase: ${err.message}` : 'Could not log the chase.')
        setJustWon((prev) => (prev?.bidId === b.id ? null : prev))
        setLocalResolved((prev) => {
          const next = { ...prev }
          delete next[b.rowKey]
          return next
        })
        setLocalTouches((prev) => {
          const next = { ...prev }
          delete next[b.id]
          return next
        })
        setStoryByBid((prev) => ({ ...prev, [b.id]: (prev[b.id] ?? []).filter((e) => e.id !== localStoryId) }))
        setChasedThisSession((n) => Math.max(0, n - 1))
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  /** Quiet data fix — clears the tab columns only; no history note, no contact stamp. */
  function removeBidTab(b: LensBid) {
    if (savingBidId) return
    setSavingBidId(b.id)
    const patch: Record<string, number | null> = { ...buildBidTabPatch(EMPTY_BID_TAB_VALUES) }
    void (async () => {
      try {
        const rows = await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'), 'remove bid tab')
        if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        await clearBidTabEntries(b.id)
        setTabEntriesByBid((prev) => ({ ...prev, [b.id]: [] }))
        onError(null)
        setTabCaptureOpen(false)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not remove the bid tab: ${err.message}` : 'Could not remove the bid tab.')
      } finally {
        setSavingBidId(null)
      }
    })()
  }

  function advanceFrom(rowKey: string) {
    if (!selectedGroup) return
    const idx = selectedBids.findIndex((b) => b.rowKey === rowKey)
    const next = nextPendingChaseBidIndex({ bids: selectedBids }, idx, nowIso)
    if (next != null && selectedBids[next]!.rowKey !== rowKey) {
      setSelectedBidId(selectedBids[next]!.rowKey)
      return
    }
    // Builder done — hop to the next builder that still has bids to chase.
    const ng = groups.find((g) => g.builderKey !== selectedGroup.builderKey && g.needsCount > 0)
    if (ng) {
      setSelectedBuilderKey(ng.builderKey)
      setSelectedBidId(null)
    }
  }

  // Keyboard: arrows move within the builder's bids.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (!selectedBid) return
      const idx = selectedBids.findIndex((b) => b.rowKey === selectedBid.rowKey)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const next = selectedBids[Math.min(selectedBids.length - 1, idx + 1)]
        if (next) setSelectedBidId(next.rowKey)
        e.preventDefault()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prev = selectedBids[Math.max(0, idx - 1)]
        if (prev) setSelectedBidId(prev.rowKey)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (lensBids.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
        No sent bids are waiting on an answer in this trade — nothing to chase.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.2rem 0.65rem',
            borderRadius: 999,
            background: rollup.needsCount > 0 ? 'var(--bg-amber-100)' : 'var(--bg-emerald-tint)',
            color: rollup.needsCount > 0 ? 'var(--text-amber-800)' : 'var(--text-emerald-800)',
          }}
        >
          {rollup.needsCount > 0
            ? `${rollup.needsCount} sent bid${rollup.needsCount === 1 ? '' : 's'} to chase`
            : 'All caught up — every open bid touched this week'}
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {`of ${rollup.pendingCount} still open · $${formatCurrency(rollup.pendingValue)} waiting on an answer`}
          {rollup.untouchedCount > 0 ? ` · ${rollup.untouchedCount} never called` : ''}
          {rollup.oldestUntouchedDays != null ? `, oldest ${rollup.oldestUntouchedDays}d` : ''}
        </span>
        <input
          type="text"
          value={chaseSearchQuery}
          onChange={(e) => {
            setChaseSearchQuery(e.target.value)
            setSelectedBuilderKey(null)
            setSelectedBidId(null)
          }}
          placeholder="Search bids (bid #, project name, or GC/Builder)…"
          aria-label="Search bids to chase"
          style={{ flex: '1 1 14rem', minWidth: '12rem', maxWidth: '22rem', font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        {chasedThisSession > 0 ? (
          <span
            style={{
              fontSize: '0.8125rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 999,
              background: 'var(--bg-emerald-tint)',
              color: 'var(--text-emerald-800)',
            }}
          >
            {chasedThisSession} chased this session
          </span>
        ) : null}
      </div>
      <p style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Every sent bid still waiting on an answer, newest first. A bid needs a chase when nobody's talked to the GC in
        over {PENDING_CHASE_STALE_CONTACT_DAYS} days — tap what happened to log the call. Arrow keys move between bids.
      </p>

      {searchedLensBids.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          No open sent bids match “{chaseSearchQuery.trim()}” — clear the search to see the whole queue.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrowViewport640 ? '1fr' : '230px minmax(0, 1fr)',
            gap: '0.75rem',
            alignItems: 'start',
            marginBottom: '1rem',
          }}
        >
          {/* Scrolls on its own — with every open bid in the queue the full list can run to dozens of builders. */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 'min(72vh, 42rem)', overflowY: 'auto' }}
            aria-label="Builder chase queue"
          >
            {groups.map((g) => {
              const active = selectedGroup?.builderKey === g.builderKey
              return (
                <button
                  key={g.builderKey}
                  type="button"
                  onClick={() => selectBuilder(g.builderKey)}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 8,
                    border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                    background: active ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{g.builderName}</span>
                    {g.needsCount === 0 ? (
                      <span style={{ color: 'var(--text-green-600)', fontSize: '0.8125rem' }} title="Every pending bid touched recently">{'✓'}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)', fontWeight: 600 }}>{g.needsCount}</span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {g.needsCount === 0 ? 'all caught up' : `$${formatCurrency(g.needsValue)} waiting`}
                    {` · sent ${shortDate(g.newestSentIso)}`}
                  </span>
                </button>
              )
            })}
          </div>

          {justWon ? (
            <div
              role="status"
              style={{ border: '1px solid var(--border-green)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.75rem', background: 'var(--bg-green-tint)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-green-700)' }}>
                You won it — {justWon.label} with {justWon.gcName}.
              </span>
              <BidWonJobActions bidId={justWon.bidId} won onOpenedForm={() => setJustWon(null)} />
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setJustWon(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
              >
                ×
              </button>
            </div>
          ) : null}
          {selectedGroup && selectedBid ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--bg-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{selectedGroup.builderName}</span>
                {(() => {
                  const phone = selectedBid.gc.gcKey !== (selectedBid.raw.customer_id ?? selectedBid.raw.gc_builder_id ?? '') ? (recipientsByBidId[selectedBid.id] ?? []).find((r) => r.customerId === selectedBid.gc.gcKey)?.phone ?? null : builderPhoneOf(selectedBid.raw)
                  return phone ? (
                    <a
                      href={`tel:${phone}`}
                      style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}
                    >
                      {'☎'} {phone}
                    </a>
                  ) : null
                })()}
                {(() => {
                  const needs = selectedBids.filter((b) => bidNeedsChase(b, nowIso)).length
                  return (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: needs > 0 ? 'var(--text-amber-800)' : 'var(--text-emerald-800)',
                      }}
                    >
                      {needs > 0 ? `${needs} of ${selectedBids.length} need a chase` : 'all caught up'}
                    </span>
                  )
                })()}
              </div>

              {looksLikeCombinedGcName(selectedGroup.builderName) ? (
                <p
                  style={{
                    margin: '0 0 0.6rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 6,
                    background: 'var(--bg-amber-100)',
                    color: 'var(--text-amber-800)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {'⚠'} This looks like a combined-GC name from before recipients existed. Open <strong>Edit Bid</strong>, set the real
                  primary GC, and add the others under <strong>Also sent to</strong> — then each real GC gets its own queue entry.
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }} aria-label="This builder's pending bids">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Their open bids</span>
                {selectedBids.map((b) => {
                  const fresh = !bidNeedsChase(b, nowIso)
                  const current = b.rowKey === selectedBid.rowKey
                  return (
                    <button
                      key={b.rowKey}
                      type="button"
                      onClick={() => setSelectedBidId(b.rowKey)}
                      title={`${b.label} · ${b.project}${b.address ? ` — ${b.address}` : ''}`}
                      aria-pressed={current}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 999,
                        cursor: 'pointer',
                        border: `1px solid ${current ? 'var(--border-stronger, var(--border-strong))' : 'var(--border)'}`,
                        background: fresh ? 'var(--bg-emerald-tint)' : 'var(--surface)',
                        color: fresh ? 'var(--text-emerald-800)' : 'var(--text-700)',
                        fontWeight: current ? 600 : 400,
                      }}
                    >
                      {fresh ? `✓ ` : ''}{bidTriagePillLabel(b)}
                    </button>
                  )
                })}
              </div>

              {/* v2.2406 (Wendi): the full picture — actions on the left, the conversation on the right (stacked on phones). */}
              <div style={{ display: 'flex', flexDirection: narrowViewport640 ? 'column' : 'row', gap: '0.8rem', alignItems: narrowViewport640 ? 'stretch' : 'flex-start' }}>
              <div style={{ flex: '1 1 58%', minWidth: 0 }}>
              <div style={{ ...cardStyle, marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{selectedBid.label} · {selectedBid.project}</span>
                </div>
                {selectedBid.address ? (
                  <button
                    type="button"
                    onClick={() => {
                      const url = bidAddressMapsUrl(selectedBid.address)
                      if (url) openInExternalBrowser(url)
                    }}
                    title="Open this address in Google Maps"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      margin: '0.35rem 0 0.15rem',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      borderRadius: 999,
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface)',
                      color: 'var(--text-link)',
                      cursor: 'pointer',
                    }}
                  >
                    {'📍'} {selectedBid.address}
                  </button>
                ) : (
                  <p style={{ margin: '0.35rem 0 0.15rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No address on this bid.</p>
                )}
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedBid.value > 0 ? `$${formatCurrency(selectedBid.value)}` : 'no bid value'}
                  {` · sent ${shortDate(selectedBid.sentIso)} (${daysAgoLabel(Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(selectedBid.sentIso)) / 86_400_000)))})`}
                  {selectedBid.dueIso ? ` · was due ${shortDate(selectedBid.dueIso)}` : ''}
                  {selectedBid.estimatorName ? ` · est. ${selectedBid.estimatorName}` : ''}
                  {(() => {
                    // Bid Room activity (v2.2471) — the chase call's best intel: are they reading it?
                    const byGc = roomStatesByBid?.[selectedBid.id]
                    const st = byGc?.[selectedBid.gc.gcKey] ?? (selectedBid.gc.gcKey === (selectedBid.raw.customer_id ?? selectedBid.raw.gc_builder_id ?? '') ? byGc?.[''] : undefined)
                    return st ? (
                      <>
                        {' · '}
                        <BidRoomStateChip state={st} />
                      </>
                    ) : null
                  })()}
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: bidNeedsChase(selectedBid, nowIso) ? 'var(--text-amber-800)' : 'var(--text-emerald-800)' }}>
                  {(() => {
                    // Same kernel as the Bid Board's Last Contact cell, so the two surfaces
                    // always agree on the day and the count.
                    const lc = selectedBid.lastContactIso ? bidBoardLastContactParts(selectedBid.lastContactIso, new Date(nowIso)) : null
                    return lc
                      ? `Last contact ${shortDate(selectedBid.lastContactIso!)} (${daysAgoLabel(Math.max(0, lc.deltaDays))})`
                      : 'Never contacted since sending'
                  })()}
                </p>
                {(() => {
                  const tabValues = bidTabValuesFromRow(selectedBid.raw as Partial<BidTabRow>)
                  if (!hasAnyBidTabValue(tabValues) || tabCaptureOpen) return null
                  const entries = tabEntriesByBid[selectedBid.id] ?? []
                  return (
                    <>
                      <BidTabRecordedLine
                        values={tabValues}
                        ourValue={selectedBid.value}
                        onEdit={() => { setTabCaptureOpen(true); setLostPickerOpen(false) }}
                      />
                      {entries.length > 0 ? <BidTabEntriesLadder entries={entries} /> : null}
                    </>
                  )
                })()}
                {(() => {
                  const g = selectedBid.gc
                  if (g.sharedLetter) {
                    return (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Sent to this GC too — same letter as {g.siblings[0]?.gcName ?? 'the bid’s GC'}
                        <span style={{ fontStyle: 'italic' }}> (a touch under any GC freshens every copy)</span>
                      </p>
                    )
                  }
                  if (g.siblings.length === 0) return null
                  return (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {g.gcName}’s packet · also went to {g.siblings.map((sb) => `${sb.gcName} (${sb.outcome === 'pending' ? 'waiting' : sb.outcome})`).join(', ')}
                      <span style={{ fontStyle: 'italic' }}> — an answer here is {g.gcName}’s; a touch freshens every copy</span>
                    </p>
                  )
                })()}
              </div>

              {lostPickerOpen ? (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }} aria-label="Loss reasons">
                  {BID_LOSS_CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => runAction(selectedBid, 'lost', c.key)}
                      disabled={savingBidId != null}
                      style={{
                        fontSize: '0.8125rem',
                        padding: '0.3rem 0.7rem',
                        borderRadius: 999,
                        cursor: 'pointer',
                        background: c.chipBg,
                        color: c.chipFg,
                        border: '1.5px solid transparent',
                        opacity: savingBidId != null ? 0.6 : 1,
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLostPickerOpen(false)}
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.3rem 0.7rem',
                      borderRadius: 999,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    back
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }} aria-label="Chase outcomes">
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    What happened?
                  </span>
                  {PENDING_CHASE_ACTIONS.map((a) => {
                    const emphasis = a.key === 'won' ? 'var(--bg-emerald-tint)' : a.key === 'lost' ? 'var(--bg-red-tint)' : 'var(--surface)'
                    const fg = a.key === 'won' ? 'var(--text-emerald-800)' : a.key === 'lost' ? 'var(--text-red-800)' : 'var(--text-700)'
                    return (
                      <button
                        key={a.key}
                        type="button"
                        aria-pressed={a.key === 'bid_tab' ? tabCaptureOpen : undefined}
                        onClick={() =>
                          a.key === 'lost'
                            ? setLostPickerOpen(true)
                            : a.key === 'bid_tab'
                              ? setTabCaptureOpen((v) => !v)
                              : runAction(selectedBid, a.key)
                        }
                        disabled={savingBidId != null}
                        style={{
                          fontSize: '0.8125rem',
                          padding: '0.3rem 0.7rem',
                          borderRadius: 999,
                          cursor: 'pointer',
                          background: emphasis,
                          color: fg,
                          border: `1px solid ${a.key === 'bid_tab' && tabCaptureOpen ? 'var(--text-link)' : 'var(--border-strong)'}`,
                          opacity: savingBidId != null ? 0.6 : 1,
                        }}
                      >
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {tabCaptureOpen ? (
                <BidTabCapturePanel
                  key={selectedBid.rowKey}
                  ourValue={selectedBid.value}
                  initial={bidTabValuesFromRow(selectedBid.raw as Partial<BidTabRow>)}
                  saving={savingBidId != null}
                  onSave={(values, noteLine, entries) => runAction(selectedBid, 'bid_tab', null, { values, noteLine, entries: entries ?? null })}
                  secondaryLabel="Log without numbers"
                  onSecondary={() => runAction(selectedBid, 'bid_tab')}
                  onRemove={() => removeBidTab(selectedBid)}
                />
              ) : null}

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="what they said (optional — saved with the next tap)"
                  aria-label="Chase note"
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    fontSize: '0.8125rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => advanceFrom(selectedBid.rowKey)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Skip {'→'}
                </button>
              </div>

              <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <button
                  type="button"
                  onClick={() => onOpenBuilderCard(selectedBid.raw)}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-link)',
                    textDecoration: 'underline',
                    font: 'inherit',
                  }}
                >
                  open their builder card {'→'}
                </button>
                {' '}for contacts, notes, and the call session.
              </p>
              </div>
              <div style={{ flex: narrowViewport640 ? undefined : '0 0 330px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(() => {
                  const sources = storyByBid[selectedBid.id]
                  const { items, total } = buildBidStory({
                    entries: sources ?? [],
                    gcId: selectedBid.gc.gcKey,
                    sentIso: selectedBid.sentIso || null,
                    sentValue: selectedBid.value,
                    cap: storyExpanded ? Infinity : 4,
                  })
                  return (
                    <div style={cardStyle} aria-label="The story so far">
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                        The story so far · {selectedBid.label}
                      </div>
                      {sources == null ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
                      ) : items.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing logged yet — your taps and Bid Board notes build the story here.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {items.map((it) => (
                            <div key={it.key} style={{ color: it.kind === 'sent' ? 'var(--text-muted)' : undefined }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span>{it.icon} {shortDate(it.iso)}</span>
                                {it.byLine ? <span>{it.byLine.replace(/^By /, '')}</span> : null}
                              </div>
                              <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{it.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {total > items.length ? (
                        <button
                          type="button"
                          onClick={() => setStoryExpanded(true)}
                          style={{ marginTop: '0.45rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem' }}
                        >
                          show all {total} {'→'}
                        </button>
                      ) : storyExpanded && total > 4 ? (
                        <button
                          type="button"
                          onClick={() => setStoryExpanded(false)}
                          style={{ marginTop: '0.45rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', font: 'inherit', fontSize: '0.75rem' }}
                        >
                          show fewer
                        </button>
                      ) : null}
                    </div>
                  )
                })()}
                {(() => {
                  const sibs = selectedBids.filter((x) => x.rowKey !== selectedBid.rowKey)
                  if (sibs.length === 0) return null
                  const lines = buildSiblingLines(
                    sibs.map((x) => ({ rowKey: x.rowKey, bidId: x.id, title: bidTriagePillLabel(x), sentIso: x.sentIso })),
                    storyByBid,
                  )
                  return (
                    <div style={cardStyle} aria-label="This builder's other open bids, latest word each">
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                        With {selectedGroup.builderName} lately · other open bids
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {lines.map((l) => (
                          <button
                            key={l.rowKey}
                            type="button"
                            onClick={() => setSelectedBidId(l.rowKey)}
                            title="Open this bid on the card"
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                              {l.kind === 'entry' && l.iso ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.icon} {shortDate(l.iso)}</span>
                              ) : null}
                            </div>
                            {l.kind === 'entry' ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.text}</div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>no contact since sent {shortDate(l.sentIso)}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

    </div>
  )
}
