import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { newPhotoId } from '../lib/photos/reportPhotos'
import { jobHasDriveFolder, loadReportPhotoSize } from '../lib/photos/reportPhotosIo'
import { addWrites, keptTiles, readyTiles, tilesInFlight, wordsForTheRest, type JobPhotoTile } from '../lib/photos/jobPhotoNotes'
import type { ShotIo } from '../lib/photos/jobPhotoNotesIo'
import { keptPhotos, type KeptPhotosStore } from '../lib/offline/keptPhotos'
import type { KeptJobPhoto } from '../lib/offline/outbox'
import { edgeFor, shrinkReportPhoto, shrinkWords, withinCap, type ReportPhotoSize } from '../lib/photos/shrink'

/**
 * Shot tiles (punch list #244, PR 1): the state a camera-first form holds from the shutter to the press, written once
 * for any host that takes photos onto a job with no report around them. A shot comes in through the one hidden file
 * input (several at once at a desk), is shrunk on the device to the office's size, sent to its bucket with its row
 * through the `io` the host mounts, and sits as a tile with its words and its stage until the host's press takes it
 * (`markAdded`, then `clear`) or the window is closed without it (`drop`). Retry and Remove are the same on every host.
 * The report form's `useReportPhotos` is the same machine with a report around it (the checklist chips, the attach at
 * Save, the kept shots with no signal); folding it onto this one is a follow-up, so the report's tests stay as they are.
 */

export type ShotStage = { fixtureId: string; name: string }

export interface UseShotTilesInput {
  open: boolean
  /** The ledger job the shots belong to; null turns the block off. */
  jobId: string | null
  authUserId: string | null
  /** The taker's name on the row and in the Drive file's name. */
  byName: string
  /** On a phone for the field roles: the input carries `capture` and takes one shot a press. */
  cameraFirst: boolean
  io: ShotIo
  /** Whether the job has a Drive folder, when the host read it already; left out, the hook reads it once per open. */
  jobHasFolder?: boolean | null
  /** Where a shot's bytes wait with no signal (PR 5); the app's unless a test passes its own. */
  kept?: KeptPhotosStore
}

export interface ShotTilesHost {
  tiles: JobPhotoTile[]
  /** The shots the press takes: in the bucket with their row, or kept on the phone (PR 5). */
  ready: JobPhotoTile[]
  /** How many wait on the phone: with any, the press goes through the outbox. */
  kept: number
  /** The riding shots as a kept press carries them (PR 5), with their words. */
  queuedPhotos: () => KeptJobPhoto[]
  /** The press was kept on the phone with the shots: the press owns them now, and a close drops nothing. */
  markQueued: () => void
  /** True while a shot is still shrinking or sending: the press waits. */
  inFlight: boolean
  photoSize: ReportPhotoSize
  /** The last shrink's words, for the line over the tiles; null until a shot came in. */
  lastShrink: string | null
  jobHasFolder: boolean | null
  inputRef: RefObject<HTMLInputElement>
  inputProps: {
    ref: RefObject<HTMLInputElement>
    type: 'file'
    accept: string
    capture: 'environment' | undefined
    multiple: boolean
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    tabIndex: -1
    'aria-hidden': true
    style: CSSProperties
    'data-testid': string
  }
  /** The camera (the file picker at a desk), for a stage or for none. */
  openCamera: (stage?: ShotStage | null) => void
  retry: (tileId: string) => void
  remove: (tileId: string) => void
  putOnStage: (tileId: string, stage: ShotStage | null) => void
  setDescription: (tileId: string, words: string) => void
  /** *Use these words for the rest*: the other tiles with no words take this one's. */
  useWordsForTheRest: (tileId: string) => void
  /** A window closed without the press, or a job changed under it: the sent shots leave the bucket and the table. */
  drop: () => void
  /** The press took these shots: their tiles leave the form and nothing is discarded. Tiles not named stay. */
  clear: (ids: ReadonlyArray<string>) => void
}

export function useShotTiles(input: UseShotTilesInput): ShotTilesHost {
  const { open, jobId, authUserId, byName, cameraFirst, io } = input
  const [tiles, setTiles] = useState<JobPhotoTile[]>([])
  const [photoSize, setPhotoSize] = useState<ReportPhotoSize>('medium')
  const [lastShrink, setLastShrink] = useState<string | null>(null)
  const [folderRead, setFolderRead] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraStageRef = useRef<ShotStage | null>(null)
  const originalsRef = useRef<Map<string, File>>(new Map())
  const urlsRef = useRef<string[]>([])
  const tilesRef = useRef<JobPhotoTile[]>([])
  tilesRef.current = tiles
  const ioRef = useRef(io)
  ioRef.current = io
  const bytes = input.kept ?? keptPhotos
  const queuedRef = useRef(false)

  // The office's size, once per open. The form never waits on it.
  useEffect(() => {
    if (!open || !jobId) return
    let live = true
    void loadReportPhotoSize().then((size) => {
      if (live) setPhotoSize(size)
    })
    return () => {
      live = false
    }
  }, [open, jobId])

  // Whether the job has a Drive folder, for the line over the tiles: the host's own read when it has one.
  const hostKnowsFolder = input.jobHasFolder !== undefined
  useEffect(() => {
    if (!open || !jobId || hostKnowsFolder) return
    let live = true
    setFolderRead(null)
    let read: Promise<boolean | null>
    try {
      read = jobHasDriveFolder(jobId)
    } catch {
      read = Promise.resolve(null)
    }
    void read.then(
      (has) => {
        if (live) setFolderRead(has)
      },
      () => {
        if (live) setFolderRead(null)
      },
    )
    return () => {
      live = false
    }
  }, [open, jobId, hostKnowsFolder])

  function keepUrl(url: string): string {
    urlsRef.current.push(url)
    return url
  }

  function letGoOfUrls() {
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    urlsRef.current = []
  }

  /** The shots of a window that was closed without the press leave the bucket and the table; every object URL is let go. */
  function drop() {
    const unadded = queuedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'sent').map((t) => ({ id: t.id, storagePath: t.storagePath }))
    if (unadded.length) void ioRef.current.discard(unadded)
    const keptIds = queuedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'kept').map((t) => t.id)
    if (keptIds.length) void bytes.drop(keptIds)
    letGoOfUrls()
    originalsRef.current.clear()
    queuedRef.current = false
    setTiles([])
    setLastShrink(null)
  }
  const dropRef = useRef(drop)
  dropRef.current = drop

  // The job changed under the window: the sent shots sit under the old job's path, so they go.
  const lastJobRef = useRef<string | null>(jobId)
  useEffect(() => {
    if (lastJobRef.current !== jobId) {
      lastJobRef.current = jobId
      if (tilesRef.current.length) dropRef.current()
    }
  }, [jobId])

  function openCamera(stage?: ShotStage | null) {
    cameraStageRef.current = stage ?? null
    inputRef.current?.click()
  }

  /**
   * Shrink on the device, keep the bytes, then send: the tile reads each step. A send lost to the signal leaves the
   * tile kept on the phone (PR 5), to go with the press; any other failure keeps the tile with Retry.
   */
  async function shrinkAndSend(id: string, file: File, takenAt: string) {
    let held = false
    try {
      const shot = await shrinkReportPhoto(file, photoSize)
      if (!withinCap(shot.blob.size)) throw new Error('The photo is over 2 MB even after the shrink.')
      const preview = shot.shrunk ? keepUrl(URL.createObjectURL(shot.blob)) : null
      setTiles((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'sending', bytes: shot.blob.size, width: shot.width, height: shot.height, shrunk: shot.shrunk, ...(preview ? { previewUrl: preview } : null) } : t)),
      )
      setLastShrink(shrinkWords({ before: file.size, after: shot.blob.size, longEdge: edgeFor(photoSize), shrunk: shot.shrunk }))
      if (!authUserId) throw new Error('Sign in again to send a photo.')
      if (!jobId) throw new Error('A photo goes on a job.')
      held = await bytes.keep(id, shot.blob)
      const sent = await ioRef.current.send({ id, jobId, blob: shot.blob, byUserId: authUserId, byName, takenAt, originalBytes: file.size, width: shot.width, height: shot.height })
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'sent', storagePath: sent.storagePath, failWhy: null } : t)))
      void bytes.drop([id])
    } catch (err) {
      // The class by name, not instanceof: a smoke that stubs the io throws a plain error and must still fail the tile.
      const lostSignal = typeof err === 'object' && err != null && (err as { name?: unknown }).name === 'PhotoSendError' && (err as { kind?: unknown }).kind === 'network'
      if (lostSignal && held) {
        setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'kept', failWhy: null } : t)))
        return
      }
      if (held) void bytes.drop([id])
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'failed', failWhy: formatErrorMessage(err, 'The photo did not send.') } : t)))
    }
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const stage = cameraStageRef.current
    cameraStageRef.current = null
    const fresh: JobPhotoTile[] = []
    const sends: Array<[string, File, string]> = []
    for (const file of files) {
      const id = newPhotoId()
      const takenAt = new Date(file.lastModified > 0 && file.lastModified < Date.now() ? file.lastModified : Date.now()).toISOString()
      originalsRef.current.set(id, file)
      fresh.push({
        id,
        status: 'shrinking',
        previewUrl: keepUrl(URL.createObjectURL(file)),
        originalBytes: file.size,
        bytes: 0,
        width: 0,
        height: 0,
        longEdge: edgeFor(photoSize),
        shrunk: false,
        fixtureId: stage?.fixtureId ?? null,
        stageName: stage?.name ?? null,
        description: '',
        storagePath: null,
        takenAt,
        failWhy: null,
      })
      sends.push([id, file, takenAt])
    }
    setTiles((prev) => [...prev, ...fresh])
    for (const [id, file, takenAt] of sends) void shrinkAndSend(id, file, takenAt)
  }

  function retry(id: string) {
    const file = originalsRef.current.get(id)
    const tile = tilesRef.current.find((t) => t.id === id)
    if (!file || !tile) return
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'shrinking', failWhy: null } : t)))
    void shrinkAndSend(id, file, tile.takenAt)
  }

  function remove(id: string) {
    const tile = tilesRef.current.find((t) => t.id === id)
    if (!tile) return
    if (tile.status === 'sent') void ioRef.current.discard([{ id: tile.id, storagePath: tile.storagePath }])
    if (tile.status === 'kept') void bytes.drop([id])
    originalsRef.current.delete(id)
    setTiles((prev) => prev.filter((t) => t.id !== id))
  }

  /** The riding shots as the press carries them: a kept one unsent, a sent one with only the landing left. */
  function queuedPhotos(): KeptJobPhoto[] {
    const words = new Map(addWrites(tilesRef.current).map((w) => [w.id, w]))
    return readyTiles(tilesRef.current).map((t) => {
      const w = words.get(t.id)
      return {
        id: t.id,
        sent: t.status === 'sent',
        fixtureId: t.fixtureId,
        stageName: t.stageName,
        caption: w?.caption ?? '',
        description: w?.description ?? '',
        questionId: null,
        questionWords: null,
        takenAt: t.takenAt,
        bytes: t.bytes,
        originalBytes: t.originalBytes,
        width: t.width,
        height: t.height,
        byName,
      }
    })
  }

  function clear(ids: ReadonlyArray<string>) {
    const gone = new Set(ids)
    for (const id of gone) originalsRef.current.delete(id)
    setTiles((prev) => {
      const left = prev.filter((t) => !gone.has(t.id))
      if (left.length === 0) {
        letGoOfUrls()
        setLastShrink(null)
      }
      return left
    })
  }

  const jobHasFolder = hostKnowsFolder ? (input.jobHasFolder ?? null) : folderRead
  const inputProps: ShotTilesHost['inputProps'] = {
    ref: inputRef,
    type: 'file',
    accept: 'image/*',
    capture: cameraFirst ? 'environment' : undefined,
    multiple: !cameraFirst,
    onChange: onFiles,
    tabIndex: -1,
    'aria-hidden': true,
    style: { display: 'none' },
    'data-testid': 'shot-input',
  }

  return {
    tiles,
    ready: readyTiles(tiles),
    kept: keptTiles(tiles).length,
    queuedPhotos,
    markQueued: () => {
      queuedRef.current = true
    },
    inFlight: tilesInFlight(tiles),
    photoSize,
    lastShrink,
    jobHasFolder,
    inputRef,
    inputProps,
    openCamera,
    retry,
    remove,
    putOnStage: (tileId, stage) => setTiles((prev) => prev.map((t) => (t.id === tileId ? { ...t, fixtureId: stage?.fixtureId ?? null, stageName: stage?.name ?? null } : t))),
    setDescription: (tileId, words) => setTiles((prev) => prev.map((t) => (t.id === tileId ? { ...t, description: words } : t))),
    useWordsForTheRest: (tileId) => setTiles((prev) => wordsForTheRest(prev, tileId)),
    drop,
    clear,
  }
}
