import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchUserDisplayNames, userDisplayLabel } from '../../lib/userDisplayNames'
import type { SupplyHouseStatsRow } from '../../lib/materials/supplyHouseStats'
import {
  buildDirectoryRows,
  directoryAgoPhrase,
  directoryKindLabel,
  priceCountsByHouse,
  requestOutcomeLabel,
  type DirectoryRep,
  type DirectoryRequest,
  type DirectoryRow,
} from '../../lib/materials/supplyHouseDirectory'
import { SupplyHouseContactsSection } from '../SupplyHouseContactsSection'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import type { Database } from '../../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type SupplyHouseDirectoryAudience = 'office' | 'estimator'

type Props = {
  supplyHouses: SupplyHouse[]
  /** The office sees every vendor with its kind; the estimator door lists supply houses only. */
  audience: SupplyHouseDirectoryAudience
  onAddHouse: () => void
  onEditHouse: (house: SupplyHouse) => void
  /** Bump after a house is saved elsewhere so reps and request history refetch. */
  reloadKey?: number
  /** When set, "Prices on file" counts that service type only. */
  selectedServiceTypeId?: string | null
}

type RequestRow = {
  supply_house_id: string | null
  created_at: string
  created_by: string | null
  status: string
  bid_id: string | null
  bid: { bid_number: string | null; project_name: string | null } | null
}

function bidRefLabel(bid: RequestRow['bid']): string | null {
  if (!bid) return null
  const n = (bid.bid_number ?? '').trim()
  if (n) return `b${n}`
  const p = (bid.project_name ?? '').trim()
  return p || null
}

const th: CSSProperties = { padding: '0.7rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.875rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }
const td: CSSProperties = { padding: '0.7rem 0.75rem', verticalAlign: 'top', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const editBtn: CSSProperties = { padding: '0.25rem 0.6rem', fontSize: '0.8125rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-base)', font: 'inherit' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const panelTitle: CSSProperties = { margin: 0, fontSize: '0.875rem', fontWeight: 600 }

/**
 * The Supply house Directory pane (to-dos/supply-house-directory, PR 1): who
 * the houses are, who to talk to there, and what the company already knows
 * about each — reps with who added them, the last price request and whether
 * it was answered, priced parts on file. One component, rendered by the office
 * above its accounts-payable pane and (PR 2) by the estimator's tab alone.
 * No invoice, aging or balance ever renders here.
 */
export function SupplyHouseDirectory({ supplyHouses, audience, onAddHouse, onEditHouse, reloadKey = 0, selectedServiceTypeId = null }: Props) {
  const narrow = useNarrowViewport640()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reps, setReps] = useState<DirectoryRep[]>([])
  const [requests, setRequests] = useState<DirectoryRequest[]>([])
  const [statsRows, setStatsRows] = useState<SupplyHouseStatsRow[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  const loadReps = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase
            .from('supply_house_contacts')
            .select('id, supply_house_id, label, name, email, is_default, created_by, created_at')
            .not('supply_house_id', 'is', null)
            .is('archived_at', null),
        'load supply house reps',
      )
      setReps((data ?? []) as DirectoryRep[])
    } catch {
      setReps([])
    }
  }, [])

  const loadRequests = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase
            .from('bid_rfqs')
            .select('supply_house_id, created_at, created_by, status, bid_id, bid:bids(bid_number, project_name)')
            .not('supply_house_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1000),
        'load price request history',
      )
      const rows = ((data ?? []) as unknown as RequestRow[]).map<DirectoryRequest>((r) => ({
        supply_house_id: r.supply_house_id,
        created_at: r.created_at,
        created_by: r.created_by,
        status: r.status,
        bid_id: r.bid_id,
        bid_label: bidRefLabel(r.bid),
      }))
      setRequests(rows)
    } catch {
      setRequests([])
    }
  }, [])

  const loadStats = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_supply_house_stats_by_service_type' as never)
    if (error) return
    setStatsRows(((data as unknown) as SupplyHouseStatsRow[] | null) ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([loadReps(), loadRequests(), loadStats()])
      if (!cancelled) setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [loadReps, loadRequests, loadStats, reloadKey])

  // Resolve who-added / who-asked through the archived-safe RPC (users SELECT hides archived rows).
  useEffect(() => {
    const ids = new Set<string>()
    for (const r of reps) if (r.created_by) ids.add(r.created_by)
    for (const q of requests) if (q.created_by) ids.add(q.created_by)
    const missing = [...ids].filter((id) => !(id in names))
    if (missing.length === 0) return
    let cancelled = false
    fetchUserDisplayNames(missing).then((rows) => {
      if (cancelled) return
      setNames((prev) => {
        const next = { ...prev }
        for (const id of missing) next[id] = ''
        for (const n of rows) next[n.id] = userDisplayLabel(n)
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [reps, requests, names])

  const priceCountByHouse = useMemo(() => {
    if (!statsRows) return null
    return priceCountsByHouse(statsRows, selectedServiceTypeId)
  }, [statsRows, selectedServiceTypeId])

  const { rows, coverage } = useMemo(
    () =>
      buildDirectoryRows({
        houses: supplyHouses,
        reps,
        requests,
        priceCountByHouse,
        search,
        kinds: audience === 'estimator' ? 'supply_house' : 'all',
      }),
    [supplyHouses, reps, requests, priceCountByHouse, search, audience],
  )

  const nowMs = Date.now()
  const nameOf = (id: string | null) => (id ? names[id] || null : null)

  type Row = DirectoryRow<SupplyHouse>

  function firstNeedsRepIndex(): number {
    return rows.findIndex((r) => r.needsRep)
  }

  const needsRepBand = (
    <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', borderBottom: '1px solid var(--border-amber-200)' }}>
      Needs a rep · {coverage.needRep} {coverage.needRep === 1 ? 'house' : 'houses'} — a price request to one of these has to be addressed by hand until someone adds a rep
    </div>
  )

  function requestLine(row: Row): string {
    if (!row.lastRequest) return 'no price requests yet'
    const ago = directoryAgoPhrase(row.lastRequest.created_at, nowMs) ?? ''
    const who = nameOf(row.lastRequest.created_by)
    return ['last request', ago, who ? `· ${who}` : null, `· ${requestOutcomeLabel(row.lastRequest.status)}`].filter(Boolean).join(' ')
  }

  function priceLine(row: Row): string {
    if (row.priceCount == null) return '…'
    if (row.priceCount === 0) return 'no prices yet'
    return `${row.priceCount.toLocaleString()} ${row.priceCount === 1 ? 'part' : 'parts'} priced`
  }

  function repsCell(row: Row, compact: boolean) {
    if (row.reps.length === 0) {
      if (row.kind !== 'supply_house') return <span style={muted}>—</span>
      return (
        <span style={{ color: 'var(--text-amber-700)', fontWeight: 500 }}>
          No rep on file
          <button type="button" onClick={() => setExpandedId(row.house.id)} style={{ marginLeft: '0.4rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', padding: 0 }}>
            add one
          </button>
        </span>
      )
    }
    const shown = compact ? row.reps.slice(0, 1) : row.reps.slice(0, 3)
    const more = row.reps.length - shown.length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {shown.map((r) => {
          const who = nameOf(r.created_by)
          const added = directoryAgoPhrase(r.created_at, nowMs)
          return (
            <div key={r.id} title={who ? `added by ${who}${added ? ` · ${added}` : ''}` : undefined} style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span aria-hidden="true" style={{ color: r.is_default ? '#f59e0b' : 'transparent', fontSize: '0.75rem', width: '0.75rem' }}>★</span>
              <span>{(r.label ?? '').trim() || (r.name ?? '').trim() || r.email}</span>
              {(r.label ?? '').trim() && (r.name ?? '').trim() ? <span style={muted}>{r.name}</span> : null}
              <a href={`mailto:${r.email}`} style={{ ...muted, color: 'var(--text-muted)' }}>
                · {r.email}
              </a>
            </div>
          )
        })}
        {more > 0 ? <span style={muted}>+ {more} more</span> : null}
      </div>
    )
  }

  function expandedPanel(row: Row) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '1rem', padding: narrow ? '0.75rem' : '0.25rem 0.75rem 1rem 2.6rem', background: 'var(--bg-subtle)' }}>
        <div style={panel}>
          <SupplyHouseContactsSection supplyHouseId={row.house.id} showAddedBy onChanged={() => void loadReps()} />
          <span style={{ ...muted, fontSize: '0.75rem' }}>The starred rep is who a price request goes to unless you pick someone else. Everyone estimating sees this same list.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={panel}>
            <h4 style={panelTitle}>Notes</h4>
            <div style={{ fontSize: '0.875rem', color: row.house.notes ? 'var(--text-700)' : 'var(--text-faint)', whiteSpace: 'pre-wrap' }}>
              {row.house.notes?.trim() || 'No notes — hours, will-call cutoff, who to call for stock checks.'}
            </div>
          </div>
          <div style={panel}>
            <h4 style={panelTitle}>Recent price requests</h4>
            {row.recentRequests.length === 0 ? (
              <span style={muted}>None yet — the first request from Bids → Pricing lands here.</span>
            ) : (
              row.recentRequests.map((q, i) => {
                const who = nameOf(q.created_by)
                return (
                  <div key={`${q.created_at}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span>{q.bid_label ?? 'a bid'}</span>
                    <span style={muted}>
                      {[directoryAgoPhrase(q.created_at, nowMs), who, requestOutcomeLabel(q.status)].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  const toolbar = (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" onClick={onAddHouse} style={{ padding: '0.5rem 0.9rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
        {audience === 'office' ? 'Add vendor' : 'Add supply house'}
      </button>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search houses, reps or emails…"
        aria-label="Search supply houses"
        style={{ flex: 1, minWidth: '12rem', padding: '0.55rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }}
      />
    </div>
  )

  const coverageLine = (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-600)' }}>
      <span>
        <strong style={{ color: 'var(--text-strong)' }}>{coverage.total}</strong> supply {coverage.total === 1 ? 'house' : 'houses'}
      </span>
      <span>
        <strong style={{ color: 'var(--text-strong)' }}>{coverage.withRep}</strong> with a rep
      </span>
      {coverage.needRep > 0 ? (
        <span style={{ color: 'var(--text-amber-700)' }}>
          <strong>{coverage.needRep}</strong> {coverage.needRep === 1 ? 'needs' : 'need'} a rep — add one when you next call
        </span>
      ) : (
        <span style={{ color: 'var(--text-green-700)' }}>every house has a rep</span>
      )}
      {audience === 'estimator' ? <span style={{ marginLeft: 'auto', ...muted }}>Insurers, rental yards and the office's ledger buckets are not listed here.</span> : null}
    </div>
  )

  if (narrow) {
    const bandAt = firstNeedsRepIndex()
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {toolbar}
        {coverageLine}
        {!loaded && rows.length === 0 ? <p style={muted}>Loading…</p> : null}
        {rows.map((row, i) => {
          const open = expandedId === row.house.id
          return (
            <Fragment key={row.house.id}>
              {i === bandAt ? <div style={{ borderRadius: 6, overflow: 'hidden' }}>{needsRepBand}</div> : null}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '0.7rem 0.75rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <button type="button" onClick={() => setExpandedId(open ? null : row.house.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-base)', flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{row.house.name}</div>
                    <div style={muted}>
                      {[row.house.address, priceLine(row)].filter(Boolean).join(' · ')}
                    </div>
                    <div style={muted}>{requestLine(row)}</div>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                    <SupplyHouseWebsiteLink websiteUrl={row.house.website_url} />
                    <button type="button" onClick={() => onEditHouse(row.house)} style={editBtn}>Edit</button>
                  </div>
                </div>
                {row.reps.length === 0 ? (
                  <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>{repsCell(row, true)}</div>
                ) : (
                  row.reps.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                          <span aria-hidden="true" style={{ color: r.is_default ? '#f59e0b' : 'transparent', fontSize: '0.75rem' }}>★ </span>
                          {(r.label ?? '').trim() || (r.name ?? '').trim() || r.email}
                          {(r.label ?? '').trim() && (r.name ?? '').trim() ? <span style={muted}> · {r.name}</span> : null}
                        </div>
                        <div style={{ ...muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.email}
                          {nameOf(r.created_by) ? ` · added by ${nameOf(r.created_by)}` : ''}
                        </div>
                      </div>
                      <a href={`mailto:${r.email}`} aria-label={`Email ${r.email}`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-link)', textDecoration: 'none', background: 'var(--surface)' }}>✉</a>
                    </div>
                  ))
                )}
                {row.house.phone ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-600)' }}>
                    <span>Counter · {row.house.phone}</span>
                    <a href={`tel:${row.house.phone}`} aria-label={`Call ${row.house.name}`} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-link)', textDecoration: 'none', background: 'var(--surface)' }}>✆</a>
                  </div>
                ) : null}
                {open ? expandedPanel(row) : null}
              </div>
            </Fragment>
          )
        })}
        {loaded && rows.length === 0 ? <p style={muted}>{search ? 'No house or rep matches that search.' : 'No supply houses yet.'}</p> : null}
      </div>
    )
  }

  const showKind = audience === 'office'
  const colCount = showKind ? 6 : 5
  const bandAt = firstNeedsRepIndex()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {toolbar}
      {coverageLine}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: showKind ? '26%' : '30%' }}>{showKind ? 'Vendor' : 'Supply house'}</th>
              {showKind ? <th style={th}>Kind</th> : null}
              <th style={{ ...th, width: '30%' }}>Reps</th>
              <th style={th}>Phone</th>
              <th style={th}>Prices on file</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && rows.length === 0 ? (
              <tr><td colSpan={colCount} style={{ ...td, ...muted }}>Loading…</td></tr>
            ) : null}
            {rows.map((row, i) => {
              const open = expandedId === row.house.id
              return (
                <Fragment key={row.house.id}>
                  {i === bandAt ? (
                    <tr><td colSpan={colCount} style={{ padding: 0 }}>{needsRepBand}</td></tr>
                  ) : null}
                  <tr style={{ background: open ? 'var(--bg-subtle)' : undefined }}>
                    <td style={{ ...td, borderBottom: open ? 'none' : td.borderBottom }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : row.house.id)}
                        aria-expanded={open}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-base)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}
                      >
                        <span aria-hidden="true" style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.6rem', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>▶</span>
                        <span>
                          <span style={{ display: 'block', fontWeight: 500, fontSize: '0.95rem' }}>{row.house.name}</span>
                          {row.house.address ? <span style={{ display: 'block', ...muted }}>{row.house.address}</span> : null}
                        </span>
                      </button>
                    </td>
                    {showKind ? (
                      <td style={{ ...td, borderBottom: open ? 'none' : td.borderBottom }}>
                        <span style={{ display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', border: '1px solid var(--border)', background: row.kind === 'supply_house' ? 'var(--bg-blue-tint)' : 'var(--bg-muted)', color: row.kind === 'supply_house' ? 'var(--text-blue-800)' : 'var(--text-700)' }}>
                          {directoryKindLabel(row.kind)}
                        </span>
                      </td>
                    ) : null}
                    <td style={{ ...td, borderBottom: open ? 'none' : td.borderBottom }}>{repsCell(row, false)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', borderBottom: open ? 'none' : td.borderBottom }}>
                      {row.house.phone ? <a href={`tel:${row.house.phone}`} style={{ color: 'var(--text-700)', textDecoration: 'none' }}>{row.house.phone}</a> : <span style={muted}>—</span>}
                    </td>
                    <td style={{ ...td, borderBottom: open ? 'none' : td.borderBottom }}>
                      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{priceLine(row)}</div>
                      <div style={muted}>{requestLine(row)}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: open ? 'none' : td.borderBottom }}>
                      <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <SupplyHouseWebsiteLink websiteUrl={row.house.website_url} />
                        <button type="button" onClick={() => onEditHouse(row.house)} style={editBtn}>Edit</button>
                      </span>
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={colCount} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>{expandedPanel(row)}</td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {loaded && rows.length === 0 ? (
              <tr><td colSpan={colCount} style={{ ...td, ...muted }}>{search ? 'No house or rep matches that search.' : 'No supply houses yet.'}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
