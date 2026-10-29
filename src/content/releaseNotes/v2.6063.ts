import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6063',
  date: '2026-10-29',
  title: 'Safety orange that reads: the Bids tabs, the form hints and the orange buttons',
  kind: 'fix',
  highlights: [
    'The Counts, Pricing and Cover Letter tabs on Bids keep their safety orange. The open tab writes its name in near-black on the orange, and a closed one in a darker orange that reads on the page in light mode and a pale orange in dark.',
    'The Required hints under a dimmed Save on the customer, job, project, bid, inspection, report and checklist forms, and the Paste data and Select a template hints, take the same readable orange.',
    'Import from /Tooling, Paste counts, the two bid scripts, the schedule’s Share and Send now and the Bid Board’s pending count keep their orange fill and write their words in near-black, the way Clock In does.',
    'The orange icons on the Pipeline stay as they are.',
  ],
}

export default note
