import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2985',
  date: '2026-09-07',
  title: 'Safety net under the county suggestion',
  kind: 'fix',
  highlights: [
    'The county suggestion on the property legal panel, the org\'s own City = County additions, and the appraisal-district links now have 11 tests pinning their behaviour.',
    'A malformed line such as "= Orphan" in the Settings county list is now skipped as intended, instead of being kept as a nameless entry.',
  ],
}

export default note
