/**
 * The papers of a site, for a job at it (punch list #439, piece 3). A paper that names a site shows on every job at
 * that place: the job's own address by its cleaned key, any spelling the answers kept make the same place, and the
 * job's development when a paper names that. The list is of outside companies' papers. A teammate's own paper for a
 * site is the gate's, and is not listed here.
 *
 * Each line leads with the company, then the paper, where it stands and its day, in the words a company's own page
 * uses (`partyPaperLine`), so a paper reads the same on both.
 *
 * Pure: no React, no supabase. The read is `hooks/useSitePapers.ts`.
 */
import { pluralNoun } from '../batchWords'
import { partyPaperLine, replacedPaperIds, type PartyPaperLine, type PartyPaperRow } from '../contracts/partyPapers'
import { val } from '../valuesInPlace'
import { siteKeysOfAddress } from './paperSite'
import type { PlaceAnswer } from './lookAlikes'

/** A job as the list reads it. */
export type SiteJob = { job_address: string | null; development_id: string | null }

export type SitePaperLine = PartyPaperLine & {
  /** The company the paper is with, as the paper keeps its name. */
  company: string
}

/** The address keys a job's site reads papers by, at most this many, so a long chain of answers stays one request. */
export const SITE_KEYS_MAX = 40

/** The keys to ask for, for a job: its own first. */
export function siteKeysToRead(job: SiteJob, answers: ReadonlyArray<PlaceAnswer> = []): string[] {
  return [...siteKeysOfAddress(job.job_address, answers)].slice(0, SITE_KEYS_MAX)
}

/** True when a paper's row is for the job's site: its address, a spelling answered Same place, or its development. */
export function rowIsForJobSite(row: PartyPaperRow, job: SiteJob, answers: ReadonlyArray<PlaceAnswer> = []): boolean {
  if (job.development_id && row.site_development_id === job.development_id) return true
  const keys = siteKeysOfAddress(job.job_address, answers)
  return !!row.site_address_key && !row.site_development_id && keys.has(row.site_address_key)
}

const waits = (l: PartyPaperLine): boolean => l.state.tone === 'waiting' || l.state.tone === 'unsent'

/**
 * The lines of a job's site: outside companies' papers for it, each once. A paper a newer one replaced is left out.
 * The ones still to sign come first, then the signed, the newest first within each.
 */
export function sitePaperLines(rows: ReadonlyArray<PartyPaperRow>, job: SiteJob, answers: ReadonlyArray<PlaceAnswer>, todayYmd: string): SitePaperLine[] {
  const replaced = replacedPaperIds(rows)
  const seen = new Set<string>()
  const out: Array<{ line: SitePaperLine; at: string }> = []
  for (const row of rows) {
    if (!row.id || seen.has(row.id) || replaced.has(row.id)) continue
    if (row.party_contact_id == null || !rowIsForJobSite(row, job, answers)) continue
    seen.add(row.id)
    const company = (row.party_name ?? '').trim() || (row.signing_for ?? '').trim() || 'A company'
    out.push({ line: { ...partyPaperLine(row, replaced, todayYmd, company), company }, at: row.signed_at ?? row.sent_at ?? row.created_at ?? '' })
  }
  return out.sort((a, b) => Number(!waits(a.line)) - Number(!waits(b.line)) || b.at.localeCompare(a.at) || a.line.id.localeCompare(b.line.id)).map((x) => x.line)
}

/** `2 of 3 papers signed.`, its counts marked as values. */
export function sitePapersCountSentence(lines: ReadonlyArray<SitePaperLine>): string {
  const signed = lines.filter((l) => l.state.tone === 'signed').length
  return `${val('count', String(signed))} of ${val('count', String(lines.length))} ${pluralNoun('paper', lines.length)} signed.`
}

/** The words of the section on a job's Documents tab. */
export const SITE_PAPERS_WORDS = {
  heading: 'Papers for this site',
  lead: 'Papers outside companies were sent for the place this job is at.',
} as const
