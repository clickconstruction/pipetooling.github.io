import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8242',
  date: '2026-11-21',
  title: 'HR files: an agent’s words for a dropped or stale plan end each sentence once',
  kind: 'fix',
  highlights: [
    'When an agent tries to apply a plan that was dropped, it is told who dropped it and why. A reason that ended in a full stop was read back with two.',
    'A plan that went stale is told why as well. A reason with no full stop ran straight into the next sentence.',
    'Both now end the reason with one full stop. Nothing changes on People → HR, and nothing changes in what a plan may do.',
  ],
}

export default note
