import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5388',
  date: '2026-10-13',
  title: 'Legal portal: counsel sees what the post office said about each mailed notice (Docsmit train, PR 8)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A notice mailed through the mail service now tells the law firm, per recipient, the day USPS accepted it, the day it was delivered and who signed. A returned or unclaimed copy says so.',
    'The Certification PDF, the proof of mailing and delivery, opens from the firm’s packet as a short-lived link.',
    'When a filed affidavit’s copy goes out through the mail service, the affidavit’s served day fills from the day USPS accepted it.',
    'Nothing shows until the first notice goes out through the mail service.',
  ],
}

export default note
