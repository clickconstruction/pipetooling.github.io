/**
 * "Adopt an existing bid" (v2.2133, Send or Compare F6b) — fold one or more board bids into the
 * selected bid's package as versions. Same-customer bids are offered first; each row previews what
 * moves (count rows, price scenarios, its send) and the version name it will get. Confirm calls the
 * `adopt_bid_as_version` RPC per bid, in order. Nothing is deleted: the adopted bid's row retires
 * from the board (adopted_into_bid_id) and its send becomes that version's history.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { adoptPreviewLine, sortAdoptCandidates, suggestVersionName, type AdoptCandidate } from '../../lib/bids/adoptBid'

type Props = {
  targetBid: BidWithBuilder
  onClose: () => void
  onAdopted: () => Promise<void> | void
}

export function AdoptBidModal({ targetBid, onClose, onAdopted }: Props) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<AdoptCandidate[]>([])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [baseName, setBaseName] = useState('To Plans')
  const [targetIsSplit, setTargetIsSplit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const [bidsRes, targetVersionsRes] = await Promise.all([
        supabase
          .from('bids')
          .select('id, bid_number, project_name, customer_id, bid_date_sent, bid_value, outcome')
          .is('adopted_into_bid_id', null)
          .neq('id', targetBid.id)
          .order('bid_number', { ascending: false })
          .limit(400),
        supabase.from('bid_versions').select('id').eq('bid_id', targetBid.id).limit(1),
      ])
      if (cancelled) return
      setTargetIsSplit((targetVersionsRes.data ?? []).length > 0)
      const rows = (bidsRes.data ?? []) as Array<Omit<AdoptCandidate, 'countRows' | 'scenarios'>>
      const ids = rows.map((r) => r.id)
      const [splitRes, countRes, scenRes] = ids.length
        ? await Promise.all([
            supabase.from('bid_versions').select('bid_id').in('bid_id', ids),
            supabase.from('bids_count_rows').select('bid_id').in('bid_id', ids),
            supabase.from('price_book_versions').select('bid_id').in('bid_id', ids),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }]
      if (cancelled) return
      const split = new Set(((splitRes.data ?? []) as Array<{ bid_id: string }>).map((r) => r.bid_id))
      const countBy = new Map<string, number>()
      for (const r of (countRes.data ?? []) as Array<{ bid_id: string }>) countBy.set(r.bid_id, (countBy.get(r.bid_id) ?? 0) + 1)
      const scenBy = new Map<string, number>()
      for (const r of (scenRes.data ?? []) as Array<{ bid_id: string | null }>) if (r.bid_id) scenBy.set(r.bid_id, (scenBy.get(r.bid_id) ?? 0) + 1)
      // Only unsplit bids can be adopted (a bid with versions would need its pieces adopted one by one).
      const list: AdoptCandidate[] = rows
        .filter((r) => !split.has(r.id))
        .map((r) => ({ ...r, bid_value: r.bid_value == null ? null : Number(r.bid_value), countRows: countBy.get(r.id) ?? 0, scenarios: scenBy.get(r.id) ?? 0 }))
      setCandidates(sortAdoptCandidates(list, targetBid.customer_id ?? null))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [targetBid.id, targetBid.customer_id])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => (c.project_name ?? '').toLowerCase().includes(q) || (c.bid_number ?? '').toLowerCase().includes(q) || `b${c.bid_number ?? ''}`.includes(q))
  }, [candidates, search])
  const sameCustomer = visible.filter((c) => targetBid.customer_id != null && c.customer_id === targetBid.customer_id)
  const others = visible.filter((c) => !(targetBid.customer_id != null && c.customer_id === targetBid.customer_id))
  const chosen = candidates.filter((c) => picked[c.id])
  const nameFor = (c: AdoptCandidate) => names[c.id] ?? suggestVersionName(c.project_name, targetBid.project_name, c.bid_number)

  async function adoptAll() {
    if (chosen.length === 0) return
    setBusy(true)
    let done = 0
    try {
      for (const c of chosen) {
        const { error } = await supabase.rpc('adopt_bid_as_version', {
          p_target_bid_id: targetBid.id,
          p_source_bid_id: c.id,
          p_name: nameFor(c).trim() || (c.project_name ?? `B${c.bid_number ?? ''}`),
          ...(targetIsSplit ? {} : { p_target_base_name: baseName.trim() || 'To Plans' }),
        })
        if (error) {
          showToast(`Adopted ${done} of ${chosen.length}. Stopped at B${c.bid_number ?? '?'}: ${error.message}`, 'error')
          break
        }
        done++
      }
      if (done > 0) {
        showToast(`Adopted ${done} bid${done === 1 ? '' : 's'} into this package.`, 'success')
        await onAdopted()
      }
    } finally {
      setBusy(false)
    }
  }

  const row = (c: AdoptCandidate) => (
    <label key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.2em 1fr', gap: '0.5rem', alignItems: 'start', padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!picked[c.id]} onChange={() => setPicked((p) => ({ ...p, [c.id]: !p[c.id] }))} style={{ marginTop: '0.2rem' }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>B{c.bid_number ?? '?'} {c.project_name ?? '—'}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{adoptPreviewLine(c)}{c.outcome ? ` · ${c.outcome}` : ''}</span>
        {picked[c.id] ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>→ version</span>
            <input type="text" value={nameFor(c)} onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))} onClick={(e) => e.preventDefault()} style={{ flex: 1, padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8rem' }} />
          </span>
        ) : null}
      </span>
    </label>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-label="Adopt an existing bid"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 640, width: '94%', maxHeight: '88vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>Adopt existing bids into BP{targetBid.bid_number ?? ''} {targetBid.project_name ?? ''}</h3>
        <p style={{ margin: '0 0 0.7rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Each one becomes a bid in this package. Its counts, takeoff, price scenarios and GC come with it; its sent date and value become that bid's send history; its old board row retires (nothing is deleted — the number still looks up). Labor and cost stay this package's.
        </p>
        {step === 'pick' ? (
          <>
            {!targetIsSplit ? (
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>Name what this bid has now</span>
                <input type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-base)', font: 'inherit' }} />
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>This bid isn't split yet — its current counts, takeoff and prices become the first bid in the package.</span>
              </label>
            ) : null}
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by bid # or project name…" style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-base)', font: 'inherit', marginBottom: '0.5rem' }} />
            {loading ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Loading bids…</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: '46vh', overflow: 'auto' }}>
                {sameCustomer.length > 0 ? (
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem', background: 'var(--bg-subtle)' }}>Same customer</div>
                ) : null}
                {sameCustomer.map(row)}
                {others.length > 0 ? (
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem', background: 'var(--bg-subtle)' }}>Other bids</div>
                ) : null}
                {others.slice(0, search ? 200 : 40).map(row)}
                {visible.length === 0 ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.6rem' }}>No bids match. Bids that already have versions can't be adopted.</div> : null}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
              <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={chosen.length === 0} onClick={() => setStep('confirm')} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: chosen.length === 0 ? 'not-allowed' : 'pointer', opacity: chosen.length === 0 ? 0.5 : 1 }}>
                Preview {chosen.length > 0 ? `${chosen.length} move${chosen.length === 1 ? '' : 's'}` : ''} →
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              {chosen.map((c) => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1em 1fr', gap: '0.5rem', padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span>→</span>
                  <span>
                    <span style={{ fontWeight: 600 }}>B{c.bid_number ?? '?'} {c.project_name ?? '—'}</span> becomes <span style={{ fontWeight: 600 }}>{nameFor(c)}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>moves {adoptPreviewLine(c)} · B{c.bid_number ?? '?'} leaves the board, stays searchable</span>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {!targetIsSplit ? <>This bid's current setup is named <strong>{baseName || 'To Plans'}</strong> first. </> : null}
              Nothing is deleted. Each adopted bid's cost estimate stays on its old row for reference.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
              <button type="button" onClick={() => setStep('pick')} disabled={busy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>← Back</button>
              <button type="button" onClick={() => void adoptAll()} disabled={busy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? 'Adopting…' : `Adopt ${chosen.length} bid${chosen.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
