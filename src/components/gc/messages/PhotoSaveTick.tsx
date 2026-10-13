import { useEffect, useState } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { loadPhotoSave, setPhotoSave } from '../../../lib/photos/photoSavesIo'
import { PHOTO_TICK_WORDS, photoTickDone, photoTickNote } from '../../../lib/photos/photoTick'
import { formatErrorMessage } from '../../../utils/errorHandling'

/**
 * Messages, cut 10 (photos saved on arrival): the job's tick under a message's Attachments, *Save every photo on this job
 * to Drive as it comes in* (the prototype's `quo-messages-mockup.html` draft 9). It reads the job's tick, and a press
 * turns it on or off through `set_photo_save`, which refuses in words the toast says. On, it says since when. A read
 * that fails draws nothing: a tick that may be wrong is worse than none.
 */
export function PhotoSaveTick({ jobKey }: { jobKey: string }) {
  const { showToast } = useToastContext()
  // The read, kept with the job it is for: a read for another job is still loading.
  const [read, setRead] = useState<{ key: string; onSince: string | null; failed: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    loadPhotoSave(jobKey).then(
      (onSince) => live && setRead({ key: jobKey, onSince, failed: false }),
      () => live && setRead({ key: jobKey, onSince: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [jobKey])

  const mine = read?.key === jobKey ? read : null
  if (mine?.failed) return null
  const on = Boolean(mine?.onSince)
  const note = photoTickNote(mine?.onSince ?? null)

  const press = () => {
    setBusy(true)
    setPhotoSave(jobKey, !on)
      .then(
        (onSince) => {
          setRead({ key: jobKey, onSince, failed: false })
          showToast(photoTickDone(onSince !== null), 'success')
        },
        (e: unknown) => showToast(formatErrorMessage(e, 'The job’s photo setting did not change.'), 'error'),
      )
      .finally(() => setBusy(false))
  }

  return (
    <div data-photo-tick={on ? 'on' : 'off'} style={{ marginTop: '0.45rem', fontSize: '0.85rem' }}>
      <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', cursor: mine && !busy ? 'pointer' : 'default' }}>
        <input type="checkbox" checked={on} disabled={!mine || busy} onChange={press} style={{ marginTop: 3, flex: 'none' }} />
        <span>{PHOTO_TICK_WORDS}</span>
      </label>
      {note && <div style={{ marginLeft: '1.45rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{note}</div>}
    </div>
  )
}
