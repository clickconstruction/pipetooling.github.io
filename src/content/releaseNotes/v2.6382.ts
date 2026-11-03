import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6382',
  date: '2026-11-02',
  title: 'Lien desk: the courtesy notice’s words follow what happened',
  kind: 'fix',
  highlights: [
    'Under a sent notice, the footer’s Courtesy notice line read “not yet” even after one had gone and a week had passed. It now reads the day it went and that nothing has come since, and the sentence under it says “since the courtesy notice of Oct 20”, not “since the packet”.',
    'In the Send a courtesy notice window, when the GC’s Messages contact could not be read, the Text column said “no number on the job”. It now says the contact could not be opened and why.',
    'The window’s line under a dead Send button lost its doubled full stop.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
