import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3771',
  date: '2026-09-23',
  title: 'Job window test: the History tab check waits for the window to load first',
  kind: 'fix',
  highlights: [
    'A test of the Job window’s History tab clicked the tab while the window was still loading its first data, and on a busy computer it gave up before the day grid appeared — it now lets the window finish loading before clicking, the way its neighbouring tests already did.',
    'Nothing changes in the app itself: the History tab still loads its day grid on the first visit and keeps it when you switch away.',
  ],
}

export default note
