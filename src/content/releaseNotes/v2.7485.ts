import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7485',
  date: '2026-11-16',
  title: 'Lien desk: one property whole (the ground)',
  kind: 'infra',
  highlights: [
    'The Lien desk can now gather its jobs by the property they stand on, and say in one line where each job’s notice and affidavit stand. Nothing on screen changes yet; the property card comes next.',
    'A notice that already went says the day it went, whether the run recorded it or a person recorded it by hand.',
    'The words are the Board’s own, so a property will never describe a paper differently from the list it sits in.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
