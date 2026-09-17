import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3551',
  date: '2026-09-17',
  title: 'A test that failed at random is fixed',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. A check on the Accounts Receivable close-out strip was reading the screen a moment too early and failing at random on unrelated work; it now waits properly, so a red build means something is really wrong.',
  ],
}

export default note
