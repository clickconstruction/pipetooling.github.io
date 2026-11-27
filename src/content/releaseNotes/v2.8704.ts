import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8704',
  date: '2026-11-27',
  title: 'Usage: the job form’s Edit tab counts which row is opened',
  kind: 'infra',
  highlights: [
    'Opening the Edit tab is half of every press on a Pipeline row, and nothing said what is pressed behind it.',
    'Each row of the Edit tab now counts its editor being opened, under the row’s own name: Team, Customer, Folders and the rest.',
    'A person’s name, a company or an address on a row’s label is never kept. Nothing on the Edit tab looks or works differently.',
    'Settings → Usage shows the counts under Edit tab row.',
  ],
}

export default note
