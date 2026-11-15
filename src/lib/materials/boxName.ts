/**
 * Materials on site: a box's name (punch list #351, PR 1, the owner's calls of 2026-11-14). A box's name was one free
 * field of 24 characters, so people typed what was inside it (`R76 TOILETS`, `MISL PILE OF JUNK PIPE`), the sheet
 * always offered A1 whatever letter the site's steel was painted, and a name was checked against one job while a
 * development's boxes sit under several.
 *
 * The rule: **one to three capital letters, a number from 1 to 999 with no zeros in front, and one letter after the
 * number if the paint has one** (`R7`, `R89`, `AB12`, `G24B`). **One of a kind across the whole site**: every job of
 * the development, or the one job when the job is on no development. **Offered, not typed**: Add opens on the next free
 * name, the letters most of the site's live boxes carry and one past the highest number any box, live or retired,
 * carries under them. **Words are moved, not refused**: `R76 TOILETS` typed into the name becomes the name R76 and the
 * words *Toilets*, which the sheet hands on to the box's own line (`boxLine.ts`, PR 2; PR 1 parked them on the where
 * line). Words alone take the next free name. Old names stay as they are until the office tidies them (PR 3).
 *
 * Pure rules and words only. The same rule in SQL is `box_name_words` and the trigger `job_containers_name_rule`
 * (`20261114100000_box_name_rule.sql`), and `on_site_next_box_name` is this file's `nextFreeName`. The screens are the
 * phone's Add sheet (`TallyOnSiteTab.tsx`), the office's Add row (`JobsMaterialsTab.tsx`) and Edit (`editBox.ts`).
 */
import type { ContainerKind } from './onSite'

/** The saved shape: letters, number, one letter after the number or none. Capitals only; the readers upper-case first. */
export const BOX_NAME_RULE = /^([A-Z]{1,3})([1-9][0-9]{0,2})([A-Z])?$/
export const BOX_NUMBER_MAX = 999
export const BOX_LETTERS_MAX = 3

/** The one line that says the rule, wherever a name is refused. */
export const BOX_NAME_RULE_WORDS = 'A name is one to three letters and a number from 1 to 999, like R76.'

export type BoxName = { letters: string; number: number; /** One letter after the number (`G24B`), or empty. */ tail: string }

/** A box as the name rule reads it: a container of any job on the site, live or retired. */
export type SiteBox = { id?: string; label: string; kind: ContainerKind | string; retiredAt: string | null; createdAt?: string }

/** A saved name read strictly; null for Unsorted, an old free-text name or anything else off the rule. */
export function parseBoxName(label: string): BoxName | null {
  const m = BOX_NAME_RULE.exec(label.trim().toUpperCase())
  if (!m) return null
  return { letters: m[1]!, number: Number(m[2]), tail: m[3] ?? '' }
}

export function isBoxName(label: string): boolean {
  return parseBoxName(label) !== null
}

export function boxNameWords(n: BoxName): string {
  return `${n.letters}${n.number}${n.tail}`
}

/** The words split off a name, said as a line reads: `TOILETS` → *Toilets*, spaces folded. Empty stays empty. */
export function sentenceWords(raw: string): string {
  const w = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : ''
}

/** What a person typed into the name field, read. */
export type TypedName =
  | { kind: 'empty' }
  /** A name on the rule, with any words typed after it split off. */
  | { kind: 'name'; name: string; words: string; zerosDropped: boolean }
  /** Letters alone (`R`): the next free name under them is meant. */
  | { kind: 'letters'; letters: string }
  /** No letter and number in it: the words alone. */
  | { kind: 'words'; words: string }
  /** Letters and a number past 999 or at 0 (`T8678`): not a name, and too much like one to be words. */
  | { kind: 'big-number'; typed: string }

const TYPED_NAME = /^([A-Z]{1,3}) ?(\d+)([A-Z](?= |$))?(?: (.*))?$/

/**
 * Reads what was typed. `R76 TOILETS` is the name R76 and the words *Toilets*; `r 76` is R76; `R007` is R7 with the
 * zeros dropped; `G24B` keeps its letter; `R` alone asks for the next free R name; `CONCRETE MIX` is words; `T8678`
 * is a number past 999.
 */
export function readTypedName(typed: string): TypedName {
  const t = typed.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!t) return { kind: 'empty' }
  if (/^[A-Z]{1,3}$/.test(t)) return { kind: 'letters', letters: t }
  const m = TYPED_NAME.exec(t)
  if (!m) return { kind: 'words', words: sentenceWords(t) }
  const number = Number(m[2])
  if (number < 1 || number > BOX_NUMBER_MAX) return { kind: 'big-number', typed: `${m[1]}${m[2]}${m[3] ?? ''}` }
  return { kind: 'name', name: `${m[1]}${number}${m[3] ?? ''}`, words: sentenceWords(m[4] ?? ''), zerosDropped: String(number) !== m[2] }
}

const live = (b: SiteBox) => !b.retiredAt && b.kind !== 'unsorted'

/**
 * The letters the site's steel is painted: the letters most of its live boxes carry. A tie goes to the letters of the
 * newest live box, since that is what the crew is painting now. Null when no live box has a name on the rule (a site
 * with no boxes, or old names only): the sheet then asks for the letter once.
 */
export function siteLetters(boxes: ReadonlyArray<SiteBox>): string | null {
  const count = new Map<string, { n: number; newest: string }>()
  for (const b of boxes) {
    if (!live(b)) continue
    const name = parseBoxName(b.label)
    if (!name) continue
    const have = count.get(name.letters) ?? { n: 0, newest: '' }
    const at = b.createdAt ?? ''
    count.set(name.letters, { n: have.n + 1, newest: at > have.newest ? at : have.newest })
  }
  let best: { letters: string; n: number; newest: string } | null = null
  for (const [letters, { n, newest }] of count) {
    if (!best || n > best.n || (n === best.n && newest > best.newest) || (n === best.n && newest === best.newest && letters < best.letters)) best = { letters, n, newest }
  }
  return best?.letters ?? null
}

/**
 * The next free name on the site: one past the highest number any box, live or retired, carries under the letters
 * (a retired box's number is never offered again). A letter after a number counts the number as taken: when G24B
 * stands the next is G25, and G24 is never offered, since one past the highest is the rule and G24B is a second
 * thing at the spot of a G24 that was or will be. Without letters the site's own are read; null when there are none,
 * or when the letters have run past 999.
 */
export function nextFreeName(boxes: ReadonlyArray<SiteBox>, letters: string | null = siteLetters(boxes)): string | null {
  if (!letters) return null
  const L = letters.toUpperCase()
  let top = 0
  for (const b of boxes) {
    if (b.kind === 'unsorted') continue
    const name = parseBoxName(b.label)
    if (name && name.letters === L) top = Math.max(top, name.number)
  }
  return top >= BOX_NUMBER_MAX ? null : `${L}${top + 1}`
}

/** The live box on the site that carries the name, if any, the box itself aside. Capitals and spaces do not matter. */
export function nameTakenBy(boxes: ReadonlyArray<SiteBox>, name: string, selfId?: string): SiteBox | null {
  const key = name.trim().toLowerCase()
  return boxes.find((b) => !b.retiredAt && b.id !== selfId && b.label.trim().toLowerCase() === key) ?? null
}

/** The verdict on what was typed, against the site's boxes. `tone` says how the line under the name reads. */
export type BoxNameVerdict =
  | { ok: true; name: string; words: string; say: string; tone: 'ok' | 'wait' }
  | { ok: false; name: null; words: string; say: string }

/**
 * What the Add sheet will do with the name field as it stands. Nothing typed takes the offer. Letters alone take the
 * next free name under them. A name on the rule is kept, its words split off. Words alone take the offer and are
 * split off whole. A number off the rule, a name a live box on the site carries, and a site with no letter yet when
 * nothing on the rule was typed, are a dead press with the reason.
 */
export function boxNameVerdict(typed: string, boxes: ReadonlyArray<SiteBox>, selfId?: string): BoxNameVerdict {
  const offered = nextFreeName(boxes)
  const read = readTypedName(typed)
  const askLetter = 'This site has no named box yet. Type the letters painted on the steel and the number 1, like R1.'
  if (read.kind === 'empty') {
    if (!offered) return { ok: false, name: null, words: '', say: askLetter }
    return { ok: true, name: offered, words: '', say: `${offered} is the next free name on this site.`, tone: 'ok' }
  }
  if (read.kind === 'letters') {
    const name = nextFreeName(boxes, read.letters)
    if (!name) return { ok: false, name: null, words: '', say: `Every ${read.letters} number up to ${BOX_NUMBER_MAX} is taken on this site. Pick other letters.` }
    const first = name === `${read.letters}1`
    return { ok: true, name, words: '', say: first ? `${name} is the first ${read.letters} box on this site.` : `${name} is the next free ${read.letters} name on this site.`, tone: 'ok' }
  }
  if (read.kind === 'words') {
    if (!offered) return { ok: false, name: null, words: read.words, say: `No letter and number in that. ${askLetter}` }
    return { ok: true, name: offered, words: read.words, say: `No letter and number in that. The next free name is ${offered}.`, tone: 'wait' }
  }
  if (read.kind === 'big-number') {
    return { ok: false, name: null, words: '', say: `A number runs from 1 to ${BOX_NUMBER_MAX}. ${read.typed} cannot be a name.` }
  }
  const taken = nameTakenBy(boxes, read.name, selfId)
  if (taken) {
    return { ok: false, name: null, words: read.words, say: offered ? `${read.name} is already on this site. Pick another name, or take ${offered}.` : `${read.name} is already on this site. Pick another name.` }
  }
  const said = `${read.zerosDropped ? 'Zeros in front are dropped. ' : ''}The name is ${read.name}.`
  return { ok: true, name: read.name, words: read.words, say: said, tone: 'ok' }
}

/** The press under the sheet: *Add R89*, or *Add it* while there is no name. */
export function addPressLabel(verdict: BoxNameVerdict): string {
  return verdict.ok ? `Add ${verdict.name}` : 'Add it'
}

/**
 * The site's boxes as the sheet reads them: what a read of the site brought for the other jobs, and this job's own
 * boxes from the store, which are fresher and there with no signal. Live and retired both, since a retired box's
 * number is not offered again.
 */
export function siteBoxesFor(jobId: string, siteRows: ReadonlyArray<SiteBox & { jobId: string }>, ownBoxes: ReadonlyArray<SiteBox>): SiteBox[] {
  return [...siteRows.filter((r) => r.jobId !== jobId), ...ownBoxes]
}
