/**
 * The paper's own names as fields (punch list #416, part 3, the second of two PRs for the rest of the Sub NDA's words):
 * the title, the job it is written for, the company and who it protects. #404's step 7 left them out, since no step of
 * the flow shows them. They are typed on a card of the editor's Edit side, one fact a line, and each is a field at its
 * own path (`paper.title`, `paper.job`, `paper.company`, `paper.protectedParty`, `paperEdit.ts`).
 *
 * A name is a name and not a line: the plain-words rules do not hold it (`definition.ts`). It must still say
 * something, or the Publish press lists it.
 *
 * Pure: no React, no supabase.
 */
import type { PaperDef } from './documentBuilder'
import { PAPER_NAMES_PAGE, type PaperNameKey } from './paperEdit'

export type PaperNameField = {
  key: PaperNameKey
  /** Where the name is typed: `paper.title`. */
  path: string
  /** The fact's label on the card, on the left. */
  label: string
  /** What the field is, for a screen reader. */
  field: string
}

/** The four names, in the order the card lists them. */
export const PAPER_NAME_FIELDS: ReadonlyArray<PaperNameField> = [
  { key: 'title', path: `${PAPER_NAMES_PAGE}.title`, label: 'Title', field: "The paper's title" },
  { key: 'job', path: `${PAPER_NAMES_PAGE}.job`, label: 'Job', field: 'The job the paper is written for' },
  { key: 'company', path: `${PAPER_NAMES_PAGE}.company`, label: 'Your company', field: "Your company's name on the paper" },
  { key: 'protectedParty', path: `${PAPER_NAMES_PAGE}.protectedParty`, label: 'Who it protects', field: 'Who the paper protects' },
]

/** The card's words. */
export const PAPER_NAMES_WORDS = {
  title: "The paper's names",
  lead: 'Press a name and type over it. No step on the right shows these four.',
  /** Under the names: a company's name inside a line is that line's own words. */
  fine: 'A line that names the company or the job keeps its own words. Change it on its page.',
} as const

/** The card's rows: each name with the words it holds now. */
export function paperNameRows(def: PaperDef): Array<PaperNameField & { words: string }> {
  return PAPER_NAME_FIELDS.map((f) => ({ ...f, words: def[f.key] }))
}
