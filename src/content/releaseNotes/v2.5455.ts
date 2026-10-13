import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5455',
  date: '2026-10-13',
  title: 'Lien desk: a sent notice says where the post office has its envelopes (Docsmit train, 6b, part 1)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A notice mailed through Docsmit no longer reads as owing a tracking number. Its row under Sent says where each envelope is: in transit, delivered on a day and signed by whom, returned, or unclaimed.',
    'The notice footer lists each recipient’s envelope with the USPS number as soon as the mail service reports it.',
    'Nothing changes for a notice printed and mailed by hand.',
  ],
}

export default note
