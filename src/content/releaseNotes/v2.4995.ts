import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4995',
  date: '2026-10-08',
  title: 'GC projects: bill the customer on a won job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A won GC job’s card has Bill the customer. It drafts this month’s pay application from the work so far, with its lines, what they hold back and what it asks.',
    'See the form in Excel or as a PDF, then send it. Email it to the customer and the architect from your own email for now.',
    'Record what the architect certified. That makes the bill the customer pays from their statement, on the job’s billing job in the Pipeline.',
    'Change the retainage there too, with a step that lowers it partway. The owner, the leaders and the controller see the window.',
  ],
}

export default note
