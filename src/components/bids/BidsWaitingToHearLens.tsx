import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { formatCurrency } from '../../lib/format'
import { bidAddressMapsUrl } from '../../lib/buildBidPricingPackageHtml'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  PENDING_CHASE_DEFAULT_WINDOW_KEY,
  PENDING_CHASE_WINDOWS,
  bidNeedsChase,
  bidSentWithinWindow,
  buildPendingChaseRollup,
  groupPendingChaseByBuilder,
  nextPendingChaseBidIndex,
  type PendingChaseBid,
  type PendingChaseWindowKey,
} from '../../lib/bidPendingChase'
import {
  type LedgerPrefixMap,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

export type BidsWaitingToHearLensProps = {
  bids: BidWithBuilder[]
  ledgerPrefixMap: LedgerPrefixMap
  /** Latest submission-entry instant per bid id (parent's `lastContactFromEntries`). */
  lastContactFromEntries: Record<string, string>
  narrowViewport640: boolean
  /** Jump to this bid's builder card on the By-builder lens (existing deep-link plumbing). */
  onOpenBuilderCard: (bid: BidWithBuilder) => void
}

type LensBid = PendingChaseBid & {
  label: string
  project: string
  address: string | null
  estimatorName: string | null
  dueIso: string | null
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

function streetPillLabel(b: LensBid): string {
  const street = (b.address ?? '').split(',')[0]?.replace(/^\d+\s*/, '').trim()
  if (street) return street.length > 18 ? `${street.slice(0, 18)}…` : street
  return b.label
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

/** 'YYYY-MM-DD' or ISO instant → 'M/D'. */
function shortDate(iso: string): string {
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
  ledgerPrefixMap,
  lastContactFromEntries,
  narrowViewport640,
  onOpenBuilderCard,
}: BidsWaitingToHearLensProps) {
  const [windowKey, setWindowKey] = useState<PendingChaseWindowKey>(PENDING_CHASE_DEFAULT_WINDOW_KEY)
  const [selectedBuilderKey, setSelectedBuilderKey] = useState<string | null>(null)
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)

  // One instant per mount keeps every memo on the same clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])
  const windowDays = PENDING_CHASE_WINDOWS.find((w) => w.key === windowKey)?.days ?? null

  const allPendingLensBids = useMemo<LensBid[]>(() => {
    return bids
      .filter(
        (b) =>
          !!b.bid_date_sent &&
          b.outcome !== 'won' &&
          b.outcome !== 'lost' &&
          b.outcome !== 'started_or_complete',
      )
      .map((b) => {
        const builderName =
          (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
        const fromBid = b.last_contact ?? null
        const fromEntries = lastContactFromEntries[b.id] ?? null
        const lastContactIso =
          fromBid && fromEntries ? (fromBid > fromEntries ? fromBid : fromEntries) : fromBid ?? fromEntries
        return {
          id: b.id,
          builderKey: b.customer_id ?? b.gc_builder_id ?? builderName,
          builderName,
          value: Number(b.bid_value) || 0,
          sentIso: b.bid_date_sent!,
          lastContactIso,
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          address: (b.address ?? '').trim() || null,
          estimatorName: estimatorNameOf(b),
          dueIso: b.bid_due_date ?? null,
          raw: b,
        }
      })
  }, [bids, lastContactFromEntries, ledgerPrefixMap])

  const lensBids = useMemo(
    () => allPendingLensBids.filter((b) => bidSentWithinWindow(b, windowDays, nowIso)),
    [allPendingLensBids, windowDays, nowIso],
  )

  const groups = useMemo(() => groupPendingChaseByBuilder(lensBids, nowIso), [lensBids, nowIso])
  const rollup = useMemo(() => buildPendingChaseRollup(lensBids, nowIso), [lensBids, nowIso])

  const selectedGroup = useMemo(() => {
    if (groups.length === 0) return null
    return groups.find((g) => g.builderKey === selectedBuilderKey) ?? groups[0]!
  }, [groups, selectedBuilderKey])

  const selectedBids = useMemo(
    () => (selectedGroup ? lensBids.filter((b) => b.builderKey === selectedGroup.builderKey) : []),
    [lensBids, selectedGroup],
  )
  const selectedBid = useMemo(() => {
    if (selectedBids.length === 0) return null
    return (
      selectedBids.find((b) => b.id === selectedBidId) ??
      selectedBids.find((b) => bidNeedsChase(b, nowIso)) ??
      selectedBids[0]!
    )
  }, [selectedBids, selectedBidId, nowIso])

  function selectBuilder(key: string) {
    setSelectedBuilderKey(key)
    setSelectedBidId(null)
  }

  function advanceFrom(bidId: string) {
    if (!selectedGroup) return
    const idx = selectedBids.findIndex((b) => b.id === bidId)
    const next = nextPendingChaseBidIndex({ bids: selectedBids }, idx, nowIso)
    if (next != null && selectedBids[next]!.id !== bidId) {
      setSelectedBidId(selectedBids[next]!.id)
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

  const windowPills = (
    <div style={{ display: 'inline-flex', gap: '0.25rem' }} role="group" aria-label="Sent within">
      {PENDING_CHASE_WINDOWS.map((w) => {
        const active = w.key === windowKey
        return (
          <button
            key={w.key}
            type="button"
            aria-pressed={active}
            onClick={() => { setWindowKey(w.key); setSelectedBuilderKey(null); setSelectedBidId(null) }}
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
              background: active ? 'var(--surface)' : 'transparent',
              color: 'var(--text-700)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {w.label}
          </button>
        )
      })}
    </div>
  )

  if (allPendingLensBids.length === 0) {
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
            : 'Every recent sent bid has a fresh touch'}
        </span>
        {windowPills}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Sent within the window, newest first · arrows move between bids
        </span>
      </div>

      {lensBids.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Nothing sent in the last {windowDays} days is still open — widen the window to see older pending bids.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }} aria-label="Builder chase queue">
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
                    {g.needsCount === 0 ? 'fresh' : `$${formatCurrency(g.needsValue)} waiting`}
                    {` · sent ${shortDate(g.newestSentIso)}`}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedGroup && selectedBid ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{selectedGroup.builderName}</span>
                {builderPhoneOf(selectedBid.raw) ? (
                  <a
                    href={`tel:${builderPhoneOf(selectedBid.raw)}`}
                    style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}
                  >
                    {'☎'} {builderPhoneOf(selectedBid.raw)}
                  </a>
                ) : null}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedBids.filter((b) => !bidNeedsChase(b, nowIso)).length} of {selectedBids.length} fresh
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }} aria-label="This builder's pending bids">
                {selectedBids.map((b) => {
                  const fresh = !bidNeedsChase(b, nowIso)
                  const current = b.id === selectedBid.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBidId(b.id)}
                      title={`${b.label} · ${b.address ?? 'no address'}`}
                      aria-pressed={current}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 999,
                        cursor: 'pointer',
                        border: `1px solid ${current ? 'var(--border-stronger, var(--border-strong))' : 'var(--border)'}`,
                        background: fresh ? 'var(--bg-emerald-tint)' : current ? 'var(--bg-page)' : 'transparent',
                        color: fresh ? 'var(--text-emerald-800)' : 'var(--text-700)',
                        fontWeight: current ? 600 : 400,
                      }}
                    >
                      {fresh ? `✓ ` : ''}{streetPillLabel(b)}
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
                  {` · sent ${shortDate(selectedBid.sentIso)} (${daysAgoLabel(Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(selectedBid.sentIso)) / 86_400_000)))})`}
                  {selectedBid.dueIso ? ` · was due ${shortDate(selectedBid.dueIso)}` : ''}
                  {selectedBid.estimatorName ? ` · est. ${selectedBid.estimatorName}` : ''}
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: bidNeedsChase(selectedBid, nowIso) ? 'var(--text-amber-800)' : 'var(--text-emerald-800)' }}>
                  {selectedBid.lastContactIso
                    ? `Last contact ${shortDate(selectedBid.lastContactIso)} (${daysAgoLabel(Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(selectedBid.lastContactIso)) / 86_400_000)))})`
                    : 'Never contacted since sending'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ask for the bid tab — did our number land? Log the answer from their builder card.
                </span>
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
          ) : null}
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Waiting to hear</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {rollup.pendingCount} sent still open · ${formatCurrency(rollup.pendingValue)}
            {rollup.untouchedCount > 0
              ? ` · never chased since sending: ${rollup.untouchedCount} · $${formatCurrency(rollup.untouchedValue)}`
              : ''}
            {rollup.oldestUntouchedDays != null ? ` · oldest untouched ${rollup.oldestUntouchedDays}d` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
