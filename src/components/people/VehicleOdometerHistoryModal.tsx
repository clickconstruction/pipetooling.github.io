import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { parseOdometerInput, vehicleDisplayName, vinTail, type FleetOdometerEntry, type FleetVehicle } from '../../lib/vehicleFleet'
import { formatMiles, formatSpanDays, odometerHistoryRows, odometerPace, odometerRowCaption, type OdometerHistoryRow, type OdometerPace } from '../../lib/vehicleOdometerHistory'
import { ModalShell } from './VehicleCatchUpModals'

/**
 * Odometer history sheet (v2.2172): opened from a vehicle card's
 * "229,950 mi · 9d ago" line. Pace tiles (per month · per year · last 90
 * days · since first reading) over the reading list, newest first, each with
 * its delta and who logged it. Reads the vehicle's entries fresh on open;
 * same chrome as the fleet catch-up sheets. "Add a reading" writes today's
 * reading right from the sheet (same insert as the catch-up list) and tells
 * the tab to reload so the card's line follows.
 */
export function VehicleOdometerHistoryModal({
  vehicle,
  todayYmd,
  nameById,
  formatDate,
  onClose,
  onAdded,
}: {
  vehicle: FleetVehicle
  todayYmd: string
  nameById: (id: string | null | undefined) => string | null
  formatDate: (ymd: string) => string
  onClose: () => void
  /** Called after a reading is saved from the sheet so the tab can reload the card's latest reading. */
  onAdded?: () => void
}) {
  const { user: authUser } = useAuth()
  const [entries, setEntries] = useState<FleetOdometerEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [addRaw, setAddRaw] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLInputElement | null>(null)

  async function addReading() {
    const val = parseOdometerInput(addRaw)
    if (val == null) {
      setAddError('Enter the miles as a number (commas are fine).')
      return
    }
    setAdding(true)
    setAddError(null)
    const { error: err } = await supabase
      .from('vehicle_odometer_entries')
      .insert({ vehicle_id: vehicle.id, odometer_value: val, read_date: todayYmd, created_by: authUser?.id ?? null })
    setAdding(false)
    if (err) {
      setAddError(err.message)
      return
    }
    setAddRaw('')
    setTick((t) => t + 1)
    onAdded?.()
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await supabase
        .from('vehicle_odometer_entries')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('read_date', { ascending: false })
        .limit(500)
      if (cancelled) return
      if (err) {
        setError(err.message)
        setEntries([])
        return
      }
      setEntries((data as FleetOdometerEntry[] | null) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [vehicle.id, tick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows: OdometerHistoryRow[] = entries ? odometerHistoryRows(entries, nameById) : []
  const pace: OdometerPace = odometerPace(entries ?? [], todayYmd)
  const tail = vinTail(vehicle.vin)

  return (
    <ModalShell
      icon="🛞"
      iconTint="var(--bg-sky-tint)"
      title="Odometer history"
      subtitle={`${vehicleDisplayName(vehicle)}${tail ? ` · ${tail}` : ''}`}
      countBig={pace.readings}
      countLabel={pace.readings === 1 ? 'reading' : 'readings'}
      footerHint="Readings come from the card's Current odometer box, the fleet catch-up list, and Quickfill's odometer sweep."
      onClose={onClose}
    >
      {entries == null ? (
        <p style={{ margin: '0.6rem 1.3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
      ) : (
        <>
          <PaceTiles pace={pace} formatDate={formatDate} />
          <p style={{ margin: '0 1.3rem 0.55rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            Averages use the first and last readings — they smooth over gaps, so one late reading doesn't swing them.
          </p>
          {error ? <p style={{ margin: '0 1.3rem 0.5rem', color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.1rem 1.3rem 0.7rem' }}>
            <input
              ref={addRef}
              type="text"
              inputMode="decimal"
              value={addRaw}
              onChange={(e) => {
                setAddRaw(e.target.value)
                setAddError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addReading()
                }
              }}
              placeholder="Today's miles"
              aria-label="Today's odometer reading"
              disabled={adding}
              style={{ flex: '1 1 9rem', minWidth: 0, font: 'inherit', fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
            <button
              type="button"
              onClick={() => void addReading()}
              disabled={adding || !addRaw.trim()}
              style={{ font: 'inherit', fontSize: '0.88rem', fontWeight: 650, padding: '0.5rem 0.95rem', borderRadius: 8, border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff', cursor: adding || !addRaw.trim() ? 'not-allowed' : 'pointer', opacity: !addRaw.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
            >
              {adding ? 'Saving…' : 'Add reading'}
            </button>
            <span style={{ flexBasis: '100%', fontSize: '0.72rem', color: addError ? 'var(--text-red-700)' : 'var(--text-faint)' }}>
              {addError ?? `Dated today (${formatDate(todayYmd)}) · Enter saves`}
            </span>
          </div>
          {rows.length === 0 ? (
            <p style={{ margin: '0.6rem 1.3rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No readings yet — add one from the card's Current odometer box.</p>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {rows.map((r) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '4.8rem 1fr auto', gap: '0.7rem', alignItems: 'baseline', padding: '0.55rem 1.3rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDate(r.readDate)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.98rem', color: 'var(--text-strong)' }}>{formatMiles(r.miles)} mi</span>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: r.kind === 'dip' ? 'var(--text-amber-800)' : r.kind === 'first' ? 'var(--text-faint)' : 'var(--text-muted)' }}>{odometerRowCaption(r)}</span>
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{r.byName ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ModalShell>
  )
}

function PaceTiles({ pace, formatDate }: { pace: OdometerPace; formatDate: (ymd: string) => string }) {
  const tile: React.CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.7rem', minWidth: 0 }
  const k: React.CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }
  const v: React.CSSProperties = { fontSize: '1.12rem', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: 'var(--text-strong)' }
  const unit: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 3 }
  const s: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }
  const needMore = pace.perMonth == null
  const trendText = pace.trend === 'faster' ? 'a little faster' : pace.trend === 'slower' ? 'a little slower' : pace.trend === 'same' ? 'about the same' : `${pace.recentReadings} reading${pace.recentReadings === 1 ? '' : 's'} in window`
  return (
    <div className="odo-pace-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem', padding: '0 1.3rem 0.6rem' }}>
      <style>{`@media (min-width: 560px) { .odo-pace-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }`}</style>
      <div style={tile}>
        <div style={k}>Per month</div>
        <div style={v}>{needMore ? '—' : formatMiles(Math.round(pace.perMonth!))}{needMore ? null : <span style={unit}>mi</span>}</div>
        <div style={s}>{needMore ? 'need one more reading' : 'average'}</div>
      </div>
      <div style={tile}>
        <div style={k}>Per year</div>
        <div style={v}>{needMore ? '—' : formatMiles(Math.round(pace.perYear!))}{needMore ? null : <span style={unit}>mi</span>}</div>
        <div style={s}>{needMore ? 'need one more reading' : 'average'}</div>
      </div>
      <div style={tile}>
        <div style={k}>Last 90 days</div>
        <div style={v}>{pace.recentPerMonth == null ? '—' : formatMiles(Math.round(pace.recentPerMonth))}{pace.recentPerMonth == null ? null : <span style={unit}>mi/mo</span>}</div>
        <div style={s}>{pace.recentPerMonth == null ? (pace.recentReadings < 2 ? 'fewer than 2 readings' : '—') : trendText}</div>
      </div>
      <div style={tile}>
        <div style={k}>Since first reading</div>
        <div style={v}>{pace.readings >= 2 ? formatMiles(Math.max(0, pace.spanMiles)) : '—'}{pace.readings >= 2 ? <span style={unit}>mi</span> : null}</div>
        <div style={s}>{pace.firstDate && pace.lastDate && pace.readings >= 2 ? `${formatSpanDays(pace.spanDays)} · ${formatDate(pace.firstDate)} → ${formatDate(pace.lastDate)}` : pace.readings === 1 ? 'one reading so far' : 'no readings yet'}</div>
      </div>
    </div>
  )
}
