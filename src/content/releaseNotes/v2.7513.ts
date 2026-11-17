import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7513',
  date: '2026-11-16',
  title: 'Lien notices: the enclosed invoice is a paper invoice, with no portal link on it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The invoice page behind a lien notice ended with the line See your updated statement any time at, and the customer’s own portal address. A notice is mailed to the property’s owner and the original contractor, so that address went to people it was never meant for. The line no longer prints on a notice’s invoice, on paper or in its PDF.',
    'The same page opened Please find your invoice attached as a PDF, words written for an email. The printed page no longer says it.',
    'Bills sent to a customer by email are unchanged: they keep both lines.',
  ],
}

export default note
