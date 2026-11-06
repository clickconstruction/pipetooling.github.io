import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AWAY_NO_NOTE_WORDS, AWAY_WORDS, awayMiles, buildAwayScreen, type AwayMiles, type MyAwayNote } from '../lib/people/awayNote'
import { loadMyAwayNote } from '../lib/people/awayNoteIo'
import { AwayScreen } from '../components/away/AwayScreen'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { recoveryFailureFromError } from '../lib/offlineRecoveryState'
import type { OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * The Away page (punch list #256 PR 8, v2.6587): the only page the app draws for a signed-in archived account. The
 * seal (migration *_archived_seal) refuses every other read, so this page reads `my_away_note()` alone and draws the
 * note over `buildAwayScreen`, the model the office's preview draws too. The countdown re-reads the clock every
 * minute. *Use my location* asks the browser only after the press, works the miles out here with the office's pin,
 * and sends nothing. With no note (the session outlived the note, or the ban), the resting words and Sign out.
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

  const screen = note ? buildAwayScreen({ draft: note.draft, firstName: note.firstName, now, leftYmd: note.leftYmd, updatedYmd: note.updatedYmd, todayYmd: todayYmdInAppTz(now), office: note.office }) : null

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

  return (
    <div data-page-scroll="allow" style={{ minHeight: '100vh', background: 'var(--bg-subtle)', color: 'var(--text-strong)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
        <span>ClickTooling</span>
        <button type="button" onClick={() => void supabase.auth.signOut()} style={{ font: 'inherit', fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {AWAY_WORDS.signOut}
        </button>
      </header>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '16px 14px 24px' }}>
        {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="away-note" idempotent /> : null}
        {note === undefined && !failure ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p> : null}
        {note === null ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>{AWAY_NO_NOTE_WORDS.title}</div>
            <div style={{ marginTop: 4, color: 'var(--text-base)' }}>{AWAY_NO_NOTE_WORDS.sub}</div>
          </div>
        ) : null}
        {screen ? <AwayScreen screen={screen} miles={miles} locating={locating} locateError={locateError} onLocate={locate} /> : null}
      </main>
    </div>
  )
}
