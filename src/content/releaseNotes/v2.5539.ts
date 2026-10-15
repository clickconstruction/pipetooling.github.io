import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5539',
  date: '2026-10-14',
  title: 'Phone and texts: the pickers list only the people on the team',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Settings → Phone and texts, Who gets a new message and Company phone seats listed the sample accounts, the digital twins and archived people beside the team. Both pickers now list the office team alone, as every other picker in the app does.',
    'A seat already saved to someone no longer listed still shows, as Someone no longer on the team, until it is changed.',
  ],
}

export default note
