import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5565',
  date: '2026-10-15',
  title: 'Training: a place for each course’s policy and each person’s passes, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The database now keeps, for each training course, whether it is on, who must take it, how long a pass is good for, and the day from which everyone must take it again. The OSHA 30 refresher is seeded, switched off.',
    'A person’s passed lessons and their passes of the final check are kept as records: the day, the score and the version of the course’s words. Where a person stands, red, amber or green, is read from those records by one rule, the same rule the screens use.',
    'The office team can read everyone’s standing for the People page and Settings; everyone else reads their own. A training-mode account and a digital twin cannot record a pass.',
  ],
}

export default note
