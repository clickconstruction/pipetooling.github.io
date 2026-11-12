import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6990',
  date: '2026-11-12',
  title: 'The dev seat reads a bid’s priced total, as the Pricing tab totals it',
  kind: 'feature',
  highlights: [
    'When a dev’s agent reads a bid, it now gets the priced total the Pricing grid shows, to the cent, instead of a note saying it could not.',
    'It names the price book the total came from, how many count rows are priced, and the margin the Pricing tab last saved on the bid.',
    'Cost and margin are still worked out on the Pricing tab itself, because they depend on the company’s crew rate.',
  ],
}

export default note
