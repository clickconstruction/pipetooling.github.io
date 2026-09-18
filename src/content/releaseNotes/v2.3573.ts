import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3573',
  date: '2026-09-17',
  title: 'Price requests: Price with robot from the table, and a Needs You card for requests past their date',
  kind: 'feature',
  highlights: [
    'On Edit Bid → Price requests, once at least one quote is in, a "Price with robot · N quotes in" button on the panel header opens the robot\'s price sheet on Pricing — the same one Pricing\'s own button opens.',
    'The Dashboard\'s Needs You card gains "past the date you asked for, with nothing in": every price request on a live bid whose needed-by has passed with no quote, longest first. Open Price requests lands on that bid\'s Pricing tab.',
  ],
}

export default note
