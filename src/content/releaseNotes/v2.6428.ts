import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6428',
  date: '2026-11-03',
  title: 'Hours statements read as cards, so the job name stays whole and Print · Open stay on the screen',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Hours statements list on a person\'s desk and on a job\'s Documents tab was a five-column table. Neither place is wide enough for it, so a long job name stacked one word a line and the Print and Open buttons sat past the edge.',
    'Each statement is now a card. The job, or the worker on the job\'s own window, is the title, whole. Under it: the record number with where it stands, the period and kind, and who saved it and when.',
    'Print and Open sit small at the right of the title. On a phone, where the card is narrow, they move to a full-width row at the foot of the card, sized for a thumb.',
  ],
}

export default note
