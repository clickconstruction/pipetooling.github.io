/**
 * The chips on the Lien desk's scrolled strip (v2.7318): the sticky line at the top of a notice pane once
 * the gates have scrolled away. The owner's rule of 2026-11-15, of the strip on JP372: it said what the
 * footer and the Next band already said, and nothing on it did anything when pressed. So the strip now says
 * only what the reader cannot see from where they are, and every chip is a press. Pure: the pane draws what
 * this says and wires each `act` to the door the gate box already has.
 *
 * - With blockers, one red chip per blocking gate in its own words (*Owner of record missing ›*) and no
 *   separate *Can't go out yet* chip: the red chips are the verdict. A check (the kind unknown) is an amber chip.
 * - With none, one green *Ready to go out ›* chip, which goes to the footer's press.
 * - The Next on the path chip is dropped when its words repeat a blocker chip: a blocked notice's next step
 *   (*Find the owner, then send the Sep notice*) says what the owner chip says. A next step that is another
 *   paper, or a notice with nothing blocking it (it adds the day), is kept.
 * - The months and the claim are quiet presses to their sections; the months chip is dropped when the months
 *   gate already blocks (*No month picked ›* is the press).
 * - A sent notice's folded grey chip (*Sent Oct 14 ›*) stays and goes back to the top. Its months chip reads the
 *   months the notice named (*Jul + Aug ›*), off the fold, since the pane picks none on a paper that went (v2.8167).
 *   A sent notice whose record keeps no month reads *No month named ›*, never *No month picked ›*, which asks for a tick.
 * - Every chip ends in › so it reads as a door.
 */
import { lienGateShortWords, type LienGate, type LienGateKey } from './lienDeskGates'

export type LienStripChipAct = `gate:${LienGateKey}` | 'top' | 'ready' | 'next' | 'months' | 'claim' | 'wording'
export type LienStripChipTone = 'red' | 'amber' | 'green' | 'quiet'

export interface LienStripChip {
  /** Stable, one per chip: `gate:owner`, `ready`, `next`, `months`, `claim`, `wording`, `sent`. */
  key: string
  /** Ends in ›. */
  words: string
  tone: LienStripChipTone
  /** The press: `gate:<key>` opens that gate's own door, `top` the gates, `ready` the footer's press, `next` the Next on the path band, `months` the month grid, `claim` the claim, `wording` the envelope line. */
  act: LienStripChipAct
  /** The hover: the gate's whole sentence, or where the press goes. */
  title: string
}

export interface LienStripChipsInput {
  gates: ReadonlyArray<Pick<LienGate, 'key' | 'n' | 'label' | 'value' | 'tone' | 'title'>>
  /** "Sep + Oct"; '' when no month is picked. */
  monthWords: string
  /** The timeline's next step, or null while the desk has no timeline. */
  next: { kind: string; words: string; tone: 'red' | 'amber' | 'green' | 'quiet' } | null
  /** "$33,500" */
  claimWords: string
  /** The claim was set by hand (an amount off the balance). */
  claimByHand: boolean
  /** The wording-diff line ("2 lines edited by Taunya"); '' when the notice carries the job's wording. */
  wordingWords: string
  /** A sent notice with nothing due: the gates folded to their one line (`lienSentGatesFold`), else null. `months` is the fold's own, the months the notice named. */
  fold: { head: string; months: string } | null
}

const DOOR = ' ›'

function capital(words: string): string {
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words
}

/** The next step's words as a chip: the sentence's full stop dropped, the door mark added. */
function nextChipWords(words: string): string {
  return `${words.trim().replace(/\.$/, '')}${DOOR}`
}

export function lienStripChips(input: LienStripChipsInput): LienStripChip[] {
  const chips: LienStripChip[] = []
  const blockers = input.fold ? [] : input.gates.filter((g) => g.tone === 'blocker')
  const checks = input.fold ? [] : input.gates.filter((g) => g.tone === 'check')

  if (input.fold) {
    chips.push({ key: 'sent', words: `${input.fold.head}${DOOR}`, tone: 'quiet', act: 'top', title: 'The notice went out. Back up to the day it went and the gates as they stood.' })
  } else if (blockers.length) {
    for (const g of blockers) chips.push({ key: `gate:${g.key}`, words: `${capital(lienGateShortWords(g))}${DOOR}`, tone: 'red', act: `gate:${g.key}`, title: g.title })
  } else {
    chips.push({ key: 'ready', words: `Ready to go out${DOOR}`, tone: 'green', act: 'ready', title: 'Every gate is clear. Down to the footer, where the send is.' })
  }
  for (const g of checks) chips.push({ key: `gate:${g.key}`, words: `${capital(lienGateShortWords(g))}${DOOR}`, tone: 'amber', act: `gate:${g.key}`, title: g.title })

  // The months, unless the months gate is already a red chip. A notice that went reads its own months off the fold.
  if (input.fold) {
    chips.push({ key: 'months', words: `${capital(input.fold.months)}${DOOR}`, tone: 'quiet', act: 'months', title: 'The months the notice named when it went. Down to Months on this job.' })
  } else if (!blockers.some((g) => g.key === 'months')) {
    chips.push({ key: 'months', words: `${input.monthWords || 'No month picked'}${DOOR}`, tone: 'quiet', act: 'months', title: 'Months on this job' })
  }

  // The next step: dropped while a blocked notice's own step is the next one, since the red chip already says it.
  if (input.next && !(blockers.length > 0 && input.next.kind === 'notice')) {
    chips.push({ key: 'next', words: nextChipWords(input.next.words), tone: input.next.tone, act: 'next', title: 'Next on the path' })
  }

  chips.push({
    key: 'claim',
    words: `Claim ${input.claimWords}${input.claimByHand ? ', set by hand' : ''}${DOOR}`,
    tone: input.claimByHand ? 'amber' : 'quiet',
    act: 'claim',
    title: input.claimByHand ? 'The claim was set by hand. Down to the claim, where it is explained.' : 'The claim',
  })
  if (input.wordingWords.trim()) chips.push({ key: 'wording', words: `${input.wordingWords.trim()}${DOOR}`, tone: 'amber', act: 'wording', title: 'The notice carries edited wording. Down to the envelope line.' })
  return chips
}
