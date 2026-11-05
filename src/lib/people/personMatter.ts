import { legalStageLabel, type LegalMatterRow } from '../legal/legalMatters'

/**
 * A matter on a person (v2.6543, punch list #269 PR 3a): the Legal desk's matter shape — the narrative for the firm,
 * the documents, the timeline of planned steps and events — standing on a people row instead of a Collections payer,
 * drawn on the HR file's Matter view. The words here: what the chip on the fact strip says, what the view says when
 * none stands, and what the stage reads as.
 */

export const PERSON_MATTER_NONE_MAIN = 'No matter on this person.'
export const PERSON_MATTER_NONE_SUB = 'A matter holds the analysis for counsel: the narrative, the documents with what each one shows, and the timeline of steps and events. Open one when the record grows past the file.'
export const PERSON_MATTER_OPEN_LABEL = 'Open a matter…'

/** The stage in the desk's words, without the firm prefix: `Under review` · `In house` · `With the firm · Demand`. */
export function personMatterStageWords(m: Pick<LegalMatterRow, 'stage' | 'closed_at' | 'closed_reason'>): string {
  if (m.closed_at) return `Closed${m.closed_reason ? ` · ${m.closed_reason}` : ''}`
  return legalStageLabel(m.stage)
}

/** The fact strip's chip: `Matter · Under review`; null when none stands. */
export function personMatterChipWords(m: Pick<LegalMatterRow, 'stage' | 'closed_at' | 'closed_reason'> | null): string | null {
  return m ? `Matter · ${personMatterStageWords(m)}` : null
}

/** One line under the matter's name: how long it has stood and whether anything is written. */
export function personMatterStandingWords(m: Pick<LegalMatterRow, 'narrative_md' | 'updated_at'>, counts: { documents: number; entries: number }): string {
  const parts: string[] = []
  parts.push(m.narrative_md && m.narrative_md.trim() ? 'narrative written' : 'no narrative yet')
  parts.push(counts.documents === 1 ? '1 document' : `${counts.documents} documents`)
  parts.push(counts.entries === 1 ? '1 step or event' : `${counts.entries} steps and events`)
  return parts.join(' · ')
}
