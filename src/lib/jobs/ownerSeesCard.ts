/**
 * The owner-sees eye and its card (v2.5770, punch list #145). On a job billed to the GC whose
 * customer is the property owner, the Pipeline row used to carry a pill reading *☐ owner sees $0*
 * (v2.3827). The owner, 2026-10-23: "confusing and takes up valuable real estate … perhaps we
 * should show an eye with a line through it where when the user hovers over it, they can get
 * details about what that means". This kernel turns the switch's state into the eye (crossed,
 * hollow or open), its tone (grey while nothing is billed, amber once open bills exist the owner
 * cannot see, blue when they see them) and the card's words: the fact first, then why, the open
 * figure with its label, and the door. Pure; `OwnerShareChip` draws it.
 */
import { formatUsdNoCents } from './jobFormatting'
import type { OwnerShareState } from './ownerBillShare'

export type OwnerSeesEye = 'crossed' | 'hollow' | 'open'
export type OwnerSeesTone = 'grey' | 'amber' | 'blue'

export type OwnerSeesCard = {
  state: OwnerShareState
  eye: OwnerSeesEye
  tone: OwnerSeesTone
  /** The fact, first: what the owner's page shows of this job. Also the glyph's accessible name. */
  title: string
  why: string
  /** The open figure with its label, or nothing when no bill is open. */
  fact: { label: string; value: string } | null
  /** The door's words; it opens the switch's window. */
  door: string
  hint: string | null
  /** A few words for a list, beside the eye, in place of the card. */
  short: string
}

export type OwnerSeesInput = {
  state: OwnerShareState
  ownerName: string
  gcName: string
  /** How many of the job's bills the GC pays are open. */
  openBills: number
  /** What is open on them, in dollars. */
  open: number
}

/** The first name, for the door: *Show Dana the bills*. The fallback name stays whole. */
export function ownerFirstName(ownerName: string): string {
  const name = ownerName.trim()
  if (!name || name === 'The owner') return 'the owner'
  return name.split(/\s+/)[0] ?? name
}

export function ownerSeesCard(input: OwnerSeesInput): OwnerSeesCard {
  const owner = input.ownerName.trim() || 'The owner'
  const first = ownerFirstName(owner)
  const gc = input.gcName.trim() || 'the GC'
  const hasOpen = input.openBills > 0 && input.open > 0
  const money = formatUsdNoCents(input.open)
  if (input.state === 'on') {
    return {
      state: 'on',
      eye: 'open',
      tone: 'blue',
      title: `${owner} sees this job's bills on their page.`,
      why: hasOpen ? `${gc} pays them. ${first === 'the owner' ? 'The owner' : first} sees them for their records, with no Pay button.` : `${gc} pays them. No bill is open right now. The next bill shows on their page too.`,
      fact: hasOpen ? { label: 'On their page', value: `${money} open` } : null,
      door: 'Stop showing',
      hint: 'Paid bills stay in their history.',
      short: 'on their page',
    }
  }
  if (input.state === 'partly') {
    return {
      state: 'partly',
      eye: 'hollow',
      tone: 'amber',
      title: `${owner} sees some of this job's bills.`,
      why: 'Some open bills are on their page and some are not. The switch finishes it.',
      fact: hasOpen ? { label: `Open to ${gc}`, value: money } : null,
      door: `Show ${first} the rest`,
      hint: null,
      short: 'some on their page',
    }
  }
  if (!hasOpen) {
    return {
      state: 'off',
      eye: 'crossed',
      tone: 'grey',
      title: `${owner}'s page shows nothing of this job's money yet.`,
      why: `The bills will go to ${gc}. No bill is out yet.`,
      fact: null,
      door: `Show ${first} the bills`,
      hint: 'Shown now, every bill after shows on their page too.',
      short: 'not on their page',
    }
  }
  return {
    state: 'off',
    eye: 'crossed',
    tone: 'amber',
    title: `${owner}'s page shows $0 of this job.`,
    why: `The bills go to ${gc}. Their page reads all paid up until you show them the bills.`,
    fact: { label: `Open to ${gc}`, value: money },
    door: `Show ${first} the bills`,
    hint: 'For their records. No Pay button, never in their balance.',
    short: 'not on their page',
  }
}

/** Every sentence the card can say, for the plain-words test. */
export function ownerSeesCardSentences(card: OwnerSeesCard): string[] {
  return [card.title, card.why, card.hint ?? ''].filter(Boolean)
}
