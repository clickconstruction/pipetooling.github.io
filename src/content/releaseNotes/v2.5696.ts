import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5696',
  date: '2026-10-20',
  title: 'Messages: Went out today names the customer, and the estimate text stops doubling "Estimate for"',
  kind: 'fix',
  highlights: [
    'On the Messages page, Went out today called every customer’s own thread "A number nobody has named". It now reads the customer’s name.',
    'The estimate text could read "Your estimate for Estimate for Evan Johnson is ready". It now reads "Your estimate for Evan Johnson is ready".',
  ],
}

export default note
