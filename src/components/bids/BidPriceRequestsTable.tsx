import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { fetchUserDisplayNames, userDisplayLabel } from '../../lib/userDisplayNames'
import { fetchSupplyHousePickerRows, type SupplyHousePickerRow } from '../../lib/supplyHousePickerRows'
import { housesForBidTrade, tradesByHouse, type HouseTradeLink } from '../../lib/materials/supplyHouseTrades'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import {
  groupPriceRequests,
  linkHostLabel,
  priceRequestSummaryLine,
  validateOutsideRequest,
  type OutsideRequestDraft,
  type PriceRequestGroup,
  type PriceRequestQuote,
  type PriceRequestRow,
  type PriceRequestShaped,
} from '../../lib/bids/bidPriceRequests'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'

type Props = {
  bidId: string
  /** The bid's trade — houses that serve it (or are untagged) list first in the picker. */
  serviceTypeId: string | null
  /** Where the desk lives; the header link opens Pricing for this bid. */
  pricingHref: string
}

type RepRow = { supply_house_id: string | null; label: string | null; name: string | null; email: string; is_default: boolean }

const th: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }
const td: CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.875rem' }
const meta: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }
const link: CSSProperties = { color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: 2, whiteSpace: 'nowrap' }
const tag: CSSProperties = { display: 'inline-block', fontSize: '0.66rem', padding: '0.05rem 0.45rem', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-700)', marginLeft: '0.4rem', verticalAlign: 'middle' }
const tagApp: CSSProperties = { ...tag, background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-800)' }
const tagOut: CSSProperties = { ...tag, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }
const mini: CSSProperties = { height: 30, border: '1px solid var(--border-strong)', borderRadius: 5, padding: '0 0.5rem', font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-base)', width: '100%' }
const ghost: CSSProperties = { padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }
const blue: CSSProperties = { padding: '0.3rem 0.8rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: 'white', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }
const textBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer' }

function neededByLine(r: PriceRequestShaped): { text: string; color: string } | null {
  const n = r.neededBy
  if (n.kind === 'none') return null
  const ymd = formatWorkDateYmdMonthDayShort(n.ymd)
  if (n.kind === 'met') return { text: `needed by ${ymd} ✓`, color: 'var(--text-green-700)' }
  if (n.kind === 'late') return { text: `needed by ${ymd} · late`, color: 'var(--text-amber-700)' }
  return { text: `needed by ${ymd}`, color: 'var(--text-amber-700)' }
}

/**
 * Price requests on a bid (v2.3175) — Edit Bid → Files & Links, under Plans.
 * One row per request, grouped by supply house: the day it was requested, the
 * request as sent (the vendor's quote page for app-sent rows, a pasted link for
 * outside ones), and the quote that came back (plugged in on Pricing, or a
 * pasted link). "Add a request" records a request sent by email or phone; it
 * never sends — that stays with Send price requests on Pricing.
 */
export function BidPriceRequestsTable({ bidId, serviceTypeId, pricingHref }: Props) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const narrow = useNarrowViewport640()

  const [rows, setRows] = useState<PriceRequestRow[]>([])
  const [quotes, setQuotes] = useState<PriceRequestQuote[]>([])
  const [houses, setHouses] = useState<SupplyHousePickerRow[]>([])
  const [reps, setReps] = useState<RepRow[]>([])
  const [tradeLinks, setTradeLinks] = useState<HouseTradeLink[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  /** Null until the migration is pushed and the columns exist; false = legacy shape only. */
  const [outsideSupported, setOutsideSupported] = useState<boolean | null>(null)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<OutsideRequestDraft>({ supplyHouseId: null, requestedOn: todayYmdInAppTz(), requestUrl: '', quoteUrl: '' })
  const [houseQuery, setHouseQuery] = useState('')
  const [showAllHouses, setShowAllHouses] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const BASE = 'id, supply_house_id, sent_to, sent_email, status, token, created_at, created_by, viewed_at, needed_by'
    const wide = await supabase
      .from('bid_rfqs')
      .select(`${BASE}, sent_via, requested_on, request_url, quote_url`)
      .eq('bid_id', bidId)
      .order('created_at', { ascending: false })
    let rfqRows: PriceRequestRow[]
    if (!wide.error) {
      setOutsideSupported(true)
      rfqRows = ((wide.data ?? []) as unknown as Array<Partial<PriceRequestRow> & { id: string; created_at: string; status: string }>).map((r) => ({
        id: r.id,
        sent_via: r.sent_via === 'outside' ? 'outside' : 'app',
        supply_house_id: r.supply_house_id ?? null,
        sent_to: r.sent_to ?? null,
        sent_email: r.sent_email ?? null,
        status: r.status,
        token: r.token ?? null,
        created_at: r.created_at,
        created_by: r.created_by ?? null,
        viewed_at: r.viewed_at ?? null,
        needed_by: r.needed_by ?? null,
        requested_on: r.requested_on ?? null,
        request_url: r.request_url ?? null,
        quote_url: r.quote_url ?? null,
      }))
    } else {
      // Pre-push: the four v2.3175 columns are unknown to PostgREST. Read the legacy shape.
      setOutsideSupported(false)
      const legacy = await supabase.from('bid_rfqs').select(BASE).eq('bid_id', bidId).order('created_at', { ascending: false })
      rfqRows = ((legacy.data ?? []) as unknown as Array<Partial<PriceRequestRow> & { id: string; created_at: string; status: string }>).map((r) => ({
        id: r.id,
        sent_via: 'app',
        supply_house_id: r.supply_house_id ?? null,
        sent_to: r.sent_to ?? null,
        sent_email: r.sent_email ?? null,
        status: r.status,
        token: r.token ?? null,
        created_at: r.created_at,
        created_by: r.created_by ?? null,
        viewed_at: r.viewed_at ?? null,
        needed_by: r.needed_by ?? null,
        requested_on: null,
        request_url: null,
        quote_url: null,
      }))
    }
    setRows(rfqRows)

    const [quoteRes, houseRows, repRes, tradeRes] = await Promise.all([
      supabase.from('bid_quotes').select('id, rfq_id, supply_house_id, received_at, valid_until, bid_quote_lines(id)').eq('bid_id', bidId),
      fetchSupplyHousePickerRows().catch(() => [] as SupplyHousePickerRow[]),
      supabase.from('supply_house_contacts').select('supply_house_id, label, name, email, is_default').not('supply_house_id', 'is', null).is('archived_at', null),
      supabase.from('supply_house_service_types' as never).select('supply_house_id, service_type_id'),
    ])
    setQuotes(
      ((quoteRes.data ?? []) as unknown as Array<{ id: string; rfq_id: string | null; supply_house_id: string | null; received_at: string; valid_until: string | null; bid_quote_lines: Array<{ id: string }> | null }>).map((q) => ({
        id: q.id,
        rfq_id: q.rfq_id,
        supply_house_id: q.supply_house_id,
        received_at: q.received_at,
        valid_until: q.valid_until,
        line_count: q.bid_quote_lines?.length ?? 0,
      })),
    )
    setHouses(houseRows)
    setReps(((repRes.data ?? []) as RepRow[]))
    setTradeLinks(tradeRes.error ? [] : ((tradeRes.data ?? []) as unknown as HouseTradeLink[]))
    setLoaded(true)
  }, [bidId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ids = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id && !(id in names)))]
    if (ids.length === 0) return
    let cancelled = false
    fetchUserDisplayNames(ids).then((found) => {
      if (cancelled) return
      setNames((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = ''
        for (const n of found) next[n.id] = userDisplayLabel(n)
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [rows, names])

  const todayYmd = todayYmdInAppTz()
  const defaultRepByHouse = useMemo(() => {
    const m = new Map<string, RepRow>()
    for (const r of reps) {
      if (!r.supply_house_id) continue
      const cur = m.get(r.supply_house_id)
      if (!cur || (r.is_default && !cur.is_default)) m.set(r.supply_house_id, r)
    }
    return m
  }, [reps])
  const houseRows = useMemo(
    () => houses.map((h) => ({ id: h.id, name: h.name, defaultRep: defaultRepByHouse.get(h.id) ?? null })),
    [houses, defaultRepByHouse],
  )
  const { groups, summary } = useMemo(
    () => groupPriceRequests(rows, quotes, houseRows, todayYmd, calendarYmdInAppTzFromIso),
    [rows, quotes, houseRows, todayYmd],
  )

  // Picker: the bid's trade first (untagged houses always pass), the rest behind "show all".
  const byHouse = useMemo(() => tradesByHouse(tradeLinks), [tradeLinks])
  const pickerHouses = useMemo(() => {
    const { shown, hidden } = housesForBidTrade(houses, serviceTypeId, byHouse)
    const pool = showAllHouses ? houses : shown
    const q = houseQuery.trim().toLowerCase()
    return { list: q ? pool.filter((h) => h.name.toLowerCase().includes(q)) : pool, hidden }
  }, [houses, serviceTypeId, byHouse, showAllHouses, houseQuery])

  function startAdd() {
    setEditingId(null)
    setDraft({ supplyHouseId: null, requestedOn: todayYmdInAppTz(), requestUrl: '', quoteUrl: '' })
    setHouseQuery('')
    setError(null)
    setAdding(true)
  }

  function startEdit(r: PriceRequestShaped) {
    setAdding(false)
    setEditingId(r.row.id)
    setDraft({ supplyHouseId: r.row.supply_house_id, requestedOn: r.requestedYmd, requestUrl: r.row.request_url ?? '', quoteUrl: r.row.quote_url ?? '' })
    setHouseQuery('')
    setError(null)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
    setError(null)
  }

  async function addNewHouse(name: string): Promise<string | null> {
    const trimmed = name.trim()
    if (!trimmed) return null
    const { data, error: e } = await supabase.from('supply_houses').insert({ name: trimmed } as never).select('id').single()
    if (e) {
      showToast(`Could not add the house: ${e.message}`, 'error')
      return null
    }
    const id = (data as { id: string } | null)?.id ?? null
    if (id) setHouses((prev) => [...prev, { id, name: trimmed }].sort((a, b) => a.name.localeCompare(b.name)))
    return id
  }

  async function save() {
    const v = validateOutsideRequest(draft)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editingId) {
        const { error: e } = await supabase
          .from('bid_rfqs')
          .update({ supply_house_id: draft.supplyHouseId, requested_on: draft.requestedOn, request_url: v.requestUrl, quote_url: v.quoteUrl } as never)
          .eq('id', editingId)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('bid_rfqs').insert({
          bid_id: bidId,
          supply_house_id: draft.supplyHouseId,
          sent_via: 'outside',
          status: v.quoteUrl ? 'quoted' : 'sent',
          scope: {},
          requested_on: draft.requestedOn,
          request_url: v.requestUrl,
          quote_url: v.quoteUrl,
          created_by: user?.id ?? null,
        } as never)
        if (e) throw e
      }
      cancel()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the request.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(r: PriceRequestShaped) {
    if (!(await confirmDialog({ message: 'Remove this request from the bid? Only the row goes; nothing is sent to the vendor.', confirmLabel: 'Remove', danger: true }))) return
    const { error: e } = await supabase.from('bid_rfqs').delete().eq('id', r.row.id)
    if (e) showToast(e.message, 'error')
    else await load()
  }

  const nameOf = (id: string | null) => (id ? names[id] || null : null)

  function requestedCell(r: PriceRequestShaped) {
    const who = nameOf(r.row.created_by)
    const nb = neededByLine(r)
    return (
      <>
        <div style={{ whiteSpace: 'nowrap' }}>{formatWorkDateYmdMonthDayShort(r.requestedYmd)}</div>
        <div style={meta}>
          {who ? who : null}
          {who && nb ? ' · ' : null}
          {nb ? <span style={{ color: nb.color }}>{nb.text}</span> : null}
        </div>
      </>
    )
  }

  function requestCell(r: PriceRequestShaped) {
    if (r.row.sent_via === 'app') {
      return (
        <>
          {r.vendorPageUrl ? <a href={r.vendorPageUrl} target="_blank" rel="noreferrer" style={link}>Vendor page</a> : <span style={{ color: 'var(--text-muted)' }}>Request</span>}
          <span style={tagApp}>sent by app</span>
          <div style={meta}>{r.row.viewed_at ? `viewed ${formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(r.row.viewed_at))}` : r.row.status === 'closed' ? 'closed' : 'not viewed yet'}</div>
        </>
      )
    }
    const url = r.row.request_url
    return (
      <>
        {url ? <a href={url} target="_blank" rel="noreferrer" style={link}>Request ({linkHostLabel(url)})</a> : <span style={{ color: 'var(--text-muted)' }}>no request link</span>}
        <span style={tagOut}>sent outside</span>
      </>
    )
  }

  function quoteCell(r: PriceRequestShaped) {
    const q = r.quote
    if (q.kind === 'plugged') {
      return (
        <>
          <a href={pricingHref} target="_blank" rel="noreferrer" style={link}>Quote · {q.lineCount} {q.lineCount === 1 ? 'line' : 'lines'}</a>
          <div style={meta}>
            plugged in {formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(q.receivedAt))}
            {q.validUntil ? ` · valid to ${formatWorkDateYmdMonthDayShort(q.validUntil.slice(0, 10))}` : ''}
          </div>
        </>
      )
    }
    if (q.kind === 'link') {
      return <a href={q.url} target="_blank" rel="noreferrer" style={link}>Quote ({linkHostLabel(q.url)})</a>
    }
    if (r.editable) {
      return (
        <button type="button" style={textBtn} onClick={() => startEdit(r)}>
          paste a quote link…
        </button>
      )
    }
    return (
      <>
        <span style={{ color: 'var(--text-faint)' }}>—</span>
        <div style={meta}>plug it in on Pricing when it lands</div>
      </>
    )
  }

  function actionsCell(r: PriceRequestShaped) {
    if (r.editable) {
      return (
        <span style={{ display: 'inline-flex', gap: '0.6rem' }}>
          <button type="button" style={textBtn} onClick={() => startEdit(r)}>Edit</button>
          <button type="button" style={{ ...textBtn, color: 'var(--text-muted)' }} onClick={() => void remove(r)}>Remove</button>
        </span>
      )
    }
    return (
      <span style={{ display: 'inline-flex', gap: '0.6rem' }}>
        {r.vendorPageUrl ? (
          <button
            type="button"
            style={textBtn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(r.vendorPageUrl!)
                showToast('Link copied.', 'success')
              } catch {
                showToast('Could not copy the link.', 'error')
              }
            }}
          >
            Copy link
          </button>
        ) : null}
        <a href={pricingHref} target="_blank" rel="noreferrer" style={{ ...textBtn, textDecoration: 'none' }}>
          {r.quote.kind === 'plugged' ? 'Compare' : 'Desk'}
        </a>
      </span>
    )
  }

  const editorRow = (
    <tr>
      <td style={{ ...td, position: 'relative' }}>
        {draft.supplyHouseId ? (
          <div>
            <div style={{ fontWeight: 600 }}>{houses.find((h) => h.id === draft.supplyHouseId)?.name ?? 'House'}</div>
            <button type="button" style={textBtn} onClick={() => setDraft((d) => ({ ...d, supplyHouseId: null }))}>change</button>
          </div>
        ) : (
          <div>
            <input
              value={houseQuery}
              onChange={(e) => setHouseQuery(e.target.value)}
              placeholder="find a supply house…"
              aria-label="Supply house"
              style={mini}
              autoFocus
            />
            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', marginTop: 4, maxHeight: 180, overflowY: 'auto', fontSize: '0.8125rem' }}>
              {pickerHouses.list.slice(0, 12).map((h) => (
                <button key={h.id} type="button" onClick={() => setDraft((d) => ({ ...d, supplyHouseId: h.id }))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.35rem 0.6rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', font: 'inherit', color: 'var(--text-base)', cursor: 'pointer' }}>
                  {h.name}
                  {defaultRepByHouse.get(h.id) ? <span style={{ ...meta, marginLeft: '0.4rem', display: 'inline' }}>{defaultRepByHouse.get(h.id)!.label || defaultRepByHouse.get(h.id)!.name || defaultRepByHouse.get(h.id)!.email}</span> : <span style={{ ...meta, marginLeft: '0.4rem', display: 'inline', color: 'var(--text-amber-700)' }}>no rep on file</span>}
                </button>
              ))}
              {pickerHouses.list.length === 0 ? <div style={{ ...meta, padding: '0.35rem 0.6rem' }}>No house matches.</div> : null}
              {!showAllHouses && pickerHouses.hidden > 0 ? (
                <button type="button" style={{ ...textBtn, padding: '0.35rem 0.6rem' }} onClick={() => setShowAllHouses(true)}>
                  show all · {pickerHouses.hidden} other-trade {pickerHouses.hidden === 1 ? 'house' : 'houses'} hidden
                </button>
              ) : null}
              {houseQuery.trim() ? (
                <button
                  type="button"
                  style={{ ...textBtn, padding: '0.35rem 0.6rem', fontWeight: 600, borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left' }}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const id = await addNewHouse(houseQuery)
                    setBusy(false)
                    if (id) setDraft((d) => ({ ...d, supplyHouseId: id }))
                  }}
                >
                  + Add "{houseQuery.trim()}" as a new supply house
                </button>
              ) : null}
            </div>
          </div>
        )}
      </td>
      <td style={td}>
        <input type="date" value={draft.requestedOn} onChange={(e) => setDraft((d) => ({ ...d, requestedOn: e.target.value }))} aria-label="Requested on" style={{ ...mini, width: 'auto' }} />
        <div style={meta}>when it went out</div>
      </td>
      <td style={td}>
        <input value={draft.requestUrl} onChange={(e) => setDraft((d) => ({ ...d, requestUrl: e.target.value }))} placeholder="paste the request link…" aria-label="Request link" style={mini} />
        <div style={meta}>the RFQ you emailed — a Drive copy, a PDF</div>
      </td>
      <td style={td}>
        <input value={draft.quoteUrl} onChange={(e) => setDraft((d) => ({ ...d, quoteUrl: e.target.value }))} placeholder="paste the quote link…" aria-label="Quote link" style={mini} />
        <div style={meta}>optional until it arrives</div>
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
        <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
          <button type="button" style={ghost} onClick={cancel} disabled={busy}>Cancel</button>
          <button type="button" style={blue} onClick={() => void save()} disabled={busy}>Save</button>
        </span>
        {error ? <div style={{ ...meta, color: 'var(--text-red-700)', whiteSpace: 'normal', maxWidth: 160 }}>{error}</div> : null}
      </td>
    </tr>
  )

  function groupRows(g: PriceRequestGroup) {
    return g.requests.map((r, i) => {
      if (editingId === r.row.id) return <Fragment key={r.row.id}>{editorRow}</Fragment>
      const first = i === 0
      return (
        <tr key={r.row.id} style={first ? { borderTop: '1px solid var(--border-strong)' } : undefined}>
          <td style={td}>
            {first ? (
              <>
                <div style={{ fontWeight: 600 }}>{g.houseName}</div>
                {g.house?.defaultRep ? <div style={meta}>{[g.house.defaultRep.label || g.house.defaultRep.name, g.house.defaultRep.email].filter(Boolean).join(' · ')}</div> : r.row.sent_email ? <div style={meta}>{r.row.sent_email}</div> : null}
              </>
            ) : (
              <div style={{ ...meta, marginTop: 0 }}>↳ another request</div>
            )}
          </td>
          <td style={td}>{requestedCell(r)}</td>
          <td style={td}>{requestCell(r)}</td>
          <td style={td}>{quoteCell(r)}</td>
          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{actionsCell(r)}</td>
        </tr>
      )
    })
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }} data-testid="bid-price-requests">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Price requests</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{loaded ? priceRequestSummaryLine(summary) : 'loading…'}</span>
        <a href={pricingHref} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', ...textBtn, fontSize: '0.8rem', textDecoration: 'none' }}>
          Open the desk on Pricing ↗
        </a>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: narrow ? 640 : undefined }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '24%' }}>Supply house</th>
              <th style={{ ...th, width: '15%' }}>Requested</th>
              <th style={{ ...th, width: '24%' }}>Request</th>
              <th style={{ ...th, width: '24%' }}>Quote</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.houseId ?? g.houseName}>{groupRows(g)}</Fragment>
            ))}
            {adding ? editorRow : null}
            {loaded && groups.length === 0 && !adding ? (
              <tr><td colSpan={5} style={{ ...td, color: 'var(--text-muted)' }}>No price requests on this bid yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!adding && !editingId ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {outsideSupported === false ? (
            <span style={{ ...meta, marginTop: 0 }}>Recording requests sent by hand arrives with the next database update.</span>
          ) : (
            <>
              <button type="button" style={blue} onClick={startAdd}>+ Add a request</button>
              <span style={{ ...meta, marginTop: 0 }}>
                for a request you sent by email or phone — the app's own go through <a href={pricingHref} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>Send price requests</a> on Pricing
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
