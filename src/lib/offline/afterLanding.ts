import type { FieldReportPayload, MovedLineStamp, OutboxPress } from './outbox'

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
}

async function defaultIo(): Promise<AfterLandingIo> {
  const [{ supabase }, { stampMovedLines }, { propagateReportPctToJob }] = await Promise.all([
    import('../supabase'),
    import('../../hooks/useJobLineProgress'),
    import('../propagateReportPctToJob'),
  ])
  return {
    invokeFunction: (name, body) => supabase.functions.invoke(name, { body }),
    stampMovedLines: (jobId, moved, reportId) => stampMovedLines(jobId, moved as never, reportId),
    propagateReportPct: (jobId, fieldValues) => propagateReportPctToJob(jobId, fieldValues),
  }
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
