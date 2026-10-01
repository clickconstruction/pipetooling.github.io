import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4301',
  date: '2026-10-01',
  title: 'Contracts: file a signed paper from the bill, for the jobs it names',
  kind: 'feature',
  highlights: [
    'View bill and Bill Customer have Add the contract beside Send one to sign. Paste the Google Drive link, or pick a scan, and nothing is sent to the customer.',
    'One signed paper can cover several of the same customer’s jobs. Tick the jobs it names. It never covers every job they have.',
    'A job the paper does not name yet hears about it on its bill. Open the paper, then press Add this job to it.',
    'The customer’s page has an Agreements card: each signed paper with its jobs, Change the jobs, Take it off, and their open jobs with no agreement.',
  ],
}

export default note
