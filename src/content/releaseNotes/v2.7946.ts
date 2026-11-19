import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7946',
  date: '2026-11-19',
  title: 'Lien desk: each envelope of the copies to mail has its own divider page',
  kind: 'feature',
  highlights: [
    'A divider page now prints in front of each envelope’s pages. It carries the envelope’s number, the same number as its line on the mail sheet.',
    'It draws the envelope’s face: your return address, and the name and address to copy by eye.',
    'It says Do not mail this page, and that the pages to mail stop at the next divider.',
    'The divider stays on the desk. The copy kept on each job is still only what went in the envelope.',
  ],
}

export default note
