import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3049',
  date: '2026-09-07',
  title: 'Safety net under the Dispatch Settings job picker',
  kind: 'fix',
  highlights: [
    'The job search and saved-job labels behind Dispatch Settings → "Jobs that don’t require a note" now have 9 tests pinning what is searched, how a cancelled keystroke behaves, and how chips are labelled; no behaviour change.',
  ],
}

export default note
