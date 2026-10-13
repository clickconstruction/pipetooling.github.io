import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5384',
  date: '2026-10-13',
  title: 'Lien desk: the rules for a run that mails through the mail service, and its Developer switches, behind the scenes (Docsmit train, PR 5a)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The rules behind the run window’s coming Mail through Docsmit button: which envelopes can go, what the mail service is asked for each, the price against the balance, and what a send’s answer means.',
    'The strip that says when to send so the month still counts: the window’s last day less a buffer, at the mail service’s cutoff, or a plain line that this month mails late.',
    'The Developer settings for the connection read from one place with every default filled: paused, the return receipt, the cutoff, the buffer, the credit warning, the poll.',
    'Nothing on screen yet. The button and the review come next, once the run’s new look has landed.',
  ],
}

export default note
