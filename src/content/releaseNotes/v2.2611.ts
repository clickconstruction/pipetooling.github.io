import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2611',
  date: '2026-09-01',
  title: 'Lien forms use the real property owner',
  kind: 'fix',
  highlights: [
    'The Lien Tooling prefill (mechanic’s lien and release forms) now uses the saved property owner for the job — their name and mailing address — instead of assuming the job’s customer lives at the property.',
    'Matters whenever the customer is a GC or the owner is absentee: lien notices must reach the owner of record at their mailing address.',
  ],
}

export default note
