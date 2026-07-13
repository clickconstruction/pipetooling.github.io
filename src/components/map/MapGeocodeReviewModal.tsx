import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  GOOGLE_ONLY_REFRESH_PACING_MS,
  invokeGeocodeOneRefreshGoogleOnly,
} from '../../lib/map/invokeGeocodeOneRefreshGoogleOnly'
import { mapGeocodeErrorMessage } from '../../lib/map/geocodeErrorMessage'
import { type MapPageEntity } from '../../hooks/useMapPageData'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

type GroupedRow = {
  addressKey: string
  addressLabel: string
  refSummary: string
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function buildGroups(entities: MapPageEntity[]): GroupedRow[] {
  const byKey = new Map<string, MapPageEntity[]>()
  for (const e of entities) {
    if (e.lat == null || e.lng == null) continue
    const list = byKey.get(e.addressKey) ?? []
    list.push(e)
    byKey.set(e.addressKey, list)
  }
  const out: GroupedRow[] = []
  for (const [addressKey, list] of byKey) {
    const job = list.filter((x) => x.kind === 'job').length
    const bid = list.filter((x) => x.kind === 'bid').length
    const est = list.filter((x) => x.kind === 'estimate').length
    const parts: string[] = []
    if (job) parts.push(`Job${job > 1 ? ` ×${job}` : ''}`)
    if (bid) parts.push(`Bid${bid > 1 ? ` ×${bid}` : ''}`)
    if (est) parts.push(`Est.${est > 1 ? ` ×${est}` : ''}`)
    const refSummary = parts.length > 0 ? parts.join(', ') : '—'
    const addressLabel = list[0]?.addressLabel ?? addressKey
    out.push({ addressKey, addressLabel, refSummary })
  }
  out.sort((a, b) => a.addressLabel.localeCompare(b.addressLabel, undefined, { sensitivity: 'base' }))
  return out
}

function formatGeocodedAt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

type RunStatus = 'idle' | 'pending' | 'ok' | 'err'

export function MapGeocodeReviewModal({
  open,
  onClose,
  entitiesWithCoords,
  onAfterRefresh,
}: {
  open: boolean
  onClose: () => void
  /** Jobs/bids/estimates that have coordinates (visible layers as desired by parent). */
  entitiesWithCoords: MapPageEntity[]
  onAfterRefresh: () => void | Promise<void>
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const groups = useMemo(() => buildGroups(entitiesWithCoords), [entitiesWithCoords])
  const allKeys = useMemo(() => groups.map((g) => g.addressKey), [groups])
  const keysId = allKeys.join('|')

  const [geocodedAtByKey, setGeocodedAtByKey] = useState<Record<string, string | null>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowRun, setRowRun] = useState<Record<string, { status: RunStatus; message?: string }>>({})
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setRowRun({})
    setBatchError(null)
  }, [open, keysId])

  useEffect(() => {
    if (!open || allKeys.length === 0) {
      setGeocodedAtByKey({})
      return
    }
    setLoadingMeta(true)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('address_geocodes')
              .select('address_normalized, geocoded_at')
              .in('address_normalized', allKeys),
          'map geocode review geocoded_at'
        )
        const m: Record<string, string | null> = {}
        for (const r of rows) {
          m[r.address_normalized] = r.geocoded_at
        }
        setGeocodedAtByKey(m)
      } catch (e) {
        setBatchError(formatErrorMessage(e, 'Could not load geocode times'))
        setGeocodedAtByKey({})
      } finally {
        setLoadingMeta(false)
      }
    })()
  }, [open, keysId, allKeys.length])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggleKey = useCallback((key: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(allKeys))
  }, [allKeys])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  const runSelected = useCallback(async () => {
    const keys = [...selected]
    if (keys.length === 0) return
    setRunBusy(true)
    setBatchError(null)
    const byKey = new Map(groups.map((g) => [g.addressKey, g] as const))
    try {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!
        const g = byKey.get(k)
        if (!g) continue
        setRowRun((prev) => ({ ...prev, [k]: { status: 'pending' } }))
        try {
          const res = await invokeGeocodeOneRefreshGoogleOnly(g.addressLabel)
          if (res.ok) {
            setRowRun((prev) => ({ ...prev, [k]: { status: 'ok' } }))
            setGeocodedAtByKey((prev) => ({
              ...prev,
              [k]: new Date().toISOString(),
            }))
          } else {
            setRowRun((prev) => ({
              ...prev,
              [k]: {
                status: 'err',
                message: mapGeocodeErrorMessage(res.error, res.detail),
              },
            }))
          }
        } catch (e) {
          setRowRun((prev) => ({
            ...prev,
            [k]: { status: 'err', message: formatErrorMessage(e, 'Request failed') },
          }))
        }
        if (i < keys.length - 1) {
          await sleep(GOOGLE_ONLY_REFRESH_PACING_MS)
        }
      }
      await Promise.resolve(onAfterRefresh())
    } finally {
      setRunBusy(false)
    }
  }, [selected, groups, onAfterRefresh])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: '1rem',
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-geocode-review-title"
        style={{
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          maxWidth: 640,
          width: '100%',
          maxHeight: 'min(90vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="map-geocode-review-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            Review geocoded addresses
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            style={{ padding: '0.25rem 0.5rem', cursor: 'pointer' }}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <p style={{ margin: 0, padding: '0.5rem 1rem 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>
          Select addresses, then <strong>Rerun Google</strong> to refresh coordinates from Google only (ignores Nominatim and the cache
          for that request). Use this if a pin is wrong or the address text was updated elsewhere.
        </p>
        {batchError ? (
          <p style={{ color: 'var(--text-red-700)', margin: '0.25rem 1rem 0', fontSize: '0.875rem' }}>{batchError}</p>
        ) : null}
        {loadingMeta ? (
          <p style={{ margin: '0.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading times…</p>
        ) : null}
        <div
          style={{
            padding: '0.5rem 1rem 0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <button type="button" onClick={selectAll} disabled={allKeys.length === 0} style={{ fontSize: '0.875rem' }}>
            Select all
          </button>
          <button type="button" onClick={clearSelection} style={{ fontSize: '0.875rem' }}>
            Clear
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            margin: '0.5rem 0',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {groups.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>No geocoded addresses in the current layer view.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ width: 32, textAlign: 'left', padding: '0.35rem 0.5rem' }}> </th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Address</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>References</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Last geocoded</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const st = rowRun[g.addressKey]?.status ?? 'idle'
                  const stMsg = rowRun[g.addressKey]?.message
                  const statusText =
                    st === 'pending' ? '…' : st === 'ok' ? 'OK' : st === 'err' ? (stMsg ?? 'Error') : '—'
                  return (
                    <tr key={g.addressKey} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={selected.has(g.addressKey)}
                          onChange={() => toggleKey(g.addressKey)}
                          disabled={runBusy}
                          aria-label={`Select ${g.addressLabel}`}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', wordBreak: 'break-word' }}>{g.addressLabel}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-600)' }}>{g.refSummary}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-600)' }}>{formatGeocodedAt(geocodedAtByKey[g.addressKey] ?? null)}</td>
                      <td
                        style={{
                          padding: '0.35rem 0.5rem',
                          color: st === 'err' ? '#b91c1c' : st === 'ok' ? '#15803d' : 'var(--text-muted)',
                        }}
                      >
                        {statusText}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.35rem 0.75rem' }}>
            Done
          </button>
          <button
            type="button"
            onClick={() => void runSelected()}
            disabled={runBusy || selected.size === 0}
            style={{ padding: '0.35rem 0.75rem' }}
          >
            {runBusy ? 'Running…' : 'Rerun Google for selected'}
          </button>
        </div>
      </div>
    </div>
  )
}
