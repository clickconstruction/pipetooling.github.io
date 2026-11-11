import { batchOutcomeWords, batchWords, countedLabel, type BatchOutcome } from '../batchWords'
import { lienAffidavitFormForItem } from './lienAffidavitForm'
import type { LienAffidavitEntry } from './lienDeskAffidavits'

/**
 * Redraw every ready affidavit on the short form in one press (punch list #305, the owner's ask of 2026-11-10 once
 * the short form was live: the liens drafted that week go out on it). Pure: which papers the press moves, which it
 * leaves with the reason, and every word around it.
 *
 * The press acts on what is ready and nothing else (`CLAUDE.md` → *Do what is ready*): an affidavit in **Ready to
 * file**, on the earlier form, not yet filed. An earlier-form paper in another pile stays where it is: one waiting on
 * the leader or held by him is his to decide, and a draft is redrawn from its own pane. Each redrawn paper goes back
 * to **To draft** and needs approval again, so the person who approves it reads the paper that will be filed.
 */
export type LienAffidavitRedrawEntry = Pick<LienAffidavitEntry, 'jobId' | 'pile' | 'item'>

export type LienAffidavitRedrawPlan<E extends LienAffidavitRedrawEntry = LienAffidavitRedrawEntry> = {
  /** In Ready to file, on the earlier form: the press redraws these. */
  ready: E[]
  /** On the earlier form in another pile, not filed: left where they are. */
  held: E[]
}

const LIVE_PILES: ReadonlyArray<LienAffidavitEntry['pile']> = ['to_draft', 'needs_property', 'awaiting', 'held']

export function lienAffidavitRedrawPlan<E extends LienAffidavitRedrawEntry>(entries: ReadonlyArray<E>): LienAffidavitRedrawPlan<E> {
  const earlier = entries.filter((e) => e.item != null && e.item.status !== 'sent' && e.item.status !== 'missed' && lienAffidavitFormForItem(e.item) === 'long')
  return { ready: earlier.filter((e) => e.pile === 'ready'), held: earlier.filter((e) => LIVE_PILES.includes(e.pile)) }
}

export type LienAffidavitRedrawWords = {
  /** The button on the list: *Redraw 12 on the short form…* */
  button: string
  /** The confirm window. */
  title: string
  message: string
  confirmLabel: string
  /** The line under the button when earlier-form papers sit in other piles, else null. */
  foot: string | null
  dead: boolean
}

export function lienAffidavitRedrawWords(plan: Pick<LienAffidavitRedrawPlan, 'ready' | 'held'>): LienAffidavitRedrawWords {
  const ready = plan.ready.length
  const held = plan.held.length
  const base = batchWords({ verb: 'Redraw', ready, held, heldWhy: { one: 'is not in Ready to file', many: 'are not in Ready to file' } })
  const counted = `${countedLabel('Redraw', ready)} on the short form`
  return {
    button: `${counted}…`,
    title: ready === 1 ? 'Redraw 1 affidavit on the short form?' : `Redraw ${ready} affidavits on the short form?`,
    message: ready === 1 ? 'The affidavit goes back to To draft on the short form. It needs approval again before it is filed.' : 'Each affidavit goes back to To draft on the short form. Each needs approval again before it is filed.',
    confirmLabel: counted,
    foot: held > 0 ? `${held} on the earlier form ${held === 1 ? 'is' : 'are'} not in Ready to file. Redraw ${held === 1 ? 'it from its own paper' : 'each from its own paper'}.` : null,
    dead: base.dead,
  }
}

/** After the press: what took and what did not; a paper that did not take stays where it was, with its reason. */
export function lienAffidavitRedrawOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'redraw', past: 'Redrew', done, failed, noun: 'affidavit' })
}
