import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1904',
  date: '2026-08-20',
  title: 'Tidier test-email confirmation',
  kind: 'fix',
  highlights: [
    'Sending a test email now confirms with a short "Test email sent to …" toast instead of pasting the whole subject and body into the notification.',
  ],
}

export default note
