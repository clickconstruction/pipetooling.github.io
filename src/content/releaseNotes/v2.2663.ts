import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2663',
  date: '2026-09-02',
  title: 'Lien paperwork on your letterhead',
  kind: 'feature',
  highlights: [
    'The § 53.056 notice, lien affidavit, and release of record now print and email on your company letterhead — name, license line, and contact block from your invoice settings — with a job/date reference strip and a filled-in-form layout (muted labels, bold answers on ruled lines).',
    'Recorded notices show a Delivery record box on the document itself: each recipient, how it was served, the tracking number, and the date.',
    'The demand letter and the lien release forms picked up the same look — matching letterhead, a claimant signature line on the notice, and page footers with the statute citation and page numbers. The notice’s “party with whom claimant contracted if different” line now appears only when it applies.',
    'The statutory wording is untouched — this is the same dressing a law firm’s letterhead adds, and § 53.056 only requires the form be followed “substantially.”',
  ],
}

export default note
