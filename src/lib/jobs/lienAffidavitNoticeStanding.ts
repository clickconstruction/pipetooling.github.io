/**
 * Where an affidavit's § 53.056 notice stands while the affidavit waits on it. Pure.
 *
 * The affidavit's `notice` gate opens only when a mailing is on record: a `job_lien_filings` row of the notice's
 * kind, which the run writes when the envelope's numbers are typed. Until then every screen said one thing,
 * *Send the § 53.056 notice first* under the tag *No notice on record*, and the row's press opened Monthly notices
 * on the Missed pile. On 2026-11-16 every affidavit that waited on its notice had a notice already approved and
 * standing in the run, so the words read as if nothing had been started and the press landed where the job was not.
 *
 * The gate is right and stays as it is. This file says where the notice stands, from the notice's own row on the
 * desk (`LienDeskEntry.pile`), and holds every string a screen needs for it: the To do row and its tag, the
 * affidavit pane's gate row, its band, its hold line and its short chip. `late` is the case the old words were
 * written for (no notice started and no month still open) and keeps them to the letter.
 */
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitGate } from './lienDeskAffidavits'
import type { LienRowTag } from './lienRowWords'

export type LienAffidavitNoticeStanding =
  /** Contracted with the owner: no monthly notice is required. */
  | 'not_needed'
  /** A mailing is on record: the gate is open. */
  | 'on_record'
  /** Nothing started and no month still open: the late notice, while the affidavit's own window is open. */
  | 'late'
  | 'needs_owner'
  /** A month is open and no notice is sent for approval yet. */
  | 'to_send'
  | 'awaiting'
  | 'held'
  /** Approved and not printed: it stands in the run. */
  | 'approved'
  /** Printed and not mailed: the run waits on the envelope's numbers. */
  | 'printed'
  /** Marked sent on the desk with no mailing on record. */
  | 'unrecorded'

/** The standings in which the gate is closed. */
export type LienAffidavitNoticeWaiting = Exclude<LienAffidavitNoticeStanding, 'not_needed' | 'on_record'>

export function lienAffidavitNoticeStanding(
  aff: { isSub: boolean; gates: ReadonlyArray<Pick<LienAffidavitGate, 'key' | 'ok'>> },
  notice: Pick<LienDeskEntry, 'pile' | 'dueMonths'> | null | undefined,
): LienAffidavitNoticeStanding {
  if (!aff.isSub) return 'not_needed'
  if (aff.gates.find((g) => g.key === 'notice')?.ok) return 'on_record'
  if (!notice) return 'late'
  switch (notice.pile) {
    case 'needs_owner':
      return 'needs_owner'
    case 'to_draft':
      return 'to_send'
    case 'awaiting':
      return 'awaiting'
    case 'held':
      return 'held'
    case 'ready':
      return 'approved'
    case 'printed':
      return 'printed'
    case 'sent':
      return 'unrecorded'
    case 'missed':
      return notice.dueMonths.length > 0 ? 'to_send' : 'late'
  }
}

/**
 * The standing from the notice's place on the desk alone, for a reader that holds no desk row: the Lien window is
 * handed the notice's pile by its opener (`lienWindowDeskNotice`). `''` or nothing is a reader that cannot know, and
 * gives null, so its words stay the late notice's.
 */
export function lienAffidavitNoticeStandingOnDesk(pile: LienDeskPile | '' | null | undefined): LienAffidavitNoticeWaiting | null {
  if (!pile) return null
  const standing = lienAffidavitNoticeStanding({ isSub: true, gates: [{ key: 'notice', ok: false }] }, { pile, dueMonths: [] })
  return lienAffidavitNoticeWaits(standing) ? standing : null
}

/** Whether the gate is closed in this standing. */
export function lienAffidavitNoticeWaits(standing: LienAffidavitNoticeStanding | null | undefined): standing is LienAffidavitNoticeWaiting {
  return standing != null && standing !== 'not_needed' && standing !== 'on_record'
}

export type LienAffidavitNoticeWords = {
  /** The To do row's tag. */
  tag: LienRowTag
  /** The To do row's words after *Affidavit ·*, lower case. */
  sub: string
  /** The To do row's one thing to know, and the chip's card under its stage. */
  detail: string
  /** The pane's gate row, after its label; '' when the row has nothing to add. */
  fact: string
  /** The pane's gate row's door. */
  door: string
  /** The pane's band press. */
  band: string
  /** The pane's hold line after *Don't file yet.* */
  foot: string
  /** The pane's red chip and the gates head's tail. */
  short: string
}

const OPEN_DOOR = 'Open the notice ›'
const MAIL_FIRST = 'Mail the notice first ›'
const MUST_GO = 'It must be mailed and recorded first.'

/** Every string a screen needs for a notice the affidavit still waits on. `leader` is the job's leader by name; absent reads *the leader*. */
export function lienAffidavitNoticeWords(standing: LienAffidavitNoticeWaiting, opts: { leader?: string | null } = {}): LienAffidavitNoticeWords {
  const warn = (words: string): LienRowTag => ({ tone: 'warn', words })
  const leader = opts.leader?.trim() || 'the leader'
  switch (standing) {
    case 'late':
      return {
        tag: warn('No notice on record'),
        sub: 'send the § 53.056 notice first — late is allowed while this window is open',
        detail: 'Send the § 53.056 notice first. Late is allowed while this window is open.',
        fact: '',
        door: 'Send the notice first ›',
        band: 'Send the notice first ›',
        foot: 'Send the § 53.056 notice first. A late one counts while this window is open.',
        short: 'no § 53.056 notice on the job',
      }
    case 'approved':
      return {
        tag: warn('Notice approved · not mailed yet'),
        sub: 'its § 53.056 notice is approved and not mailed yet',
        detail: 'Its § 53.056 notice is approved and not mailed yet.',
        fact: 'approved · not mailed yet',
        door: OPEN_DOOR,
        band: MAIL_FIRST,
        foot: 'The § 53.056 notice is approved and not mailed yet. Mail it and record the mailing first.',
        short: '§ 53.056 notice not mailed yet',
      }
    case 'printed':
      return {
        tag: warn('Notice printed · not mailed yet'),
        sub: 'its § 53.056 notice is printed and not mailed yet',
        detail: 'Its § 53.056 notice is printed and not mailed yet.',
        fact: 'printed · not mailed yet',
        door: OPEN_DOOR,
        band: MAIL_FIRST,
        foot: 'The § 53.056 notice is printed and not mailed yet. Mail it and record the mailing first.',
        short: '§ 53.056 notice not mailed yet',
      }
    case 'awaiting':
      return {
        tag: warn('Notice awaiting approval'),
        sub: `its § 53.056 notice waits on ${leader}’s approval`,
        detail: `Its § 53.056 notice waits on ${leader}’s approval.`,
        fact: 'awaiting approval',
        door: OPEN_DOOR,
        band: OPEN_DOOR,
        foot: `The § 53.056 notice waits on ${leader}’s approval. ${MUST_GO}`,
        short: '§ 53.056 notice awaiting approval',
      }
    case 'to_send':
      return {
        tag: warn('Notice not sent for approval yet'),
        sub: 'its § 53.056 notice is not sent for approval yet',
        detail: 'Its § 53.056 notice is not sent for approval yet.',
        fact: 'not sent for approval yet',
        door: OPEN_DOOR,
        band: OPEN_DOOR,
        foot: `The § 53.056 notice is not sent for approval yet. ${MUST_GO}`,
        short: '§ 53.056 notice not sent for approval',
      }
    case 'held':
      return {
        tag: warn('Notice held'),
        sub: 'its § 53.056 notice is held',
        detail: 'Its § 53.056 notice is held.',
        fact: 'held',
        door: OPEN_DOOR,
        band: OPEN_DOOR,
        foot: `The § 53.056 notice is held. ${MUST_GO}`,
        short: '§ 53.056 notice held',
      }
    case 'needs_owner':
      return {
        tag: warn('Notice needs the owner'),
        sub: 'its § 53.056 notice needs the owner of record',
        detail: 'Its § 53.056 notice needs the owner of record.',
        fact: 'needs the owner of record',
        door: OPEN_DOOR,
        band: OPEN_DOOR,
        foot: `The § 53.056 notice needs the owner of record. ${MUST_GO}`,
        short: '§ 53.056 notice needs the owner',
      }
    case 'unrecorded':
      return {
        tag: warn('Notice sent · no mailing on record'),
        sub: 'its § 53.056 notice is marked sent with no mailing on record',
        detail: 'Its § 53.056 notice is marked sent with no mailing on record.',
        fact: 'sent · no mailing on record',
        door: OPEN_DOOR,
        band: OPEN_DOOR,
        foot: 'The § 53.056 notice is marked sent with no mailing on record. Record the mailing first.',
        short: '§ 53.056 notice has no mailing on record',
      }
  }
}

/** The notices pile a press opens for a notice in this standing: the notice's own pile, or Missed for the late notice with no row on the desk. */
export function lienAffidavitNoticePile(notice: Pick<LienDeskEntry, 'pile'> | null | undefined): LienDeskPile {
  return notice?.pile ?? 'missed'
}
