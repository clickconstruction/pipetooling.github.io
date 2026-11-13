import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7094',
  date: '2026-11-12',
  title: 'Help guides use made-up names in their examples',
  kind: 'infra',
  highlights: [
    'The examples in the help guides now use made-up customers, builders, owners, job names, streets and emails in place of ones that read like real ones.',
    'Only the names changed. Every step, button and rule in a guide reads as before.',
    'A screen recording in a guide may still show an older name. Those are listed for a later pass.',
  ],
}

export default note
