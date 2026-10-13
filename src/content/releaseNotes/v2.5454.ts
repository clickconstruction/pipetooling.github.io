import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5454',
  date: '2026-10-13',
  title: 'Lien desk: the run mails its envelopes through Docsmit, after a review of each one (Docsmit train, PR 5b)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Once a developer has set the mail service up, the run gets a second button beside Print the packet: Mail through Docsmit, with the count of certified envelopes that can go.',
    'Pressing it makes each envelope’s PDF, checks each address with the service, and opens a review: one envelope at a time, the way it will be mailed, with the address in the window, the code on the owner’s letter, the price and the balance.',
    'One button mails them all. A mailed card reads mailed through Docsmit, number coming; the USPS number arrives within the hour and nobody types it. An envelope the service cannot mail stays on paper with its reason.',
    'A strip above the cards says the day and time to send by so the month still counts, and turns red once that has passed.',
  ],
}

export default note
