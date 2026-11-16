import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7480',
  date: '2026-11-16',
  title: 'Liens: upload the scanned PDF of a filed affidavit (punch list #366)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Record filing… has a new press beside Take a photo of the stamped page: Upload the scanned PDF. Pick the scan from the computer and it becomes the filing’s saved copy.',
    'The scan goes up as it is, into the job’s Drive folder under Sent by us, with a name that says what it is, whose job and the day filed.',
    'A filing already recorded takes its scan too. Press link the saved copy on its row, then Upload the scanned PDF. It is saved at once.',
    'A file over 10 MB, an empty file or a file that is not a scan is refused with what to do. The photo press is unchanged for a phone.',
  ],
}

export default note
