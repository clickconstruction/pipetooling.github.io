import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { formatErrorMessage } from '../../utils/errorHandling'
import { contactParts } from '../../../supabase/functions/_shared/permitLookup'
import { RESEARCH_CITIES, shortDay } from '../../lib/research/permitResearch'
import { builderName } from '../../lib/research/permitBuilders'
import { loadBuilders } from '../../lib/research/permitResearchIo'
import { permitsOnSite, readBidAddress } from '../../lib/research/bidSite'
import { numbersToAsk, type GcBid, type SitePermitRow } from '../../lib/research/bidSitePanel'
import { loadBidsOfCustomers, loadNameAnswers, loadPermitsByHouseNumber, loadPermitsOfName, recordNameAnswer, type NamePermit } from '../../lib/research/bidSiteIo'
import { foldNameAnswers, listedName } from '../../lib/research/nameAnswers'
import { compareRows, markName, searchNames, siteCountsByName, suggestNames, tiePressWords, type PermitName, type SitePermitHit } from '../../lib/research/nameLikeness'
import { ROBOT_BID_RE } from '../../lib/bids/bidPursuit'
import { PermitChip } from './PermitChip'
import { EmptyState } from '../EmptyState'
import { BidGcTiedNames } from './BidGcTiedNames'

/**
 * Find a customer's names on permits (punch list #307, PR 9). Our names for customers do not
 * match the names a city lists, so a person links them here. The sheet suggests names that may
 * be the customer, each with its reasons: a permit on an address we bid to them first, then how
 * alike the names are. Compare puts ours beside the city's. A search reaches every name. Two
 * presses on a name, and nothing is tied on a likeness alone.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const sub: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }
const primary: CSSProperties = { background: '#2563eb', color: '#fff', border: '1px solid #2563eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit' }
const ghost: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit' }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }

type Known = { names: PermitName[]; hits: Array<SitePermitHit & { id: string }>; bids: GcBid[]; settled: Set<string> }
type Loaded = { state: 'loading' } | { state: 'absent' } | { state: 'done'; known: Known } | { state: 'failed'; message: string }

/** A name as the screen draws it: the words it shares with ours marked. */
export function MarkedName({ name, marked }: { name: string; marked: readonly string[] }) {
  return (
    <span style={{ fontSize: '0.9375rem', color: 'var(--text-700)' }}>
      {markName(name, marked).map((part, i) =>
        part.hit ? (
          <mark key={i} style={{ background: 'var(--bg-amber-tint)', color: 'var(--text-strong)', borderRadius: 3, padding: '0 2px', fontWeight: 700 }}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}

function CompareBlock({ customerName, known, name }: { customerName: string; known: Known; name: PermitName }) {
  const [permits, setPermits] = useState<NamePermit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadPermitsOfName(name.key)
      .then((rows) => live && setPermits(rows))
      .catch((e) => live && setError(formatErrorMessage(e)))
    return () => {
      live = false
    }
  }, [name.key])
  if (error) return <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div>
  if (!permits) return <div style={muted}>Reading what the city has under this name…</div>
  const ours = known.bids.filter((b) => !ROBOT_BID_RE.test(b.project_name ?? ''))
  const siteStreets = ours.map((b) => readBidAddress(b.address, RESEARCH_CITIES)).flatMap((s) => (s.kind === 'site' ? [s.street] : []))
  const rows = compareRows({ customerName, bidAddresses: ours.map((b) => b.address), siteStreets, name: name.name, permits, onOurSites: known.hits.filter((h) => h.builderKey === name.key) })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: '0.8125rem' }} data-testid="name-compare">
      {rows.flatMap((r, i) =>
        [r.ours, r.theirs].map((cell, j) => (
          <div key={`${i}-${j}`} style={{ padding: '7px 10px', borderTop: i === 0 && j === 0 ? 0 : '1px solid var(--border)', background: r.hit ? 'var(--bg-green-tint)' : 'transparent', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cell.label}</span>
            {cell.value}
          </div>
        )),
      )}
    </div>
  )
}

export function FindNamesSheet({ customerIds, customerName, onClose }: { customerIds: readonly string[]; customerName: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [query, setQuery] = useState('')
  const [comparing, setComparing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idsKey = [...customerIds].sort().join(',')

  const load = useCallback(async () => {
    const ids = idsKey === '' ? [] : idsKey.split(',')
    const answers = await loadNameAnswers(ids)
    if (answers == null) return setLoaded({ state: 'absent' })
    const [perCity, bids] = await Promise.all([Promise.all(RESEARCH_CITIES.map((c) => loadBuilders(c))), loadBidsOfCustomers(ids)])
    const byKey = new Map<string, PermitName>()
    for (const rows of perCity) {
      for (const r of rows ?? []) {
        const held = byKey.get(r.key)
        if (held) {
          held.permits += r.permits
          if ((r.last_permit_on ?? '') > (held.lastOn ?? '')) held.lastOn = r.last_permit_on
        } else byKey.set(r.key, { key: r.key, name: builderName(r), permits: r.permits, lastOn: r.last_permit_on, kind: r.kind })
      }
    }
    // The permits on the addresses we bid to them, each once, with the name the city lists.
    const hits = new Map<string, SitePermitHit & { id: string }>()
    for (const [city, numbers] of numbersToAsk(bids, RESEARCH_CITIES)) {
      const rows: SitePermitRow[] = (await loadPermitsByHouseNumber(city, numbers)) ?? []
      for (const bid of bids) {
        if (ROBOT_BID_RE.test(bid.project_name ?? '')) continue
        const site = readBidAddress(bid.address, RESEARCH_CITIES)
        if (site.kind !== 'site' || site.city !== city) continue
        for (const p of permitsOnSite(site, rows)) {
          hits.set(p.id, { id: p.id, builderKey: p.builder_key, address: p.address, day: p.issued_on ?? p.submitted_on, stage: p.stage })
          // A name the builders list does not carry (a person, a plumbing permit) is still a name.
          const shown = listedName(p.contact)
          if (p.builder_key && shown && !byKey.has(p.builder_key)) byKey.set(p.builder_key, { key: p.builder_key, name: shown, permits: 0, lastOn: p.issued_on ?? p.submitted_on, kind: null })
        }
      }
    }
    const states = foldNameAnswers(answers.rows, ids)
    const settled = new Set([...states.values()].filter((s) => s.all || s.someoneElse).map((s) => s.key))
    setLoaded({ state: 'done', known: { names: [...byKey.values()], hits: [...hits.values()], bids, settled } })
  }, [idsKey])

  useEffect(() => {
    let live = true
    load().catch((e) => {
      if (live) setLoaded({ state: 'failed', message: formatErrorMessage(e) })
    })
    return () => {
      live = false
    }
  }, [load])

  const known = loaded.state === 'done' ? loaded.known : null
  const suggestions = useMemo(() => (known ? suggestNames(customerName, known.names, siteCountsByName(known.hits), known.settled) : []), [known, customerName])
  const found = useMemo(() => {
    if (!known) return []
    const offered = new Set(suggestions.map((s) => s.key))
    return searchNames(query, known.names.filter((n) => !known.settled.has(n.key) && !offered.has(n.key)))
  }, [known, query, suggestions])

  const answer = async (name: PermitName, tie: boolean) => {
    const customerId = customerIds[0]
    if (!customerId || busy) return
    setBusy(true)
    setError(null)
    try {
      await recordNameAnswer({ builderKey: name.key, customerId, answer: tie ? 'works_for' : 'someone_else', scope: tie ? 'all' : null, permitId: null, name: name.name })
      setComparing(null)
      await load()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const row = (n: PermitName, extra: { reasons?: Array<{ words: string; tone: 'green' | 'amber' | 'grey' }>; marked?: string[]; top?: boolean }) => {
    const isCompany = contactParts(n.name).company != null
    const open = comparing === n.key
    return (
      <div key={n.key} style={{ border: `1px solid ${extra.top ? 'var(--text-green-700)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6, minWidth: 0 }}>
        <MarkedName name={n.name} marked={extra.marked ?? []} />
        {extra.reasons && extra.reasons.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {extra.reasons.map((r) => (
              <PermitChip key={r.words} chip={r} />
            ))}
          </div>
        )}
        <div style={muted}>{n.permits > 0 ? `Listed on ${n.permits} commercial permit${n.permits === 1 ? '' : 's'} in the last year${n.lastOn ? ` · last ${shortDay(n.lastOn)}` : ''}` : 'Listed on a permit on an address you bid to them'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" disabled={busy} onClick={() => void answer(n, true)} style={primary}>
            {tiePressWords(isCompany)}
          </button>
          <button type="button" disabled={busy} onClick={() => void answer(n, false)} style={ghost}>
            Not them
          </button>
          <button type="button" aria-expanded={open} onClick={() => setComparing(open ? null : n.key)} style={linkPress}>
            {open ? 'Hide the comparison' : 'Compare ›'}
          </button>
        </div>
        {open && known && <CompareBlock customerName={customerName} known={known} name={n} />}
      </div>
    )
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 0.75rem calc(1rem + env(safe-area-inset-bottom, 0px))' }} onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="find-names-title" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, padding: '1.1rem 1.25rem', maxWidth: 680, width: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'grid', gap: 10, fontWeight: 400 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="find-names-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, flex: '1 1 auto' }}>
            Find {customerName} on permits
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', width: 36, height: 36, borderRadius: 8, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        {loaded.state === 'loading' && <div style={muted}>Reading the names on permits…</div>}
        {loaded.state === 'absent' && <div style={muted}>Names can be tied here once the database change is in.</div>}
        {loaded.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{loaded.message}</div>}
        {known && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <PermitChip chip={{ words: `${known.names.length.toLocaleString('en-US')} names on permits`, tone: 'grey' }} />
              <PermitChip chip={{ words: RESEARCH_CITIES.join(' · '), tone: 'blue' }} />
            </div>
            <div style={sub}>Names that may be them</div>
            {suggestions.length === 0 ? <EmptyState main={`Nothing on permits resembles ${customerName}, and no permit sits on an address you bid to them. Search below.`} compact /> : suggestions.slice(0, 8).map((s, i) => row(s, { reasons: s.reasons, marked: s.marked, top: i === 0 && s.onOurSites > 0 }))}
            <div style={sub}>Or search every name on permits</div>
            <input type="search" aria-label="Search every name on permits" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a company or a person" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 11px', font: 'inherit', fontSize: '0.875rem', minHeight: 38, background: 'var(--surface)', color: 'var(--text-strong)' }} />
            {query.trim() !== '' && (found.length === 0 ? <EmptyState main="No name on permits begins with those words." compact /> : found.map((n) => row(n, {})))}
            {error && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div>}
            <BidGcTiedNames customerIds={customerIds} customerName={customerName} findPress={false} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
