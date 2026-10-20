import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5381',
  date: '2026-10-13',
  title: 'Lien desk: the two server functions that talk to the mail service, behind the scenes (Docsmit train, PR 3)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Two server functions now exist for sending a notice certified through Docsmit and reading back what the post office says. Nothing on screen calls them yet.',
    'The first checks the address, makes the envelope at the mail service, uploads the PDF, prices it, sends it, and stops the batch with a clear line when the prepaid credit runs short.',
    'The second reads every open envelope each hour: the USPS number, where it is, the day it was accepted, the delivery and who signed, and files the certification once delivered.',
    'Both run against the sandbox until a developer points them at the live service. A pause switch in Developer settings holds everything.',
  ],
}

export default note
