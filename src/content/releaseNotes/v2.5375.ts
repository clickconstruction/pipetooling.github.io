import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5375',
  date: '2026-10-12',
  title: 'Lien desk: the rules behind sending a notice by certified mail from the app, behind the scenes (Docsmit train, PR 1)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The first piece of sending a lien notice certified through Docsmit without leaving the app: the rules, with no screen or database change yet.',
    'A recipient’s typed name and address become what the mail service needs: a company or a first and last name, the street, a suite on its own line, the city, the state and the ZIP.',
    'A page count picks the envelope, the day’s cutoff turns a window’s last day into a send-by time, and whatever the mail service says about a piece folds into one status, with a needs-a-person bucket for words it has not seen.',
    'A certified send the service carries no longer nags the office for a tracking number it cannot type: the number is coming. Letter two’s clock can start from the day USPS accepted the first packet or the day it was delivered, and says which.',
  ],
}

export default note
