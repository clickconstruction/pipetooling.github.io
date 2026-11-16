import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7428',
  date: '2026-11-15',
  title: 'Sub labor: a teammate’s own sheet is theirs in the dev seat and in Banking (sub labor train)',
  kind: 'fix',
  highlights: [
    'A payment recorded through the dev seat on a teammate’s own sheet now names that teammate, as the Record payment window does. Their sheets can share one payment and hold a credit.',
    'The dev seat no longer says such a sheet is crew pay that runs through payroll. It says the sheet is owed to the teammate as sub labor.',
    'Banking reads the same rule. Nothing changes on the Banking screen today: the picker already named the teammate.',
  ],
}

export default note
