import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3787',
  date: '2026-09-23',
  title: 'The law firm’s portal shows where each job stands and the paper that went out — the Lien desk’s own timeline and envelopes',
  kind: 'feature',
  highlights: [
    'The firm’s Paper tab (and the Legal desk’s, and the printed packet) replaces the five-column lien clock with the job’s timeline — every Chapter 53 step on one rail with today marked and one “Next on the path” line — read from the same kernel the Lien desk draws, so the office and the firm never disagree on a date. The § 53.057 step carries the contract-end date, the retainage held and the payment bond as words when the job holds them.',
    'Lien filings list as envelopes: one row per paper that went out — the day, by the run or by hand, the method and tracking, the claim as printed, every job’s share when one paper covered several, the months as printed with “as information” where a month’s window had already closed, and the saved copy. Affidavits and releases read filed · served, with the county and recording number.',
    'The portal function now sends the three retainage facts and the job’s creation date, so a job with no clock hours is dated from the month it was made — the same rule as the desk.',
    'Nothing is typed and nothing new is stored; the firm still cannot mark anything paid, edit a job or reach the customer.',
  ],
}

export default note
