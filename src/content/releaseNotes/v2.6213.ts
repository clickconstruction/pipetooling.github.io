import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6213',
  date: '2026-10-31',
  title: 'The business-records affidavit, from the same window (punch list #220, PR 6 of six)',
  kind: 'feature',
  highlights: [
    'Under Start from, Swear a statement… now offers Business records, Rule 902(10): the affidavit the firm asks for to put our invoices, the clock and the job thread into evidence with nobody called to testify.',
    'Pick who signs it, the custodian of records or an employee or owner, tick the records attached from Evidence and type the page count. The paragraphs write themselves in the rule’s own words and stop rewriting once you edit them.',
    'Print it, have it signed, and file the signed copy as any statement. The window reminds you the firm serves the records and the affidavit on the other side at least 14 days before trial.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
