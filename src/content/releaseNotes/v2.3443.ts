import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3443',
  date: '2026-09-14',
  title: 'Database types regenerated after the evening migrations',
  kind: 'fix',
  highlights: ['No visible change. The app’s generated database types now match the day’s applied migrations exactly (the Pipeline percent date, the sub-sheet cleanup, the retired stage-window columns).'],
}

export default note
