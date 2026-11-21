/**
 * The notice pane's stacked section heads (v2.4733, Taunya's ask: "as I scroll through this
 * section I get lost in where I am"). The Notices list pins its pile titles — the ones passed
 * stack at the top, the ones to come at the bottom, the one you are in is lit — and the pane
 * gets the same device for its five sections. Each head is the section's title row, carrying
 * the fact a glance wants: the next step, how many gates are clear, the houses and their money,
 * the months and the claim, the pages in the envelope. Pure: facts in, heads and offsets out.
 */

import { LIEN_PILE_HEAD_H, LIEN_PILE_HEAD_H_PHONE } from './lienPhoneLists'
import { LIEN_RUN_ACT } from './lienRunWords'

/** The height of one head: the Notices list's title bar, one number for every bar on the desk (v2.7323). */
export const LIEN_PANE_HEAD_H = LIEN_PILE_HEAD_H

export type LienPaneSectionKey = 'path' | 'gates' | 'houses' | 'months' | 'envelope' | 'sign'

export type LienPaneSection<K extends string = LienPaneSectionKey> = {
  key: K
  /** The uppercase label at the left. */
  label: string
  /** The bold fact at the right. */
  fact: string
  /** A muted tail after the fact, cut short first when the row is narrow; '' for none. */
  tail: string
  /**
   * The pane's last section, the one that holds the footer (v2.7422): its bar is blue, and it pins at the pane's
   * bottom edge only. It never stacks under the strip, so it cannot ride over its own short body at the pane's end.
   */
  foot?: boolean
}

/**
 * A head's fact as whole words (v2.7446): the fact and its tail on one line, for the `title` of the words a narrow pane
 * cuts with an ellipsis. The head draws the same two pieces, so the tip and the bar cannot part.
 */
export function lienPaneHeadFactWords(section: Pick<LienPaneSection<string>, 'fact' | 'tail'>): string {
  return section.tail ? `${section.fact} · ${section.tail}` : section.fact
}

export type LienPaneSectionsInput = {
  /** The timeline's next step, "Draft the Jul + Aug notice — 9 days."; null with no timeline. */
  nextWords: string | null
  /** The verdict; or, on a sent notice with nothing due (v2.6625), the day it went — the head reads *Sent Oct 14* and judges nothing. */
  gates: { ready: boolean; headline: string; summary: string } | { sentOn: string } | null
  /** The job's houses; null when it bought nothing (the section is not drawn). */
  houses: { count: number; housesOwed: number; owed: number; paid: number; asOf: string } | null
  /** 'YYYY-MM', the months on this notice. */
  months: readonly string[]
  /**
   * On a sent notice with nothing due, the months the notice named as its fold words them (`lienSentGatesFold`'s
   * `months`: "Jul + Aug", or *no month named* when the record keeps none); null or absent on a notice still being
   * drafted. The head reads these in place of the draft's months, which a paper that went does not have (v2.8167).
   */
  sentMonths?: string | null
  /** "$27,199" — the claim as the strip says it. */
  claimWords: string
  /** The pages of the owner's copy the pane shows. */
  pages: number
  /** The GC gets a courtesy PDF too. */
  gcEmail: boolean
  monthShort: (key: string) => string
  money: (n: number) => string
  /** The footer's own section at the pane's end (v2.7422, `lienNoticeFootHead`); null or absent where the footer is not in the pane (a phone). */
  foot?: { label: string; fact: string } | null
}

function houses(n: number): string {
  return n === 1 ? 'house' : 'houses'
}

/** The heads in pane order. The supply houses head is drawn only when the job has houses. */
export function lienPaneSections(i: LienPaneSectionsInput): LienPaneSection[] {
  const out: LienPaneSection[] = []
  out.push({ key: 'path', label: 'Where this notice is', fact: (i.nextWords ?? '').replace(/\.$/, '') || 'nothing due', tail: '' })
  out.push({
    key: 'gates',
    label: 'The four gates',
    fact: !i.gates ? '—' : 'sentOn' in i.gates ? `Sent ${i.gates.sentOn}` : `${i.gates.ready ? '✓' : '✗'} ${i.gates.headline}`,
    tail: !i.gates ? '' : 'sentOn' in i.gates ? 'as the notice went' : i.gates.summary,
  })
  if (i.houses) {
    const h = i.houses
    out.push({
      key: 'houses',
      label: 'Supply houses',
      fact: h.housesOwed > 0 ? `${h.housesOwed} ${houses(h.housesOwed)} owed · ${i.money(h.owed)}` : `${h.count} ${houses(h.count)}, all paid · ${i.money(h.paid)}`,
      tail: h.asOf ? `from our books · ${h.asOf}` : '',
    })
  }
  out.push({ key: 'months', label: 'Months on this job', fact: `${i.sentMonths || (i.months.length ? i.months.map(i.monthShort).join(' + ') : 'no months')} · ${i.claimWords}`, tail: '' })
  out.push({ key: 'envelope', label: 'In the envelope', fact: `${i.pages} ${i.pages === 1 ? 'page' : 'pages'} · owner + GC`, tail: i.gcEmail ? 'courtesy PDF to the GC' : '' })
  if (i.foot) out.push({ key: 'sign', label: i.foot.label, fact: i.foot.fact, tail: '', foot: true })
  return out
}

/** The piles a notice sits in, as the desk names them (`LienDeskPile`); spelled here so this kernel reads no other. */
export type LienNoticeFootPile = 'needs_owner' | 'to_draft' | 'awaiting' | 'ready' | 'printed' | 'held' | 'sent' | 'missed'

/**
 * Whether a notice in the Missed pile is still a notice to send (v2.8170, the live walk of punch list #361). It is while
 * a month is still due. It is too while every window closed unsent and the affidavit's own window is open: v2.4708's
 * rule is that a late notice can then go and the affidavit follow it, and `lateUntil` is that window's last day. Its
 * footer is then the draft's, with the send. Past both, the footer says the lien right on that work is gone. Before
 * this the footer read only the months due, so in the late window it said the right was gone under a months card that
 * said a late notice can still go.
 */
export function lienMissedNoticeStillGoes(i: { dueMonths: number; lateUntil?: string | null }): boolean {
  return i.dueMonths > 0 || Boolean(i.lateUntil)
}

/**
 * The blue bar over the notice's footer (v2.7422, Taunya's ask of 2026-11-15: the signing box is a section of the
 * pane like the rest, its bar blue, so the paper has the whole pane and the reader goes through it to sign at the
 * bottom). The label is the act the section holds; the fact is where the signature stands, so the bar says from
 * the pane's bottom edge whether anything waits down there.
 */
export function lienNoticeFootHead(i: { pile: LienNoticeFootPile; signed: boolean; signerFirst: string; /** Months still due on the job; a missed notice with none has nothing left to sign, unless a late one can still go. */ dueMonths: number; /** The affidavit's last day while a late notice can still go (`lienMissedNoticeStillGoes`); null or absent otherwise. */ lateUntil?: string | null }): { label: string; fact: string } {
  const who = i.signerFirst.trim()
  switch (i.pile) {
    case 'sent':
      return { label: 'After the send', fact: 'Sent' }
    case 'printed':
      return { label: LIEN_RUN_ACT.record, fact: 'Printed, not mailed' }
    case 'missed':
      return lienMissedNoticeStillGoes(i) ? { label: 'Sign and send', fact: 'Not signed yet' } : { label: 'Window closed', fact: 'Nothing to sign' }
    case 'held':
      return { label: 'Sign and send', fact: 'On hold' }
    case 'ready':
      // Approved (v2.7448): signed, the section holds the press to print and mail; unsigned, it holds the signature first.
      return i.signed ? { label: LIEN_RUN_ACT.print, fact: 'Signed, to print' } : { label: 'Sign it', fact: 'Approved, not signed yet' }
    case 'awaiting':
      return { label: 'Sign and send', fact: who ? `Waiting on ${who}’s signature` : 'Waiting on the signature' }
    default:
      return { label: 'Sign and send', fact: 'Not signed yet' }
  }
}

/** The heads that stack over the pages: every head but the footer's, which pins at the pane's bottom edge and never over a page. */
export function lienPaneHeadsOverPages<K extends string>(sections: ReadonlyArray<LienPaneSection<K>>): number {
  return sections.filter((h) => !h.foot).length
}

/** Where a head sticks and how tall it is: under the strip and the heads passed, above the heads to come — the list's `top: i·H`, `bottom: (n−1−i)·H`. */
export function lienPaneHeadOffsets(index: number, count: number, stripHeight: number, phone = false): { top: number; bottom: number | 'auto'; height: number } {
  // A phone pins one head, the section being read, under the strip (punch list #352, PR 6): five stacked heads were 150 px of a pane that had 58 to 285.
  if (phone) return { top: Math.max(0, stripHeight), bottom: 'auto', height: LIEN_PANE_HEAD_H_PHONE }
  return { top: Math.max(0, stripHeight) + index * LIEN_PANE_HEAD_H, bottom: Math.max(0, count - 1 - index) * LIEN_PANE_HEAD_H, height: LIEN_PANE_HEAD_H }
}

/** A phone's head is a thumb tall, the list's. */
export const LIEN_PANE_HEAD_H_PHONE = LIEN_PILE_HEAD_H_PHONE

/** The height of the heads that sit over section `index` once it is scrolled to: its own and, on a computer, the ones before it. */
function headsOver(index: number, phone: boolean): number {
  return phone ? LIEN_PANE_HEAD_H_PHONE : (index + 1) * LIEN_PANE_HEAD_H
}

/** The scroll position that lands a section under its own head — the list's rule, with the strip's height on top. */
export function lienPaneSectionScrollTop(bodyOffsetTop: number, index: number, stripHeight: number, phone = false): number {
  return Math.max(0, bodyOffsetTop - Math.max(0, stripHeight) - headsOver(index, phone))
}

/**
 * Which head is lit: the last section whose body has reached its stuck head — the list's
 * `rows.offsetTop <= scrollTop + (i + 2) · H`, with the strip's height on top. The first head is
 * lit at the top of the pane; null only with no sections.
 */
export function litLienPaneSection<K extends string>(bodies: ReadonlyArray<{ key: K; offsetTop: number }>, scrollTop: number, stripHeight: number, phone = false): K | null {
  let on: K | null = bodies[0]?.key ?? null
  bodies.forEach((b, i) => {
    if (b.offsetTop <= scrollTop + Math.max(0, stripHeight) + headsOver(i, phone) + (phone ? LIEN_PANE_HEAD_H_PHONE : LIEN_PANE_HEAD_H)) on = b.key
  })
  return on
}
