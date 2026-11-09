import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6762',
  date: '2026-11-08',
  title: 'Settings: Training, Usage, the company documents, the clause approvals and the email log open to the owner',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The owner now sets which courses each role must take on Settings → Training, and reads how the company uses the app on Settings → Usage. Both were a dev’s.',
    'The owner adds and replaces the company’s own papers, the W-9 and the insurance certificate, on Settings → Company and Documents → Company.',
    'The owner approves or declines a change to a contract clause beside the controller and a dev.',
    'Activity logs → Most recent emails sent shows the owner every email the app sent, with its delivery status.',
  ],
}

export default note
