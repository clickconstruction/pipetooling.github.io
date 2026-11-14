/**
 * Materials on site: what a screen says when part of its read failed (punch list #344, PR 3, v2.7175).
 *
 * The desk reads every job that holds a box, one read a job. A job whose read failed kept its error to itself, so
 * the desk drew it as a job with no boxes, $0.00 missing and every count in hand, and a site's screen left its boxes
 * out without a word. A read that failed is not a zero: these are the words that say which part is not on the screen.
 */

/** Over a site's screen: how many of its jobs are not on it. */
export function siteJobsNotLoadedWords(failed: number, total: number): string {
  if (failed <= 0) return ''
  if (failed >= total) return total === 1 ? 'This site’s job did not load, so none of its boxes are on this screen.' : `None of this site’s ${total} jobs loaded, so none of its boxes are on this screen.`
  return `${failed} of this site’s ${total} jobs did not load. ${failed === 1 ? 'Its boxes are' : 'Their boxes are'} not on this screen, and the figures leave them out.`
}

/** On the desk's site row, beside the totals of the jobs that did load. */
export function deskJobsNotLoadedWords(failed: number): string {
  if (failed <= 0) return ''
  return failed === 1 ? '1 job did not load' : `${failed} jobs did not load`
}

/** In a job's own desk row, in place of its figures. */
export function deskRowNotLoadedWords(reason: string | null | undefined): string {
  const why = (reason ?? '').trim()
  return why ? `Did not load. ${why}` : 'Did not load.'
}

/** When the read of which site each job belongs to failed. */
export const SITES_NOT_LOADED_WORDS = 'The sites did not load, so each job is on its own row.'
export const SITE_NOT_LOADED_WORDS = 'This site’s jobs did not load.'
/** When the names joined on a site did not load: the rows still add up, each spelling on its own. */
export const TIES_NOT_LOADED_WORDS = 'The names joined on this site did not load. Parts that were joined show as separate rows until they do.'
