/**
 * Where the flow's own words are typed (punch list #416, part 3; #404's step 7 left them plain). Step 7 made the
 * disclaimer, a level's meaning, the breach lines and the site lines fields. The paper holds more words than those,
 * and the flow drew them as plain text: a topic's section name, the name of a fact above the basis slider, what the
 * basis page says when the whole paper is Off, and the last step's press with the line under it.
 *
 * Each already has a path into the paper (`paperEdit.ts`). This file says which path the words on show are typed at,
 * since some places draw one of two pieces of words: a fact reads the topic's own fact name or, with none, its label.
 *
 * Pure: no React, no supabase, no clock.
 */
import type { PaperDef, PaperFlow, PaperSettings } from './documentBuilder'

/** The fact's key the kernel gives the count of what a level asks of the site (`levelFacts`). */
const SITE_FACT = 'site'

/** The path a topic's section name is typed at: *Section 5: Photos and video*. */
export function sectionPath(topicKey: string): string {
  return `topic.${topicKey}.section`
}

/**
 * The path the name of a fact above the basis slider is typed at. The last fact counts what the level asks of the
 * site, and its name is the paper's `siteFact`. Every other fact is a topic's: its own fact name when it has one, else
 * the topic's label, which is what the fact then reads.
 */
export function factPath(def: PaperDef, factKey: string): string {
  const topic = def.topics.find((t) => t.key === factKey)
  if (!topic) return factKey === SITE_FACT ? 'words.siteFact' : ''
  return topic.fact == null ? `topic.${topic.key}.label` : `topic.${topic.key}.fact`
}

/** What a field's fact is called, for a screen reader. */
export function factFieldLabel(def: PaperDef, factKey: string): string {
  const topic = def.topics.find((t) => t.key === factKey)
  return topic ? `The name of the fact for ${topic.label}` : 'The name of the fact that counts what the site must have'
}

/** The path the line under the levels is typed at while the whole paper is Off. Null while it is a count the flow works out. */
export function basisNotePath(s: PaperSettings): string | null {
  return s.off ? 'words.offSays' : null
}

/**
 * The paths of the last step's press and the line under it. Off, the press says nothing can be required and the line
 * says why. On, the press confirms and the line says what happens before it. Once pressed, the line is a count the
 * flow works out, and no field.
 */
export function confirmPaths(s: PaperSettings, flow: Pick<PaperFlow, 'done'>): { label: string; note: string | null } {
  if (s.off) return { label: 'words.nothingPress', note: 'words.offNote' }
  return { label: 'words.confirmPress', note: flow.done ? null : 'words.beforeConfirm' }
}
