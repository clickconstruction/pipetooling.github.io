/**
 * What a sent copy is about (the Documents spike of 2026-11-01, the owner's ask): the job or the bid the copy names,
 * drawn as a link under the line so the office reads at a glance which job a bill or a test report went for, and the
 * subject line when it says more than the title. The ids are on the row (`job_ids`, `bid_id`); the labels come from one
 * read per page (`loadSentCopyAbout`), so a job the reader may not see, or one deleted since, is drawn by its id alone.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { SentCopy } from './sentCopies'

export interface SentCopyAboutJob {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
}

export interface SentCopyAboutBid {
  id: string
  bid_number: string | number | null
  project_name: string | null
}

export interface SentCopyAboutMaps {
  jobs: ReadonlyMap<string, SentCopyAboutJob>
  bids: ReadonlyMap<string, SentCopyAboutBid>
}

export const EMPTY_ABOUT: SentCopyAboutMaps = { jobs: new Map(), bids: new Map() }

/** One link under the line: *J1076 · Sneegas Post Test* to the job window, *B244 · Emergency Animal Hospital* to the bid. */
export interface SentCopyAboutLink {
  kind: 'job' | 'bid'
  label: string
  to: string
}

/** A job's words: `J<number> · <name>`, the name alone, or *Job <id>* when the label did not read. */
export function sentCopyJobLabel(id: string, job: SentCopyAboutJob | undefined): string {
  if (!job) return `Job ${id.slice(0, 8)}`
  const num = effectiveJobLedgerNumber((job.hcp_number ?? '').trim(), job.click_number)
  const name = (job.job_name ?? '').trim()
  if (num && name) return `J${num} · ${name}`
  return num ? `J${num}` : name || `Job ${id.slice(0, 8)}`
}

/** A bid's words: `B<number> · <project>`, or *Bid <id>* when the label did not read. */
export function sentCopyBidLabel(id: string, bid: SentCopyAboutBid | undefined): string {
  if (!bid) return `Bid ${id.slice(0, 8)}`
  const num = bid.bid_number != null && String(bid.bid_number).trim() ? String(bid.bid_number).trim() : ''
  const name = (bid.project_name ?? '').trim()
  if (num && name) return `B${num} · ${name}`
  return num ? `B${num}` : name || `Bid ${id.slice(0, 8)}`
}

/** The links a line draws: each job the copy names, then its bid. A copy that names none draws nothing. */
export function sentCopyAbout(row: Pick<SentCopy, 'jobIds' | 'bidId'>, maps: SentCopyAboutMaps): SentCopyAboutLink[] {
  const out: SentCopyAboutLink[] = []
  for (const id of row.jobIds ?? []) out.push({ kind: 'job', label: sentCopyJobLabel(id, maps.jobs.get(id)), to: `/jobs?edit=${encodeURIComponent(id)}` })
  if (row.bidId) out.push({ kind: 'bid', label: sentCopyBidLabel(row.bidId, maps.bids.get(row.bidId)), to: `/bids?bidId=${encodeURIComponent(row.bidId)}` })
  return out
}

/** The subject line, when it says something the title does not; '' otherwise. */
export function sentCopySubjectLine(row: Pick<SentCopy, 'title' | 'subject'>): string {
  const subject = row.subject.trim()
  if (!subject) return ''
  const same = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  return same(subject) === same(row.title) ? '' : subject
}
