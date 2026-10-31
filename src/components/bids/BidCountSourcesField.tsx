import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserDisplayNames } from '../../hooks/useUserDisplayNames'
import { BID_COUNT_SOURCE_SELECT, type BidCountSourceRow } from '../../hooks/useBidCountSourcesByBid'
import { versionChipWords } from '../../lib/bids/bidPlanSets'
import { fetchBidVersionNames } from '../../lib/bids/bidVersionNames'
import { countSourceLabel, parseSourceShares, rowsCarryingKey, sharesWithoutKey } from '../../lib/bids/countSources'
import { countSourceTokenOf } from '../../lib/bids/parseCountsImportText'
import { formatErrorMessage } from '../../utils/errorHandling'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

/**
 * Edit Bid → CountTooling projects (v2.5520, combine two CountTooling counts on one bid): one row per project behind
 * the bid's counts — its label, who imported it and when, what the copy covered, how many rows are its and how many
 * it shares — with Open and ×, and a link typed by hand. Removing a project keeps its rows on the bid; they just lose
 * its share (`sharesWithoutKey`). The first project by first import is the bid's own CountTooling link (the Bid
 * Board's crosshair): when it goes, the next one takes its place and the form's field follows (`onFirstLinkChange`).
 * Saved bids only — a project needs a bid id.
 */
export type BidCountSourcesFieldProps = {
  bidId: string
  /** The form's CountTooling Plans field: the first project's link, kept in step. */
  onFirstLinkChange?: (link: string) => void
}

const SCOPE_WORDS: Record<string, string> = { all: 'every sheet', partial: 'part of the takeoff', unknown: 'no scope heading' }

function fmtDay(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BidCountSourcesField({ bidId, onFirstLinkChange }: BidCountSourcesFieldProps) {
  const { user } = useAuth()
  const [sources, setSources] = useState<BidCountSourceRow[]>([])
  const [rows, setRows] = useState<Array<{ id: string; source_shares: unknown }>>([])
  const [loaded, setLoaded] = useState(false)
  const [gen, setGen] = useState(0)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [versionNames, setVersionNames] = useState<ReadonlyMap<string, string>>(new Map())
  const names = useUserDisplayNames(sources.map((s) => s.imported_by))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [src, cr] = await Promise.all([
          supabase.from('bid_count_sources').select(BID_COUNT_SOURCE_SELECT).eq('bid_id', bidId).order('first_imported_at', { ascending: true }),
          supabase.from('bids_count_rows').select('id, source_shares').eq('bid_id', bidId),
        ])
        if (src.error) throw src.error
        if (cancelled) return
        setSources((src.data ?? []) as BidCountSourceRow[])
        if ((src.data ?? []).some((r) => (r as BidCountSourceRow).bid_version_id)) setVersionNames(await fetchBidVersionNames(bidId))
        setRows((cr.data ?? []) as Array<{ id: string; source_shares: unknown }>)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not read the CountTooling projects'))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, gen])

  const counts = useMemo(() => {
    const out = new Map<string, { own: number; shared: number }>()
    for (const s of sources) out.set(s.id, { own: 0, shared: 0 })
    for (const r of rows) {
      const keys = Object.keys(parseSourceShares(r.source_shares))
      for (const k of keys) {
        const c = out.get(k)
        if (!c) continue
        if (keys.length > 1) c.shared += 1
        else c.own += 1
      }
    }
    return out
  }, [sources, rows])

  const add = useCallback(async () => {
    const link = draft.trim()
    if (!link || !/^https?:\/\//i.test(link)) {
      setError('Paste the project’s link, starting with https://')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const token = countSourceTokenOf(link)
      if (token && sources.some((s) => s.token && s.token.toLowerCase() === token)) throw new Error('That project is already on the bid')
      const { error: err } = await supabase.from('bid_count_sources').insert({ bid_id: bidId, link, token, project_name: null, scope: 'unknown', imported_by: user?.id ?? null })
      if (err) throw err
      if (sources.length === 0) onFirstLinkChange?.(link)
      setDraft('')
      setAdding(false)
      setGen((n) => n + 1)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not add the link'))
    } finally {
      setBusy(false)
    }
  }, [draft, sources, bidId, user?.id, onFirstLinkChange])

  const remove = useCallback(
    async (src: BidCountSourceRow) => {
      setBusy(true)
      setError(null)
      try {
        // The rows stay; they just lose this project's share.
        for (const id of rowsCarryingKey(rows, src.id)) {
          const row = rows.find((r) => r.id === id)
          const { error: err } = await supabase.from('bids_count_rows').update({ source_shares: sharesWithoutKey(parseSourceShares(row?.source_shares), src.id) }).eq('id', id)
          if (err) throw err
        }
        const { error: err } = await supabase.from('bid_count_sources').delete().eq('id', src.id)
        if (err) throw err
        const rest = sources.filter((s) => s.id !== src.id)
        if (sources[0]?.id === src.id) onFirstLinkChange?.(rest[0]?.link ?? '')
        setPendingRemove(null)
        setGen((n) => n + 1)
      } catch (e) {
        setError(formatErrorMessage(e, 'Could not remove the project'))
      } finally {
        setBusy(false)
      }
    },
    [rows, sources, onFirstLinkChange],
  )

  const btn: React.CSSProperties = { font: 'inherit', fontSize: '0.78rem', padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }

  return (
    <div data-testid="bid-count-sources" style={{ marginTop: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500 }}>CountTooling projects</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>One per count that went into this bid. The first is the crosshair on the Bid Board; each keeps its own share of the rows.</span>
      </div>
      {!loaded ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>Loading…</div>
      ) : sources.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>No project recorded yet. The next copy from CountTooling records its project here.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0, display: 'grid', gap: '0.4rem' }}>
          {sources.map((src, i) => {
            const c = counts.get(src.id) ?? { own: 0, shared: 0 }
            const total = c.own + c.shared
            const who = src.imported_by ? names[src.imported_by] ?? null : null
            return (
              <li key={src.id} data-testid="bid-count-source" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{countSourceLabel(src, who)}</span>
                    {src.bid_version_id && versionChipWords(versionNames.get(src.bid_version_id)) ? (
                      <span data-testid="bid-count-source-version" style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', borderRadius: 999, background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }} title="This project came with the bid adopted as this version">
                        {versionChipWords(versionNames.get(src.bid_version_id))}
                      </span>
                    ) : null}
                    {i === 0 ? <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}>first</span> : null}
                    {c.shared > 0 ? <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', borderRadius: 999, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }}>combined</span> : null}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {who ? `imported by ${who}` : 'imported'} · {fmtDay(src.first_imported_at)}{src.last_imported_at !== src.first_imported_at ? ` · last ${fmtDay(src.last_imported_at)}` : ''} · {SCOPE_WORDS[src.scope] ?? src.scope} · {total} row{total === 1 ? '' : 's'}{total > 0 ? c.shared > 0 ? `, ${c.shared} shared` : `, all its own` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => openInExternalBrowser(src.link)} title={src.link} style={btn}>Open ↗</button>
                {pendingRemove === src.id ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => void remove(src)} style={{ ...btn, borderColor: 'var(--border-red)', color: 'var(--text-red-700)' }}>Remove</button>
                    <button type="button" disabled={busy} onClick={() => setPendingRemove(null)} style={btn}>Keep</button>
                  </>
                ) : (
                  <button type="button" aria-label={`Remove ${countSourceLabel(src, who)}`} title="Remove this project; its rows stay on the bid" disabled={busy} onClick={() => setPendingRemove(src.id)} style={{ ...btn, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {adding ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <input type="url" aria-label="CountTooling link to add" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://counttooling.com/app/?t=…" style={{ flex: 1, minWidth: 0, padding: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          <button type="button" disabled={busy} onClick={() => void add()} style={{ ...btn, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>Add</button>
          <button type="button" disabled={busy} onClick={() => { setAdding(false); setDraft(''); setError(null) }} style={btn}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ ...btn, marginTop: '0.5rem', border: '1px dashed var(--border-strong)', background: 'var(--bg-subtle)' }}>+ Add a CountTooling link</button>
      )}
      {loaded && sources.length > 0 ? <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Removing a link keeps its rows on the bid; they just lose their project.</div> : null}
      {error ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)', marginTop: '0.35rem' }}>{error}</div> : null}
    </div>
  )
}
