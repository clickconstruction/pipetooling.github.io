/**
 * Plain words — the rules for anything a first-timer reads on a screen: a walkthrough's
 * stops, a strip's Next line, a help guide. The owner, 2026-09-29, on the Submittals
 * walkthrough: it "needs to use simpler sentences to communicate ideas. They are hard to
 * follow for someone who is not very smart." The rules were written for that tab (v2.4123)
 * and became the convention for every new or changed surface on 2026-09-30 (v2.4233,
 * `CLAUDE.md` → Help guides ship with features). This file is their one home.
 *
 * 1. One idea per sentence. No sentence over 20 words.
 * 2. Start with what the person does: *you* + a verb, and the control's exact name.
 * 3. No dashes, semicolons, parentheses or `·` lists inside a sentence.
 * 4. A trade word gets a plain word beside it the first time: *a cut sheet, the maker's
 *    page for the product*.
 * 5. Every stop has the same shape: what this is → what you do → what happens after.
 * 6. A test holds the rules; words that fail it are rewritten, never exempted.
 *
 * Rules 1 and 3 are mechanical and live here. Rules 2, 4 and 5 are each surface's own test
 * cases (`submittalTour.test.ts`, `workbenchHelp.test.ts`), since the verbs, the trade
 * words and the shape belong to the surface. `helpGuidePlainWords.test.ts` holds every
 * guide, a new one from its first commit. The guides written before the rules were all
 * rewritten by 2026-10-05 (punch list #75), so no guide is exempt.
 *
 * What is quoted is not held: a mock-UI token is the control's exact name whatever it
 * contains, an italic span in a guide is what the screen prints, quoted as printed, and a
 * guide's `:::example` panels quote real bids and are kept as written. A table row's pipes
 * are its cell walls, not words, and a cell holding only "—" is an empty cell, not glue.
 */

export const PLAIN_WORDS_MAX_SENTENCE_WORDS = 20

/** An em dash, a semicolon, a parenthesis or a dot list: two ideas glued into one sentence. */
export const PLAIN_WORDS_GLUE = /[—;()·]/

/** The sentences of a text: split after `.`, `?` or `!` followed by space. */
export function plainWordsSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Rules 1 and 3 over one text as written (a tour stop's body, a Next line). Each failure
 * is one line a person can act on; an empty list is a pass.
 */
export function plainWordsFailures(text: string): string[] {
  const failures: string[] = []
  if (PLAIN_WORDS_GLUE.test(text)) failures.push(`glued (a dash, semicolon, parenthesis or · inside a sentence): ${text}`)
  for (const sentence of plainWordsSentences(text)) {
    const words = sentence.split(/\s+/).length
    if (words > PLAIN_WORDS_MAX_SENTENCE_WORDS) failures.push(`${words} words (over ${PLAIN_WORDS_MAX_SENTENCE_WORDS}): ${sentence}`)
  }
  return failures
}

/**
 * A help guide's prose lines: the body's paragraphs and list items. Not the frontmatter,
 * not the headings, not the `:::example` panels, not blank lines.
 */
export function helpGuideProseLines(source: string): string[] {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lines: string[] = []
  let inExample = false
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line.startsWith(':::')) {
      inExample = line.length > 3
      continue
    }
    if (inExample || !line || line.startsWith('#')) continue
    lines.push(line.replace(/^-\s+/, ''))
  }
  return lines
}

/** A table row (`| a | b |`): its pipes are cell walls, not words. */
const TABLE_ROW = /^\|/

/** For counting: a link is its text, a token becomes its label, bold marks go, an italic span is one quoted word, a table row's pipes go. */
export function helpGuideLineForCounting(line: string): string {
  const counted = line
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\{\{[a-z]+:[^|}]*\|([^}]*)\}\}/g, '$1')
    .replace(/\{\{[a-z]+:[^|}]*\}\}/g, 'icon')
    .replace(/\*\*/g, '')
    .replace(/\*[^*]+\*/g, 'quoted')
  return TABLE_ROW.test(line) ? counted.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim() : counted
}

/** For the glue rule: a link's target, tokens and italic spans are not prose, read around, and a table cell holding only "—" is empty. */
export function helpGuideLineForGlue(line: string): string {
  return (TABLE_ROW.test(line) ? line.replace(/\|[ \t]*—[ \t]*(?=\|)/g, '| ') : line)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*[^*]+\*/g, '')
}

/** Rules 1 and 3 over a whole guide's prose. Each failure names its line. */
export function helpGuidePlainWordsFailures(source: string): string[] {
  const failures: string[] = []
  for (const line of helpGuideProseLines(source)) {
    if (PLAIN_WORDS_GLUE.test(helpGuideLineForGlue(line))) failures.push(`glued (a dash, semicolon, parenthesis or · inside a sentence): ${line}`)
    for (const sentence of plainWordsSentences(helpGuideLineForCounting(line))) {
      const words = sentence.split(/\s+/).length
      if (words > PLAIN_WORDS_MAX_SENTENCE_WORDS) failures.push(`${words} words (over ${PLAIN_WORDS_MAX_SENTENCE_WORDS}): ${sentence}\n      in: ${line}`)
    }
  }
  return failures
}
