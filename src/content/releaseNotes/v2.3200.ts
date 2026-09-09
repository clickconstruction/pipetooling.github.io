import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3200',
  date: '2026-09-09',
  title: 'Where a bid is in the estimating flow',
  kind: 'feature',
  highlights: [
    'The office poster — load plans, send the RFQ, count, take off, price, review, letter, file, send — is now drawn on every bid. A thin bar under the Bid Board’s jump icons shows each phase done, next, or not yet; hover it for the summary.',
    'Open a row on the Bid Board and the full ten-step strip sits above the bid’s details, every step a door to its tab. The same strip shows under the bid title on Counts, Takeoffs, Labor, Pricing and Cover Letter.',
    'Every step reads something the bid already has — links, count rows, takeoff lines, a price, the sent date — and the tooltip says which. Review shows as not tracked until the Mark reviewed button arrives.',
  ],
}

export default note
