import { BidLossCategoryChips } from './BidLossCategoryChips'
import { BidLossLearnPanel } from './BidLossLearnPanel'
import { BidTabCapturePanel, BidTabEntriesLadder, BidTabRecordedLine } from './BidTabCapturePanel'
import { clearBidTabEntries, fetchBidTabEntries, replaceBidTabEntries, type BidTabEntryRow } from '../../lib/bids/bidTabEntriesData'
import type { BidTabEntryDraft } from '../../lib/bids/bidTabPaste'
import type { BidLossLearnRow } from '../../lib/bidLossLearn'
import {
  EMPTY_BID_TAB_VALUES,
  bidTabValuesFromRow,
  buildBidTabPatch,
  hasAnyBidTabValue,
  type BidTabRow,
  type BidTabValues,
} from '../../lib/bidTabCapture'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from '../../lib/bids/updateGuard'
import { formatCurrency } from '../../lib/format'
import { bidAddressMapsUrl } from '../../lib/buildBidPricingPackageHtml'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  BID_LOSS_CATEGORIES,
  bidLossCategoryLabel,
  buildLossRollup,
  groupLossTriageByBuilder,
  isBidLossCategoryKey,
  nextLossTriageBidIndex,
  suggestLossCategoryFromNote,
  type BidLossCategoryKey,
} from '../../lib/bidLossCategories'
import {
  type LedgerPrefixMap,
  bidNumberMatchesQuery,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import { bidTriagePillLabel } from '../../lib/bids/bidFormatting'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { looksLikeCombinedGcName, type BidGcRecipientsMap } from '../../lib/bids/bidGcRecipients'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { gcOutcomeRowsForBid, gcRowIsPacketScoped, type GcOutcomeRow } from '../../lib/bids/gcOutcomeRows'
import { setGcPacketLossCategory } from '../../lib/bids/gcPacketOutcome'

export type BidsWhyWeLostLensProps = {
  bids: BidWithBuilder[]
  /** Bids by GC (v2.2164): per-bid GC packets — the lens triages each GC's loss, not the bid's. */
  gcPacketsByBid: Record<string, GcPacket[]>
  ledgerPrefixMap: LedgerPrefixMap
  /** bid_id → other GCs the bid went to; each gets its own queue entry. */
  recipientsByBidId: BidGcRecipientsMap
  narrowViewport640: boolean
  onError: (message: string | null) => void
  onReloadBids: () => void
  /** Jump to this bid's builder card on the By-builder lens (existing deep-link plumbing). */
  onOpenBuilderCard: (bid: BidWithBuilder) => void
}

type LensBid = {
  /** Bid id (writes, tab capture, builder card). One bid can appear once per GC it went to. */
  id: string
  /** Unique per bid × GC — React keys, selection, optimistic saves. */
  rowKey: string
  gc: GcOutcomeRow
  builderKey: string
  builderName: string
  value: number
  category: string | null
  label: string
  project: string
  address: string | null
  estimatorName: string | null
  legacyReason: string | null
  note: string | null
  raw: BidWithBuilder
}

// The one white thing on the panel's gray stage — same treatment as the
// Waiting to hear card (v2.2083): bg-page on the panel was nearly invisible.
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

export function BidsWhyWeLostLens({
  bids,
  gcPacketsByBid,
  ledgerPrefixMap,
  recipientsByBidId,
  narrowViewport640,
  onError,
  onReloadBids,
  onOpenBuilderCard,
}: BidsWhyWeLostLensProps) {
  // Optimistic saves layered over props so chips feel instant while the
  // background reload catches up; also drives the "cleared today" counter.
  const [localSaves, setLocalSaves] = useState<Record<string, { category: BidLossCategoryKey; note: string | null }>>({})
  const [selectedBuilderKey, setSelectedBuilderKey] = useState<string | null>(null)
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [lossSearchQuery, setLossSearchQuery] = useState('')
  const [tabCaptureOpen, setTabCaptureOpen] = useState(false)
  const [savingTabBidId, setSavingTabBidId] = useState<string | null>(null)
  /** Full per-bidder tabs (v2.2296), fetched lazily for the open bid; keyed by bid id. */
  const [tabEntriesByBid, setTabEntriesByBid] = useState<Record<string, BidTabEntryRow[]>>({})
  /** "bids by" estimator scope (v2.2053) — '' = all; scopes the WHOLE lens (headline, rail, queue). */
  const [estimatorFilter, setEstimatorFilter] = useState('')

  /** Every GC-level row across all bids (won / lost / pending / unsent) — the lens's unit of work. */
  const allRows = useMemo(() => {
    const out: Array<{ bid: BidWithBuilder; row: GcOutcomeRow }> = []
    for (const b of bids) {
      const builderName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
      const builderKey = b.customer_id ?? b.gc_builder_id ?? builderName
      for (const row of gcOutcomeRowsForBid(b, { key: builderKey, name: builderName }, gcPacketsByBid[b.id])) out.push({ bid: b, row })
    }
    return out
  }, [bids, gcPacketsByBid])

  const allLensBids = useMemo<LensBid[]>(() => {
    return allRows
      .filter(({ row }) => row.outcome === 'lost')
      .map(({ bid: b, row }) => {
        const rowKey = row.packetKey ? `${b.id}:${row.gcKey}` : b.id
        const local = localSaves[rowKey]
        return {
          id: b.id,
          rowKey,
          gc: row,
          builderKey: row.gcKey,
          builderName: row.gcName,
          value: row.value,
          category: local?.category ?? row.lossCategory,
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          address: (b.address ?? '').trim() || null,
          estimatorName: estimatorNameOf(b),
          legacyReason: row.lossNote,
          note: local?.note ?? null,
          raw: b,
        }
      })
  }, [allRows, localSaves, ledgerPrefixMap])

  /** Distinct estimator names across the lost bids, for the "bids by" select. */
  const estimatorOptions = useMemo(() => {
    const names = new Set<string>()
    let hasUnassigned = false
    for (const b of allLensBids) {
      if (b.estimatorName) names.add(b.estimatorName)
      else hasUnassigned = true
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    return hasUnassigned ? [...sorted, 'No estimator'] : sorted
  }, [allLensBids])

  const lensBids = useMemo(() => {
    if (!estimatorFilter) return allLensBids
    return allLensBids.filter((b) => (b.estimatorName ?? 'No estimator') === estimatorFilter)
  }, [allLensBids, estimatorFilter])

  // One instant per mount keeps the Learn panel's window slicing on one clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])

  /** Lost bids (same estimator scope) as the Learn panel sees them. */
  const learnRows = useMemo<BidLossLearnRow[]>(
    () =>
      lensBids.map((b) => ({
        id: b.rowKey,
        builderKey: b.builderKey,
        builderName: b.builderName,
        value: b.value,
        sentIso: b.raw.bid_date_sent ?? null,
        tab: bidTabValuesFromRow(b.raw),
      })),
    [lensBids],
  )

  // Per-GC copies: a bid sent to three GCs gets a queue entry under each.
  // The outcome is per-bid, so recording it under any GC clears every copy.
  // Search narrows the queue (rail + bids), never the headline — "N need a
  // reason" stays a status of the whole queue, not of the query.
  const searchedLensBids = useMemo(() => {
    const q = lossSearchQuery.trim().toLowerCase()
    if (!q) return lensBids
    return lensBids.filter(
      (b) =>
        b.project.toLowerCase().includes(q) ||
        b.builderName.toLowerCase().includes(q) ||
        b.label.toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q) ||
        (b.estimatorName ?? '').toLowerCase().includes(q) ||
        bidNumberMatchesQuery(b.raw, lossSearchQuery, ledgerPrefixMap),
    )
  }, [lensBids, lossSearchQuery, ledgerPrefixMap])

  // Per-GC rows already carry one entry per GC (packets + "Also sent to"), so no further expansion.
  const expandedLensBids = searchedLensBids

  const groups = useMemo(() => groupLossTriageByBuilder(expandedLensBids), [expandedLensBids])

  const pendingCountByBuilderKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const { row } of allRows) {
      if (row.outcome !== 'pending') continue
      map.set(row.gcKey, (map.get(row.gcKey) ?? 0) + 1)
    }
    return map
  }, [allRows])

  const wonCount = useMemo(() => allRows.filter(({ row }) => row.outcome === 'won').length, [allRows])
  const rollup = useMemo(() => buildLossRollup(lensBids, wonCount), [lensBids, wonCount])
  const clearedToday = Object.keys(localSaves).length

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
    return selectedBids.find((b) => b.rowKey === selectedBidId) ?? selectedBids.find((b) => !isBidLossCategoryKey(b.category)) ?? selectedBids[0]!
  }, [selectedBids, selectedBidId])

  useEffect(() => {
    setNoteDraft('')
    setTabCaptureOpen(false)
  }, [selectedBid?.rowKey])

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

  function saveBidTab(b: LensBid, values: BidTabValues, entries: BidTabEntryDraft[] | null = null) {
    setSavingTabBidId(b.id)
    const patch: Record<string, number | null> = { ...buildBidTabPatch(values) }
    const clearing = !hasAnyBidTabValue(values)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'),
          'save bid tab',
        )
        if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        onError(null)
        // Paste capture (v2.2296): the full per-bidder tab rides along; a
        // summary clear ("Remove bid tab") clears the rungs too. Fail-soft.
        if (entries?.length) {
          const res = await replaceBidTabEntries(b.id, entries, null)
          if (res.ok) setTabEntriesByBid((prev) => ({ ...prev, [b.id]: entries.map((e, i) => ({ ...e, id: `local-${i}` })) }))
          else onError('Tab summary saved, but the full bidder list could not be stored yet.')
        } else if (clearing) {
          await clearBidTabEntries(b.id)
          setTabEntriesByBid((prev) => ({ ...prev, [b.id]: [] }))
        }
        setTabCaptureOpen(false)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save the bid tab: ${err.message}` : 'Could not save the bid tab.')
      } finally {
        setSavingTabBidId(null)
      }
    })()
  }

  function selectBuilder(key: string) {
    setSelectedBuilderKey(key)
    setSelectedBidId(null)
  }

  function advanceFrom(rowKey: string) {
    if (!selectedGroup) return
    const idx = selectedBids.findIndex((b) => b.rowKey === rowKey)
    const group = { bids: selectedBids }
    const next = nextLossTriageBidIndex(group, idx)
    if (next != null) {
      setSelectedBidId(selectedBids[next]!.rowKey)
      return
    }
    // Builder clear — hop to the next builder that still needs reasons.
    const ng = groups.find((g) => g.builderKey !== selectedGroup.builderKey && g.needsCount > 0)
    if (ng) {
      setSelectedBuilderKey(ng.builderKey)
      setSelectedBidId(null)
    }
  }

  function saveCategory(b: LensBid, key: BidLossCategoryKey) {
    const note = noteDraft.trim()
    setLocalSaves((prev) => ({
      ...prev,
      [b.rowKey]: { category: key, note: note || (prev[b.rowKey]?.note ?? null) },
    }))
    advanceFrom(b.rowKey)
    void (async () => {
      try {
        if (gcRowIsPacketScoped(b.gc)) {
          // Multi-GC bid: the reason belongs to this GC's packet; the bid's own reason is untouched.
          const res = await setGcPacketLossCategory({ versionIds: b.gc.versionIds, category: key, note: note || null })
          if (res.error) throw new Error(res.error)
          window.dispatchEvent(new Event('bid-gc-outcome-changed'))
        } else {
          const patch: { loss_category: string; loss_reason?: string } = { loss_category: key }
          if (note) patch.loss_reason = note
          const rows = await withSupabaseRetry(
            async () => supabase.from('bids').update(patch).eq('id', b.id).select('id'),
            'save bid loss category',
          )
          if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        }
        onError(null)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save loss reason: ${err.message}` : 'Could not save loss reason.')
        setLocalSaves((prev) => {
          const next = { ...prev }
          delete next[b.rowKey]
          return next
        })
      }
    })()
  }

  // Keyboard: 1–6 saves a reason on the open bid, arrows move within the builder.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (!selectedBid) return
      const n = Number.parseInt(e.key, 10)
      if (n >= 1 && n <= BID_LOSS_CATEGORIES.length) {
        saveCategory(selectedBid, BID_LOSS_CATEGORIES[n - 1]!.key)
        e.preventDefault()
        return
      }
      // Enter confirms the note-derived suggestion (never auto-applied — this IS the tap).
      if (e.key === 'Enter' && !isBidLossCategoryKey(selectedBid.category)) {
        const suggested = suggestLossCategoryFromNote(selectedBid.legacyReason)
        if (suggested) {
          saveCategory(selectedBid, suggested)
          e.preventDefault()
          return
        }
      }
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

  const needTotal = rollup.uncategorizedCount

  if (allLensBids.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
        No lost bids in this trade yet — nothing to explain.
      </p>
    )
  }

  const estimatorFilterSelect =
    estimatorOptions.length > 1 ? (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
        bids by
        <select
          value={estimatorFilter}
          onChange={(e) => {
            setEstimatorFilter(e.target.value)
            setSelectedBuilderKey(null)
            setSelectedBidId(null)
          }}
          aria-label="Show only bids by estimator"
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.18rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: estimatorFilter ? 'var(--text-blue-700)' : 'var(--text-strong)' }}
        >
          <option value="">All estimators</option>
          {estimatorOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    ) : null

  const maxLineCount = Math.max(1, ...rollup.lines.map((l) => l.count))
  const pendingForSelected = selectedGroup ? pendingCountByBuilderKey.get(selectedGroup.builderKey) ?? 0 : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.2rem 0.65rem',
            borderRadius: 999,
            background: needTotal > 0 ? 'var(--bg-red-tint)' : 'var(--bg-emerald-tint)',
            color: needTotal > 0 ? 'var(--text-red-800)' : 'var(--text-emerald-800)',
          }}
        >
          {needTotal > 0 ? `${needTotal} lost bid${needTotal === 1 ? ' needs' : 's need'} a reason` : 'Every lost bid has a reason'}
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {`of ${rollup.lostCount} lost · $${formatCurrency(rollup.uncategorizedValue)} unexplained`}
          {rollup.lossRatePct != null ? ` · loss rate ${rollup.lossRatePct}%` : ''}
          {rollup.lossRateExclGcLostPct != null ? `, excluding GC-lost ${rollup.lossRateExclGcLostPct}%` : ''}
        </span>
        <input
          type="text"
          value={lossSearchQuery}
          onChange={(e) => {
            setLossSearchQuery(e.target.value)
            setSelectedBuilderKey(null)
            setSelectedBidId(null)
          }}
          placeholder="Search bids (bid #, project name, or GC/Builder)…"
          aria-label="Search lost bids"
          style={{ flex: '1 1 13rem', minWidth: '11rem', maxWidth: '20rem', font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        {clearedToday > 0 ? (
          <span
            style={{
              fontSize: '0.8125rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 999,
              background: 'var(--bg-emerald-tint)',
              color: 'var(--text-emerald-800)',
            }}
          >
            {clearedToday} cleared this session
          </span>
        ) : null}
        {estimatorFilterSelect}
      </div>
      <p style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Every lost bid with no reason recorded — biggest dollars first. Tap the reason the GC gives you: keys 1–
        {BID_LOSS_CATEGORIES.length} work, Enter takes the amber suggestion. Arrow keys move between bids.
      </p>
      {estimatorFilter && lensBids.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
          No lost bids by {estimatorFilter} in this trade — switch back to All estimators.
        </p>
      ) : null}
      {lossSearchQuery.trim() && searchedLensBids.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
          No lost bids match “{lossSearchQuery.trim()}” — clear the search to see the whole queue.
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrowViewport640 ? '1fr' : '230px minmax(0, 1fr)',
          gap: '0.75rem',
          alignItems: 'start',
          marginBottom: '1rem',
        }}
      >
        {/* Scrolls on its own — the full unexplained backlog can run to dozens of builders. */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 'min(72vh, 42rem)', overflowY: 'auto' }}
          aria-label="Builder call queue"
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
                    <span style={{ color: 'var(--text-green-600)', fontSize: '0.8125rem' }} title="Every lost bid explained">{'✓'}</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)', fontWeight: 600 }}>{g.needsCount}</span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {g.needsCount === 0 ? 'all explained' : `$${formatCurrency(g.needsValue)} to explain`}
                  {(pendingCountByBuilderKey.get(g.builderKey) ?? 0) > 0
                    ? ` · ${pendingCountByBuilderKey.get(g.builderKey)} pending`
                    : ''}
                </span>
              </button>
            )
          })}
        </div>

        {selectedGroup && selectedBid ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{selectedGroup.builderName}</span>
              {(() => {
                const phone = selectedBid.gc.sharedLetter || selectedBid.gc.gcKey !== (selectedBid.raw.customer_id ?? selectedBid.raw.gc_builder_id ?? '') ? (recipientsByBidId[selectedBid.id] ?? []).find((r) => r.customerId === selectedBid.gc.gcKey)?.phone ?? null : builderPhoneOf(selectedBid.raw)
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
                const needs = selectedBids.filter((b) => !isBidLossCategoryKey(b.category)).length
                return (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: needs > 0 ? 'var(--text-red-800)' : 'var(--text-emerald-800)',
                    }}
                  >
                    {needs > 0 ? `${needs} of ${selectedBids.length} need a reason` : 'all explained'}
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
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }} aria-label="This builder's lost bids">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Their lost bids</span>
              {selectedBids.map((b) => {
                const done = isBidLossCategoryKey(b.category)
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
                      background: done ? 'var(--bg-emerald-tint)' : current ? 'var(--bg-page)' : 'transparent',
                      color: done ? 'var(--text-emerald-800)' : 'var(--text-700)',
                      fontWeight: current ? 600 : 400,
                    }}
                  >
                    {done ? `✓ ` : ''}{bidTriagePillLabel(b)}
                  </button>
                )
              })}
            </div>

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
                {selectedBid.estimatorName ? ` · est. ${selectedBid.estimatorName}` : ''}
              </div>
              {(() => {
                const tabValues = bidTabValuesFromRow(selectedBid.raw as Partial<BidTabRow>)
                if (tabCaptureOpen) return null
                if (hasAnyBidTabValue(tabValues)) {
                  const entries = tabEntriesByBid[selectedBid.id] ?? []
                  return (
                    <>
                      <BidTabRecordedLine values={tabValues} ourValue={selectedBid.value} onEdit={() => setTabCaptureOpen(true)} />
                      {entries.length > 0 ? <BidTabEntriesLadder entries={entries} /> : null}
                    </>
                  )
                }
                return (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    No bid tab recorded —{' '}
                    <button
                      type="button"
                      onClick={() => setTabCaptureOpen(true)}
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit' }}
                    >
                      record the bid tab {'→'}
                    </button>
                  </p>
                )
              })()}
              {(() => {
                // Bids by GC: which GC this entry is, its answer and ★, and what the other GCs on the bid did.
                const g = selectedBid.gc
                if (g.sharedLetter) {
                  const primary = g.siblings[0]?.gcName ?? ((selectedBid.raw.customers?.name ?? '').trim() || (selectedBid.raw.bids_gc_builders?.name ?? '').trim() || 'the bid’s GC')
                  return (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      Sent to this GC too — same letter as {primary}
                      <span style={{ fontStyle: 'italic' }}> (one reason clears it for every GC)</span>
                    </p>
                  )
                }
                if (g.siblings.length === 0) return null
                const fmtSent = (ymd: string) => { const [, m, d] = ymd.split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ymd }
                const outcomeChip = (o: string) => (
                  <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.45rem', borderRadius: 999, border: '1px solid var(--border)', background: o === 'won' ? 'var(--bg-emerald-tint)' : o === 'lost' ? 'var(--bg-red-tint)' : 'var(--bg-muted)', color: o === 'won' ? 'var(--text-emerald-800)' : o === 'lost' ? 'var(--text-red-800)' : 'var(--text-700)' }}>{o === 'pending' ? 'waiting' : o}</span>
                )
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.55rem', alignItems: 'center', fontSize: '0.8rem', margin: '0.45rem 0 0', padding: '0.35rem 0.55rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{g.gcName}</span>
                    {outcomeChip(g.outcome)}
                    <span style={{ color: 'var(--text-muted)' }}>{g.value > 0 ? `★ $${formatCurrency(g.value)}` : ''}{g.sentOn ? `${g.value > 0 ? ' · ' : ''}sent ${fmtSent(g.sentOn)}` : ''}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--text-muted)' }}>also went to</span>
                    {g.siblings.map((sb) => (
                      <span key={sb.gcKey} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{sb.gcName}</span>
                        {outcomeChip(sb.outcome)}
                      </span>
                    ))}
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', flexBasis: '100%' }}>this reason is {g.gcName}’s — the bid stays {selectedBid.raw.outcome === 'won' || selectedBid.raw.outcome === 'started_or_complete' ? 'won' : selectedBid.raw.outcome === 'lost' ? 'lost' : 'as it is'}</span>
                  </div>
                )
              })()}
              {selectedBid.legacyReason && !selectedBid.note ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  note on file: “{selectedBid.legacyReason}”
                </p>
              ) : null}
              {isBidLossCategoryKey(selectedBid.category) ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-emerald-800)' }}>
                  {'✓'} {bidLossCategoryLabel(selectedBid.category)}
                  {selectedBid.gc.reasonInferred && !localSaves[selectedBid.rowKey] ? <span title="Recorded when another GC on this bid was marked won" style={{ marginLeft: '0.35rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 3, padding: '0 0.25rem', verticalAlign: 'middle' }}>auto</span> : null}
                  {selectedBid.note ? ` — “${selectedBid.note}”` : ''}
                  <span style={{ color: 'var(--text-muted)' }}> (tap another reason to change)</span>
                </p>
              ) : null}
            </div>

            {tabCaptureOpen ? (
              <BidTabCapturePanel
                key={selectedBid.rowKey}
                ourValue={selectedBid.value}
                initial={bidTabValuesFromRow(selectedBid.raw as Partial<BidTabRow>)}
                saving={savingTabBidId != null}
                onSave={(values, _noteLine, entries) => saveBidTab(selectedBid, values, entries ?? null)}
                secondaryLabel="Cancel"
                onSecondary={() => setTabCaptureOpen(false)}
                onRemove={() => saveBidTab(selectedBid, EMPTY_BID_TAB_VALUES)}
              />
            ) : null}

            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Why did we lose it?
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  keys 1–{BID_LOSS_CATEGORIES.length} · Enter takes the amber suggestion
                </span>
              </div>
              <BidLossCategoryChips
                value={isBidLossCategoryKey(selectedBid.category) ? selectedBid.category : null}
                onSelect={(key) => saveCategory(selectedBid, key)}
                showKeyNumbers
                suggestedKey={suggestLossCategoryFromNote(selectedBid.legacyReason)}
                suggestedHint="suggested from the note — Enter confirms"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="what they said (optional — saved with the next reason tap)"
                aria-label="Loss note"
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
              {pendingForSelected > 0 ? (
                <>
                  Also on this call: {pendingForSelected} pending bid{pendingForSelected === 1 ? '' : 's'} —{' '}
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
                </>
              ) : (
                'No pending bids with this builder.'
              )}
            </p>
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Why we lost</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {rollup.lostCount} lost · ${formatCurrency(rollup.lostValue)}
            {rollup.lossRatePct != null ? ` · loss rate ${rollup.lossRatePct}%` : ''}
            {rollup.lossRateExclGcLostPct != null ? ` · excluding GC-lost ${rollup.lossRateExclGcLostPct}%` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rollup.lines.filter((l) => l.count > 0).map((l) => (
            <div key={l.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 2 }}>
                <span>{l.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{l.count} · ${formatCurrency(l.value)}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-subtle)' }}>
                <div
                  style={{
                    width: `${Math.round((l.count / maxLineCount) * 100)}%`,
                    height: 7,
                    borderRadius: 4,
                    background: l.key === 'gc_lost' ? '#6b7280' : l.key === 'price' ? '#f59e0b' : l.key === 'other_sub' ? '#8b5cf6' : l.key === 'project_died' ? '#10b981' : l.key === 'no_bid' ? '#ef4444' : '#94a3b8',
                  }}
                />
              </div>
            </div>
          ))}
          {rollup.uncategorizedCount > 0 ? (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Not yet recorded: {rollup.uncategorizedCount} · ${formatCurrency(rollup.uncategorizedValue)} — that's the queue above.
            </p>
          ) : null}
        </div>
      </div>

      <BidLossLearnPanel rows={learnRows} nowIso={nowIso} />
    </div>
  )
}
