import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5320',
  date: '2026-10-12',
  title: 'Messages: a flow saves all at once, and the money team prices a drafted change order',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Groundwork for Settings → Flows. Nothing changes on screen yet.',
    'Saving a flow saves every change together, or none. If someone saved it while you edited, it says so.',
    'Remind now clears a hold on that step.',
    'The money team can price a change order the office drafted, until it goes to the customer.',
  ],
}

export default note
