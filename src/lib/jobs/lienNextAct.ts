/**
 * What pressing the verdict band does (v2.7321). The Lien desk's *Next on the path* band named the
 * step — *Find the owner, then send the Sep notice — tomorrow* — and a press on it did nothing, while
 * the doors sat in the gate rows under it and in the footer. The owner, 2026-11-15, pointing at the
 * band on the affidavit pane: "it should be actionable and better presented."
 *
 * This is the one table that turns the kernel's next step into a named act the pane maps to its own
 * door, derived from the same facts the words are: a notice that needs the owner opens the property
 * record at the owner, a drafted paper goes to the footer's main press, a filed affidavit's copy is
 * recorded in the Lien window. When the move is not ours — the owner's reply to a demand letter, the
 * county, counsel on a public owner — there is no act, and the band wears a quiet *Waiting on* tag
 * instead. The words stay the kernel's (`buildLienTimeline`); only the act is decided here. Pure.
 */
import type { LienAffidavitGateKey } from './lienDeskAffidavits'
import { lienAffidavitNoticeWaits, lienAffidavitNoticeWords, type LienAffidavitNoticeStanding } from './lienAffidavitNoticeStanding'
import type { LienTimelineAffidavitState, LienTimelineMove, LienTimelineNextKind, LienTimelineNoticeState } from './lienTimeline'
import { LIEN_RUN_ACT } from './lienRunWords'
import { lienServeStageDoor, type LienServeStage } from './lienServeStage'

/**
 * The doors a pane maps an act to. `gate:*` opens the record the gate reads (`owner` the property record at
 * the owner, `legal` at the county and legal description, `homestead` at the homestead question, `contractor`
 * the GC's customer record, `notice` Monthly notices on the job); `footer` is the footer's main press (send
 * for approval, approve, file); `retainage` the job's § 53.057 notice; `serve` and `release` the Lien window's
 * tab for the copy and the release; `legal_desk` the Legal desk once the lien is gone and money is still owed.
 */
export type LienNextActDoor = 'gate:owner' | 'gate:legal' | 'gate:homestead' | 'gate:contractor' | 'gate:notice' | 'footer' | 'retainage' | 'serve' | 'release' | 'legal_desk'

export type LienNextAct =
  /** Our move: the press's label, ending in ›. */
  | { kind: LienNextActDoor; label: string }
  /** Not our move, or nothing to do: `waiting` is whose move it is for the tag, null for no tag; `words` are a pane's own tag words in a move's place (*Waiting on Robert*). */
  | { kind: 'none'; waiting: LienTimelineMove | null; words?: string }

export const LIEN_NEXT_ACT_NONE: LienNextAct = { kind: 'none', waiting: null }

export type LienNextActFacts = {
  next: { kind: LienTimelineNextKind; affidavitState?: LienTimelineAffidavitState }
  /** Whose move the kernel says it is; null when nobody waits. */
  waitingOn: { who: LienTimelineMove } | null
  noticeState: LienTimelineNoticeState
  /** The affidavit's closed gates, by key, when a fact holds it. */
  missingKeys: ReadonlyArray<LienAffidavitGateKey>
  /** Where the job's notice stands while the affidavit's notice gate is closed (`lienAffidavitNoticeStanding.ts`); absent reads *Send the notice first ›*. */
  noticeStanding?: LienAffidavitNoticeStanding | null
  /** Where a filed lien's copies stand (`lienServeStage.ts`); absent reads as still to print. */
  serveStage?: LienServeStage | null
  paid: boolean
}

/** The footer's main press by where the paper stands on the desk; the file verb is the affidavit's. */
function footerLabel(state: LienTimelineNoticeState | LienTimelineAffidavitState, paper: 'notice' | 'affidavit'): string {
  switch (state) {
    case 'awaiting':
      return 'Approve it ›'
    case 'ready':
      return paper === 'affidavit' ? 'File it ›' : `${LIEN_RUN_ACT.print} ›`
    case 'printed':
      return `${LIEN_RUN_ACT.record} ›`
    case 'held':
      return 'Lift the hold ›'
    default:
      return 'Send for approval ›'
  }
}

const door = (kind: LienNextActDoor, label: string): LienNextAct => ({ kind, label })

/** The one closed gate the band opens on, in the order the affidavit's gate rows read (`affidavitGates`). */
function affidavitGateAct(keys: ReadonlyArray<LienAffidavitGateKey>, noticeStanding?: LienAffidavitNoticeStanding | null): LienNextAct {
  // No lien attaches to public property, and a homestead is the attorney's call: counsel's move.
  if (keys.includes('public_owner') || keys.includes('homestead')) return { kind: 'none', waiting: 'counsel' }
  if (keys.includes('owner')) return door('gate:owner', 'Find the owner ›')
  if (keys.includes('legal')) return door('gate:legal', 'Fill in the legal description ›')
  if (keys.includes('contractor')) return door('gate:contractor', 'Add the GC’s address ›')
  // The notice's door says what the notice still needs: a notice already approved is mailed, not sent again.
  if (keys.includes('notice')) return door('gate:notice', lienAffidavitNoticeWaits(noticeStanding) ? lienAffidavitNoticeWords(noticeStanding).band : 'Send the notice first ›')
  if (keys.includes('homestead_answer')) return door('gate:homestead', 'Answer the homestead question ›')
  return door('footer', 'Send for approval ›')
}

export function lienNextActFor(f: LienNextActFacts): LienNextAct {
  if (f.waitingOn && f.waitingOn.who !== 'ours') return { kind: 'none', waiting: f.waitingOn.who }
  switch (f.next.kind) {
    case 'notice':
      return f.noticeState === 'needs_owner' ? door('gate:owner', 'Find the owner ›') : door('footer', footerLabel(f.noticeState, 'notice'))
    case 'late_notice':
      return door('gate:notice', 'Send the late notice ›')
    case 'retainage':
      return door('retainage', 'Send the retainage notice ›')
    case 'affidavit': {
      const state = f.next.affidavitState ?? ''
      if (state === 'needs_property') return affidavitGateAct(f.missingKeys, f.noticeStanding)
      return door('footer', footerLabel(state, 'affidavit'))
    }
    case 'serve':
      // The step's stage names the press, as on every door to the copies (`lienServeStage.ts`). *Record the service ›* until v2.7798.
      return door('serve', lienServeStageDoor(f.serveStage ?? 'print'))
    case 'release':
      return door('release', 'File the release ›')
    case 'lien_gone':
      return f.paid ? LIEN_NEXT_ACT_NONE : door('legal_desk', 'Open the Legal desk ›')
    default:
      return LIEN_NEXT_ACT_NONE
  }
}
