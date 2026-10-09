import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5054',
  date: '2026-10-09',
  title: 'Division 22 rules: the groundwork for the rules manager',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The first part of the Division 22 rules manager is in, behind the scenes. It works out which fixture names each rule decides, which rules never get to decide, and what a change to a rule would move before it is saved.',
    'Nothing changes on screen yet. The manager window comes in the next parts.',
  ],
}

export default note
