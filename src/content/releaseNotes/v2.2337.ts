import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2337',
  date: '2026-08-26',
  title: 'Bad bill dates can never fool the pay-speed math again',
  kind: 'fix',
  highlights: [
    'A bill dated after its own payment used to count as an instant same-day payment and drag the medians down. Those pairs are now shut out of the math permanently.',
    'They show up in the Data health list with a "billed after paid" chip and the same type-the-date fix, and land in Quickfill\'s Missing bill dates station for the assistants.',
  ],
}

export default note
