/**
 * What a GC reads about the papers a job requires (punch list #389, step 5), on the page they already open. The
 * shapes and the readers live in `supabase/functions/_shared/portalJobPapers.ts`, so the function that makes the
 * answer and the page that draws it read one file. This adds the page's words. Pure.
 */
import type { GcJobPaper, GcPaperBusiness } from '../../../supabase/functions/_shared/portalJobPapers'
import { formatPortalDate } from './portalPayload'

export * from '../../../supabase/functions/_shared/portalJobPapers'

const people = (n: number): string => (n === 1 ? '1 person' : `${n} people`)

/** The block's title. The Document builder's own block on this page is named *Secrecy on this job*, so this is not. */
export const GC_PAPER_TITLE = 'How we bind everyone we bring onto this job'

/** The level as one line: its name, then the kind of place it is aligned with. A mix says so. */
export function gcPaperLevel(paper: Pick<GcJobPaper, 'level'>): { chip: string; line: string | null } {
  if (!paper.level) return { chip: 'A mix of its own', line: null }
  return { chip: paper.level.label, line: paper.level.alignedWith || null }
}

/** How many have signed, as the head of the signed card, and how full its meter is. */
export function gcPaperSigned(paper: Pick<GcJobPaper, 'signed' | 'total'>): { head: string; percent: number } {
  if (paper.total === 0) return { head: 'Nobody is on this job yet', percent: 0 }
  const verb = paper.total === 1 ? 'has' : 'have'
  return { head: `${paper.signed} of ${people(paper.total)} ${verb} signed`, percent: Math.round((paper.signed / paper.total) * 100) }
}

/** One sub business: its chip, and how many of its people signed when it has more than one. */
export function gcPaperBusiness(b: GcPaperBusiness): { chip: string; done: boolean; detail: string | null } {
  const done = b.signed === b.people
  const on = done ? formatPortalDate(b.signedOn) : null
  return {
    chip: done ? (on ? `Signed ${on}` : 'Signed') : 'Not yet',
    done,
    detail: b.people > 1 ? `${b.signed} of ${people(b.people)} signed` : null,
  }
}

/** Under the signed card's meter: what a signature opens. */
export function gcPaperGate(company: string): string {
  return `Nobody opens this job in ${company || 'our'}${company ? '’s' : ''} system until they sign.`
}

/** The small print: whose paper this is, and what it does not change. */
export function gcPaperFine(company: string): string {
  const co = company || 'our company'
  return `This is ${co}’s paper for the people it brings onto your job. It does not change the agreement between ${co} and you.`
}

/** The line under the title that says a change started the count again. Null on a paper nobody has changed. */
export function gcPaperRevisionLine(paper: Pick<GcJobPaper, 'settingsRevision'>): string | null {
  return paper.settingsRevision > 1 ? `These settings are revision ${paper.settingsRevision} on this job. Everyone signs each revision.` : null
}
