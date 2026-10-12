import { salaryZonedWallClockToUtcMs } from '../salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { LienPenWitnessHow } from './lienNoticeSignature'
import { lienPenWitnessWords } from './lienNoticeSignature'

/**
 * Recording a pen signature (the pen train, PR 2): the pure parts of the pane. The office types
 * the day the leader signed (the print day is filled in), says how they know, may add a photo or
 * scan of the signed page, and ticks the notices he signed. These helpers turn those answers into
 * what the write needs and what the words say; nothing here touches the database.
 */

/** The day the office typed, as the instant the row keeps: noon in the app's calendar, so the day reads the same in any zone. */
export function penSignedAtIso(ymd: string): string | null {
  const ms = salaryZonedWallClockToUtcMs(ymd, 12, 0, 0, APP_CALENDAR_TZ)
  return ms == null ? null : new Date(ms).toISOString()
}

export const PEN_PAGE_MAX_BYTES = 15 * 1024 * 1024

/** Why a file cannot be the signed page, or null when it can: an image or a PDF, up to 15 MB. */
export function penPageFileProblem(file: { type: string; size: number }): string | null {
  const ok = file.type.startsWith('image/') || file.type === 'application/pdf'
  if (!ok) return 'The signed page is a photo or a scan: an image or a PDF.'
  if (file.size > PEN_PAGE_MAX_BYTES) return 'The signed page is over 15 MB. Take a smaller photo.'
  return null
}

/** The file's extension for the bucket, from its type; `bin` for anything unexpected. */
export function penPageExtension(type: string): string {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/heic' || type === 'image/heif') return 'heic'
  if (type === 'image/webp') return 'webp'
  return 'bin'
}

/** Where the signed page goes: `desk/<item id>/pen-<uuid>.<ext>` in the release bucket, beside the drawn signatures. */
export function penPagePath(itemId: string, uuid: string, type: string): string {
  return `desk/${itemId}/pen-${uuid}.${penPageExtension(type)}`
}

/** The witness word the office picked, or `page` once a photo is attached: the page is the stronger fact. */
export function penWitnessHowWithPage(how: LienPenWitnessHow, hasPage: boolean): LienPenWitnessHow {
  return hasPage ? 'page' : how
}

/**
 * The toast after the record: "Recorded 3 pen signatures · Robert Douglas signed October 9 ·
 * written down by Taunya, who watched him sign."
 */
export function penRecordedWords(args: { count: number; leaderName: string; dayWords: string; how: LienPenWitnessHow; recorderName: string | null }): string {
  const n = args.count
  return `Recorded ${n} pen signature${n === 1 ? '' : 's'} · ${args.leaderName.trim() || 'the leader'} signed ${args.dayWords} · written down by ${lienPenWitnessWords(args.how, args.recorderName)}.`
}

/** The problems the pane refuses to record over, in the order it checks them; empty when it may go. */
export function penRecordProblems(args: { ymd: string; todayYmd: string; printedYmd: string | null; ticked: number; leaderName: string }): string[] {
  const out: string[] = []
  if (!args.leaderName.trim()) out.push('The job has no leader to name. Set the job’s master first.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.ymd)) out.push('Type the day he signed.')
  else {
    if (args.ymd > args.todayYmd) out.push('The day he signed cannot be after today.')
    if (args.printedYmd && args.ymd < args.printedYmd) out.push(`The paper printed ${args.printedYmd}. He cannot have signed it before that.`)
  }
  if (args.ticked === 0) out.push('Tick at least one notice.')
  return out
}
