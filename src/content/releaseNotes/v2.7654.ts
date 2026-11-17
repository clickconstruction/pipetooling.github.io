import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7654',
  date: '2026-11-17',
  title: 'A dismissed alert stays dismissed on your other devices',
  kind: 'fix',
  highlights: [
    'When you dismiss an alert, the app now saves that to your account, so the alert does not come back on another phone or computer.',
    'Before this, the save was prepared but never sent, so a dismissal lived only on the device where you pressed it.',
    'Alerts you dismissed before today are remembered only on the device where you dismissed them.',
  ],
}

export default note
