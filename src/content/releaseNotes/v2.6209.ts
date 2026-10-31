import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6209',
  date: '2026-10-31',
  title: 'A sworn statement has a place on the Legal desk’s Timeline (punch list #220, PR 2 of six)',
  kind: 'infra',
  highlights: [
    'The Legal desk’s Timeline now knows a sworn statement or a declaration: it sits on the Said lane on the day it is about, with its title, its paragraphs and who swears it.',
    'The firm reads it on its portal as a sworn statement by the office’s team or a declaration by a witness, and a draft says it is a draft. The office can hold one from counsel like a planned step.',
    'The office’s county for the venue line is a setting, Guadalupe to start. The window that writes statements comes in the next PR.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
