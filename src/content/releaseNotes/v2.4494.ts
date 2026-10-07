import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4494',
  date: '2026-10-04',
  title: 'AIA G702-G703: a later application says when it no longer matches',
  kind: 'feature',
  highlights: [
    'When an earlier pay application changes, the later one shows a warning. It lists each previous amount that no longer matches.',
    'It is not blocked. You can still save and generate it.',
    'Use the earlier application’s amounts with one button, or keep it as it went out and type why.',
    'The warning and the reason also show on the job’s Documents tab and on the application’s chip.',
  ],
}

export default note
