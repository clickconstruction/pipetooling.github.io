import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4323',
  date: '2026-10-01',
  title: 'Notifications: tapping one opens its page when the app is already open',
  kind: 'fix',
  highlights: [
    'Tapping a notification while the app was open, even in the background on a phone, only closed it. Now the app comes forward on the page the notification is about: the marked bid, the dispatch answer, the checklist, the returned check.',
    'With the app closed a tap already opened the page, and it still does. Settings → Your account → Test notification now opens Settings when you tap it.',
    'Each phone or computer gets the fix with the new version. Press Reload when the “A new version is ready” pill shows.',
  ],
}

export default note
