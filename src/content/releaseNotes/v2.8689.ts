import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8689',
  date: '2026-11-26',
  title: 'Ready to bill: a test job sends no notice',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Voiding a test job’s last billed bill moves the job back to Ready to bill. That move sent the Ready to bill email and push to the people on the office’s list, as if the job were real.',
    'A test job, one whose name or customer name starts with ZZ, now sends no Ready to bill notice, however it gets there.',
    'To see the notice for a test job, use Preview & test in the Ready to Bill notifications window. It still works for one.',
    'Nothing changes for a real job, and the paid notices are as they were.',
  ],
}

export default note
