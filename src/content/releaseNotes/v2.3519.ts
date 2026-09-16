import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3519',
  date: '2026-09-16',
  title: 'A card refund comes off the job’s parts cost instead of adding to it',
  kind: 'fix',
  highlights: [
    'When parts go back to Lowe’s, Home Depot or O’Reilly and the refund lands on the company card, the job’s Parts cost now goes down by the refund. Before, the refund was counted as another purchase, so the job read high by twice the amount.',
    'The same rule runs everywhere parts are added up: Job Summary and its per-person split, the job window’s Costs tab, the Charges timeline, People → Review and Overhead, the Bridge, the Projects job-history day, and Bids → Bid Costs.',
    'In the card-charge rows a refund reads as a negative amount with a small “refund” mark, so a job whose parts all went back shows a credit rather than nothing.',
    'The weekly money report and the other database-side rollups follow in the next release.',
  ],
}

export default note
