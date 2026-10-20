import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5228',
  date: '2026-10-10',
  title: 'GC mode: our lien waiver on a GC job names Click Construction, LLC',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On the billing job of a GC project we build, the waiver names Click Construction, LLC as the one who releases.',
    'The email that sends it goes from Click Construction, as every GC customer email does.',
    'A plumbing job that bills a GC keeps the plumbing company on its waiver and its email.',
  ],
}

export default note
