import type { FieldReportPayload, KeptReportPhoto, MovedLineStamp, OutboxPress } from './outbox'
import { checklistAnswerWrites, type ChecklistAnswerWrite } from '../photos/reportPhotoChecklist'
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
}

async function defaultIo(): Promise<AfterLandingIo> {
  const [{ supabase }, { stampMovedLines }, { propagateReportPctToJob }, { attachReportPhotos }, { answerQuestionsWithReportPhotos }] = await Promise.all([
    import('../supabase'),
    import('../../hooks/useJobLineProgress'),
    import('../propagateReportPctToJob'),
    import('../photos/reportPhotosIo'),
    import('../jobs/stageChecklistSheetIo'),
  ])
  return {
    invokeFunction: (name, body) => supabase.functions.invoke(name, { body }),
    stampMovedLines: (jobId, moved, reportId) => stampMovedLines(jobId, moved as never, reportId),
    propagateReportPct: (jobId, fieldValues) => propagateReportPctToJob(jobId, fieldValues),
    attachPhotos: (reportId, photos) => attachReportPhotos(reportId, photos),
    answerQuestions: (writes, who) => answerQuestionsWithReportPhotos(writes, who),
    dropKeptPhotos: (ids) => keptPhotos.drop(ids),
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
