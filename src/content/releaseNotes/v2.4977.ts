import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4977',
  date: '2026-10-08',
  title: 'Lien desk: the run saves its addresses for a certified mail label service',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'Addresses for the labels on Send the run saves a spreadsheet with one row per envelope that goes out: the name and address as the envelope reads them, split into the columns a label service asks for.',
    'The envelope number and the jobs inside ride in the reference column, so the printed labels match the checklist sheet and the dividers.',
    'Held envelopes, and anything that goes by email or by hand, are left out.',
  ],
}

export default note
