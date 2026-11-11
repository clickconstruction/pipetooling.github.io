/**
 * Materials on site (punch list #297, the finish line, v2.6927): what a job's screens say while its box photos' files
 * are on their way to its Drive folder. When a job's on-site rows change job (a whole-job combine, the dev seat's
 * move), the database marks each filed photo due a move (`job_box_photos.refile_due_at`) and the photo sweep moves
 * what is due; the app also asks at once for the roles that may. The strip shows the count while it runs, names a
 * held file with its reason, and is not drawn when nothing is due. Pure: the marks in, the words out.
 */
import { countedLabel } from '../batchWords'

export { REFILE_ASK_ROLES, mayAskRefile } from '../../../supabase/functions/_shared/boxPhotoRefile'

/** A photo whose file is due a move: the row's id, the file's name, when it is due, and the reason when a try was held. */
export interface RefileMark {
  id: string
  fileName: string
  dueAt: string
  failWhy: string | null
}

export interface RefileHeldLine {
  id: string
  fileName: string
  why: string
}

export type RefileStripView =
  | { kind: 'none' }
  | {
      kind: 'moving'
      head: string
      sub: string
      /** How far along, from 0 to 1, or null when this screen has not seen the count go down yet. */
      progress: number | null
      held: RefileHeldLine[]
    }
  | {
      kind: 'held'
      head: string
      sub: string
      held: RefileHeldLine[]
      /** The press that tries the held files again, for a role that may ask. */
      button: string
    }

const photos = (n: number): string => (n === 1 ? '1 box photo' : `${n} box photos`)

/**
 * The strip for a job. `seenMost` is the most marks this screen has seen on the job since it opened, so the count can
 * read *5 of 12 moved*; `filedTotal` is how many of the job's box photos are filed in Drive, for the line that stands
 * once only held files are left.
 */
export function refileStripView(marks: readonly RefileMark[], seenMost: number, filedTotal: number | null): RefileStripView {
  const held: RefileHeldLine[] = marks.filter((m) => m.failWhy).map((m) => ({ id: m.id, fileName: m.fileName, why: m.failWhy as string }))
  const moving = marks.length - held.length
  if (marks.length === 0) return { kind: 'none' }
  if (moving > 0) {
    const of = Math.max(seenMost, marks.length)
    const done = of - marks.length
    return {
      kind: 'moving',
      head: `${photos(moving)} ${moving === 1 ? 'is' : 'are'} moving to this job’s Drive folder`,
      sub: `${done > 0 ? `${done} of ${of} moved. ` : ''}You can leave this page: the rest follow by themselves.`,
      progress: done > 0 ? done / of : null,
      held,
    }
  }
  const n = held.length
  const total = filedTotal != null && filedTotal >= n ? filedTotal : null
  return {
    kind: 'held',
    head: total != null ? `${total - n} of ${photos(total)} ${total - n === 1 ? 'is' : 'are'} in this job’s Drive folder` : `${photos(n)} could not move to this job’s Drive folder`,
    sub: `${n === 1 ? '1 was held. It still opens from its box' : `${n} were held. They still open from their boxes`}. A held file is tried again by itself a day later.`,
    held,
    button: countedLabel('Try', n, ['held file again', 'held files again']),
  }
}

/** The sentence a combine's finish adds when the job it kept has box photos on their way; nothing when none is due. */
export function combinePhotosSentence(due: number): string {
  if (due <= 0) return ''
  return due === 1
    ? 'Its 1 box photo is moving to the job’s Drive folder. That takes a minute or two and finishes by itself.'
    : `Its ${due} box photos are moving to the job’s Drive folder. That takes a minute or two and finishes by itself.`
}

/** The most rounds one press asks before it leaves the rest to the sweep: an ask moves about forty files. */
export const REFILE_MAX_ROUNDS = 12

/** Whether to ask again after an answer: only while files were left unreached and the last round moved something. */
export function refileAsksAgain(answer: { left?: number; moved?: unknown[] } | null, round: number): boolean {
  if (!answer || round >= REFILE_MAX_ROUNDS) return false
  return Number(answer.left ?? 0) > 0 && Array.isArray(answer.moved) && answer.moved.length > 0
}
