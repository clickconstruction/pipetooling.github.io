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

/** How the press ended: the email went (to whom), or the question is on its job and the email did not go, with the send's reason. */
export type AskArchitectEnd = { sent: true; to?: string | null } | { sent: false; job: string | null; reason: string }

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
