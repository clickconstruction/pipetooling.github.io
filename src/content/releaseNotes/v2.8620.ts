import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8620',
  date: '2026-11-26',
  title: 'Form Studio: a form a job requires or once required says it cannot be deleted',
  kind: 'fix',
  highlights: [
    'In the Contract library’s Forms tab, a form any job requires or once required now has a grey Delete, and its row says how many jobs hold it.',
    'Before, Delete confirmed as if it would go through, and the database refused it in its own words about a constraint and a table.',
    'A form no job holds is deleted as before. If a job takes the form between the list drawing and the press, the refusal is said in plain words and the press goes grey.',
  ],
}

export default note
