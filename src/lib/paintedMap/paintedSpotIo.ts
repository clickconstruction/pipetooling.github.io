/**
 * Photo of a spot (punch list #413): the one reading of the phone a spot is given. Asked once, on
 * the press that opens the camera, so the reading is of the moment the photo was taken. The rules
 * are `paintedSpot.ts`'s. This file only asks.
 */
import { requestMyFix } from '../materials/myLocation'
import { JOB_LIST_WORDS, jobListsOf } from './paintedJobList'
import { openPaintedMap, paintPaintedMap } from './paintedMapDoor'
import { loadPaintedMapsFor } from './paintedMapIo'
import { SPOT_WORDS, type PaintedSpot, type SpotReading } from './paintedSpot'

/** An id for a list not yet saved, as the start sheet makes one for a map. */
const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** Asks the phone where it is, once. It always answers: with a reading, or with why none came. */
export function readSpotNow(): Promise<SpotReading> {
  return new Promise((resolve) => {
    requestMyFix(
      (fix) => resolve({ ok: true, fix }),
      (why) => resolve({ ok: false, why }),
    )
  })
}

/** The job a spot is kept on, in the words the start of a list needs. */
export type SpotJob = { jobId: string; label?: string | null; address?: string | null }

/**
 * Opens the place sheet for a spot on a job, from a screen that has not read the job's maps: the
 * job's own list of places already adding a place, or a new list that is saved with this first
 * place. The job's strip does the same with the lists it already holds.
 */
export async function openSpotOnJob(job: SpotJob, spot: PaintedSpot): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await loadPaintedMapsFor({ jobId: job.jobId })
  if (!res.ok) return { ok: false, error: res.error }
  const list = jobListsOf(res.value.map((w) => w.map), job.jobId)[0]
  const opened = list
    ? openPaintedMap(list.id, job.address ?? null, 'place', spot)
    : paintPaintedMap({ id: newId(), name: JOB_LIST_WORDS.name, words: '', home: { jobId: job.jobId, developmentId: null, label: job.label ?? null, address: job.address ?? null }, first: 'place', jobList: true, spot })
  return opened ? { ok: true } : { ok: false, error: SPOT_WORDS.noDoor }
}

/**
 * A photo already on a screen, as the file a spot begins with: read back from its preview address.
 * `takenAt` is the photo's own time when the screen read one, and gives the file its date.
 */
export async function spotFileFromPreview(previewUrl: string, takenAt: string | null | undefined): Promise<File> {
  const blob = await (await fetch(previewUrl)).blob()
  const taken = takenAt ? Date.parse(takenAt) : Number.NaN
  return new File([blob], 'spot.jpg', { type: blob.type || 'image/jpeg', lastModified: Number.isFinite(taken) ? taken : Date.now() })
}
