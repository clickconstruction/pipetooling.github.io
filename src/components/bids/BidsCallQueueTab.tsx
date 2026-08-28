import { useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
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
import type { GcPacket } from '../../lib/bids/gcPackets'
import { gcOutcomeRowsForBid, gcRowIsPacketScoped, type GcOutcomeRow } from '../../lib/bids/gcOutcomeRows'
import { setGcPacketLossCategory, setGcPacketOutcome } from '../../lib/bids/gcPacketOutcome'
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

export type BidsCallQueueTabProps = {
  bids: BidWithBuilder[]
  /** Per-bid GC packets — builder stats and rows count each GC's packet, not the bid. */
  gcPacketsByBid: Record<string, GcPacket[]>
  ledgerPrefixMap: LedgerPrefixMap
  /** Latest submission-entry instant per bid id (parent's `lastContactFromEntries`). */
  lastContactFromEntries: Record<string, string>
  narrowViewport640: boolean
  authUserId: string | null
  onError: (message: string | null) => void
  onReloadBids: () => void
  /** Jump to this bid's builder card on the By-builder lens (call session lives there). */
  onOpenBuilderCard: (bid: BidWithBuilder) => void
}

type QueueRowKey = 'chase' | 'reasons' | 'tabs'

/** One queue entry = one bid × one GC (Bids by GC, v2.2164). `id` stays the bid id (writes); `rowKey` is unique. */
type MappedBid = CallQueueBid & { rowKey: string; label: string; project: string; raw: BidWithBuilder; gc: GcOutcomeRow }

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
  gcPacketsByBid,
  ledgerPrefixMap,
  lastContactFromEntries,
  narrowViewport640,
  authUserId,
  onError,
  onReloadBids,
  onOpenBuilderCard,
}: BidsCallQueueTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKey, setFilterKey] = useState<'all' | QueueRowKey>('all')
  const [openRow, setOpenRow] = useState<{ builderKey: string; row: QueueRowKey } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [lostPickerBidId, setLostPickerBidId] = useState<string | null>(null)
  const [tabOpenBidId, setTabOpenBidId] = useState<string | null>(null)
  const [savingBidId, setSavingBidId] = useState<string | null>(null)

  // One instant per mount keeps every memo on the same clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])

  const mapped = useMemo<MappedBid[]>(
    () =>
      bids.flatMap((b) => {
        const builderName = (b.customers?.name ?? '').trim() || (b.bids_gc_builders?.name ?? '').trim() || 'No builder'
        const builderKey = b.customer_id ?? b.gc_builder_id ?? builderName
        const fromBid = b.last_contact ?? null
        const fromEntries = lastContactFromEntries[b.id] ?? null
        const lastContactIso =
          fromBid && fromEntries ? (fromBid > fromEntries ? fromBid : fromEntries) : fromBid ?? fromEntries
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
          label: bidLensLabel(b, ledgerPrefixMap),
          project: (b.project_name ?? '').trim() || '—',
          raw: b,
          gc: row,
        }))
      }),
    [bids, gcPacketsByBid, lastContactFromEntries, ledgerPrefixMap],
  )

  const queue = useMemo(() => buildCallQueue(mapped, nowIso), [mapped, nowIso])
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
  }, [queue.builders, filterKey, searchQuery, bidsByBuilder, ledgerPrefixMap])

  function toggleRow(builderKey: string, row: QueueRowKey) {
    setNoteDraft('')
    setLostPickerBidId(null)
    setTabOpenBidId(null)
    setOpenRow((cur) => (cur && cur.builderKey === builderKey && cur.row === row ? null : { builderKey, row }))
  }

  /** Multi-GC bid rows carry their own answer and reason (a packet); single-GC rows write the bid as always. */
  function packetScoped(b: MappedBid): boolean {
    return gcRowIsPacketScoped(b.gc)
  }

  /** One chase tap — entry + last_contact stamp (+ outcome / tab when given), then reload. */
  function chaseAction(b: MappedBid, action: PendingChaseActionKey, lossCategory: BidLossCategoryKey | null = null, tab: BidTabValues | null = null, tabEntries: BidTabEntryDraft[] | null = null) {
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
    setSavingBidId(b.id)
    setNoteDraft('')
    setLostPickerBidId(null)
    setTabOpenBidId(null)
    void (async () => {
      try {
        await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(writes.entry), 'log call note')
        const patch: Record<string, string | number | null> = { last_contact: writes.lastContact }
        if (writes.outcomeUpdate && packetScoped(b)) {
          // Multi-GC bid: the answer is this GC's, not the bid's — write the packet; the bid rolls up.
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
          patch.outcome = writes.outcomeUpdate.outcome
          patch.loss_reason = writes.outcomeUpdate.loss_reason
          patch.loss_category = writes.outcomeUpdate.loss_category
        }
        if (tab && hasAnyBidTabValue(tab)) Object.assign(patch, buildBidTabPatch(tab))
        await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id), 'save call outcome')
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
          await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id), 'save loss reason')
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
        await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', b.id), 'save bid tab')
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

  const noteInput = (
    <input
      type="text"
      value={noteDraft}
      onChange={(e) => setNoteDraft(e.target.value)}
      placeholder="what they said (optional — saved with the next tap)"
      aria-label="Call note"
      style={{ flex: 1, minWidth: '14rem', maxWidth: '30rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.78rem', font: 'inherit' }}
    />
  )

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
            return (
              <div key={b.rowKey} style={{ marginBottom: '0.55rem' }}>
                {bidHeadline(b, `${b.sentIso ? ` · sent ${shortDate(b.sentIso)}` : ''}${quietDays != null ? ` · quiet ${quietDays}d` : ''}`)}
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
                        onClick={() =>
                          a.key === 'lost' ? setLostPickerBidId(b.rowKey) : a.key === 'bid_tab' ? setTabOpenBidId(b.rowKey) : chaseAction(b, a.key)
                        }
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.22rem 0.6rem',
                          borderRadius: 999,
                          cursor: 'pointer',
                          border: '1px solid var(--border-strong)',
                          background: a.key === 'won' ? 'var(--bg-emerald-tint)' : a.key === 'lost' ? 'var(--bg-red-tint)' : 'var(--surface)',
                          color: a.key === 'won' ? 'var(--text-emerald-800)' : a.key === 'lost' ? 'var(--text-red-800)' : 'var(--text-700)',
                          opacity: savingBidId != null ? 0.6 : 1,
                          font: 'inherit',
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{noteInput}</div>
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
          {` · ${queue.totals.chaseCount} bids to chase · ${queue.totals.reasonsCount} losses need a reason · $${formatCurrency(queue.totals.reasonsDollars)} unexplained · ${queue.totals.tabsCount} tabs gettable`}
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
                font: 'inherit',
              }}
            >
              {f.label}
              {f.count != null ? <span style={{ opacity: 0.75, fontSize: '0.72rem', marginLeft: '0.25rem' }}>{f.count}</span> : null}
            </button>
          )
        })}
      </div>
      <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        One list, worked top to bottom — whoever has waited longest first. Every card shows the same three rows; click a row to
        open the bids behind the number right here. {'📞'} opens the builder card for a full call session.
      </p>

      {visibleBuilders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Nothing matches — clear the search or switch the filter back to All calls.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {visibleBuilders.map((builder) => {
            const rows: Array<{ key: QueueRowKey; label: string; todo: string | null; todoSub: string | null; done: string }> = [
              {
                key: 'chase',
                label: 'Chase',
                todo: builder.chase.todo.length > 0 ? `${builder.chase.todo.length} pending` : null,
                todoSub: builder.chase.oldestQuietDays != null ? `quiet ${builder.chase.oldestQuietDays}d` : null,
                done: `${builder.chase.freshCount} of ${builder.stats.pending} fresh`,
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
                  {builder.phone ? (
                    <a href={`tel:${builder.phone}`} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}>
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
