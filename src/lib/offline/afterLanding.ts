import type { BidPhotosPayload, CounterTicketPayload, FieldReportPayload, JobPhotosPayload, KeptReportPhoto, MovedLineStamp, OutboxPress, TaskPhotoPayload } from './outbox'
import { announceTickets } from '../tickets/ticketEvents'
import { announceTaskPhotos } from '../taskPhotos'
import { checklistAnswerWrites, type ChecklistAnswerWrite } from '../photos/reportPhotoChecklist'
import { threadLineWords } from '../photos/jobPhotoNotes'
import { keptPhotos } from './keptPhotos'

export type { MovedLineStamp } from './outbox'

/**
 * What follows a press once it lands from the queue (punch list #163 PR 3). A report filed live
 * does these from the form; a report that waited on the phone does them here when the replay
 * lands it: the two notifications (best effort, as the form's are), the moved lines stamped on the
 * job, and the report's percent mirrored onto the job. The Ready to bill prompt the form offers on
 * a 100% report is not drawn here, since the form is long closed; the job's percent still moves.
 * A note needs nothing after it lands. Every call is best effort and never throws.
 */


export interface AfterLandingIo {
  invokeFunction: (name: string, body: Record<string, unknown>) => Promise<unknown>
  stampMovedLines: (jobId: string, moved: ReadonlyArray<MovedLineStamp>, reportId: string | null) => Promise<void>
  propagateReportPct: (jobId: string, fieldValues: Record<string, unknown>) => Promise<unknown>
  /** Punch list #229, PR 6: the kept report's photos take the report's id; the ids that did not come back. */
  attachPhotos?: (reportId: string, photos: ReadonlyArray<{ id: string; fixtureId: string | null; stageName: string | null; caption: string }>) => Promise<{ failedIds?: string[] }>
  /** A photo that answers a checklist question goes onto the answer row (PR 6 of #189). */
  answerQuestions?: (writes: ReadonlyArray<ChecklistAnswerWrite>, who: { userId: string; name: string }) => Promise<unknown>
  /** The kept bytes go once the photos are on the report. */
  dropKeptPhotos?: (ids: ReadonlyArray<string>) => Promise<void>
  /** A job photos press (punch list #244, PR 5): the one line on the job's thread after it lands, best effort. */
  postThreadLine?: (jobId: string, userId: string, body: string) => Promise<boolean>
  /** A task photo press (punch list #273, v2.6628): the card's strips hear the landed photos and read again. */
  announceTaskPhotos?: (ids: ReadonlyArray<string>) => void
  /** A counter ticket (punch list #295, PR 2): My tickets hears the landed ticket and reads again. */
  announceTickets?: (ids: ReadonlyArray<string>) => void
}

async function defaultIo(): Promise<AfterLandingIo> {
  const [{ supabase }, { stampMovedLines }, { propagateReportPctToJob }, { attachReportPhotos }, { answerQuestionsWithReportPhotos }, { postJobThreadNoteBody }] = await Promise.all([
    import('../supabase'),
    import('../../hooks/useJobLineProgress'),
    import('../propagateReportPctToJob'),
    import('../photos/reportPhotosIo'),
    import('../jobs/stageChecklistSheetIo'),
    import('../jobs/postJobThreadNote'),
  ])
  return {
    invokeFunction: (name, body) => supabase.functions.invoke(name, { body }),
    stampMovedLines: (jobId, moved, reportId) => stampMovedLines(jobId, moved as never, reportId),
    propagateReportPct: (jobId, fieldValues) => propagateReportPctToJob(jobId, fieldValues),
    attachPhotos: (reportId, photos) => attachReportPhotos(reportId, photos),
    answerQuestions: (writes, who) => answerQuestionsWithReportPhotos(writes, who),
    dropKeptPhotos: (ids) => keptPhotos.drop(ids),
    postThreadLine: (jobId, userId, body) => postJobThreadNoteBody(jobId, userId, body),
    announceTaskPhotos: (ids) => announceTaskPhotos(ids),
    announceTickets: (ids) => announceTickets(ids),
  }
}

/** A kept photo as the checklist's answer rule reads a tile: sent, with its question. */
function asAnswerTile(p: KeptReportPhoto) {
  return { id: p.id, status: 'sent' as const, previewUrl: '', originalBytes: p.originalBytes, bytes: p.bytes, width: p.width, height: p.height, longEdge: 0, shrunk: true, fixtureId: p.fixtureId, stageName: p.stageName, questionId: p.questionId, questionWords: p.questionWords, storagePath: null, takenAt: p.takenAt, failWhy: null }
}

/** The report id the server answered, when it did. */
export function reportIdOf(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const id = (result as { report_id?: unknown }).report_id
  return typeof id === 'string' && id ? id : null
}

export async function afterLanding(press: OutboxPress, result: unknown, io?: AfterLandingIo): Promise<void> {
  if (press.kind === 'counter-ticket') {
    // The replay wrote the row and the pages and the landing saved it; the bytes go, and My tickets hears it. Best effort.
    const payload = press.payload as CounterTicketPayload
    const run = io ?? (await defaultIo().catch(() => null))
    if (!run) return
    const sent = (payload.photos ?? []).filter((p) => p.sent).map((p) => p.id)
    if (run.dropKeptPhotos && sent.length > 0) await run.dropKeptPhotos(sent).catch(() => undefined)
    if (run.announceTickets) {
      try {
        run.announceTickets([payload.ticketId])
      } catch {
        // a list that is not mounted hears nothing, and loses nothing: it reads on its next open
      }
    }
    return
  }
  if (press.kind === 'bid-photos') {
    // The replay wrote the rows and the landing added them; the bytes go. The board and an open window hear the
    // landing itself (`OUTBOX_LANDED_EVENT`) and read again. A bid photo writes no thread line. Best effort.
    const payload = press.payload as BidPhotosPayload
    const run = io ?? (await defaultIo().catch(() => null))
    if (!run) return
    const sent = (payload.photos ?? []).filter((p) => p.sent).map((p) => p.id)
    if (run.dropKeptPhotos && sent.length > 0) await run.dropKeptPhotos(sent).catch(() => undefined)
    return
  }
  if (press.kind === 'task-photo') {
    // The replay wrote the row and the landing tied it to its line; the bytes go, and the card's strip hears it. Best effort.
    const payload = press.payload as TaskPhotoPayload
    const run = io ?? (await defaultIo().catch(() => null))
    if (!run) return
    const sent = (payload.photos ?? []).filter((p) => p.sent).map((p) => p.id)
    if (run.dropKeptPhotos && sent.length > 0) await run.dropKeptPhotos(sent).catch(() => undefined)
    if (run.announceTaskPhotos && sent.length > 0) {
      try {
        run.announceTaskPhotos(sent)
      } catch {
        // a strip that is not mounted hears nothing, and loses nothing: it reads on its next open
      }
    }
    return
  }
  if (press.kind === 'job-photos') {
    // The press landed the words on the rows; the bytes go and the thread gets its one line. Best effort.
    const payload = press.payload as JobPhotosPayload
    const run = io ?? (await defaultIo().catch(() => null))
    if (!run) return
    const sent = (payload.photos ?? []).filter((p) => p.sent)
    if (run.dropKeptPhotos && sent.length > 0) await run.dropKeptPhotos(sent.map((p) => p.id)).catch(() => undefined)
    const line = threadLineWords(sent)
    if (run.postThreadLine && line && payload.jobLedgerId) await run.postThreadLine(payload.jobLedgerId, press.userId, line).catch(() => undefined)
    return
  }
  if (press.kind !== 'field-report') return
  const reportId = reportIdOf(result)
  const payload = press.payload as FieldReportPayload
  const run = io ?? (await defaultIo().catch(() => null))
  if (!run) return
  // The photos first (punch list #229, PR 6): the sent ones take the report's id and answer their questions, then
  // the bytes go; the notifications after, so the email carries the photos. Every step best effort.
  const photos = (payload.photos ?? []).filter((p) => p.sent)
  if (reportId && photos.length > 0) {
    let failed = new Set<string>()
    if (run.attachPhotos) {
      const attached = await run.attachPhotos(reportId, photos.map((p) => ({ id: p.id, fixtureId: p.fixtureId, stageName: p.stageName, caption: p.caption }))).catch(() => ({ failedIds: photos.map((p) => p.id) }))
      failed = new Set(attached.failedIds ?? [])
    }
    if (run.answerQuestions && payload.jobLedgerId) {
      const answers = checklistAnswerWrites({ jobId: payload.jobLedgerId, tiles: photos.filter((p) => !failed.has(p.id)).map(asAnswerTile) })
      if (answers.length > 0) await run.answerQuestions(answers, { userId: press.userId, name: photos[0]?.byName ?? '' }).catch(() => undefined)
    }
    if (run.dropKeptPhotos) await run.dropKeptPhotos(photos.map((p) => p.id)).catch(() => undefined)
  }
  if (reportId) {
    void run.invokeFunction('send-report-notification', { report_id: reportId }).catch(() => undefined)
    void run.invokeFunction('send-report-email', { report_id: reportId }).catch(() => undefined)
  }
  if (payload.jobLedgerId) {
    if (payload.movedLines && payload.movedLines.length > 0) {
      await run.stampMovedLines(payload.jobLedgerId, payload.movedLines, reportId).catch(() => undefined)
    }
    const fv = payload.fieldValues && typeof payload.fieldValues === 'object' ? (payload.fieldValues as Record<string, unknown>) : {}
    await run.propagateReportPct(payload.jobLedgerId, fv).catch(() => undefined)
  }
}
