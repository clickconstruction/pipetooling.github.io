/**
 * Batch words (punch list #184, sweep A) — the words on a button that acts on many rows.
 *
 * The rule (`CLAUDE.md` → *Do what is ready, never all or nothing*): a button that acts on
 * many rows says how many it will act on and how many it holds, acts on the ready ones, lists
 * the held ones with the reason and a door, and is dead only when nothing is ready. The Lien
 * desk's run set the shape (v2.5533, `runRecordWords` in `jobs/lienDeskRun.ts`); this kernel
 * is the shared one, so a new batch button takes its words from here instead of writing
 * *Approve all* again. `scripts/codemods/batch-label-sweep.mjs --check` refuses a static label
 * that says *all*, *selected*, *shown* or *remaining* with no number in it.
 *
 * Two shapes:
 *  - `countedLabel` for a button with no holds: *Mark 5 opened*, *Clear 6 page pins*. At zero
 *    it reads the bare verb and its noun, *Clear page pins*, and the site makes it dead.
 *  - `batchWords` for a button that may hold some rows: the button in the Lien run's shape,
 *    *Send 3 · 1 has no email ▸*, the foot that says what stays and what goes, and `dead`.
 *
 * The foot is read by a first-timer, so it keeps to `plainWords.ts`: one idea per sentence,
 * none over 20 words, no glue inside a sentence. The button is a label, not a sentence; its
 * `·` and `▸` are the desk's own marks (the `▸` says a list opens).
 */

/** A noun as one word that takes an `s` or `es`, or the two forms when it does not: `['opened', 'opened']`. */
export type BatchNoun = string | readonly [one: string, many: string]

/** The held reason as one phrase for any count, or the two forms: `{ one: 'typed waits', many: 'typed wait' }`. */
export type BatchHeldWhy = string | { one: string; many: string }

export interface BatchWordsInput {
  /** The press, capitalised as the button reads it: `Send`, `Approve`, `Apply`. One word reads best in the foot. */
  verb: string
  /** Rows the press acts on now. */
  ready: number
  /** Rows the press leaves where they are, with a reason. */
  held: number
  /** Why the held rows stay, after their count: `has no email`. Defaults to `held`. */
  heldWhy?: BatchHeldWhy
  /** What the rows are, after the count: `request` → *Send 4 requests*. */
  noun?: BatchNoun
}

export interface BatchWords {
  /** The button's label. */
  button: string
  /** The line under the button when something is held, else null. */
  foot: string | null
  /** True when nothing is ready: the button is disabled. */
  dead: boolean
}

/** `punch` → `punches`, `user` → `users`, `page pin` → `page pins`; a tuple gives both forms. */
export function pluralNoun(noun: BatchNoun, n: number): string {
  if (typeof noun !== 'string') return n === 1 ? noun[0] : noun[1]
  if (n === 1) return noun
  return /(s|x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`
}

/** `send` → `sends`, `apply` → `applies`, `push` → `pushes`; only the first word of a phrase changes. */
function thirdPerson(verb: string): string {
  const [first = '', ...rest] = verb.split(' ')
  const one = /[^aeiou]y$/.test(first) ? `${first.slice(0, -1)}ies` : /(s|x|z|ch|sh|o)$/.test(first) ? `${first}es` : `${first}s`
  return [one, ...rest].join(' ')
}

function heldWhyFor(why: BatchHeldWhy, held: number): string {
  return typeof why === 'string' ? why : held === 1 ? why.one : why.many
}

/**
 * A button with no holds: the verb, the count and the noun. *Mark 5 opened*, *Move 1 session*,
 * *Pin for 4 users*. At zero the count is left out, *Pin for users*, and the site makes the
 * button dead.
 */
export function countedLabel(verb: string, n: number, noun?: BatchNoun): string {
  if (n <= 0) return noun ? `${verb} ${pluralNoun(noun, 0)}` : verb
  return noun ? `${verb} ${n} ${pluralNoun(noun, n)}` : `${verb} ${n}`
}

/**
 * A button that may hold some rows, in the Lien run's shape:
 *  - ready 4, held 0 → `Send 4` (`Send 4 requests` with the noun), no foot, live
 *  - ready 3, held 1 → `Send 3 · 1 has no email ▸`, the foot says what stays and what goes, live
 *  - ready 0, held 2 → `Send ▸`, dead, the foot says nothing is ready and where to look
 *  - ready 0, held 0 → `Send`, dead, no foot
 */
export function batchWords({ verb, ready, held, heldWhy = 'held', noun }: BatchWordsInput): BatchWords {
  const v = verb.toLowerCase()
  if (ready <= 0) {
    if (held <= 0) return { button: verb, foot: null, dead: true }
    return { button: `${verb} ▸`, foot: `Nothing is ready to ${v}. Fix what is marked in red, then ${v}.`, dead: true }
  }
  const counted = noun ? `${verb} ${ready} ${pluralNoun(noun, ready)}` : `${verb} ${ready}`
  if (held <= 0) return { button: counted, foot: null, dead: false }
  const stays = held === 1 ? 'It stays' : 'They stay'
  const goes = ready === 1 ? `one ${thirdPerson(v)}` : `ones ${v}`
  return {
    button: `${counted} · ${held} ${heldWhyFor(heldWhy, held)} ▸`,
    foot: `${held} ${held === 1 ? 'is' : 'are'} held. ${stays} here with the reason. The ${ready} ready ${goes} now.`,
    dead: false,
  }
}
