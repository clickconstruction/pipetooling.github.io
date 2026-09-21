import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3667',
  date: '2026-09-21',
  title: 'Property kind in one click: Residential or Commercial, asked where it matters',
  kind: 'feature',
  highlights: [
    'Put a GC on notice: a job whose property kind is not set now asks on its own row — Residential or Commercial. One click saves it and the notice dates re-read; a residential property is due a month earlier, so you see a window close before the run, not after.',
    'Jobs at the same saved property change together and say so. An answered row reads its kind with “change” beside it.',
    'Edit Job → Property record now shows “kind not set” on the row and, opened, has the Residential / Non-residential choice with Homestead. It saves on the property, so every job at that address follows.',
    'The “set it” link and the Lien desk’s Set property kind used to open Edit Job at the top, where nothing set the kind. They now land on the Property record row, already open.',
  ],
}

export default note
