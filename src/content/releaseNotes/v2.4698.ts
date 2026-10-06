import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4698',
  date: '2026-10-06',
  title: 'Release of Lien: a draft keeps the leader you picked to sign',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In the Release of Lien window, the Signs pick is saved with the draft. A draft you come back to opens on the leader you picked, the one its Signed by line names.',
    'Before, a reopened draft went back to the default leader. Send it to his desk then asked the wrong person to sign a page that printed another name.',
    'A draft whose leader has since been archived opens on the job\'s default.',
  ],
}

export default note
