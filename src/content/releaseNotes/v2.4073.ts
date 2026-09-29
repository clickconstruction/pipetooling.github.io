import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4073',
  date: '2026-09-28',
  title: 'Subs on a phone: the sheet form’s Save is no longer under the bottom bar',
  kind: 'fix',
  highlights: [
    'Opening a sub’s sheet from Subs → Work (or → Pay) on a phone with Dispatch Mode on drew the form behind the bottom bar, so its Save button was half hidden. The form now sits above the bar, like every other sheet on a phone.',
    'The same for the small dialogs the form opens (add a subcontractor, a book entry).',
  ],
}

export default note
