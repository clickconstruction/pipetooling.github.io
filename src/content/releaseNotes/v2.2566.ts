import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2566',
  date: '2026-09-01',
  title: 'Emails now arrive from ClickTooling',
  kind: 'fix',
  highlights: [
    'Invoices, reports, estimates, and sign-in emails now show "ClickTooling" as the sender name (was "PipeTooling").',
    'Auth emails (magic links, invites) now arrive from "Click Notifications".',
    'The estimate preview\'s From line matches the real sender.',
  ],
}

export default note
