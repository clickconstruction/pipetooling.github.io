import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3741',
  date: '2026-09-22',
  title: 'The app also updates itself while you are away — and never over unsaved work',
  kind: 'feature',
  highlights: [
    'A tab left in the background for five minutes, or sitting untouched for half an hour, now picks up a waiting update by itself. Phones left open overnight come back on the morning\'s version without anyone tapping Reload.',
    'It will not reload while anything is still saving — every save request is counted until the server answers — or while a form that knows it has unsaved edits is open (the legal-firm and sub-portal pay settings, the sub sheet portal fields, the Form Studio editor to start).',
    'Everything from the last release stands: no reload while a window is open or a field has the cursor in it, ten minutes of grace after Not now, and the pill as the fallback.',
  ],
}

export default note
