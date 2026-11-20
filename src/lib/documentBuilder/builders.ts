/**
 * The Document builder tab's registry (punch list #404): every builder the tab lists, in the order it lists them. A
 * builder makes one kind of paper. There are two kinds. A **walked** builder is one someone walks, page by page,
 * picking a level. A **filled** builder is one page with blanks that each job fills.
 *
 * A new builder is added here, in code: the tab has no New builder press. Today the list is one, the Sub NDA. A
 * builder's contents live in the database (`document_builders`, read through `documentBuildersIo.ts`), and where a
 * builder stands is `standing.ts`.
 *
 * Pure: no React, no supabase.
 */

export type DocumentBuilderKind = 'walked' | 'filled'

export type DocumentBuilderEntry = {
  /** The builder's name in the address: `?tab=builder&builder=sub-nda`. */
  id: string
  kind: DocumentBuilderKind
  /** The owner's name for it, as the row and the open bar say it. */
  name: string
  /** One line under the name: what the builder makes. */
  says: string
  /** Who reads a revision before it goes out, in the words of the chip: an attorney for one, an insurance agent for another. */
  reader: { unread: string; readBy: string }
}

export const DOCUMENT_BUILDERS: readonly DocumentBuilderEntry[] = [
  {
    id: 'sub-nda',
    kind: 'walked',
    name: 'Sub NDA',
    says: "A job's secrecy paper for the people you bring onto it. Four levels, seven topics.",
    reader: { unread: 'Not read by an attorney', readBy: 'Read by' },
  },
]

/** The words the tab itself says. */
export const DOCUMENT_BUILDER_WORDS = {
  title: 'Document builder',
  devOnly: 'Dev only',
  lead: 'A builder makes one kind of paper from a few settings.',
  open: 'Open',
  back: 'Document builder',
  load: 'Load the first draft',
  loading: 'Loading the first draft',
  reading: 'Reading the builders',
  /** Under a builder with no contents yet. */
  notLoaded: 'This builder has no contents yet. The first draft is placeholder words, for you to change.',
} as const

export function documentBuilderById(id: string | null | undefined): DocumentBuilderEntry | null {
  return DOCUMENT_BUILDERS.find((b) => b.id === id) ?? null
}

/** The address's name for the open builder. */
export const BUILDER_PARAM = 'builder'

/** The builder the address opens, or null for the list. A name the registry does not know opens the list. */
export function openBuilderFromSearch(search: string): DocumentBuilderEntry | null {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return documentBuilderById(p.get(BUILDER_PARAM))
}

export type BuilderChipTone = 'ok' | 'wait' | 'warn'
export type BuilderChip = { tone: BuilderChipTone; words: string }
