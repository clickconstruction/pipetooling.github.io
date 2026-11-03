import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { newPhotoId } from '../lib/photos/reportPhotos'
import { jobHasDriveFolder, loadReportPhotoSize } from '../lib/photos/reportPhotosIo'
import { addWrites, keptTiles, readyTiles, tilesInFlight, wordsForTheRest, type JobPhotoTile } from '../lib/photos/jobPhotoNotes'
import type { ShotIo } from '../lib/photos/jobPhotoNotesIo'
import { keptPhotos, type KeptPhotosStore } from '../lib/offline/keptPhotos'
import type { KeptJobPhoto } from '../lib/offline/outbox'
import { edgeFor, shrinkReportPhoto, shrinkWords, withinCap, type ReportPhotoSize } from '../lib/photos/shrink'
import { readTakenAt } from '../lib/photos/photoTakenAt'
import { fileTimeOrNow, sendLostSignal, type ShotTileBase } from '../lib/photos/shotTiles'

/**
 * Shot tiles (punch list #244): the state a camera-first form holds from the shutter to its press, written once for
 * every host that takes photos onto a job. `useShotTileEngine` is the machine. A shot comes in through the one hidden
 * file input; its time is the camera's own when the file carries one (punch list #247), else the host's `pickedAt`; it
 * is shrunk on the device to the office's size, its bytes are kept, and it is sent to its bucket with its row through
 * the `io` the host mounts. It then sits as a tile until the host's press owns it (`own`, or `clear` once it is taken)
 * or the form is closed without it (`drop`). With no signal the tile is kept on the phone, to go with the press; any
 * other failure keeps the tile with Retry. Remove is the same on every host.
 *
 * Its two hosts (the fold of v2.6453): `useShotTiles` below, the Job photos window (several files a press at a desk,
 * each tile's words), and `useReportPhotos`, a report form (one shot a press, the checklist chips, the attach at Save).
 */

export type ShotStage = { fixtureId: string; name: string }

/** The one hidden file input: the host renders `<input {...inputProps} />` once inside its form. */
export type ShotInputProps = {
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

export interface ShotTileEngineInput<T extends ShotTileBase> {
  open: boolean
  /** The ledger job the shots belong to; null turns the block off. */
  jobId: string | null
  authUserId: string | null
  /** The taker's name on the row and in the Drive file's name. */
  byName: string
  /** On a phone for the field roles: the input carries `capture`. */
  cameraFirst: boolean
  io: ShotIo
  /** Whether the job has a Drive folder, when the host read it already; left out, the engine reads it once per open. */
  jobHasFolder?: boolean | null
  /** Where a shot's bytes wait with no signal; the app's unless a test passes its own. */
  kept?: KeptPhotosStore
  /** A fresh tile with the host's own fields on it: a report's question, a job photo's words. */
  tile: (base: ShotTileBase) => T
  /** Every file a press hands over (a desk's pick in the Job photos window), or the first only (a report form). */
  multiple: boolean
  /** The name of the io's send error: its network kind keeps a shot on the phone. */
  sendErrorName: string
  /** What a shot reads when its job is gone before it sends. */
  noJobWords: string
  /** A shot's time until the camera's own is read: the moment it was picked, or the file's own. */
  pickedAt: (file: File) => string
  /** The hidden input's test id. */
  testId: string
}

export interface ShotTileEngine<T extends ShotTileBase> {
  tiles: T[]
  /** The tiles as they stand, for a press that reads them after the render that drew them. */
  current: () => T[]
  /** The host's own change to one tile: its stage, its words, its question. */
  edit: (tileId: string, change: (tile: T) => T) => void
  /** The host's own change across the tiles. */
  editAll: (change: (tiles: T[]) => T[]) => void
  photoSize: ReportPhotoSize
  /** The last shrink's words, for the line over the tiles; null until a shot came in. */
  lastShrink: string | null
  jobHasFolder: boolean | null
  inputRef: RefObject<HTMLInputElement>
  inputProps: ShotInputProps
  /** The camera (the file picker at a desk), for a stage or for none. */
  openCamera: (stage?: ShotStage | null) => void
  retry: (tileId: string) => void
  remove: (tileId: string) => void
  /** A form closed without its press, or a job changed under it: the sent shots leave the bucket and the table, the kept ones the phone. */
  drop: () => void
  /** The press took these shots: their tiles leave the form and nothing is discarded. Tiles not named stay. */
  clear: (ids: ReadonlyArray<string>) => void
  /** The press owns the shots now (a report saved, or a press kept on the phone): a close drops nothing. */
  own: () => void
}

export function useShotTileEngine<T extends ShotTileBase>(input: ShotTileEngineInput<T>): ShotTileEngine<T> {
  const { open, jobId, authUserId, byName, cameraFirst, multiple } = input
  const [tiles, setTiles] = useState<T[]>([])
  const [photoSize, setPhotoSize] = useState<ReportPhotoSize>('medium')
  const [lastShrink, setLastShrink] = useState<string | null>(null)
  const [folderRead, setFolderRead] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraStageRef = useRef<ShotStage | null>(null)
  const originalsRef = useRef<Map<string, File>>(new Map())
  const urlsRef = useRef<string[]>([])
  const tilesRef = useRef<T[]>([])
  tilesRef.current = tiles
  // The host's io and its own rules, read when a shot moves rather than when it was picked.
  const hostRef = useRef(input)
  hostRef.current = input
  const bytes = input.kept ?? keptPhotos
  const ownedRef = useRef(false)

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

  /** The shots of a form closed without its press leave the bucket and the table, the kept ones the phone; every object URL is let go. */
  function drop() {
    const unowned = ownedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'sent').map((t) => ({ id: t.id, storagePath: t.storagePath }))
    if (unowned.length) void hostRef.current.io.discard(unowned)
    const keptIds = ownedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'kept').map((t) => t.id)
    if (keptIds.length) void bytes.drop(keptIds)
    letGoOfUrls()
    originalsRef.current.clear()
    ownedRef.current = false
    setTiles([])
    setLastShrink(null)
  }
  const dropRef = useRef(drop)
  dropRef.current = drop

  // The job changed under the form: the sent shots sit under the old job's path, so they go.
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
   * Read the camera's time, shrink on the device, keep the bytes, then send: the tile reads each step. A send lost to
   * the signal leaves the tile kept on the phone, to go with the press; any other failure keeps the tile with Retry.
   */
  async function shrinkAndSend(id: string, file: File, pickedAt: string) {
    const host = hostRef.current
    let held = false
    try {
      // The photo's time is the file's own when the camera wrote one (punch list #247, PR 3), else the host's pickedAt.
      const takenAt = await readTakenAt(file, Date.parse(pickedAt) || Date.now())
      const shot = await shrinkReportPhoto(file, photoSize)
      if (!withinCap(shot.blob.size)) throw new Error('The photo is over 2 MB even after the shrink.')
      const preview = shot.shrunk ? keepUrl(URL.createObjectURL(shot.blob)) : null
      setTiles((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: 'sending' as const, takenAt, bytes: shot.blob.size, width: shot.width, height: shot.height, shrunk: shot.shrunk, ...(preview ? { previewUrl: preview } : null) } : t,
        ),
      )
      setLastShrink(shrinkWords({ before: file.size, after: shot.blob.size, longEdge: edgeFor(photoSize), shrunk: shot.shrunk }))
      if (!authUserId) throw new Error('Sign in again to send a photo.')
      if (!jobId) throw new Error(host.noJobWords)
      held = await bytes.keep(id, shot.blob)
      const sent = await host.io.send({ id, jobId, blob: shot.blob, byUserId: authUserId, byName, takenAt, originalBytes: file.size, width: shot.width, height: shot.height })
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'sent' as const, storagePath: sent.storagePath, failWhy: null } : t)))
      void bytes.drop([id])
    } catch (err) {
      if (sendLostSignal(err, host.sendErrorName) && held) {
        setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'kept' as const, failWhy: null } : t)))
        return
      }
      if (held) void bytes.drop([id])
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'failed' as const, failWhy: formatErrorMessage(err, 'The photo did not send.') } : t)))
    }
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const host = hostRef.current
    const handed = Array.from(e.target.files ?? [])
    e.target.value = ''
    // A report form takes one shot a press; the Job photos window takes every file a desk's pick hands over.
    const files = multiple ? handed : handed.slice(0, 1)
    if (files.length === 0) return
    const stage = cameraStageRef.current
    cameraStageRef.current = null
    const fresh: T[] = []
    const sends: Array<[string, File, string]> = []
    for (const file of files) {
      const id = newPhotoId()
      const pickedAt = host.pickedAt(file)
      originalsRef.current.set(id, file)
      fresh.push(
        host.tile({
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
          storagePath: null,
          takenAt: pickedAt,
          failWhy: null,
        }),
      )
      sends.push([id, file, pickedAt])
    }
    setTiles((prev) => [...prev, ...fresh])
    for (const [id, file, at] of sends) void shrinkAndSend(id, file, at)
  }

  function retry(id: string) {
    const file = originalsRef.current.get(id)
    const tile = tilesRef.current.find((t) => t.id === id)
    if (!file || !tile) return
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'shrinking' as const, failWhy: null } : t)))
    void shrinkAndSend(id, file, tile.takenAt)
  }

  function remove(id: string) {
    const tile = tilesRef.current.find((t) => t.id === id)
    if (!tile) return
    if (tile.status === 'sent') void hostRef.current.io.discard([{ id: tile.id, storagePath: tile.storagePath }])
    if (tile.status === 'kept') void bytes.drop([id])
    originalsRef.current.delete(id)
    setTiles((prev) => prev.filter((t) => t.id !== id))
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
  const inputProps: ShotInputProps = {
    ref: inputRef,
    type: 'file',
    accept: 'image/*',
    capture: cameraFirst ? 'environment' : undefined,
    multiple,
    onChange: onFiles,
    tabIndex: -1,
    'aria-hidden': true,
    style: { display: 'none' },
    'data-testid': input.testId,
  }

  return {
    tiles,
    current: () => tilesRef.current,
    edit: (tileId, change) => setTiles((prev) => prev.map((t) => (t.id === tileId ? change(t) : t))),
    editAll: (change) => setTiles((prev) => change(prev)),
    photoSize,
    lastShrink,
    jobHasFolder,
    inputRef,
    inputProps,
    openCamera,
    retry,
    remove,
    drop,
    clear,
    own: () => {
      ownedRef.current = true
    },
  }
}

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
  inputProps: ShotInputProps
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

/** The Job photos window's shots: every file a desk's pick hands over, each tile's words, the press's queued photos. */
export function useShotTiles(input: UseShotTilesInput): ShotTilesHost {
  const { byName } = input
  const shots = useShotTileEngine<JobPhotoTile>({
    open: input.open,
    jobId: input.jobId,
    authUserId: input.authUserId,
    byName,
    cameraFirst: input.cameraFirst,
    io: input.io,
    jobHasFolder: input.jobHasFolder,
    kept: input.kept,
    tile: (base) => ({ ...base, description: '' }),
    multiple: !input.cameraFirst,
    sendErrorName: 'PhotoSendError',
    noJobWords: 'A photo goes on a job.',
    pickedAt: (file) => fileTimeOrNow(file),
    testId: 'shot-input',
  })

  /** The riding shots as the press carries them: a kept one unsent, a sent one with only the landing left. */
  function queuedPhotos(): KeptJobPhoto[] {
    const tiles = shots.current()
    const words = new Map(addWrites(tiles).map((w) => [w.id, w]))
    return readyTiles(tiles).map((t) => {
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

  return {
    tiles: shots.tiles,
    ready: readyTiles(shots.tiles),
    kept: keptTiles(shots.tiles).length,
    queuedPhotos,
    markQueued: shots.own,
    inFlight: tilesInFlight(shots.tiles),
    photoSize: shots.photoSize,
    lastShrink: shots.lastShrink,
    jobHasFolder: shots.jobHasFolder,
    inputRef: shots.inputRef,
    inputProps: shots.inputProps,
    openCamera: shots.openCamera,
    retry: shots.retry,
    remove: shots.remove,
    putOnStage: (tileId, stage) => shots.edit(tileId, (t) => ({ ...t, fixtureId: stage?.fixtureId ?? null, stageName: stage?.name ?? null })),
    setDescription: (tileId, words) => shots.edit(tileId, (t) => ({ ...t, description: words })),
    useWordsForTheRest: (tileId) => shots.editAll((prev) => wordsForTheRest(prev, tileId)),
    drop: shots.drop,
    clear: shots.clear,
  }
}
