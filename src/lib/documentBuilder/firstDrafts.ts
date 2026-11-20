/**
 * A builder's first draft (punch list #404, step 2): the contents the **Load the first draft** press writes into the
 * database for a builder that has none. The migration writes no words, so this is where a builder's first words come
 * from. They are placeholders, made to be typed over in the app, and no attorney has read them.
 *
 * Pure: no React, no supabase.
 */
import type { DocumentBuilderEntry } from './builders'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'

const FIRST_DRAFTS: Record<string, () => unknown> = {
  'sub-nda': () => SECRECY_PAPER_FIXTURE,
}

/** The first draft for a builder, or null for a builder with none written yet. */
export function firstDraftOf(entry: DocumentBuilderEntry): unknown | null {
  const make = FIRST_DRAFTS[entry.id]
  return make ? make() : null
}
