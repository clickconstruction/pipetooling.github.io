import { pluralNoun } from '../batchWords'
import { runCopyPages, type RunNotice } from './lienDeskRun'
import { runMailing } from './lienRunPaper'
import { runEnvelopes } from './runEnvelopes'

/**
 * One notice out of the run (the owner's ask of 2026-11-16): the ready footer's *Just this one* opens the run window on
 * that notice alone, so one notice printed alone and one printed with fifteen others come out the same pages, built by
 * the same builders.
 *
 * Until then the link opened the job's Lien window, whose print was one set of pages built fresh from the job behind a
 * help sheet that told the office to photocopy it for the second envelope and to sign each set in ink. The desk held
 * the leader's signature, the approved draft and counsel's letter, and that print carried none of them.
 *
 * This kernel is the plan of what the press prints, read off the same `RunNotice` the run is built from: the envelopes
 * that go out, in packet order, with the documents the desk already knows are inside each (the pay page and the unpaid
 * bills join them once the window has read the bills), the envelopes the run holds back with the run's own reason, and
 * the link's words with its count. Pure.
 */

/** One envelope's set, as the packet stacks it. */
export type LienRunOneSet = {
  /** The envelope's number in the packet, from 1. */
  n: number
  /** Whose copy leads the envelope: *Owner of record* or *Original contractor*. */
  label: string
  /** The name the envelope is made out to. */
  name: string
  /** The documents inside, in print order, by the labels the copy's pages carry. */
  pages: string[]
}

export type LienRunOnePlan = {
  /** The envelopes that print, in packet order. */
  sets: LienRunOneSet[]
  /** The envelopes the run holds back, each with the run's own reason. */
  held: Array<{ label: string; name: string; why: string }>
  /** The owner and the original contractor are one name at one address, so one envelope carries both copies. */
  shared: boolean
  /** The link's words: *Just this one · 2 envelopes ›*. */
  label: string
  /** What the press will do, as a sentence or two for the link's hover. */
  title: string
}

const ENVELOPE = ['envelope', 'envelopes'] as const

/** The link while the desk has no run notice for the row (the data is still loading, or the item is gone). */
export const LIEN_RUN_ONE_BARE = 'Just this one ›'

/** *2 envelopes*, *1 envelope*. */
function envelopeCount(n: number): string {
  return `${n} ${pluralNoun(ENVELOPE, n)}`
}

/**
 * The plan for one notice. `null` (no run notice for the row) reads the bare link and says the window opens on it.
 *
 * - Every envelope goes: *Just this one · 2 envelopes ›*.
 * - One goes and one is held (the contractor has no mailing address): *Just this one · 1 envelope, 1 held ›*.
 * - Nothing goes (unsigned, or no address anywhere): *Just this one · held ›*, and the hover gives the first reason.
 *   The window still opens, since the doors that clear a hold are inside it.
 */
export function lienRunOnePlan(notice: RunNotice | null | undefined): LienRunOnePlan {
  if (!notice) return { sets: [], held: [], shared: false, label: LIEN_RUN_ONE_BARE, title: 'This notice alone, in the run window.' }
  const mailing = runMailing(runEnvelopes([notice]))
  const sets = mailing.mailed.map((env) => ({
    n: env.n,
    label: env.label,
    name: env.name,
    pages: env.contents.flatMap((c) => runCopyPages(c.notice, c.recipient).map((p) => p.label)),
  }))
  const held = mailing.held.map(({ env, why }) => ({ label: env.label, name: env.name, why }))
  const shared = mailing.all.some((env) => env.contents.length > 1)
  const who = (h: { label: string; name: string }) => (h.name.trim() ? `${h.label}, ${h.name.trim()}` : h.label)
  if (sets.length === 0) {
    const first = held[0]
    return {
      sets,
      held,
      shared,
      label: 'Just this one · held ›',
      title: first ? `Nothing prints yet. ${first.why} The window that opens has the way to clear it.` : 'Nothing prints yet. This notice has nobody to send to.',
    }
  }
  const prints =
    sets.length === 1
      ? shared
        ? 'One envelope prints. The owner and the original contractor are one name at one address, so it carries both copies.'
        : 'One envelope prints, with its set of pages.'
      : `${sets.length === 2 ? 'Both' : `All ${sets.length}`} envelopes print in one press. Each has its own set of pages, so nothing is photocopied.`
  const heldWords = held.map((h) => `Held: ${who(h)}. ${h.why}`).join(' ')
  return {
    sets,
    held,
    shared,
    label: `Just this one · ${envelopeCount(sets.length)}${held.length ? `, ${held.length} held` : ''} ›`,
    title: [`This notice alone, as the run prints it. ${prints}`, heldWords, 'The mail numbers are typed in the same window.'].filter(Boolean).join(' '),
  }
}
