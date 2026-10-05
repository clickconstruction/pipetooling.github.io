import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4574',
  date: '2026-10-05',
  title: 'Documents: every email we send outside is kept',
  kind: 'feature',
  highlights: [
    'Every email the app sends to a customer, a GC, a supplier, a sub or a law firm is now kept as it was read, with its attachments.',
    'On a job’s Documents tab, Sent from this job now lists lien notices, demand letters, releases, hazmat notices, test reports, estimates, contract emails and supply house job accounts.',
    'Statements to a GC, price requests to a supply house, bid room links and notices to a law firm are kept too. They cover no single job, so a place to browse them is coming to the Documents page.',
    'Mail to our own team, such as digests and reminders, is not kept as a send.',
  ],
}

export default note
