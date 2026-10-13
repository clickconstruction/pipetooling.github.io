import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5301',
  date: '2026-10-12',
  title: 'GC mode: Papers on a job shows every company’s papers, and what is missing first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Each GC project’s card has Papers. It opens a grid with a row for each company on the job and a column for each paper.',
    'A dot shows each paper as done, waiting, none yet, late, running out soon or lapsed. The counts in the title filter the grid.',
    'On a job we are bidding, a strip before bid day names the insurance that ran out, the late quotes and the quotes still due.',
    'List shows each paper with the step it finishes and where the person is.',
  ],
}

export default note
