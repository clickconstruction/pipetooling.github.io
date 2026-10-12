/**
 * Messages, cut 2: *Ask the architect* on a plans question asks the architect (the lead, 2026-10-12). The question goes on
 * the line's GC project as GC mode keeps plan questions (`gc_record_question`, asked by the person who wrote it), the line
 * is marked asked (`read_question`, so a second press makes no second question), and the email goes to the architect
 * (`gc-plan-question-email`), whose own gate says who may send it. A line on no GC project has no button. The words after
 * say what happened: the prototype's "sent" only when the email went.
 */
import { jobRefOf } from '../messages/load'
import { ASKED_ARCHITECT_TOAST } from '../messages/promises'

/** A plan question as GC mode records it (`gcIo.recordQuestion`). A question from a message is about the job as a whole. */
export interface PlanQuestionInput {
  projectId: string
  packageId: null
  askedByName: string
  text: string
  sheets: string[]
}

/** The GC project a line is on, or null. Only a line on a GC project can go to that project's architect. */
export function lineGcProject(line: { jobId?: string | null } | undefined): string | null {
  const job = jobRefOf(line?.jobId)
  return job?.kind === 'project' ? job.id : null
}

/** Who asked, as the job's questions show it: "Greg Paulk at Hillside Excavation", or the name alone. */
export function askedByOf(person: { name: string; company?: string | null }): string {
  const name = person.name.trim()
  const company = person.company?.trim()
  if (!company || company === name) return name || company || ''
  return name ? `${name} at ${company}` : company
}

/** The plan question a line becomes: their words, asked by them, on the line's GC project. Null with no project or no words. */
export function planQuestionOf(line: { jobId?: string | null; body: string }, person: { name: string; company?: string | null }): PlanQuestionInput | null {
  const projectId = lineGcProject(line)
  const text = line.body.trim()
  if (!projectId || !text) return null
  return { projectId, packageId: null, askedByName: askedByOf(person), text, sheets: [] }
}

/** GC mode's plan question writes (`gcIo.recordQuestion`, `gcIo.sendQuestionToArchitect`), as Follow up hands them on. */
export interface PlanQuestionIo {
  record: (question: PlanQuestionInput) => Promise<string>
  /** Emails it to the job's architect. Rejects with the send's own reason, its gate's included. */
  send: (questionId: string) => Promise<{ to: string }>
}

/** How the press ended: the email went (to whom), or the question is on its job and the email did not go, with the send's reason. */
export type AskArchitectEnd = { sent: true; to?: string | null } | { sent: false; job: string | null; reason: string }

/**
 * The lead's order: the question on the job, the line marked asked so a second press makes no second question, then the
 * email. A refused record or mark rejects, and `onRecorded` has said whether a question was made first; a refused email
 * does not reject, and the end carries the send's reason. Follow up's row and the thread's line both press through this.
 */
export async function askTheArchitect(
  io: PlanQuestionIo,
  markAsked: () => Promise<unknown>,
  question: PlanQuestionInput,
  opts: { jobName: string | null; reason: (error: unknown) => string; onRecorded?: () => void },
): Promise<AskArchitectEnd> {
  const questionId = await io.record(question)
  opts.onRecorded?.()
  await markAsked()
  try {
    return { sent: true, to: (await io.send(questionId)).to }
  } catch (e) {
    return { sent: false, job: opts.jobName, reason: opts.reason(e) }
  }
}

/** What the office reads after the press. */
export function askArchitectToast(end: AskArchitectEnd): { words: string; tone: 'success' | 'error' } {
  if (end.sent) return { words: end.to?.trim() ? `Sent to ${end.to.trim()} as a plan question.` : ASKED_ARCHITECT_TOAST, tone: 'success' }
  const reason = end.reason.trim()
  return {
    words: [
      `The question is under Questions about the plans on ${end.job?.trim() || 'its job'}.`,
      'The email to the architect did not go.',
      ...(reason ? [/[.!?]$/.test(reason) ? reason : `${reason}.`] : []),
      'The office can email it from there.',
    ].join(' '),
    tone: 'error',
  }
}
