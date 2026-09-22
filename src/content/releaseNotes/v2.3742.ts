import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3742',
  date: '2026-09-22',
  title: 'Unsaved edits survive an update',
  kind: 'feature',
  highlights: [
    'The legal-firm and sub-portal pay settings, the sub sheet portal fields and the Form Studio keep your unsaved edits in the tab while you work. If the app updates itself under them, the edits come straight back after the reload, marked unsaved, with a note saying so — save when ready.',
    'Those editors no longer hold an update off while they have unsaved edits; only a save still in flight does. A draft lives only in its own tab and is dropped after a day.',
  ],
}

export default note
