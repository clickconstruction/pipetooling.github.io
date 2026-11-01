import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import type { ReportPhotoStage } from '../components/reports/ReportPhotoTiles'
import { newPhotoId, photosInFlight, reportPhotoCaption, ridingTiles, sentTiles, tilesOnStage, type ReportPhotoTile } from '../lib/photos/reportPhotos'
import { type ReportPhotoSendError, attachReportPhotos, discardReportPhotos, jobHasDriveFolder, loadReportPhotoSize, sendReportPhoto } from '../lib/photos/reportPhotosIo'
import { keptPhotos } from '../lib/offline/keptPhotos'
import type { KeptReportPhoto } from '../lib/offline/outbox'
import { answerFailWords, checklistAnswerWrites, checklistPhotoChips, tileAnswering, tileOnStage, type ChecklistPhotoChip } from '../lib/photos/reportPhotoChecklist'
import { loadQuestions } from '../lib/jobs/stageChecklistIo'
import { answerQuestionsWithReportPhotos } from '../lib/jobs/stageChecklistSheetIo'
import type { StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { edgeFor, shrinkReportPhoto, shrinkWords, withinCap, type ReportPhotoSize } from '../lib/photos/shrink'

/**
 * A report form's photos (punch list #229, PR 1): the state the camera-first report built (punch list #189, PR 5b
 * and PR 6), lifted out of `AdditionalReportModal` so every form that writes a report mounts the same block. A shot
 * comes in through the one hidden file input, is shrunk on the device to the office's size, sent to the bucket with
 * its row, and sits as a tile until Save ties it to the report (`attach`) or the form is closed without saving
 * (`drop`). The stage chips, the checklist question chips, Retry and Remove are the same on every host. The host
 * draws the tiles (`ReportPhotoTiles`) and owns the report; this hook owns the shots.
 *
 * The block is off when `jobId` is null (a report on a project or a bid: `report_photos` is keyed to a ledger job),
 * and the tiles are dropped when the host's job changes under them, since a sent shot sits under its job's path.
 *
 * With no signal (punch list #229, PR 6) a shrunk shot is kept on the phone (`keptPhotos.ts`) and its tile reads so;
 * the host's Save then queues the report with the photos' facts (`queuedPhotos`), and the replay sends the bytes,
 * lands the report and ties them to it. `markQueued` tells the hook the press owns the shots, so a close drops nothing.
 */

export interface UseReportPhotosInput {
  open: boolean
  /** The ledger job the shots belong to; null (a project, a bid) turns the block off. */
  jobId: string | null
  authUserId: string | null
  /** The taker's name on the row and in the Drive file's name. */
  byName: string
  /** On a phone for the field roles: the input carries `capture`, and the camera's words are Take a photo. */
  cameraFirst: boolean
  /** The stages a photo can sit on: the job's priced lines, a paid one never. */
  stages: ReadonlyArray<ReportPhotoStage>
  /** Whether the job has a Drive folder, when the host read it already; left out, the hook reads it once per open. */
  jobHasFolder?: boolean | null
}

export interface ReportPhotosHost {
  tiles: ReportPhotoTile[]
  /** The shots that ride with the report: sent, or kept on the phone. */
  riding: ReportPhotoTile[]
  /** How many wait on the phone: Save queues the report when any do. */
  kept: number
  /** True while a shot is still shrinking or sending: Save waits. */
  inFlight: boolean
  photoSize: ReportPhotoSize
  /** The last shrink's words, for the line over the tiles; null until a shot came in. */
  lastShrink: string | null
  jobHasFolder: boolean | null
  /** The stages a photo can sit on, as given. */
  stages: ReadonlyArray<ReportPhotoStage>
  /** The checklist questions that ask for a photo on those stages, each a chip under a new tile. */
  chips: ChecklistPhotoChip[]
  /** The one hidden file input: the host renders `<input {...inputProps} />` once inside its form. */
  inputRef: RefObject<HTMLInputElement>
  inputProps: {
    ref: RefObject<HTMLInputElement>
    type: 'file'
    accept: string
    capture: 'environment' | undefined
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    tabIndex: -1
    'aria-hidden': true
    style: CSSProperties
    'data-testid': string
  }
  /** The camera (the file picker at a desk), for a stage or for none. */
  openCamera: (stage: ReportPhotoStage | null) => void
  retry: (tileId: string) => void
  remove: (tileId: string) => void
  putOnStage: (tileId: string, stage: ReportPhotoStage) => void
  putOnQuestion: (tileId: string, chip: ChecklistPhotoChip) => void
  /** The tiles on one stage's row. */
  onStage: (fixtureId: string) => ReportPhotoTile[]
  /** A form closed without saving, or a job changed under it: the sent shots leave the bucket and the table, the kept ones the phone. */
  drop: () => void
  /** The riding shots as a kept report carries them (PR 6), captioned as `attach` would caption them. */
  queuedPhotos: (whatGotDone: string) => KeptReportPhoto[]
  /** The report was kept on the phone with the shots: the press owns them now, and a close drops nothing. */
  markQueued: () => void
  /**
   * Save: each sent shot takes the report's id, its stage and the words it is named by, then each shot that answers a
   * checklist question goes onto the answer row. Best-effort: the report stands saved either way, and the words of
   * what did not attach come back for the host's toast.
   */
  attach: (reportId: string, whatGotDone: string) => Promise<void>
}

export function useReportPhotos(input: UseReportPhotosInput): ReportPhotosHost {
  const { open, jobId, authUserId, byName, cameraFirst, stages } = input
  const { showToast } = useToastContext()
  const [tiles, setTiles] = useState<ReportPhotoTile[]>([])
  const [photoSize, setPhotoSize] = useState<ReportPhotoSize>('medium')
  const [lastShrink, setLastShrink] = useState<string | null>(null)
  const [questions, setQuestions] = useState<StageChecklistQuestion[]>([])
  const [folderRead, setFolderRead] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraStageRef = useRef<ReportPhotoStage | null>(null)
  const originalsRef = useRef<Map<string, File>>(new Map())
  const urlsRef = useRef<string[]>([])
  const attachedRef = useRef(false)
  const tilesRef = useRef<ReportPhotoTile[]>([])
  tilesRef.current = tiles

  // The office's size and the live questions, once per open. A failed read offers no chips; the form never waits.
  useEffect(() => {
    if (!open || !jobId) return
    let live = true
    void loadReportPhotoSize().then((size) => {
      if (live) setPhotoSize(size)
    })
    loadQuestions().then(
      (qs) => {
        if (live) setQuestions(qs)
      },
      () => {
        if (live) setQuestions([])
      },
    )
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

  /** The shots of a form that was not saved leave the bucket and the table, the kept ones the phone; every object URL is let go. */
  function drop() {
    const unsaved = attachedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'sent').map((t) => ({ id: t.id, storagePath: t.storagePath }))
    if (unsaved.length) void discardReportPhotos(unsaved)
    const keptIds = attachedRef.current ? [] : tilesRef.current.filter((t) => t.status === 'kept').map((t) => t.id)
    if (keptIds.length) void keptPhotos.drop(keptIds)
    for (const u of urlsRef.current) URL.revokeObjectURL(u)
    urlsRef.current = []
    originalsRef.current.clear()
    attachedRef.current = false
    setTiles([])
    setLastShrink(null)
  }
  const dropRef = useRef(drop)
  dropRef.current = drop

  // The job changed under the form (the desk's job search): the sent shots sit under the old job's path, so they go.
  const lastJobRef = useRef<string | null>(jobId)
  useEffect(() => {
    if (lastJobRef.current !== jobId) {
      lastJobRef.current = jobId
      if (tilesRef.current.length) dropRef.current()
    }
  }, [jobId])

  function openCamera(stage: ReportPhotoStage | null) {
    cameraStageRef.current = stage
    inputRef.current?.click()
  }

  /**
   * Shrink on the device, keep the bytes, then send: the tile reads each step. A send lost to the signal leaves the
   * tile kept on the phone (PR 6), to go with the report; any other failure keeps the tile with Retry.
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
      if (!jobId) throw new Error('Photos ride on a job’s report.')
      held = await keptPhotos.keep(id, shot.blob)
      const sent = await sendReportPhoto({ id, jobId, blob: shot.blob, byUserId: authUserId, byName, takenAt, originalBytes: file.size, width: shot.width, height: shot.height })
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'sent', storagePath: sent.storagePath, failWhy: null } : t)))
      void keptPhotos.drop([id])
    } catch (err) {
      // The class by name, not instanceof: a smoke that stubs the io throws a plain error and must still fail the tile.
      const lostSignal = typeof err === 'object' && err != null && (err as { name?: unknown }).name === 'ReportPhotoSendError' && (err as ReportPhotoSendError).kind === 'network'
      if (lostSignal && held) {
        setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'kept', failWhy: null } : t)))
        return
      }
      if (held) void keptPhotos.drop([id])
      setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'failed', failWhy: formatErrorMessage(err, 'The photo did not send.') } : t)))
    }
  }

  function onCameraFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const stage = cameraStageRef.current
    cameraStageRef.current = null
    const id = newPhotoId()
    const takenAt = new Date().toISOString()
    originalsRef.current.set(id, file)
    setTiles((prev) => [
      ...prev,
      {
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
        questionId: null,
        questionWords: null,
        storagePath: null,
        takenAt,
        failWhy: null,
      },
    ])
    void shrinkAndSend(id, file, takenAt)
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
    if (tile.status === 'sent') void discardReportPhotos([{ id: tile.id, storagePath: tile.storagePath }])
    if (tile.status === 'kept') void keptPhotos.drop([id])
    originalsRef.current.delete(id)
    setTiles((prev) => prev.filter((t) => t.id !== id))
  }

  function putOnStage(tileId: string, stage: ReportPhotoStage) {
    setTiles((prev) => prev.map((t) => (t.id === tileId ? tileOnStage(t, stage) : t)))
  }

  /** A question chip (PR 6): the tile goes on the question's stage and is its answer once the report saves. */
  function putOnQuestion(tileId: string, chip: ChecklistPhotoChip) {
    setTiles((prev) => prev.map((t) => (t.id === tileId ? tileAnswering(t, chip) : t)))
  }

  async function attach(reportId: string, whatGotDone: string) {
    const riding = sentTiles(tilesRef.current)
    if (!jobId || riding.length === 0) return
    const attached = await attachReportPhotos(
      reportId,
      riding.map((t) => ({ id: t.id, fixtureId: t.fixtureId, stageName: t.stageName, caption: reportPhotoCaption({ stageName: t.stageName, whatGotDone, questionWords: t.questionWords }) })),
    )
    attachedRef.current = true
    if (attached.failed.length) {
      showToast(`Report saved, but ${attached.failed.length === 1 ? 'a photo' : `${attached.failed.length} photos`} did not attach: ${attached.failed[0]}`, 'warning')
    }
    // A photo answers a checklist question (PR 6): each attached shot a question chip placed goes onto the stage
    // checklist's answer row with its report photo id. Best-effort: the report stands saved either way.
    const failedIds = new Set(attached.failedIds ?? [])
    const answers = checklistAnswerWrites({ jobId, tiles: riding.filter((t) => !failedIds.has(t.id)) })
    if (answers.length > 0 && authUserId) {
      const wrote = await answerQuestionsWithReportPhotos(answers, { userId: authUserId, name: byName })
      if (wrote.failed.length) showToast(answerFailWords(wrote.failed.length, wrote.failed[0]!), 'warning')
    }
  }

  function queuedPhotos(whatGotDone: string): KeptReportPhoto[] {
    return ridingTiles(tilesRef.current).map((t) => ({
      id: t.id,
      sent: t.status === 'sent',
      fixtureId: t.fixtureId,
      stageName: t.stageName,
      caption: reportPhotoCaption({ stageName: t.stageName, whatGotDone, questionWords: t.questionWords }),
      questionId: t.questionId,
      questionWords: t.questionWords,
      takenAt: t.takenAt,
      bytes: t.bytes,
      originalBytes: t.originalBytes,
      width: t.width,
      height: t.height,
      byName,
    }))
  }

  const jobHasFolder = hostKnowsFolder ? (input.jobHasFolder ?? null) : folderRead
  const inputProps: ReportPhotosHost['inputProps'] = {
    ref: inputRef,
    type: 'file',
    accept: 'image/*',
    capture: cameraFirst ? 'environment' : undefined,
    onChange: onCameraFile,
    tabIndex: -1,
    'aria-hidden': true,
    style: { display: 'none' },
    'data-testid': 'report-camera-input',
  }

  return {
    tiles,
    riding: ridingTiles(tiles),
    kept: tiles.filter((t) => t.status === 'kept').length,
    inFlight: photosInFlight(tiles),
    photoSize,
    lastShrink,
    jobHasFolder,
    stages,
    chips: checklistPhotoChips(stages, questions),
    inputRef,
    inputProps,
    openCamera,
    retry,
    remove,
    putOnStage,
    putOnQuestion,
    onStage: (fixtureId) => tilesOnStage(tiles, fixtureId),
    drop,
    queuedPhotos,
    markQueued: () => {
      attachedRef.current = true
    },
    attach,
  }
}
