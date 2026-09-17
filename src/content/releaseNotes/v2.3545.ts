import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3545',
  date: '2026-09-16',
  title: 'Pipeline: a confirm dialog nothing could open is removed',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. An "Are you sure?" dialog that no button on the Pipeline ever opened has been deleted from the code; the confirms you do see are untouched.',
  ],
}

export default note
