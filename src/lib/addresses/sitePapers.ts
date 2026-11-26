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

/** A site as the lists read it: the address keys that are the place, and the development a paper may name instead. */
export type SiteScope = { keys: ReadonlySet<string>; developmentId: string | null }

/** A development's site reads by this many keys at most, asked forty at a time. */
export const DEVELOPMENT_SITE_KEYS_MAX = 200

/** A job's site: its address, every spelling answered Same place, and its development. */
export function jobSiteScope(job: SiteJob, answers: ReadonlyArray<PlaceAnswer> = []): SiteScope {
  return { keys: siteKeysOfAddress(job.job_address, answers), developmentId: job.development_id || null }
}

/**
 * A development's site (punch list #439, piece 3): the development itself, and the address of every job and bid in
 * it with each spelling answered Same place. A development has no address of its own, so a paper sent for one of its
 * jobs is the development's paper too.
 */
export function developmentSiteScope(developmentId: string | null | undefined, addresses: ReadonlyArray<string | null | undefined>, answers: ReadonlyArray<PlaceAnswer> = []): SiteScope {
  const keys = new Set<string>()
  for (const address of addresses) {
    for (const key of siteKeysOfAddress(address, answers)) {
      if (keys.size >= DEVELOPMENT_SITE_KEYS_MAX) break
      keys.add(key)
    }
  }
  return { keys, developmentId: developmentId || null }
}

/** True when a paper's row is for a site: it names the site's development, or one of its address keys. */
export function rowIsInSiteScope(row: PartyPaperRow, scope: SiteScope): boolean {
  if (scope.developmentId && row.site_development_id === scope.developmentId) return true
  return !!row.site_address_key && !row.site_development_id && scope.keys.has(row.site_address_key)
}

/** The keys to ask for, for a job: its own first. */
export function siteKeysToRead(job: SiteJob, answers: ReadonlyArray<PlaceAnswer> = []): string[] {
  return [...siteKeysOfAddress(job.job_address, answers)].slice(0, SITE_KEYS_MAX)
}

/** True when a paper's row is for the job's site: its address, a spelling answered Same place, or its development. */
export function rowIsForJobSite(row: PartyPaperRow, job: SiteJob, answers: ReadonlyArray<PlaceAnswer> = []): boolean {
  return rowIsInSiteScope(row, jobSiteScope(job, answers))
}

const waits = (l: PartyPaperLine): boolean => l.state.tone === 'waiting' || l.state.tone === 'unsent'

/**
 * The lines of a job's site: outside companies' papers for it, each once. A paper a newer one replaced is left out.
 * The ones still to sign come first, then the signed, the newest first within each.
 */
export function sitePaperLines(rows: ReadonlyArray<PartyPaperRow>, job: SiteJob, answers: ReadonlyArray<PlaceAnswer>, todayYmd: string): SitePaperLine[] {
  return sitePaperLinesInScope(rows, jobSiteScope(job, answers), todayYmd)
}

/** The same lines for any site: a job's, or a development's with every job in it. */
export function sitePaperLinesInScope(rows: ReadonlyArray<PartyPaperRow>, scope: SiteScope, todayYmd: string): SitePaperLine[] {
  const replaced = replacedPaperIds(rows)
  const seen = new Set<string>()
  const out: Array<{ line: SitePaperLine; at: string }> = []
  for (const row of rows) {
    if (!row.id || seen.has(row.id) || replaced.has(row.id)) continue
    if (row.party_contact_id == null || !rowIsInSiteScope(row, scope)) continue
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
  developmentLead: 'Papers outside companies were sent for this development, or for a job in it.',
} as const
