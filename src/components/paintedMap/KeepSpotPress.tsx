/**
 * **＋ Keep this spot on the job** (punch list #413, step 2): the press on a photo that is being
 * added anyway, in the Job photos window and on a report. It reads the phone once, hands the photo
 * to the job's list of places, and the place sheet opens over the screen with the photo in it. A
 * plain photo is one press to skip, and nothing about adding it changes.
 *
 * The photo is the one already on the screen, read back from its preview. A photo whose own time
 * is more than five minutes old takes no reading (`paintedSpot.ts`): it is not of where the person
 * stands. Once its place is saved the press says so and goes quiet, so a second press does not
 * make a second place.
 */
import { useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { SPOT_WORDS } from '../../lib/paintedMap/paintedSpot'
import { openSpotOnJob, readSpotNow, spotFileFromPreview, type SpotJob } from '../../lib/paintedMap/paintedSpotIo'
import { formatErrorMessage } from '../../utils/errorHandling'

type Props = {
  job: SpotJob
  /** The photo as the screen shows it. */
  previewUrl: string
  /** The photo's own time, when the screen read one. */
  takenAt?: string | null
  /** The photo is still being read by the phone: the press waits for it. */
  waiting?: boolean
  /** Under a small tile: the short words, at the tile's own width. */
  compact?: boolean
  style?: CSSProperties
}

const press: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 48, padding: '0 0.8rem', borderRadius: 10, borderWidth: 1.5, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', boxSizing: 'border-box' }
const dead: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const done: CSSProperties = { ...press, borderColor: 'var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', cursor: 'default' }

/** The press under a report's 96 px tile: the same act in three words, still 44 px tall. */
const small: CSSProperties = { minHeight: 44, padding: '0 0.25rem', fontSize: '0.75rem', lineHeight: 1.15, borderRadius: 8 }

export function KeepSpotPress({ job, previewUrl, takenAt = null, waiting = false, compact = false, style }: Props) {
  const [busy, setBusy] = useState(false)
  const [kept, setKept] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keep = async () => {
    if (busy || kept || waiting) return
    setBusy(true)
    setError(null)
    // The phone is read on the press, while the person still stands where the photo was taken.
    const reading = readSpotNow()
    try {
      const file = await spotFileFromPreview(previewUrl, takenAt)
      const res = await openSpotOnJob(job, { file, reading, takenMs: file.lastModified > 0 ? file.lastModified : null, onKept: () => setKept(true) })
      if (!res.ok) setError(res.error)
    } catch (e) {
      setError(formatErrorMessage(e, 'The photo did not open.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span data-keep-spot={kept ? 'kept' : busy ? 'busy' : 'ready'} style={{ display: 'grid', gap: '0.25rem', minWidth: 0, ...style }}>
      <button type="button" aria-label={compact && !kept && !busy ? 'Keep this spot on the job' : undefined} style={{ ...(kept ? done : busy || waiting ? dead : press), ...(compact ? small : null) }} disabled={busy || kept || waiting} onClick={(e) => { e.stopPropagation(); void keep() }}>
        {kept ? (compact ? SPOT_WORDS.keptShort : SPOT_WORDS.kept) : busy ? (compact ? SPOT_WORDS.openingShort : SPOT_WORDS.opening) : compact ? SPOT_WORDS.keepShort : SPOT_WORDS.keep}
      </button>
      {error ? (
        <span role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}
