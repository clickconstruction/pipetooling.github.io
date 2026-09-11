import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3315',
  date: '2026-09-11',
  title: 'Test reports can be printed by the server',
  kind: 'infra',
  highlights: [
    'The test report paper now renders on the server too, from the same layout the modal uses — groundwork for sending PASS reports automatically. Nothing changes on screen.',
  ],
}

export default note
