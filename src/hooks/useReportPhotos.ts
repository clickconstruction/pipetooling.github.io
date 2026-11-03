import { useEffect, useState, type RefObject } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import type { ReportPhotoStage } from '../components/reports/ReportPhotoTiles'
import { photosInFlight, reportPhotoCaption, ridingTiles, sentTiles, tilesOnStage, type ReportPhotoTile } from '../lib/photos/reportPhotos'
import { attachReportPhotos, discardReportPhotos, sendReportPhoto } from '../lib/photos/reportPhotosIo'
import type { ShotIo } from '../lib/photos/jobPhotoNotesIo'
import type { KeptReportPhoto } from '../lib/offline/outbox'
import { answerFailWords, checklistAnswerWrites, checklistPhotoChips, tileAnswering, tileOnStage, type ChecklistPhotoChip } from '../lib/photos/reportPhotoChecklist'
import { loadQuestionsForJob } from '../lib/jobs/stageChecklistIo'
import { answerQuestionsWithReportPhotos } from '../lib/jobs/stageChecklistSheetIo'
import type { StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import type { ReportPhotoSize } from '../lib/photos/shrink'
import { useShotTileEngine, type ShotInputProps } from './useShotTiles'

/**
 * A report form's photos (punch list #229, PR 1): the state the camera-first report built (punch list #189, PR 5b
 * and PR 6), lifted out of `AdditionalReportModal` so every form that writes a report mounts the same block. The shot
 * itself runs on the shot-tile engine (`useShotTileEngine`, the fold of v2.6453): one shot a press through the one
 * hidden file input, shrunk on the device to the office's size, sent to the bucket with its row, and sitting as a tile
 * until Save ties it to the report (`attach`) or the form is closed without saving (`drop`). This hook keeps what is
 * the report's own: its io, the stage chips' rule, the checklist question chips, the attach and the queued photos. The
 * host draws the tiles (`ReportPhotoTiles`) and owns the report; the engine owns the shots.
 *
 * The block is off when `jobId` is null (a report on a project or a bid: `report_photos` is keyed to a ledger job),
 * and the tiles are dropped when the host's job changes under them, since a sent shot sits under its job's path.
 *
 * With no signal (punch list #229, PR 6) a shrunk shot is kept on the phone (`keptPhotos.ts`) and its tile reads so;
 * the host's Save then queues the report with the photos' facts (`queuedPhotos`), and the replay sends the bytes,
 * lands the report and ties them to it. `markQueued` tells the hook the press owns the shots, so a close drops nothing.
 */

/** A report's shots go to `report_photos` and its bucket. */
const reportShotIo: ShotIo = {
  send: (shot) => sendReportPhoto(shot),
  discard: (photos) => discardReportPhotos(photos),
}

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
  inputProps: ShotInputProps
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
  const shots = useShotTileEngine<ReportPhotoTile>({
    open,
    jobId,
    authUserId,
    byName,
    cameraFirst,
    io: reportShotIo,
    jobHasFolder: input.jobHasFolder,
    tile: (base) => ({ ...base, questionId: null, questionWords: null }),
    multiple: false,
    sendErrorName: 'ReportPhotoSendError',
    noJobWords: 'Photos ride on a job’s report.',
    pickedAt: () => new Date().toISOString(),
    testId: 'report-camera-input',
  })
  const [questions, setQuestions] = useState<StageChecklistQuestion[]>([])

  // The live questions, once per open. A failed read offers no chips; the form never waits.
  useEffect(() => {
    if (!open || !jobId) return
    let live = true
    loadQuestionsForJob(jobId).then(
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

  async function attach(reportId: string, whatGotDone: string) {
    const riding = sentTiles(shots.current())
    if (!jobId || riding.length === 0) return
    const attached = await attachReportPhotos(
      reportId,
      riding.map((t) => ({ id: t.id, fixtureId: t.fixtureId, stageName: t.stageName, caption: reportPhotoCaption({ stageName: t.stageName, whatGotDone, questionWords: t.questionWords }) })),
    )
    shots.own()
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
    return ridingTiles(shots.current()).map((t) => ({
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

  const { tiles } = shots
  return {
    tiles,
    riding: ridingTiles(tiles),
    kept: tiles.filter((t) => t.status === 'kept').length,
    inFlight: photosInFlight(tiles),
    photoSize: shots.photoSize,
    lastShrink: shots.lastShrink,
    jobHasFolder: shots.jobHasFolder,
    stages,
    chips: checklistPhotoChips(stages, questions),
    inputRef: shots.inputRef,
    inputProps: shots.inputProps,
    openCamera: (stage) => shots.openCamera(stage),
    retry: shots.retry,
    remove: shots.remove,
    putOnStage: (tileId, stage) => shots.edit(tileId, (t) => tileOnStage(t, stage)),
    putOnQuestion: (tileId, chip) => shots.edit(tileId, (t) => tileAnswering(t, chip)),
    onStage: (fixtureId) => tilesOnStage(tiles, fixtureId),
    drop: shots.drop,
    queuedPhotos,
    markQueued: shots.own,
    attach,
  }
}
