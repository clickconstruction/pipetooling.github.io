/**
 * The Person desk's control for a watch on what one person does with the material on site
 * (`person_watches`). A dev's alone: the row is drawn for no other viewer, and the database answers
 * no other role. Turning it on changes nothing the person may do and nothing they see. It marks their
 * presses on a site's By person look, where what is outside the process then reads in red, and
 * starts a quiet log of the boxes they open. A watch is stopped with a reason and stays on record.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { DeskRow } from '../personDeskShared'
import { fetchWatchOn, liftWatch, setWatch, type PersonWatch } from '../../../lib/people/personWatchIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { formatErrorMessage } from '../../../utils/errorHandling'

type Props = {
  userId: string
  /** The person's first name or name, for the words. */
  name: string
  viewerUserId: string | null
  /** The reads and writes; a test hands in its own. */
  io?: { read: typeof fetchWatchOn; set: typeof setWatch; lift: typeof liftWatch }
}

const field: CSSProperties = { minHeight: 32, width: '100%', maxWidth: 420, boxSizing: 'border-box', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.85rem', padding: '0 0.5rem' }
const press: CSSProperties = { minHeight: 32, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }

const defaultIo = { read: fetchWatchOn, set: setWatch, lift: liftWatch }

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PersonWatchRow({ userId, name, viewerUserId, io = defaultIo }: Props) {
  const [watch, setWatchState] = useState<PersonWatch | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [why, setWhy] = useState('')
  const [tellMe, setTellMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoaded(false)
    setError(null)
    // Inside a promise, so a read that throws at once is caught like one that fails later.
    Promise.resolve()
      .then(() => io.read(userId))
      .then((w) => {
        if (!live) return
        setWatchState(w)
        setLoaded(true)
      })
      .catch((e: unknown) => {
        if (!live) return
        setError(formatErrorMessage(e, 'The watch did not load.'))
        setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [userId, io])

  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      setWatchState(await io.set(userId, why, tellMe && viewerUserId ? [viewerUserId] : []))
      setWhy('')
    } catch (e) {
      setError(formatErrorMessage(e, 'The watch was not turned on.'))
    }
    setBusy(false)
  }
  const stop = async () => {
    if (!watch || !why.trim()) return
    setBusy(true)
    setError(null)
    try {
      await io.lift(watch.id, why)
      setWatchState(null)
      setWhy('')
    } catch (e) {
      setError(formatErrorMessage(e, 'The watch was not stopped.'))
    }
    setBusy(false)
  }

  const tellsMe = Boolean(watch && viewerUserId && watch.tellUserIds.includes(viewerUserId))
  const canStop = !busy && why.trim().length > 0

  return (
    <DeskRow label="Watch on site">
      <div style={{ display: 'grid', gap: '0.4rem' }} data-testid="person-watch">
        {!loaded ? (
          <span style={muted}>Reading the watch…</span>
        ) : watch ? (
          <>
            <span>
              <strong>Watched since {dayWords(watch.setAt)}</strong>
              <span style={muted}> · set by {watch.setByName || 'a dev'}{watch.tellUserIds.length === 0 ? ' · tells nobody' : tellsMe ? ' · tells you' : ` · tells ${watch.tellUserIds.length === 1 ? '1 person' : `${watch.tellUserIds.length} people`}`}</span>
            </span>
            {watch.why ? <span style={muted}>{watch.why}</span> : null}
            <span style={muted}>A site’s By person look marks what {name} does outside the process in red. {name} sees nothing different.</span>
            <input aria-label="Why the watch stops" placeholder="Why it stops" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} style={field} />
            <span><button type="button" style={{ ...press, ...(canStop ? {} : dead) }} disabled={!canStop} aria-disabled={!canStop} onClick={() => void stop()}>Stop watching</button></span>
          </>
        ) : (
          <>
            <span style={muted}>Turn this on to follow what {name} does with material on site. It changes nothing {name} may do and nothing {name} sees.</span>
            <input aria-label="Why the watch is on" placeholder="Why (kept, never shown to them)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} style={field} />
            <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={tellMe} onChange={(e) => setTellMe(e.target.checked)} />
              Tell me when they press
            </label>
            <span style={muted}>You are told when they start on a day, when a press is outside the process, and once in the evening.</span>
            <span><button type="button" style={{ ...press, ...(busy ? dead : {}) }} disabled={busy} aria-disabled={busy} onClick={() => void turnOn()}>Turn on the watch</button></span>
          </>
        )}
        {error ? <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{error}</span> : null}
      </div>
    </DeskRow>
  )
}
