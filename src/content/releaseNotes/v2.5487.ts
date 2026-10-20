import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5487',
  date: '2026-10-13',
  title: 'Lien desk: three doors on an envelope that came back (Docsmit train, 6b, part 3)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under a sent notice, an envelope Docsmit returned, could not deliver or refused now has three doors: send a plain copy, mail to another address, handled by hand.',
    'A plain copy goes First Class to the same address through Docsmit with one press. Another address takes a name and one line, checked before it can go, and mails the same letter again certified.',
    'Handled by hand records a courier or a visit in a few words. Each door marks the envelope answered, so Do now stops asking.',
  ],
}

export default note
