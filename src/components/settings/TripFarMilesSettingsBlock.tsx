import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { readTripFarMiles, saveTripFarMiles } from '../../lib/trips/tripsIo'
import { TRIP_FAR_MILES_HELP, TRIP_FAR_MILES_LABEL, TRIP_FAR_MILES_MAX, TRIP_FAR_MILES_MIN, TRIP_FAR_MILES_NEAR_NOTE, tripFarMilesSavedWords, tripFarMilesTyped } from '../../lib/trips/tripFarMiles'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → Jobs, bills and liens → Trips (v2.7888, punch list #379, the owner's call 1): how many miles from the
 * shop makes a site a trip from home. One row of `app_settings` (`trips_far_miles_v1`), set by a dev and read by
 * the Trips look and by every phone that asks about a trip. Self-contained like GcBillDayCutoffSettingsBlock:
 * loads its own value, saves on Save. The io is injectable for the smoke.
 */
export type TripFarMilesIo = { read: () => Promise<number>; save: (miles: number) => Promise<void> }
const supabaseIo: TripFarMilesIo = { read: readTripFarMiles, save: saveTripFarMiles }

export default function TripFarMilesSettingsBlock({ io = supabaseIo }: { io?: TripFarMilesIo }) {
  const { showToast } = useToastContext()
  const [miles, setMiles] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    void io.read().then((m) => {
      if (!live) return
      setMiles(m)
      setTyped(String(m))
    })
    return () => {
      live = false
    }
  }, [io])

  const wanted = tripFarMilesTyped(typed)
  const save = async () => {
    if (wanted == null) return
    setSaving(true)
    try {
      await io.save(wanted)
      setMiles(wanted)
      showToast(tripFarMilesSavedWords(wanted), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The distance did not change.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1rem' }} data-testid="trip-far-miles-block">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600 }}>
          {TRIP_FAR_MILES_LABEL}
          <input
            type="number"
            inputMode="numeric"
            min={TRIP_FAR_MILES_MIN}
            max={TRIP_FAR_MILES_MAX}
            step={1}
            value={typed}
            disabled={miles === null || saving}
            onChange={(e) => setTyped(e.target.value)}
            data-testid="trip-far-miles-input"
            style={{ width: '5.5rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
          />
        </label>
        <button
          type="submit"
          disabled={miles === null || saving || wanted == null || wanted === miles}
          data-testid="trip-far-miles-save"
          style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}
        >
          Save
        </button>
      </form>
      <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>{TRIP_FAR_MILES_HELP}</span>
      <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>{TRIP_FAR_MILES_NEAR_NOTE}</span>
    </div>
  )
}
