import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3714',
  date: '2026-09-22',
  title: 'Day book: past days say how many approvals were still waiting',
  kind: 'feature',
  highlights: [
    'On any past day, an Approved line now ends with how many clock sessions were still waiting at the end of that day, worked out from the sessions’ own timestamps. Nothing had to be recorded nightly, so it is true for days before this change too.',
    'The Month view can now turn an empty run on the Approvals row amber: three working days with nothing approved while sessions were waiting.',
    'Bills, deposits and contracts still show what is left on today only; the app keeps no record of what was waiting on a past day for those.',
    'Sample accounts, digital twins and archived users no longer appear on the Day book.',
  ],
}

export default note
