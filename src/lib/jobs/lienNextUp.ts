/**
 * The Lien desk's Next up list (punch list #82, PR 1): every lien paper that asks for an act,
 * as one list in deadline order, each row naming its one next move and the screen that already
 * does it. Pure: it folds the queues the desk already builds (notices, affidavits, retainage,
 * letter two, liens filed and not yet served) and reads nothing itself. Nothing here writes,
 * and nothing replaces a pane: a row only says which existing pane, pile and job to open.
 *
 * The office and the leader see different buttons on the same row, as the panes' footers do
 * (`isLienOffice` / `isLienLeader`); a role that is neither sees the list and no buttons.
 */
import { lienServeClock, lienServeRowWords } from './lienServeClock'
import { LIEN_SERVE_STAGE_WORDS, type LienServeStage } from './lienServeStage'
import { isLienLeader, isLienOffice, type LienDeskEntry, type LienDeskPile, type LienDeskSeverity } from './lienDesk'
import { lienOtherScreen } from './lienCodeSigner'
import { lienAffidavitGateHeld, type LienAffidavitEntry } from './lienDeskAffidavits'
import type { LienRetainageEntry } from './lienDeskRetainage'
import { letterTwoIsDue, type LetterTwoStatus } from './lienLetterTwo'
import { COURTESY_BUTTON, PROMISE_BUTTON, courtesyIsDue, type CourtesyStatus } from './lienCourtesyNotice'
import { lienReminderAt, type LienReminderAt } from './lienReminders'
import { LIEN_RUN_ACT, LIEN_RUN_STEP } from './lienRunWords'
import { lienOfferChipWords, lienOfferFromItem } from './lienPayOffer'
import { lienChipSigned, lienFieldsHash, lienItemUnsigned, lienPenAwaitsConfirm, signatureColumnsOf } from './lienNoticeSignature'
import { lienRunRowLine } from './lienRunChecklist'
import { formatYmdMonthDay } from './billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { LIEN_NOTICE_OWED_DOORS, lienNoticeOwedMonths, lienNoticeOwedWords } from './lienNoticeOwed'
import { describeNoticeMonths } from './lienNoticeMonthWords'
import { lienActFor } from './lienActWords'
import { LIEN_JOB_PATH_DOOR } from './lienJobPathWindow'
import { lienAffidavitNoticePile, lienAffidavitNoticeStanding, lienAffidavitNoticeWaits, lienAffidavitNoticeWords } from './lienAffidavitNoticeStanding'

export type LienNextUpKind = 'notice' | 'affidavit' | 'retainage'

export type LienNextUpAction =
  | 'find_owner'
  | 'draft'
  | 'approve'
  /** The leader's signature on a notice already approved (v2.5087): the run holds it until his name is on it. */
  | 'sign'
  /** The leader's word on a pen record the office wrote down (the pen train, PR 3): nothing waits on it, it strengthens the record. */
  | 'confirm_pen'
  | 'send'
  | 'send_run'
  | 'add_tracking'
  | 'record_mailing'
  | 'review_hold'
  | 'letter_two'
  /** The courtesy notice (punch list #231): the plain reminder by email and text from day 7 after a sent notice. */
  | 'courtesy'
  /** Paying it down (punch list #274, PR 3): a payment since the packet paused the reminders; the row asks what they promised for the rest. */
  | 'promise'
  | 'note_missed'
  | 'fix_property'
  | 'send_notice'
  | 'draft_late'
  | 'file_affidavit'
  | 'record_service'
  /** An envelope mailed through the provider came back, went unclaimed, was refused, or reads a status the fold had not seen (the Docsmit train, 6b). */
  | 'mail_needs_you'
  /** Retainage the job's own bills or notes show and nobody recorded (fix A of the retainage clock check, PR 2): the office answers with the figure, or with none. */
  | 'record_retainage'

/** Where a row's button goes — always a screen that exists today. */
export type LienNextUpTarget =
  | { open: 'notices'; jobId: string; pile: LienDeskPile }
  | { open: 'affidavits'; jobId: string }
  /** The Affidavits list at one pile (punch list #362, step 4): a folded row's press, where the pile's own batch press stands. */
  | { open: 'affidavit_pile'; pile: 'ready' | 'to_draft' }
  | { open: 'retainage'; jobId: string }
  /** The Retainage list at *Looks held · not on the job*, on this job's row: where the figure is recorded or answered as none. */
  | { open: 'retainage_unrecorded'; jobId: string }
  /** The run window: a GC's ready notices, or (punch list #101) every printed notice, `takeBack` opening on its confirm. */
  | { open: 'run'; gcId: string | null; takeBack?: boolean }
  /** The Lien window on a paper's tab; `openLastWork` (punch list #353) opens it with the last day of work ready to change. */
  | { open: 'lien_window'; jobId: string; tab: 'affidavit' | 'notice'; openLastWork?: true }
  /** The recorded notice's months, corrected (punch list #353): the paper as mailed named these months too, so they join its record. */
  | { open: 'notice_record_months'; jobId: string; months: string[] }
  /** The window that takes one job off the lien path, with a reason (v2.7526, `lienJobPathWindow.ts`). */
  | { open: 'job_path'; jobId: string }
  /** The window that mails every filed lien's copies together (punch list #366): a folded row's press, and the Board's own. */
  | { open: 'serve_copies' }

/** `now` / `coming` by the day; the list draws `sign` (v2.5087, his signature on an approved notice) and `mine` (only the viewer can press it) first — punch list #101 PR 3. `reminders` (punch list #262) holds the sent notices' courtesy and letter-two rows between `now` and `coming`. Since v2.7371 (punch list #362, step 2) `risk` holds the `now` rows that will not make their day as they stand, first, and `waiting` (on the leader) stands right after it, above the rest of `now`. */
export type LienNextUpGroup = 'sign' | 'pen' | 'mine' | 'risk' | 'now' | 'reminders' | 'coming' | 'waiting'

export type LienNextUpRow = {
  key: string
  kind: LienNextUpKind
  jobId: string | null
  gcId: string | null
  /** The job (or the GC, for a run) as the desk names it. */
  title: string
  /** What state the paper is in, in a few words. */
  sub: string
  /**
   * The one thing to know about the paper once its kind and its stage are said beside it (v2.7372, punch list #362
   * step 3): the months a notice is for, the one fact an affidavit waits on, how long an approval has waited. Empty
   * when the stage says it all; absent, `sub` stands. The desktop row reads it after the Board's bin name.
   */
  detail?: string
  /** The last day (YYYY-MM-DD); null when the row has no date of its own. */
  dueOn: string | null
  /** Whole days to `dueOn` (negative once past); null with no date. */
  daysLeft: number | null
  severity: LienDeskSeverity
  group: LienNextUpGroup
  action: LienNextUpAction
  /** The button's words; null when this viewer has no move on the row (it still opens on a press of the row). */
  button: string | null
  /** A filed lien's row: where its copies stand (`lienServeStage.ts`), which names the press and picks where it lands. */
  serveStage?: LienServeStage
  target: LienNextUpTarget
  /** A second, quieter button (punch list #101: the run row's *Take back…*); null or absent for most rows. */
  secondary?: { words: string; target: LienNextUpTarget } | null
  /** More doors beside the button (punch list #353): on a job with a recorded notice that still owes one, the two ways the row may be wrong. */
  doors?: ReadonlyArray<{ words: string; target: LienNextUpTarget }>
  /** The jobs a run row stands for, in deadline order (punch list #101), for its fold and the find. */
  jobs?: ReadonlyArray<{ jobId: string; title: string; dueOn: string | null }>
  /** A courtesy or letter-two row's rung on the REMINDERS ladder (punch list #262), read from the two statuses; null when the desk did not build the courtesy status. */
  reminder?: LienReminderAt | null
}

/** A row inside this many days, or past its day, is *Needs you now*. */
export const LIEN_NEXT_UP_NOW_DAYS = 7

const BUTTON: Record<LienNextUpAction, string> = {
  find_owner: 'Find the owner',
  draft: 'Open the notice',
  approve: 'Approve',
  sign: 'Sign',
  confirm_pen: 'Yes, I signed it',
  // Print and mail (v2.7442, Taunya's words of 2026-11-16): the act at the counter, not the desk's word for it. A GC's row adds its count.
  send: LIEN_RUN_ACT.print,
  send_run: LIEN_RUN_ACT.print,
  add_tracking: 'Add tracking',
  record_mailing: LIEN_RUN_ACT.record,
  review_hold: 'Review the hold',
  letter_two: 'Send the attorney’s letter',
  courtesy: COURTESY_BUTTON,
  promise: PROMISE_BUTTON,
  note_missed: 'Note it',
  fix_property: 'Fix the property',
  send_notice: 'Send the notice first',
  draft_late: 'Draft it late',
  file_affidavit: 'File the affidavit',
  // The copies of a filed lien (punch list #366). *Record service* until v2.7497, *Mail the copies* until v2.7798: a row reads its
  // stage's name (`lienServeStage.ts`), and this one stands for a row with no stage handed in, which has printed nothing.
  record_service: LIEN_SERVE_STAGE_WORDS.print,
  mail_needs_you: 'Open the notice',
  record_retainage: 'Record the retainage',
}

/** The To do row's first words for retainage the bills or notes show and nobody recorded; the reason follows them. */
export const LIEN_RETAINAGE_UNRECORDED_SUB = 'Retainage not on the job'

/**
 * The notices a run holds (v2.7442). Opened from a GC's To do row, or from its one notice, the run holds that GC's
 * approved notices alone, so *Print and mail 3* opens on three. The desk's own doors pass no GC and get every approved
 * and printed notice, as before.
 *
 * Opened from a ready notice's *Just this one* (v2.7512, `lienRunOne.ts`), the run holds that one notice, by its desk
 * item. It is looked for in both piles, since the notice moves to the printed pile the moment its packet prints and
 * the open window must still find it.
 */
export function lienRunEntriesFor<E extends { gcCustomerId?: string | null; item?: { id: string } | null }>(ready: ReadonlyArray<E>, printed: ReadonlyArray<E>, gcId: string | null, onlyItemId?: string | null): E[] {
  if (onlyItemId) return [...ready, ...printed].filter((e) => e.item?.id === onlyItemId)
  return gcId ? ready.filter((e) => e.gcCustomerId === gcId) : [...ready, ...printed]
}

export type LienNextUpInput = {
  notices: ReadonlyArray<LienDeskEntry>
  affidavits: ReadonlyArray<LienAffidavitEntry>
  retainage: ReadonlyArray<LienRetainageEntry>
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  /** The courtesy notice per job with a sent notice (punch list #231); absent on readers that do not build it. */
  courtesyByJob?: Readonly<Record<string, CourtesyStatus>>
  /** Filed affidavits not yet served (`LienWatchResult.serveDue`). */
  serveDue?: ReadonlyArray<{ jobId: string; serveDue: string; /** Where the copies stand; absent reads as still to print. */ stage?: LienServeStage }>
  role: string | null | undefined
  todayYmd: string
  jobTitle: (jobId: string) => string
  gcName: (gcId: string) => string
  /** The leader who approves this job's paper, by name (the job's master), for the office's waiting rows; null or absent reads *the leader*. */
  leaderName?: (jobId: string) => string | null
  /** Any user by id (the pen train, PR 3): who wrote down a pen record, for the leader's row. */
  userName?: (userId: string) => string | null
  /** Who is reading (v2.6734, punch list #150): with `masterUserId`, a leader's own rows are the jobs he is master of; on another master's jobs he reads what the office reads. Absent, every leader's rows are his own, as before. */
  viewerUserId?: string | null
  /** The job's master by job (v2.6734); null for a job with no master, whose paper the signed-in leader signs as himself. */
  masterUserId?: (jobId: string) => string | null
  /** The envelopes mailed through the provider that want a person (the Docsmit train, 6b): `mailNeedsYouRows` from the desk's pieces. */
  mailNeedsYou?: ReadonlyArray<{ jobId: string; pieceId: string; who: string; words: string }>
  /** The months the live § 53.056 notices name, by job (punch list #353): a To draft row with a notice on record names the owed month beside them. Absent, the row keeps its plain words. */
  noticeMonthsByJob?: Readonly<Record<string, ReadonlyArray<string>>>
  /** The open jobs under a GC whose bills or notes say retainage is held with none recorded (`retainageSuggested.ts`), each with its row's words. Absent, no such row. */
  retainageUnrecorded?: ReadonlyArray<{ jobId: string; title: string; why: string }>
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const d = (y: string) => Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)) - 1, Number(y.slice(8, 10)))
  return Math.round((d(toYmd) - d(fromYmd)) / 86_400_000)
}

function groupOf(daysLeft: number | null, severity: LienDeskSeverity): LienNextUpGroup {
  if (daysLeft != null) return daysLeft <= LIEN_NEXT_UP_NOW_DAYS ? 'now' : 'coming'
  return severity === 'red' ? 'now' : 'coming'
}

/** Overdue first, then by the last day; a row with no day goes after the dated ones of its group. */
function compareRows(a: LienNextUpRow, b: LienNextUpRow): number {
  if (a.group !== b.group) return a.group === 'now' ? -1 : 1
  if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1
  if (!!a.dueOn !== !!b.dueOn) return a.dueOn ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

/**
 * Whether the viewer is the leader this job's paper waits on (v2.6734, punch list #150): a lien leader on a job whose
 * master is him, or that has none (then the signed-in leader signs as himself); a dev on another master's job is not,
 * and his To do reads those rows as the office does — *Waiting on Malachi*, never *Only you can approve*. Without a
 * viewer or a master lookup, every leader leads every job, as before.
 */
export function lienViewerLeadsJob(input: Pick<LienNextUpInput, 'role' | 'viewerUserId' | 'masterUserId'>, jobId: string | null): boolean {
  if (!isLienLeader(input.role)) return false
  if (input.viewerUserId === undefined || !input.masterUserId || !jobId) return true
  return !lienOtherScreen(input.masterUserId(jobId), input.viewerUserId)
}

export function buildLienNextUp(input: LienNextUpInput): LienNextUpRow[] {
  const office = isLienOffice(input.role)
  const leader = isLienLeader(input.role)
  const canAct = office || leader
  const rows: LienNextUpRow[] = []
  const leads = (jobId: string) => leader && lienViewerLeadsJob(input, jobId)

  const push = (r: Omit<LienNextUpRow, 'group' | 'button'> & { button?: string | null }) => {
    const button = r.button !== undefined ? r.button : canAct ? BUTTON[r.action] : null
    rows.push({ ...r, button, group: groupOf(r.daysLeft, r.severity) })
  }
  /** Awaiting Master approval: the leader approves; the office waits on him by name, with no button. */
  const awaiting = (jobId: string, item: { submitted_at?: string | null } | null | undefined): { action: LienNextUpAction; button: string | null; sub: string; detail: string } => {
    const since = item?.submitted_at ? calendarYmdInAppTzFromIso(item.submitted_at) : ''
    const dated = /^\d{4}-\d{2}-\d{2}$/.test(since)
    // How long it has waited (v2.7372): the day it was sent for approval, and the days since.
    const detail = dated ? `Sent for approval ${formatYmdMonthDay(since)} · ${lienWaitedWords(daysBetween(since, input.todayYmd))}` : 'Sent for approval'
    if (leads(jobId)) return { action: 'approve', button: BUTTON.approve, sub: 'Waiting on your approval', detail }
    const name = input.leaderName?.(jobId)?.trim() || 'the leader'
    return { action: 'approve', button: null, sub: `Waiting on ${name}${dated ? ` · since ${formatYmdMonthDay(since)}` : ''}`, detail }
  }
  /** The months a notice is for, as the row's one thing to know: *September 2026*. */
  const monthsOf = (e: LienDeskEntry) => describeNoticeMonths(e.dueMonths.filter((m) => /^\d{4}-\d{2}$/.test(m)))

  // ---- § 53.056 notices ----
  const readyByGc = new Map<string, LienDeskEntry[]>()
  for (const e of input.notices) {
    if (e.pile === 'ready' && e.gcCustomerId) {
      const list = readyByGc.get(e.gcCustomerId)
      if (list) list.push(e)
      else readyByGc.set(e.gcCustomerId, [e])
    }
  }
  const printed = input.notices.filter((e) => e.pile === 'printed')
  const printedCount = printed.length
  for (const e of input.notices) {
    const base = { kind: 'notice' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.earliestDeadline, daysLeft: e.daysLeft, severity: e.severity }
    const pane = (pile: LienDeskPile): LienNextUpTarget => ({ open: 'notices', jobId: e.jobId, pile })
    // A notice that went inside thirty days (v2.6624, punch list #248): its courtesy, letter-two and promise rows ride on the
    // row's own pile — Sent while nothing is due, To draft once new months are — so one job's draft row and its reminder row
    // stand together on To do, and the press opens the pane whose footer carries the door.
    if (e.pile === 'sent' || e.sentItem) {
      const two = input.letterTwoByJob[e.jobId]
      const courtesy = input.courtesyByJob?.[e.jobId]
      const courtesyDue = Boolean(courtesy && courtesyIsDue(courtesy))
      const twoDue = Boolean(two && letterTwoIsDue(two))
      // The rung on the REMINDERS ladder (punch list #262): the row's dots and the strip's narrowing read it; it changes no rule of when a row appears.
      const reminder = lienReminderAt(courtesy, two)
      const target = pane(e.pile)
      // Paying it down (PR 3 of #274): a payment since the packet is an answer, so no reminder leads; the row asks what they promised for the rest, quiet once a promise is on record.
      if (courtesy?.state === 'paying') push({ ...base, key: `promise:${e.jobId}`, sub: courtesy.words, dueOn: null, daysLeft: null, severity: courtesy.paying?.promisedYmd ? 'quiet' : 'amber', action: 'promise', button: office ? BUTTON.promise : null, target, reminder })
      // The courtesy notice (punch list #231) is the light step, so it leads while none has gone, even past day 10; once one went, letter two leads from day 10 with the courtesy's state in its words.
      else if (courtesyDue && (!twoDue || !courtesy!.lastSentAt)) push({ ...base, key: `courtesy:${e.jobId}`, sub: courtesy!.words, dueOn: null, daysLeft: null, severity: two?.state === 'overdue' ? 'red' : 'amber', action: 'courtesy', button: office ? BUTTON.courtesy : null, target, reminder })
      else if (two && twoDue) push({ ...base, key: `letter-two:${e.jobId}`, sub: `${two.words || 'The attorney’s letter is due'}${courtesy?.lastSentAt ? ` · ${courtesy.words}` : ''}`, dueOn: null, daysLeft: null, severity: two.state === 'overdue' ? 'red' : 'amber', action: 'letter_two', button: office ? BUTTON.letter_two : null, target, reminder })
    }
    switch (e.pile) {
      case 'needs_owner':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Needs the owner of record', detail: monthsOf(e), action: 'find_owner', target: pane('needs_owner') })
        break
      case 'to_draft': {
        // A notice on record that names other months (punch list #353, part 2): the row says which month still owes one, and
        // offers the two ways it may be wrong beside the draft. With no notice on record the row keeps its plain words.
        const owedWords = lienNoticeOwedWords(e.dueMonths, input.noticeMonthsByJob?.[e.jobId] ?? [])
        const owed = lienNoticeOwedMonths(e)
        push({
          ...base,
          key: `notice:${e.jobId}`,
          sub: owedWords ?? 'Notice to send',
          detail: owedWords ?? monthsOf(e),
          action: 'draft',
          target: pane('to_draft'),
          ...(owedWords && canAct
            ? {
                doors: [
                  { words: LIEN_NOTICE_OWED_DOORS.named(owed), target: { open: 'notice_record_months' as const, jobId: e.jobId, months: owed } },
                  { words: LIEN_NOTICE_OWED_DOORS.lastDay, target: { open: 'lien_window' as const, jobId: e.jobId, tab: 'notice' as const, openLastWork: true as const } },
                ],
              }
            : {}),
        })
        break
      }
      case 'awaiting': {
        const a = awaiting(e.jobId, e.item)
        push({ ...base, key: `notice:${e.jobId}`, sub: a.sub, detail: a.detail, action: a.action, button: a.button, target: pane('awaiting') })
        break
      }
      case 'ready': {
        // Unsigned (v2.5087): the run holds it until the leader's name is on it — his own row with Sign, whatever the GC's count; the office's row says it waits.
        const unsigned = lienItemUnsigned(e.item)
        if (unsigned && leads(e.jobId)) {
          push({ ...base, key: `notice:${e.jobId}`, sub: e.item?.approval_mode === 'word' ? 'Approved on your word · unsigned' : 'Approved · unsigned', action: 'sign', button: BUTTON.sign, target: pane('ready') })
          break
        }
        // A pen record the leader has not confirmed (the pen train, PR 3), or a signature by his code on someone else's screen (v2.5791): his own row, first on the list; it blocks nothing, so the office's row is the ready one below.
        if (leads(e.jobId) && e.item && lienPenAwaitsConfirm(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields))) {
          const cols = signatureColumnsOf(e.item)
          const day = cols.signed_at ? calendarYmdInAppTzFromIso(cols.signed_at) : ''
          const dayWords = /^\d{4}-\d{2}-\d{2}$/.test(day) ? ` ${formatYmdMonthDay(day)}` : ''
          if (cols.signer_signature_mode === 'code') {
            const screen = (cols.signed_on_device_of ? input.userName?.(cols.signed_on_device_of) : null)?.trim() || 'the office'
            push({ ...base, key: `notice:${e.jobId}`, sub: `Signed with your code${dayWords} · on ${screen}’s screen`, action: 'confirm_pen', button: BUTTON.confirm_pen, target: pane('ready') })
            break
          }
          const who = (cols.signed_recorded_by ? input.userName?.(cols.signed_recorded_by) : null)?.trim() || 'the office'
          push({ ...base, key: `notice:${e.jobId}`, sub: `Signed by pen${dayWords} · recorded by ${who}`, action: 'confirm_pen', button: BUTTON.confirm_pen, target: pane('ready') })
          break
        }
        // A GC with several ready is one row below; a single job is its own row. Its Print and mail (v2.7442) opens the run on
        // its GC, which holds this one notice, as the GC's row does; the row itself still opens the notice.
        if (e.gcCustomerId && (readyByGc.get(e.gcCustomerId)?.length ?? 0) > 1) break
        const offer = lienOfferFromItem(e.item)
        // The line on a phone is the pile's name (v2.7448; *Approved · ready to send* until then). A computer's row starts with its bin, so `detail` says
        // only what the bin does not: the tick the notice lacks, in the run checklist's words, the offer, and who has yet to sign.
        const offerWords = offer ? lienOfferChipWords(offer).replace(/^Offer/, 'offer') : ''
        const unsignedWords = unsigned ? `not signed, waits on ${input.leaderName?.(e.jobId)?.trim() || 'the leader'}` : ''
        push({ ...base, key: `notice:${e.jobId}`, sub: [LIEN_RUN_STEP.toPrint, offerWords, unsignedWords].filter(Boolean).join(' · '), detail: [lienRunRowLine(false, !unsigned, false), offerWords, unsignedWords].filter(Boolean).join(' · '), action: 'send', button: office ? BUTTON.send : null, target: e.gcCustomerId ? { open: 'run', gcId: e.gcCustomerId } : pane('ready') })
        break
      }
      case 'printed':
        // Two or more printed are one run row below (punch list #101); one keeps its own row.
        if (printedCount > 1) break
        // Approved · to mail (the pile's name since v2.7434; *In the run* since v2.7328): the row names the tick the notice waits on, as the pile's row does.
        push({ ...base, key: `notice:${e.jobId}`, sub: `${LIEN_RUN_STEP.toMail} · ${lienRunRowLine(true, !!e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) !== 'unsigned', false)}`, detail: lienRunRowLine(true, !!e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) !== 'unsigned', false), action: 'add_tracking', button: office ? BUTTON.add_tracking : null, target: pane('printed') })
        break
      case 'held':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Held', detail: '', action: 'review_hold', target: pane('held') })
        break
      case 'sent':
        // Its rows are the reminders above (v2.6624); a Sent row has no notice of its own to draft.
        break
      case 'missed':
        // Months still open are drafted as on any other row; a closed window nobody wrote down is noted.
        if (e.dueMonths.length > 0) push({ ...base, key: `notice:${e.jobId}`, sub: 'Notice to send · a window closed', detail: [monthsOf(e), 'a window closed'].filter(Boolean).join(' · '), action: 'draft', target: pane('missed') })
        else {
          // v2.4708: every window closed unsent, but the affidavit's own window is still open — a late notice can still carry it (the owner's reading, 2026-10-06).
          const aff = input.affidavits.find((a) => a.jobId === e.jobId)
          const lateOpen = aff && aff.pile !== 'filed' && aff.deadline && aff.deadline >= input.todayYmd && e.missedMonths.length > 0
          if (lateOpen) push({ ...base, key: `notice:${e.jobId}`, sub: 'Late notice to send · the window closed, the affidavit is still open', dueOn: aff.deadline, daysLeft: aff.daysLeft, severity: aff.severity, action: 'draft_late', button: office ? BUTTON.draft_late : null, target: pane('missed') })
          else if (e.missedUnrecorded.length > 0) push({ ...base, key: `notice:${e.jobId}`, sub: 'A window closed with nothing recorded', dueOn: null, daysLeft: null, severity: 'red', action: 'note_missed', button: office ? BUTTON.note_missed : null, target: pane('missed') })
        }
        break
    }
  }
  const unsignedIn = (list: ReadonlyArray<LienDeskEntry>) => list.filter((e) => lienItemUnsigned(e.item)).length
  for (const [gcId, list] of readyByGc) {
    if (list.length < 2) continue
    const dated = list.filter((e) => e.earliestDeadline).sort((a, b) => (a.earliestDeadline! < b.earliestDeadline! ? -1 : 1))
    const first = dated[0] ?? null
    push({
      kind: 'notice',
      key: `run:${gcId}`,
      jobId: null,
      gcId,
      title: input.gcName(gcId),
      sub: `${list.length} notices approved · to print`,
      // A computer's row starts with its bin, so the detail never says it again (v2.7448): how many, the tick they lack, and how many of them the leader has yet to sign.
      detail: [`${list.length} notices`, lienRunRowLine(false, true, false), unsignedIn(list) > 0 ? `${unsignedIn(list)} not signed` : ''].filter(Boolean).join(' · '),
      dueOn: first?.earliestDeadline ?? null,
      daysLeft: first?.daysLeft ?? null,
      severity: list.some((e) => e.severity === 'red') ? 'red' : list.some((e) => e.severity === 'amber') ? 'amber' : 'quiet',
      action: 'send_run',
      button: office ? `${BUTTON.send_run} ${list.length}` : null,
      target: { open: 'run', gcId },
    })
  }

  // The printed notices as one row (punch list #101): one run, one window, one question — mailed, or taken back?
  if (printedCount > 1) {
    const byDay = [...printed].sort((a, b) => ((a.earliestDeadline ?? '9999') < (b.earliestDeadline ?? '9999') ? -1 : (a.earliestDeadline ?? '9999') > (b.earliestDeadline ?? '9999') ? 1 : 0))
    const first = byDay.find((e) => e.earliestDeadline) ?? null
    push({
      kind: 'notice',
      key: 'run:printed',
      jobId: null,
      gcId: null,
      title: `${printedCount} notices ${lienPrintedDaysWords(printed.map((e) => (e.item as { printed_at?: string | null } | null)?.printed_at ?? null))}`.trim(),
      sub: 'A checklist: tick Printed, Signed and Mailed on each. Mailed? Type each envelope’s number. Not mailing them? Take the print back.',
      dueOn: first?.earliestDeadline ?? null,
      daysLeft: first?.daysLeft ?? null,
      severity: printed.some((e) => e.severity === 'red') ? 'red' : printed.some((e) => e.severity === 'amber') ? 'amber' : 'quiet',
      action: 'record_mailing',
      button: office ? BUTTON.record_mailing : null,
      target: { open: 'run', gcId: null },
      secondary: office ? { words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } } : null,
      jobs: byDay.map((e) => ({ jobId: e.jobId, title: input.jobTitle(e.jobId), dueOn: e.earliestDeadline })),
    })
  }

  // ---- § 53.052 affidavits ----
  for (const e of input.affidavits) {
    const base = { kind: 'affidavit' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.deadline || null, daysLeft: e.deadline ? e.daysLeft : null, severity: e.severity, target: { open: 'affidavits', jobId: e.jobId } as LienNextUpTarget }
    const key = `affidavit:${e.jobId}`
    // A paper a fact holds, by that fact (the body of *Needs the property facts*). `approved` (punch list #335) is a paper
    // a gate closed on after its approval: it sits in Held, the row still asks the one question, and says the approval stands.
    const pushHold = (approved: boolean) => {
      const stands = approved ? ' The approval stands.' : ''
      // Not lienable… (v2.7526, the owner's pick of 2026-11-16): a paper a fact holds is where a job with no lien behind
      // it shows up, so the office's row offers the door that takes the one job off the lien path, with a reason. A
      // public owner's row has none: that answer is the property's, and its own window takes every job there.
      const offPath = office ? { doors: [{ words: LIEN_JOB_PATH_DOOR, target: { open: 'job_path' as const, jobId: e.jobId } }] } : {}
      const lead = approved ? 'Affidavit approved, held · ' : 'Affidavit · '
      // v2.4708: when the notice is the one gate left, the move is the late notice, not the property record.
      const failing = e.gates.filter((g) => !g.ok).map((g) => g.key)
      if (failing.length === 1 && failing[0] === 'notice') {
        // Where that notice stands (`lienAffidavitNoticeStanding.ts`, v2.7457): the row says it, and the press goes to the step
        // that is really next. A notice already approved is printed and mailed from the run, never *sent first* again.
        const notice = input.notices.find((n) => n.jobId === e.jobId) ?? null
        const found = lienAffidavitNoticeStanding(e, notice)
        const standing = lienAffidavitNoticeWaits(found) ? found : 'late'
        const words = lienAffidavitNoticeWords(standing, { leader: input.leaderName?.(e.jobId) })
        const pane: LienNextUpTarget = { open: 'notices', jobId: e.jobId, pile: standing === 'late' ? 'missed' : lienAffidavitNoticePile(notice) }
        const press: { button: string | null; target: LienNextUpTarget } =
          standing === 'approved'
            ? { button: office ? BUTTON.send : null, target: notice?.gcCustomerId ? { open: 'run', gcId: notice.gcCustomerId } : pane }
            : standing === 'printed'
              ? { button: office ? BUTTON.record_mailing : null, target: { open: 'run', gcId: null } }
              : standing === 'late'
                ? { button: office ? BUTTON.send_notice : null, target: pane }
                : { button: canAct ? 'Open the notice' : null, target: pane }
        push({ ...base, key, sub: `${lead}${words.sub}`, detail: `${words.detail}${stands}`, action: 'send_notice', ...press, ...offPath })
      }
      // Punch list #305: when the property record is whole and the GC's address is what is missing, the row says so.
      // Punch list #314: a public owner is not a record to fix. The row says so and offers no press.
      else if (failing.includes('public_owner')) push({ ...base, key, sub: `${lead}public property, no lien attaches. Ask the attorney about the bond`, detail: 'Public property, no lien attaches. Ask the attorney about the bond.', action: 'fix_property', button: null })
      else if (failing.includes('contractor') && !failing.some((k) => k === 'owner' || k === 'legal' || k === 'homestead' || k === 'homestead_answer')) push({ ...base, key, sub: `${lead}the general contractor has no address on file`, detail: `The general contractor has no address on file.${stands}`, action: 'fix_property', button: canAct ? 'Add the address' : null, ...offPath })
      else {
        // The hold by name (v2.7372, punch list #362 step 3): the one fact the affidavit waits on, in `gateAct`'s words, on
        // the row and on its button. Until then every hold read *the property record is not complete*, whatever the gate.
        const hold = lienGateHoldWords(failing)
        push({ ...base, key, sub: `${lead}${hold.sub}`, detail: `${hold.detail}${stands}`, action: 'fix_property', button: canAct ? hold.button : null, ...offPath })
      }
    }
    switch (e.pile) {
      case 'needs_property':
      case 'needs_notice':
        pushHold(false)
        break
      case 'to_draft':
        push({ ...base, key, sub: 'Affidavit to send', detail: '', action: 'draft', button: canAct ? 'Open the affidavit' : null })
        break
      case 'awaiting': {
        const a = awaiting(e.jobId, e.item)
        push({ ...base, key, sub: `Affidavit · ${a.sub.charAt(0).toLowerCase()}${a.sub.slice(1)}`, detail: a.detail, action: a.action, button: a.button })
        break
      }
      case 'ready':
        push({ ...base, key, sub: 'Affidavit approved · ready to file', detail: '', action: 'file_affidavit', button: office ? BUTTON.file_affidavit : null })
        break
      case 'held':
        // Held by a gate that closed after the approval (punch list #335): the gate's question and its door. Held by the leader: his hold to review.
        if (lienAffidavitGateHeld(e)) pushHold(true)
        else push({ ...base, key, sub: 'Affidavit held', detail: '', action: 'review_hold' })
        break
      case 'filed':
      case 'missed':
        break
    }
  }
  // A filed lien's copies (punch list #366): the row says what is owed and by when, and turns red the day before its day.
  for (const s of input.serveDue ?? []) {
    const clock = lienServeClock(s.serveDue, input.todayYmd)
    const daysLeft = clock.serveDue ? clock.daysLeft : daysBetween(input.todayYmd, s.serveDue)
    push({ kind: 'affidavit', key: `serve:${s.jobId}`, jobId: s.jobId, gcId: null, title: input.jobTitle(s.jobId), sub: lienServeRowWords(clock), dueOn: s.serveDue, daysLeft, severity: clock.late || daysLeft <= 1 ? 'red' : 'amber', action: 'record_service', serveStage: s.stage ?? 'print', button: office ? LIEN_SERVE_STAGE_WORDS[s.stage ?? 'print'] : null, target: { open: 'lien_window', jobId: s.jobId, tab: 'affidavit' } })
  }

  // ---- § 53.057 retainage ----
  for (const e of input.retainage) {
    const base = { kind: 'retainage' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.deadline, daysLeft: e.daysLeft, severity: e.severity, target: { open: 'retainage', jobId: e.jobId } as LienNextUpTarget }
    const key = `retainage:${e.jobId}`
    switch (e.pile) {
      case 'needs_owner':
        push({ ...base, key, sub: 'Retainage · needs the owner of record', action: 'find_owner' })
        break
      case 'to_draft':
        push({ ...base, key, sub: 'Retainage notice to send', action: 'draft' })
        break
      case 'awaiting': {
        const a = awaiting(e.jobId, e.item)
        push({ ...base, key, sub: `Retainage · ${a.sub.charAt(0).toLowerCase()}${a.sub.slice(1)}`, action: a.action, button: a.button })
        break
      }
      case 'ready':
        push({ ...base, key, sub: 'Retainage notice approved · to mail', action: 'send', button: office ? BUTTON.send : null })
        break
      case 'held':
        push({ ...base, key, sub: 'Retainage held', action: 'review_hold' })
        break
      case 'clock_not_started':
      case 'sent':
      case 'missed':
        break
    }
  }

  // Retainage nobody recorded: no clock runs and no notice names it until the office answers, so the row stands under
  // Needs you now with no day of its own. The office's press (a master is office too); any other role reads the row.
  // A retainage row has no bin on the Board, so its reason rides in the row's own words as well as its detail.
  for (const u of input.retainageUnrecorded ?? []) {
    rows.push({ key: `retainage-unrecorded:${u.jobId}`, kind: 'retainage', jobId: u.jobId, gcId: null, title: u.title, sub: u.why ? `${LIEN_RETAINAGE_UNRECORDED_SUB} · ${u.why}` : LIEN_RETAINAGE_UNRECORDED_SUB, detail: u.why, dueOn: null, daysLeft: null, severity: 'amber', group: 'now', action: 'record_retainage', button: office ? BUTTON.record_retainage : null, target: { open: 'retainage_unrecorded', jobId: u.jobId } })
  }

  // An envelope the provider mailed that came back or went unclaimed (the Docsmit train, 6b): the office's row, under Needs you now, opening the notice under Sent whose footer has the doors.
  for (const m of input.mailNeedsYou ?? []) {
    rows.push({ key: `mail:${m.pieceId}`, kind: 'notice', jobId: m.jobId, gcId: null, title: input.jobTitle(m.jobId), sub: `Docsmit · ${m.who.toLowerCase()} · ${m.words}`, dueOn: null, daysLeft: null, severity: 'red', group: 'now', action: 'mail_needs_you', button: office ? BUTTON.mail_needs_you : null, target: { open: 'notices', jobId: m.jobId, pile: input.notices.find((e) => e.jobId === m.jobId)?.pile ?? 'sent' } })
  }

  return rows.sort(compareRows)
}

/** How long an approval has waited: *today*, *1 day*, *39 days*. */
export function lienWaitedWords(days: number): string {
  if (days <= 0) return 'today'
  return `waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * An affidavit held by its property facts, by name (v2.7372): what the row says, the one thing to know after its
 * stage, and the press, all from `gateAct` (`lienActWords.ts`), so the row, the Pipeline's lien line and the chip
 * say one thing. One fact missing asks for that fact; several say the record is missing facts.
 */
export function lienGateHoldWords(missing: ReadonlyArray<string>): { sub: string; detail: string; button: string } {
  const act = lienActFor({ paper: 'affidavit', action: 'fix_property', missing: missing as Parameters<typeof lienActFor>[0]['missing'] })
  // Several facts missing: the row names each, so the press that opens the record is not a guess at what it wants.
  const names = missing.map((k) => GATE_FACT[k]).filter((n): n is string => Boolean(n))
  const several = missing.length > 1 && names.length === missing.length && !missing.includes('public_owner') && !missing.includes('homestead')
  const whole = act?.why ?? 'The property record is missing facts the affidavit needs.'
  const why = several ? `The affidavit still needs ${names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}.` : whole.split(/(?<=\.)\s+/)[0]!
  const lower = `${why.charAt(0).toLowerCase()}${why.slice(1)}`.replace(/\.$/, '')
  // An act that is a finding and not a press (*Homestead, ask the attorney*) keeps both its sentences on the row, and
  // the press says what it opens.
  const finding = !several && /,/.test(act?.words ?? '')
  return { sub: lower, detail: finding ? whole : why, button: finding ? 'Open the property record' : (act?.words ?? 'Fix the property record') }
}

/** A gate's fact as a few words, for a row that waits on more than one. */
const GATE_FACT: Record<string, string> = {
  owner: 'the owner of record',
  legal: 'the legal description',
  contractor: 'the GC’s address',
  notice: 'a § 53.056 notice',
  homestead_answer: 'the homestead answer',
}

/** "printed Oct 7", "printed Oct 7 to Oct 8", or "" with no day: the run row's title (punch list #101). */
export function lienPrintedDaysWords(stamps: ReadonlyArray<string | null>): string {
  const days = Array.from(new Set(stamps.filter((s): s is string => Boolean(s)).map((s) => calendarYmdInAppTzFromIso(s)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort()
  if (days.length === 0) return 'printed'
  const a = formatYmdMonthDay(days[0]!)
  const b = formatYmdMonthDay(days[days.length - 1]!)
  return a === b ? `printed ${a}` : `printed ${a} to ${b}`
}

/** An approval only the leader can give (punch list #101 PR 3): his, when the row has his button; the office waits on it. */
function approvalGroup(r: LienNextUpRow): 'sign' | 'pen' | 'mine' | 'waiting' | null {
  if (r.action === 'sign') return 'sign'
  if (r.action === 'confirm_pen') return 'pen'
  if (r.action !== 'approve') return null
  return r.button ? 'mine' : 'waiting'
}

/** A sent notice's follow-up row (punch list #262): the courtesy press, letter two's, or the promise press while they pay (PR 3 of #274), with no day of its own. */
export function isLienReminderRow(r: Pick<LienNextUpRow, 'action'>): boolean {
  return r.action === 'courtesy' || r.action === 'letter_two' || r.action === 'promise'
}

export type LienNextUpGrouped = {
  group: LienNextUpGroup
  label: string
  rows: LienNextUpRow[]
  /** One of the parts *Needs you now* reads in (v2.7371): drawn under that head, with its own smaller one. */
  part?: true
}

export type LienNextUpGroupOpts = {
  waitingOn?: string | null
  /** The stages a row's paper still has to pass when it will not make its day, else null (`lienBoardRowRisk`). Absent, no row is at risk. */
  risk?: (row: LienNextUpRow) => number | null
  /** The head over the rows at risk, in the Board's own words for that many: *Will not make tomorrow as they stand*. */
  riskLabel?: (n: number) => string
  /** What a row's job still owes, for *largest first* inside a day; absent, a day's rows keep the desk's order. */
  amount?: (row: LienNextUpRow) => number | null
}

/** The part of a row's key before the colon: the paper's kind as the desk's order knows it (`affidavit`, `notice`, `retainage`, `run`, `serve`). */
const keyKind = (r: LienNextUpRow) => r.key.slice(0, r.key.indexOf(':') < 0 ? r.key.length : r.key.indexOf(':'))

/** By the last day, a row with none after the dated ones; then the kind of paper; then the largest first; then the key. */
function compareByDay(amount: LienNextUpGroupOpts['amount']) {
  return (a: LienNextUpRow, b: LienNextUpRow): number => {
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1
    if (!!a.dueOn !== !!b.dueOn) return a.dueOn ? -1 : 1
    const ka = keyKind(a)
    const kb = keyKind(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    const na = amount?.(a) ?? null
    const nb = amount?.(b) ?? null
    if (na != null && nb != null && na !== nb) return nb - na
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  }
}

/**
 * The groups, in order, each with its rows — what the view draws. The leader's approvals lead as
 * *Only you can approve*; the rest run by day (*Needs you now*, *Coming up*), with the sent
 * notices' reminders between them as *Reminders* (punch list #262) so the red group holds dated
 * work.
 *
 * Since v2.7371 (punch list #362, step 2; Taunya's order of 2026-11-15) *Needs you now* reads in
 * up to three parts. First the rows that will not make their day as they stand (`risk`), the
 * longest road first: a paper that needs a fact needs it today to go out with the rest. Then the
 * approvals the office waits on, *Waiting on <leader>* (`waitingOn`, else *the leader*), where a
 * person can act on them. Then the rest, *On track*. A desk with nothing at risk and nothing
 * waiting keeps the one group, *Needs you now*. Inside a day the kinds stay together and the
 * largest comes first (`amount`).
 */
export function groupLienNextUp(rows: ReadonlyArray<LienNextUpRow>, opts: LienNextUpGroupOpts = {}): LienNextUpGrouped[] {
  const sign = rows.filter((r) => approvalGroup(r) === 'sign')
  const pen = rows.filter((r) => approvalGroup(r) === 'pen')
  const mine = rows.filter((r) => approvalGroup(r) === 'mine')
  const waiting = rows.filter((r) => approvalGroup(r) === 'waiting')
  const rest = rows.filter((r) => approvalGroup(r) == null)
  const reminders = rest.filter(isLienReminderRow)
  const byDay = compareByDay(opts.amount)
  const nowAll = rest.filter((r) => r.group === 'now' && !isLienReminderRow(r))
  const steps = (r: LienNextUpRow) => opts.risk?.(r) ?? null
  const risk = nowAll.filter((r) => steps(r) != null).sort((a, b) => steps(b)! - steps(a)! || byDay(a, b))
  const track = nowAll.filter((r) => steps(r) == null).sort(byDay)
  const coming = rest.filter((r) => r.group === 'coming' && !isLienReminderRow(r)).sort(byDay)
  // In parts when there is something to put above the rest: a row at risk, or an approval waiting over rows on track.
  const parts = risk.length > 0 || (waiting.length > 0 && track.length > 0)
  const part = parts ? { part: true as const } : {}
  return [
    ...(sign.length ? [{ group: 'sign' as const, label: 'Only you can sign', rows: sign }] : []),
    ...(pen.length ? [{ group: 'pen' as const, label: pen.every((r) => r.sub.startsWith('Signed with your code')) ? 'Signed with your code, as recorded' : pen.some((r) => r.sub.startsWith('Signed with your code')) ? 'Signed by pen or code, as recorded' : 'Signed by pen, as recorded', rows: pen }] : []),
    ...(mine.length ? [{ group: 'mine' as const, label: 'Only you can approve', rows: mine }] : []),
    ...(risk.length ? [{ group: 'risk' as const, label: opts.riskLabel?.(risk.length).trim() || `Will not make ${risk.length === 1 ? 'its day as it stands' : 'their day as they stand'}`, rows: risk, ...part }] : []),
    // *to approve* since v2.7448: these rows are the papers the leader has yet to approve, one of the two parts the Board's tile counts.
    ...(waiting.length ? [{ group: 'waiting' as const, label: `Waiting on ${opts.waitingOn?.trim() || 'the leader'} to approve`, rows: waiting, ...part }] : []),
    ...(track.length ? [{ group: 'now' as const, label: parts ? 'On track' : 'Needs you now', rows: track, ...part }] : []),
    ...(reminders.length ? [{ group: 'reminders' as const, label: 'Reminders', rows: reminders }] : []),
    ...(coming.length ? [{ group: 'coming' as const, label: 'Coming up', rows: coming }] : []),
  ]
}

/**
 * The head over the parts of *Needs you now* (v2.7371), or null when the list has no parts: how many rows this
 * viewer can move (the ones at risk and the ones on track), and how many more wait on the leader, in a few words.
 */
export function lienNextUpNowHead(groups: ReadonlyArray<Pick<LienNextUpGrouped, 'group' | 'label' | 'rows' | 'part'>>): { label: string; count: number; waiting: string | null } | null {
  const parts = groups.filter((g) => g.part)
  if (parts.length === 0) return null
  const count = parts.filter((g) => g.group !== 'waiting').reduce((n, g) => n + g.rows.length, 0)
  const waiting = parts.find((g) => g.group === 'waiting')
  return { label: 'Needs you now', count, waiting: waiting ? `${waiting.rows.length} ${waiting.label.charAt(0).toLowerCase()}${waiting.label.slice(1)}` : null }
}

/** To do's count (punch list #101 PR 3): every row but the ones waiting on the leader — what this viewer can move. */
export function lienNextUpCount(rows: ReadonlyArray<LienNextUpRow>): number {
  return rows.filter((r) => approvalGroup(r) !== 'waiting').length
}
