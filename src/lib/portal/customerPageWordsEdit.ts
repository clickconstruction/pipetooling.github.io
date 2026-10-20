/**
 * Messages, cut 8d: Settings → What customers see → Customer page, the office's side of `customer_page_words`. Every
 * sentence of ours on a customer's page, as the code ships it (`customerPageWordRows()`), with the office's change laid
 * over it, grouped by where it shows on the page (the order and sections of `pageWords.ts`), and whether a change can be
 * saved. The table's own rules are said here before the press: both languages, 400 characters at most, and the blanks
 * the page fills kept in each (`customer_page_words_edit`). These words are the office's, in English. Pure.
 */
import { customerPageWordRows, PAPER_WORDS, type PortalPaperId } from './pageWords'

/** A sentence as the table keeps it, with who changed it (a name, when the read found one). */
export interface SavedWord {
  key: string
  en: string
  es: string
  editedAt: string | null
  editedBy: string | null
}

export interface WordLine {
  key: string
  /** A paper's part ("Its button"); null for a sentence of the page itself. */
  part: string | null
  /** As the code ships it. */
  code: { en: string; es: string }
  /** As the page reads it now: the office's change, else the code's. */
  now: { en: string; es: string }
  /** Who changed it and when; null while it reads as shipped. */
  changed: { by: string | null; at: string } | null
  /** The blanks the page fills, which both languages keep. */
  blanks: string[]
  /** False for a sentence the table does not hold yet (the next update brings it): it reads as the code's and cannot change. */
  saved: boolean
}

export interface WordGroup {
  title: string
  lines: WordLine[]
}

/**
 * Where each run of sentences shows on the page, by the first key of its section in `pageWords.ts`. A new sentence
 * joins the section it is written in.
 */
export const WORD_PLACES: readonly { from: string; title: string }[] = [
  { from: 'switchLang', title: 'Every page' },
  { from: 'onIt', title: 'Each step of their job' },
  { from: 'withCompany', title: 'The page and Home' },
  { from: 'changeWaits', title: 'A change order waiting on them' },
  { from: 'builtPct', title: 'Money: how far along' },
  { from: 'payAppN', title: 'Money: each pay application' },
  { from: 'afterThatTitle', title: 'Money: the next bill' },
  { from: 'historyTitle', title: 'Money: History' },
  { from: 'statementTitle', title: 'Money: the statement' },
  { from: 'signedTitle', title: 'Papers' },
  { from: 'milestones', title: 'Schedule' },
  { from: 'messagesSame', title: 'Messages' },
]

/** A paper's parts, in the office's words. */
export const PAPER_PARTS: Readonly<Record<string, string>> = {
  label: 'Its name',
  yours: 'Its name when it is theirs',
  why: 'Why we ask for it',
  button: 'Its button',
  button2: 'Its second button',
  onIt: 'While we are on it',
  comes: 'When it comes',
  renew: 'When it runs out',
}

/** The blanks of a sentence, as the table reads them: each once, sorted. */
export function blanksOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''))].sort()
}

const MAX = 400

/** Every sentence of ours, by where it shows, then each paper's words under the paper's name. */
export function customerPageWordGroups(saved: readonly SavedWord[]): WordGroup[] {
  const byKey = new Map(saved.map((s) => [s.key, s]))
  const lineOf = (key: string, en: string, es: string, part: string | null): WordLine => {
    const s = byKey.get(key)
    return {
      key,
      part,
      code: { en, es },
      now: s ? { en: s.en, es: s.es } : { en, es },
      changed: s?.editedAt ? { by: s.editedBy, at: s.editedAt } : null,
      blanks: blanksOf(s?.en ?? en),
      saved: !!s,
    }
  }
  const groups: WordGroup[] = []
  const papers = new Map<string, WordGroup>()
  for (const row of customerPageWordRows()) {
    const [head, paper, field] = row.key.split('.')
    if (head === 'paper' && paper && field) {
      let group = papers.get(paper)
      if (!group) {
        group = { title: `The paper: ${PAPER_WORDS[paper as PortalPaperId]?.en.label ?? paper}`, lines: [] }
        papers.set(paper, group)
      }
      group.lines.push(lineOf(row.key, row.en, row.es, PAPER_PARTS[field] ?? field))
      continue
    }
    const place = WORD_PLACES.find((p) => p.from === row.key)
    if (place || groups.length === 0) groups.push({ title: place?.title ?? WORD_PLACES[0]?.title ?? '', lines: [] })
    groups[groups.length - 1]?.lines.push(lineOf(row.key, row.en, row.es, null))
  }
  return [...groups, ...papers.values()]
}

/** Why a change cannot be saved, in the office's words; null when it can. */
export function wordEditProblem(line: WordLine, en: string, es: string): string | null {
  if (!line.saved) return 'This sentence comes with the next update. It can change once it is here.'
  if (!en.trim() || !es.trim()) return 'Write it in English and in Spanish.'
  if (en.trim().length > MAX || es.trim().length > MAX) return `Keep each one to ${MAX} characters.`
  const want = line.blanks.join()
  if (blanksOf(en).join() !== want) return blankWords('English', line.blanks)
  if (blanksOf(es).join() !== want) return blankWords('Spanish', line.blanks)
  return null
}

function blankWords(language: string, blanks: readonly string[]): string {
  if (blanks.length === 0) return `The ${language} has nothing for the page to fill in. Take out the words in braces.`
  const list = blanks.map((b) => `{${b}}`).join(', ')
  return `The ${language} keeps ${list} as written. The page fills ${blanks.length === 1 ? 'it' : 'them'} in.`
}

/** The groups with only the sentences whose words, in either language, hold every word of the search. */
export function findWordLines(groups: readonly WordGroup[], search: string): WordGroup[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...groups]
  const hit = (l: WordLine) => {
    const text = `${l.now.en} ${l.now.es} ${l.code.en} ${l.code.es} ${l.part ?? ''}`.toLowerCase()
    return words.every((w) => text.includes(w))
  }
  return groups.map((g) => ({ title: g.title, lines: g.lines.filter(hit) })).filter((g) => g.lines.length > 0)
}
