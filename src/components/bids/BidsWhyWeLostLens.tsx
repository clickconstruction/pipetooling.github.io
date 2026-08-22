import { BidLossCategoryChips } from './BidLossCategoryChips'
import { BidTabCapturePanel, BidTabRecordedLine } from './BidTabCapturePanel'
import {
  bidTabValuesFromRow,
  buildBidTabPatch,
  hasAnyBidTabValue,
  type BidTabRow,
  type BidTabValues,
} from '../../lib/bidTabCapture'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
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
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import { bidTriagePillLabel } from '../../lib/bids/bidFormatting'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { expandLensBidByRecipients, looksLikeCombinedGcName, type BidGcRecipientsMap, type RecipientExpanded } from '../../lib/bids/bidGcRecipients'

export type BidsWhyWeLostLensProps = {
  bids: BidWithBuilder[]
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
  id: string
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

const cardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 0.9rem',
  background: 'var(--bg-page)',
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
  const [tabCaptureOpen, setTabCaptureOpen] = useState(false)
  const [savingTabBidId, setSavingTabBidId] = useState<string | null>(null)
  /** "bids by" estimator scope (v2.2053) — '' = all; scopes the WHOLE lens (headline, rail, queue). */
  const [estimatorFilter, setEstimatorFilter] = useState('')

  const allLensBids = useMemo<LensBid[]>(() => {
    return bids
      .filter((b) => b.outcome === 'lost')
      .map((b) => {
        const local = localSaves[b.id]
        const builderName =
          (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
        return {
          id: b.id,
          builderKey: b.customer_id ?? b.gc_builder_id ?? builderName,
          builderName,
          value: Number(b.bid_value) || 0,
          category: local?.category ?? b.loss_category,
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          address: (b.address ?? '').trim() || null,
          estimatorName: estimatorNameOf(b),
          legacyReason: (b.loss_reason ?? '').trim() || null,
          note: local?.note ?? null,
          raw: b,
        }
      })
  }, [bids, localSaves, ledgerPrefixMap])

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

  // Per-GC copies: a bid sent to three GCs gets a queue entry under each.
  // The outcome is per-bid, so recording it under any GC clears every copy.
  const expandedLensBids = useMemo<RecipientExpanded<LensBid>[]>(
    () => lensBids.flatMap((b) => expandLensBidByRecipients(b, recipientsByBidId[b.id])),
    [lensBids, recipientsByBidId],
  )

  const groups = useMemo(() => groupLossTriageByBuilder(expandedLensBids), [expandedLensBids])

  const pendingCountByBuilderKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of bids) {
      if (!b.bid_date_sent || b.outcome === 'won' || b.outcome === 'lost' || b.outcome === 'started_or_complete') continue
      const key = b.customer_id ?? b.gc_builder_id ?? ((b.customers?.name ?? b.bids_gc_builders?.name ?? '').trim() || 'No builder')
      map.set(key, (map.get(key) ?? 0) + 1)
      for (const r of recipientsByBidId[b.id] ?? []) {
        if (r.customerId === key) continue
        map.set(r.customerId, (map.get(r.customerId) ?? 0) + 1)
      }
    }
    return map
  }, [bids, recipientsByBidId])

  const wonCount = useMemo(
    () => bids.filter((b) => b.outcome === 'won' || b.outcome === 'started_or_complete').length,
    [bids],
  )
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
    return selectedBids.find((b) => b.id === selectedBidId) ?? selectedBids.find((b) => !isBidLossCategoryKey(b.category)) ?? selectedBids[0]!
  }, [selectedBids, selectedBidId])

  useEffect(() => {
    setNoteDraft('')
    setTabCaptureOpen(false)
  }, [selectedBid?.id])

  function saveBidTab(b: LensBid, values: BidTabValues) {
    setSavingTabBidId(b.id)
    const patch: Record<string, number | null> = { ...buildBidTabPatch(values) }
    void (async () => {
      try {
        await withSupabaseRetry(
          async () => supabase.from('bids').update(patch).eq('id', b.id),
          'save bid tab',
        )
        onError(null)
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

  function advanceFrom(bidId: string) {
    if (!selectedGroup) return
    const idx = selectedBids.findIndex((b) => b.id === bidId)
    const group = { bids: selectedBids }
    const next = nextLossTriageBidIndex(group, idx)
    if (next != null) {
      setSelectedBidId(selectedBids[next]!.id)
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
      [b.id]: { category: key, note: note || (prev[b.id]?.note ?? null) },
    }))
    advanceFrom(b.id)
    void (async () => {
      try {
        const patch: { loss_category: string; loss_reason?: string } = { loss_category: key }
        if (note) patch.loss_reason = note
        await withSupabaseRetry(
          async () => supabase.from('bids').update(patch).eq('id', b.id),
          'save bid loss category',
        )
        onError(null)
        onReloadBids()
      } catch (err) {
        onError(err instanceof Error ? `Could not save loss reason: ${err.message}` : 'Could not save loss reason.')
        setLocalSaves((prev) => {
          const next = { ...prev }
          delete next[b.id]
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
      const idx = selectedBids.findIndex((b) => b.id === selectedBid.id)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const next = selectedBids[Math.min(selectedBids.length - 1, idx + 1)]
        if (next) setSelectedBidId(next.id)
        e.preventDefault()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prev = selectedBids[Math.max(0, idx - 1)]
        if (prev) setSelectedBidId(prev.id)
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
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Keys 1–{BID_LOSS_CATEGORIES.length} tap a reason · Enter takes a suggestion · arrows move between bids
        </span>
      </div>
      {estimatorFilter && lensBids.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
          No lost bids by {estimatorFilter} in this trade — switch back to All estimators.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }} aria-label="Builder call queue">
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
                  {g.needsCount === 0 ? 'clear' : `$${formatCurrency(g.needsValue)} to explain`}
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
                const phone = selectedBid.viaRecipient ? selectedBid.viaRecipient.phone : builderPhoneOf(selectedBid.raw)
                return phone ? (
                  <a
                    href={`tel:${phone}`}
                    style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}
                  >
                    {'☎'} {phone}
                  </a>
                ) : null
              })()}
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedBids.length - selectedBids.filter((b) => !isBidLossCategoryKey(b.category)).length} of {selectedBids.length} done
              </span>
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
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }} aria-label="This builder's lost bids">
              {selectedBids.map((b) => {
                const done = isBidLossCategoryKey(b.category)
                const current = b.id === selectedBid.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBidId(b.id)}
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
                  return (
                    <BidTabRecordedLine values={tabValues} ourValue={selectedBid.value} onEdit={() => setTabCaptureOpen(true)} />
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
                const recips = recipientsByBidId[selectedBid.id] ?? []
                if (recips.length === 0 && !selectedBid.viaRecipient) return null
                const primaryName =
                  (selectedBid.raw.customers?.name ?? '').trim() || (selectedBid.raw.bids_gc_builders?.name ?? '').trim() || 'No builder'
                const others = [
                  ...(selectedBid.viaRecipient ? [primaryName] : []),
                  ...recips.filter((r) => r.customerId !== selectedBid.builderKey).map((r) => r.name),
                ]
                return (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {selectedBid.viaRecipient ? 'Sent to this GC too — ' : ''}
                    also sent to: {others.length > 0 ? others.join(', ') : '—'}
                    <span style={{ fontStyle: 'italic' }}> (one reason clears it for every GC)</span>
                  </p>
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
                  {selectedBid.note ? ` — “${selectedBid.note}”` : ''}
                  <span style={{ color: 'var(--text-muted)' }}> (tap another reason to change)</span>
                </p>
              ) : null}
            </div>

            {tabCaptureOpen ? (
              <BidTabCapturePanel
                key={selectedBid.id}
                ourValue={selectedBid.value}
                initial={bidTabValuesFromRow(selectedBid.raw as Partial<BidTabRow>)}
                saving={savingTabBidId != null}
                onSave={(values) => saveBidTab(selectedBid, values)}
                secondaryLabel="Cancel"
                onSecondary={() => setTabCaptureOpen(false)}
              />
            ) : null}

            <div style={{ marginBottom: '0.6rem' }}>
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
                onClick={() => advanceFrom(selectedBid.id)}
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
    </div>
  )
}
