import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { awayMiles, type AwayMiles, type MyAwayNote } from '../lib/people/awayNote'
import { loadMyAwayNote } from '../lib/people/awayNoteIo'
import { AwayPageView } from '../components/away/AwayPageView'
import { recoveryFailureFromError } from '../lib/offlineRecoveryState'
import type { OfflineRecoveryLastError } from '../lib/offlineRecoveryState'

/**
 * The Away page (punch list #256 PR 8, v2.6587): the only page the app draws for a signed-in archived account. The
 * seal (migration *_archived_seal) refuses every other read, so this page reads `my_away_note()` alone and draws the
 * note on `AwayPageView`, the page the office's See what they see window draws too (v2.6846), over `buildAwayScreen`.
 * The countdown re-reads the clock every minute. *Use my location* asks the browser only after the press, works the
 * miles out here with the office's pin, and sends nothing. With no note (the session outlived the note, or the ban), the resting words and Sign out.
 */

const MINUTE = 60_000

export default function Away() {
  const [note, setNote] = useState<MyAwayNote | null | undefined>(undefined)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [miles, setMiles] = useState<AwayMiles | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailure(null)
    try {
      setNote(await loadMyAwayNote())
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'Could not read your note'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), MINUTE)
    return () => clearInterval(t)
  }, [])

  function locate() {
    const office = note?.office.latLng
    if (!office) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('This phone cannot share its location.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMiles(awayMiles({ lat: pos.coords.latitude, lng: pos.coords.longitude }, office))
        setLocating(false)
      },
      () => {
        setLocateError('Your location was not shared. The miles stay unknown.')
        setLocating(false)
      },
      { maximumAge: 5 * MINUTE, timeout: 15_000 },
    )
  }

  return <AwayPageView note={note} now={now} failure={failure} onRetry={load} onSignOut={() => void supabase.auth.signOut()} miles={miles} locating={locating} locateError={locateError} onLocate={locate} />
}
