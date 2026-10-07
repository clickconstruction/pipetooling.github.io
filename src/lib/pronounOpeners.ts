/**
 * Pronoun openers: a warning on the help guides, never a failing rule (the owner's call,
 * 2026-10-06, after the plain-words sweep, punch list #75). A sentence that opens on a bare
 * pronoun pointing back across a full stop makes a first-timer carry "it" over the stop:
 * "The office gets the same notification. It clears the reminder." Is "it" the office, the
 * notification or the report? Repeating the noun ("The report clears…") costs one word.
 *
 * What counts as bare: it, its, they, their, them, he, she, his, her, always. That, this,
 * these, those, each and both only when a verb or a comma follows ("That is…", "Those, and…"),
 * so a pronoun with its noun ("That section…") is fine. Also after an opening then, so, and,
 * but, or, if, when and the like ("Then it…", "If they…"). A deictic that ends its sentence on
 * a colon points forward to a list ("These are the gaps:") and is fine. A dummy "it" points at
 * nothing, so there is no noun to repeat: "If it's been a while", "It does not matter
 * whether…", "It is safe to close". Tokens are their labels and an italic span is one quoted
 * word, as plain words counts them, so a screen quote never opens a sentence.
 *
 * Measured on the 250 guides held on 2026-10-06: about 99% of what this finds is a real bare
 * pronoun, but only about four in ten were ambiguous to a reader. So each finding is the
 * writer's call, and `npm run check:pronouns` prints them without failing.
 *
 * The second finding is the one that can fail later: a paragraph opens at most one sentence on
 * "So". Two "So" openers in a row chain three sentences on each other.
 */
import { helpGuideLineForCounting, helpGuideProseLinesNumbered, plainWordsSentences } from './plainWords'

export type PronounOpenerRule = 'pronoun' | 'so'

export type PronounOpener = {
  /** The 1-based line in the guide's file. */
  line: number
  /** The sentence, as plain words counts it: a token is its label, an italic span is "quoted". */
  sentence: string
  rule: PronounOpenerRule
}

const ALWAYS = new Set(['it', "it's", 'its', 'they', "they're", 'their', 'them', 'he', 'she', 'his', 'her', "that's"])
const DEICTIC = new Set(['that', 'this', 'these', 'those', 'each', 'both'])
/** The words that make a deictic stand alone: "That is…", "Each has…", "Both open…". */
const VERBISH = new Set([
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'may', 'might', 'must', 'should', 'does', 'do', 'did',
  'means', 'happens', 'gives', 'shows', 'makes', 'keeps', 'stays', 'holds', 'goes', 'comes', 'covers', 'includes', 'tells', 'opens', 'works',
  'reads', 'sits', 'lands', 'counts', 'asks', 'adds', 'carries', 'lists', 'prints', 'runs', 'turns', 'says', 'saves', 'needs', 'takes',
  'moves', 'starts', 'clears', 'puts', 'sets', 'lets', 'uses', 'follows', 'appears', 'changes',
  // The plural verbs that are rarely a noun's first word: not "open", "work" or "list" ("These open bills…").
  'show', 'read', 'sit', 'say', 'need', 'mean', 'happen', 'go', 'come', 'stay', 'keep',
])
/** An opening word the pronoun can hide behind: "Then it…", "If they…", "When that happens…". */
const LEAD = new Set(['then', 'so', 'and', 'but', 'or', 'if', 'when', 'under', 'beside', 'without', 'for', 'once', 'after', 'until', 'while'])
/** The dummy "it": it points at nothing, so there is no noun to repeat. */
const DUMMY_IT = [/^it(?:'s| has) been\b/, /^it (?:does not|doesn't|did not|didn't) matter\b/, /^it(?:'s| is) (?:safe|harmless|fine|ok|okay) to\b/]

const bare = (w: string) => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '')

/** The sentence opens on a bare pronoun that points back across the full stop before it. */
export function opensOnBarePronoun(sentence: string): boolean {
  let words = sentence.replace(/’/g, "'").replace(/^\d+\.\s+/, '').split(/\s+/).filter(Boolean)
  if (LEAD.has(bare(words[0] ?? ''))) words = words.slice(1)
  if (DUMMY_IT.some((re) => re.test(words.join(' ').toLowerCase()))) return false
  const [first = '', second = ''] = words
  const w = bare(first)
  if (ALWAYS.has(w)) return true
  if (!DEICTIC.has(w)) return false
  if (/:$/.test(sentence.trim())) return false
  return /[,:]$/.test(first) || VERBISH.has(bare(second))
}

/** The sentence opens on "So", the word the chains of the sweep leaned on. */
export function opensOnSo(sentence: string): boolean {
  return /^(?:\d+\.\s+)?So\b/.test(sentence)
}

/** Every pronoun opener in a guide's prose, and every paragraph's second and later "So" opener. */
export function helpGuidePronounOpeners(source: string): PronounOpener[] {
  const out: PronounOpener[] = []
  for (const { line, text } of helpGuideProseLinesNumbered(source)) {
    let so = 0
    for (const sentence of plainWordsSentences(helpGuideLineForCounting(text))) {
      if (opensOnBarePronoun(sentence)) out.push({ line, sentence, rule: 'pronoun' })
      if (opensOnSo(sentence) && ++so > 1) out.push({ line, sentence, rule: 'so' })
    }
  }
  return out
}

/**
 * The lines a change wrote in a file, from `git diff -U0`: each hunk's lines on the new side. A new
 * file is every line; a hunk that only deletes writes none. The warning reads only these, so a writer
 * who fixes one sentence is not shown forty they did not write (2026-10-06, after v2.4660).
 */
export function changedLinesFromDiff(diff: string): Set<number> {
  const out = new Set<number>()
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1])
    const count = m[2] == null ? 1 : Number(m[2])
    for (let i = 0; i < count; i++) out.add(start + i)
  }
  return out
}

/** The findings on the lines a change wrote, and how many sit on lines it left alone. */
export function openersOnChangedLines(found: ReadonlyArray<PronounOpener>, changed: ReadonlySet<number>): { onChanged: PronounOpener[]; elsewhere: number } {
  const onChanged = found.filter((f) => changed.has(f.line))
  return { onChanged, elsewhere: found.length - onChanged.length }
}
