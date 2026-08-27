import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/format'
import { firstSentOn, latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'
import { groupVersionsByGc, type GcPacket, type GcVersionLike } from '../../lib/bids/gcPackets'

/**
 * Edit Bid → per-GC sent panel (v2.2407, Option A): on a bid with versions, "sent" lives with
 * each GC's packet — one row per GC with Mark sent / Date… / Un-send — and the bid-level
 * `bids.bid_date_sent` is a derived roll-up (FIRST send; the sync trigger enforces it
 * server-side, this panel writes the same value client-side for the pre-push window).
 * Nothing hand-types the bid-level date on version bids any more.
 */

type PanelProps = {
  bidId: string
  /** The bid's own GC display name ('' → "To Plans"). */
  ownGcName: string
  /** bids.bid_date_sent as loaded — the pre-per-GC fallback for packets with no send rows. */
  currentBidDateSent: string | null
  /** Keeps the parent form's date state in sync so Save never clobbers the derived roll-up. */
  onRollupDateChanged: (d: string | null) => void
}

const chipStyle = (sent: boolean): React.CSSProperties => ({
  fontSize: '0.7rem',
  fontWeight: 700,
  borderRadius: 999,
  padding: '0.1rem 0.55rem',
  whiteSpace: 'nowrap',
  background: sent ? 'var(--bg-green-tint)' : 'var(--bg-muted)',
  color: sent ? 'var(--text-green-700)' : 'var(--text-muted)',
})

const rowBtnStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  padding: '0.16rem 0.55rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export function BidGcSentPanel({ bidId, ownGcName, currentBidDateSent, onRollupDateChanged }: PanelProps) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [versions, setVersions] = useState<GcVersionLike[]>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  const [recipients, setRecipients] = useState<Array<{ customerId: string; name: string }>>([])
  const [loaded, setLoaded] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // The LIVE roll-up date (the prop is the modal-open snapshot): after an un-send the
  // pre-per-GC fallback must not resurrect the deleted send from the stale prop.
  const [liveBidDateSent, setLiveBidDateSent] = useState<string | null>(currentBidDateSent)
  /** Which packet's inline date editor is open, and its draft value. */
  const [dateEditKey, setDateEditKey] = useState<string | null>(null)
  const [dateDraft, setDateDraft] = useState('')

  async function loadAll() {
    const [vRes, sRes, rRes] = await Promise.all([
      supabase.from('bid_versions').select('id, name, customer_id, sort_order, created_at, starred_price_book_version_id').eq('bid_id', bidId).order('sort_order'),
      supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId),
      supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bidId),
    ])
    const vs = (vRes.data ?? []) as GcVersionLike[]
    setVersions(vs)
    setSends((sRes.data ?? []) as VersionSendRow[])
    type RecRow = { customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
    setRecipients(
      ((rRes.data ?? []) as RecRow[]).map((r) => ({ customerId: r.customer_id, name: (Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name) ?? '—' })),
    )
    const ids = [...new Set(vs.map((v) => v.customer_id).filter((x): x is string => !!x))]
    if (ids.length > 0) {
      const { data } = await supabase.from('customers').select('id, name').in('id', ids)
      const names: Record<string, string> = {}
      for (const c of data ?? []) names[c.id] = c.name ?? '—'
      setGcNames(names)
    }
    setLoaded(true)
  }
  useEffect(() => {
    setLoaded(false)
    setLiveBidDateSent(currentBidDateSent)
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId])

  if (!loaded || versions.length === 0) return null

  const latestSends = latestSendByVersion(sends)
  const packets = groupVersionsByGc(versions, {
    bidGcName: ownGcName || 'To Plans',
    gcNames,
    latestSends,
    bidDateSent: liveBidDateSent,
    recipients,
  })
  const realPackets = packets.filter((p) => !p.sharedLetter)
  const sentCount = realPackets.filter((p) => p.sentOn != null).length
  const derivedFirst = firstSentOn(sends) ?? (sends.length === 0 ? liveBidDateSent : null)

  const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  /** After any send write: refresh, derive the FIRST send, and mirror it onto the bid + parent form. */
  async function syncRollupAfterWrite() {
    const { data } = await supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId)
    const rows = (data ?? []) as VersionSendRow[]
    setSends(rows)
    const first = firstSentOn(rows)
    await withSupabaseRetry(async () => supabase.from('bids').update({ bid_date_sent: first }).eq('id', bidId), 'per-GC sent roll-up')
    setLiveBidDateSent(first)
    onRollupDateChanged(first)
    window.dispatchEvent(new Event('bid-version-sends-changed'))
  }

  async function markGcSent(p: GcPacket, dateStr: string) {
    setBusyKey(p.key)
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null
      try {
        await withSupabaseRetry(
          async () =>
            supabase.from('bid_version_sends').insert(
              p.versions.map((v) => ({ bid_id: bidId, bid_version_id: v.id, sent_on: dateStr, value: null, is_alternate: false, created_by: userId })),
            ),
          'per-GC mark sent',
        )
      } catch (e) {
        showToast('Could not record the send: ' + (e instanceof Error ? e.message : String(e)), 'error')
        return
      }
      await syncRollupAfterWrite()
      showToast(`${p.name} marked sent ${dateStr}.`, 'success')
    } finally {
      setBusyKey(null)
    }
  }

  async function editGcDate(p: GcPacket, dateStr: string) {
    setBusyKey(p.key)
    try {
      const ids = p.versions.map((v) => v.id)
      // Latest send date this packet actually carries in rows (not the pre-per-GC fallback).
      let latestReal: string | null = null
      for (const v of ids) {
        const s = latestSends[v]
        if (s && (!latestReal || s.sentOn > latestReal)) latestReal = s.sentOn
      }
      if (latestReal) {
        try {
          await withSupabaseRetry(
            async () => supabase.from('bid_version_sends').update({ sent_on: dateStr }).in('bid_version_id', ids).eq('sent_on', latestReal),
            'per-GC send date edit',
          )
        } catch (e) {
          showToast('Could not change the date: ' + (e instanceof Error ? e.message : String(e)), 'error')
          return
        }
        await syncRollupAfterWrite()
        showToast(`${p.name}'s send moved to ${dateStr}.`, 'success')
      } else {
        await markGcSent(p, dateStr)
        return
      }
    } finally {
      setBusyKey(null)
      setDateEditKey(null)
    }
  }

  async function unsendGc(p: GcPacket) {
    const others = realPackets.filter((x) => x.key !== p.key && x.sentOn != null).length
    const ok = await confirmDialog({
      message:
        `Remove every send record for ${p.name}? Their packet goes back to "not sent"` +
        (others === 0 ? ' — and with no other GC sent, the bid returns to Unsent/Working.' : '.'),
      confirmLabel: 'Un-send',
      danger: true,
    })
    if (!ok) return
    setBusyKey(p.key)
    try {
      const ids = p.versions.map((v) => v.id)
      try {
        await withSupabaseRetry(
          async () => supabase.from('bid_version_sends').delete().eq('bid_id', bidId).in('bid_version_id', ids),
          'per-GC un-send',
        )
      } catch (e) {
        showToast('Could not un-send: ' + (e instanceof Error ? e.message : String(e)), 'error')
        return
      }
      await syncRollupAfterWrite()
      showToast(`${p.name} un-sent.`, 'success')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
        Sent <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>— per GC</span>
      </label>
      <div style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.45rem 0.6rem', background: 'var(--bg-subtle)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
        {sentCount > 0 ? (
          <>
            <b>{sentCount} of {realPackets.length} GC{realPackets.length === 1 ? '' : 's'} sent</b>
            {derivedFirst ? <> · first {derivedFirst}</> : null}
            <span style={{ color: 'var(--text-muted)' }}> — rolled up from the rows below</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Not sent to any GC yet.</span>
        )}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        {packets.map((p, i) => {
          const busy = busyKey === p.key
          const editing = dateEditKey === p.key
          return (
            <div key={p.key || 'own'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.6rem', borderBottom: i < packets.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
              <b style={{ overflowWrap: 'anywhere' }}>{p.name}</b>
              <span style={chipStyle(p.sentOn != null)}>{p.sentOn != null ? `sent ${p.sentOn}` : 'not sent'}</span>
              {p.sentValue != null ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(p.sentValue)}</span> : null}
              {p.sharedLetter ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>same letter as {ownGcName || 'the GC'} — tracked with the bid</span>
              ) : editing ? (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.12rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 5 }} aria-label={`Sent date for ${p.name}`} />
                  <button type="button" disabled={busy || !dateDraft} onClick={() => void editGcDate(p, dateDraft)} style={{ ...rowBtnStyle, background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 700 }}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setDateEditKey(null)} style={rowBtnStyle}>Cancel</button>
                </span>
              ) : (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {p.sentOn == null ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markGcSent(p, today())}
                      title={`Record that ${p.name}'s letter went out today`}
                      style={{ ...rowBtnStyle, background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 700 }}
                    >
                      {busy ? 'Marking…' : 'Mark sent'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDateEditKey(p.key)
                      setDateDraft(p.sentOn ?? today())
                    }}
                    title="Set or correct the date this GC's letter actually went out (sent or phoned in)"
                    style={rowBtnStyle}
                  >
                    ✎ Date…
                  </button>
                  {p.sentOn != null ? (
                    <button type="button" disabled={busy} onClick={() => void unsendGc(p)} style={{ ...rowBtnStyle, color: 'var(--text-red-700)' }}>
                      Un-send…
                    </button>
                  ) : null}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
        These are the same per-GC send records the Cover Letter's Mark-sent writes. The bid's board date rolls up automatically (first send) — nothing types it by hand on a bid with versions.
      </div>
    </div>
  )
}
